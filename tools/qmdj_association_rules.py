"""
奇門遁甲 × K-Bar 關聯規則分析
================================
使用 FP-Growth 挖掘奇門盤面標籤組合與市場漲跌/路徑之間的關聯規則，
並匯出 CSV + HTML 報表。

使用方式:
    python tools/qmdj_association_rules.py
"""

import os
import sys
import pandas as pd
from mlxtend.frequent_patterns import fpgrowth, association_rules
from datetime import datetime
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(__file__))
from qmdj_feature_engineering import extract_features, ANALYSIS_FEATURES

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# ============================================================
# 1. 資料前處理
# ============================================================

# 目標變數對照
DIRECTION_MAP = {1: "方向=漲", 0: "方向=平", -1: "方向=跌"}
PATH_PREFIX = "路徑="


def _encode_features(df: pd.DataFrame) -> pd.DataFrame:
    """將奇門特徵欄位轉為 One-Hot 布林矩陣。"""
    encoded_parts = []
    for col in ANALYSIS_FEATURES:
        if col not in df.columns:
            continue
        if df[col].dtype == bool or set(df[col].dropna().unique()) <= {True, False}:
            encoded_parts.append(
                pd.DataFrame({col: df[col].astype(bool)})
            )
        else:
            dummies = pd.get_dummies(df[col].astype(str), prefix=col)
            encoded_parts.append(dummies.astype(bool))
    return pd.concat(encoded_parts, axis=1)


def load_and_encode_binary(csv_path: str, direction: int) -> tuple[pd.DataFrame, list[str]]:
    """
    讀取資料集，針對單一方向做二元編碼。

    Parameters
    ----------
    csv_path : str
        資料集 CSV 路徑。
    direction : int
        1 = 做多分析（目標=漲），-1 = 做空分析（目標=跌）。

    Returns
    -------
    (encoded_df, target_columns)
    """
    df = pd.read_csv(csv_path)
    df = extract_features(df)

    encoded = _encode_features(df)

    # 二元目標：該方向 vs 其他
    label = "方向=漲" if direction == 1 else "方向=跌"
    encoded[label] = (df["direction_2h"] == direction).astype(bool)
    target_columns = [label]

    return encoded, target_columns


# ============================================================
# 2. 關聯規則挖掘
# ============================================================

def mine_rules(encoded_df: pd.DataFrame,
               target_columns: list[str],
               min_support: float = 0.05,
               min_confidence: float = 0.5) -> pd.DataFrame:
    """
    挖掘頻繁項目集並產生關聯規則。
    只保留 consequents 包含目標變數的規則。
    """
    print(f"  FP-Growth: min_support={min_support}")
    freq = fpgrowth(encoded_df, min_support=min_support, use_colnames=True)
    print(f"  頻繁項目集: {len(freq)} 個")

    if freq.empty:
        print("  無頻繁項目集，請降低 min_support。")
        return pd.DataFrame()

    print(f"  產生關聯規則: min_confidence={min_confidence}")
    rules = association_rules(freq, metric="confidence",
                              min_threshold=min_confidence)
    print(f"  原始規則數: {len(rules)}")

    if rules.empty:
        return rules

    # 只保留 consequents 含目標變數的規則
    target_set = set(target_columns)
    mask = rules["consequents"].apply(
        lambda x: len(x & target_set) > 0
    )
    rules = rules[mask].copy()

    # 只保留 antecedents 不含目標變數的規則（避免目標互推）
    mask2 = rules["antecedents"].apply(
        lambda x: len(x & target_set) == 0
    )
    rules = rules[mask2].copy()

    # 增加 count 欄位與覆蓋率
    n = len(encoded_df)
    rules["count"] = (rules["support"] * n).round().astype(int)

    # 覆蓋率：這條規則抓到的目標筆數 / 目標總筆數
    # target 的總筆數 = 目標欄位為 True 的數量
    target_col = list(target_set)[0]  # 二元分析只有一個目標
    target_total = encoded_df[target_col].sum()
    if target_total > 0:
        rules["coverage"] = (rules["count"] / target_total).round(4)
    else:
        rules["coverage"] = 0.0

    # 只保留 consequents 全為目標變數的規則（不要混合結論）
    rules = rules[rules["consequents"].apply(
        lambda x: x.issubset(target_set)
    )].copy()

    # 去重：同樣的 (antecedents, consequents) 只保留 lift 最高的
    rules["_ant_str"] = rules["antecedents"].apply(
        lambda x: "|".join(sorted(x))
    )
    rules["_con_str"] = rules["consequents"].apply(
        lambda x: "|".join(sorted(x))
    )
    rules = (rules.sort_values("lift", ascending=False)
             .drop_duplicates(subset=["_ant_str", "_con_str"], keep="first")
             .drop(columns=["_ant_str", "_con_str"]))

    # 過濾 lift < 1 的規則（比隨機差的沒有意義）
    before = len(rules)
    rules = rules[rules["lift"] > 1.0].copy()
    removed = before - len(rules)
    if removed > 0:
        print(f"  移除 lift ≤ 1 的規則: {removed} 條")

    # 移除子集冗餘：如果規則 B 的前提是規則 A 的超集，
    # 且結論相同、lift 沒有更好，才移除 B（保留精簡的 A）
    # 如果 B 的 lift 比 A 高（組合比單一更準），則保留 B
    rules = rules.sort_values("lift", ascending=False).reset_index(drop=True)
    drop_idx = set()
    LIFT_IMPROVE_THRESHOLD = float(os.getenv("RULES_LIFT_IMPROVE_THRESHOLD", "0.05"))

    for i in range(len(rules)):
        if i in drop_idx:
            continue
        for j in range(len(rules)):
            if j in drop_idx or i == j:
                continue
            ant_i = rules.loc[i, "antecedents"]
            ant_j = rules.loc[j, "antecedents"]
            con_i = rules.loc[i, "consequents"]
            con_j = rules.loc[j, "consequents"]
            lift_i = rules.loc[i, "lift"]
            lift_j = rules.loc[j, "lift"]

            # j 的前提是 i 的超集，且結論相同
            if ant_i < ant_j and con_i == con_j:
                # 組合規則 j 的 lift 有明顯提升才保留
                if lift_j <= lift_i * (1 + LIFT_IMPROVE_THRESHOLD):
                    drop_idx.add(j)
            # 結論互為子集且前提相同
            elif ant_i == ant_j and con_i < con_j:
                drop_idx.add(j)
            elif ant_i == ant_j and con_j < con_i:
                drop_idx.add(i)
                break

    if drop_idx:
        rules = rules.drop(index=drop_idx).reset_index(drop=True)
        print(f"  移除子集冗餘: {len(drop_idx)} 條")

    # 最終排序
    rules = rules.sort_values("lift", ascending=False).reset_index(drop=True)
    print(f"  有效規則數（最終）: {len(rules)}")

    return rules


# ============================================================
# 3. 報表匯出
# ============================================================

def _frozenset_to_str(fs):
    """將 frozenset 轉為可讀字串。"""
    return " + ".join(sorted(fs))


def export_csv(rules: pd.DataFrame, filepath: str):
    """匯出 CSV 報表。"""
    out = rules.copy()
    out["antecedents"] = out["antecedents"].apply(_frozenset_to_str)
    out["consequents"] = out["consequents"].apply(_frozenset_to_str)
    cols = ["antecedents", "consequents", "support", "confidence",
            "lift", "conviction", "count"]
    out = out[[c for c in cols if c in out.columns]]
    out.to_csv(filepath, index=False, encoding="utf-8-sig")
    print(f"  CSV 報表: {filepath}")


def _build_html_report(rules: pd.DataFrame, csv_path: str,
                       n_features: int, direction: int) -> str:
    """產生單一方向的 HTML 報表內容。"""
    df_raw = pd.read_csv(csv_path)
    n = len(df_raw)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    is_bull = direction == 1
    title = "做多（漲）" if is_bull else "做空（跌）"
    color = "#2e7d32" if is_bull else "#c62828"
    bg_color = "#e8f5e9" if is_bull else "#ffebee"
    th_color = "#4caf50" if is_bull else "#e53935"

    # 基準率
    target_count = (df_raw["direction_2h"] == direction).sum()
    base_rate = target_count / n

    # 欄位中英對照
    COL_RENAME = {
        "antecedents": "前提條件（奇門盤面）",
        "consequents": "結論",
        "support": "支持度",
        "confidence": "置信度",
        "lift": "提升度",
        "conviction": "確信度",
        "coverage": "覆蓋率",
        "count": "筆數",
    }

    def rules_to_html_table(r, max_rows=50):
        if r.empty:
            return "<p>無符合條件的規則</p>"
        r = r.head(max_rows).copy()
        r["antecedents"] = r["antecedents"].apply(_frozenset_to_str)
        r["consequents"] = r["consequents"].apply(_frozenset_to_str)
        cols = ["antecedents", "consequents", "support", "confidence",
                "lift", "coverage", "conviction", "count"]
        r = r[[c for c in cols if c in r.columns]]
        for c in ["support", "confidence", "lift", "conviction"]:
            if c in r.columns:
                r[c] = r[c].round(4)
        if "coverage" in r.columns:
            r["coverage"] = (r["coverage"] * 100).round(1).astype(str) + "%"
        r = r.rename(columns=COL_RENAME)
        return r.to_html(index=False, classes="rule-table", border=0)

    # 方向分布
    dir_dist = df_raw["direction_2h"].value_counts().sort_index()

    return f"""<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>奇門遁甲 {title}分析報表</title>
<style>
  body {{ font-family: "Microsoft JhengHei", "PingFang TC", sans-serif; margin: 40px; background: #f8f9fa; color: #333; }}
  h1 {{ color: {color}; border-bottom: 3px solid {color}; padding-bottom: 10px; }}
  h2 {{ color: #2980b9; margin-top: 40px; }}
  .summary {{ background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 20px 0; }}
  .summary table {{ border-collapse: collapse; }}
  .summary td {{ padding: 6px 16px; }}
  .summary td:first-child {{ font-weight: bold; color: #555; }}
  .base-rate {{ background: {bg_color}; padding: 12px 20px; border-radius: 8px; font-size: 1.1em; margin: 15px 0; display: inline-block; }}
  .rule-table {{ border-collapse: collapse; width: 100%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
  .rule-table th {{ background: {th_color}; color: #fff; padding: 10px 12px; text-align: left; }}
  .rule-table td {{ padding: 8px 12px; border-bottom: 1px solid #eee; }}
  .rule-table tr:hover {{ background: #f0f7ff; }}
  .dist-table {{ border-collapse: collapse; margin: 10px 0; }}
  .dist-table th, .dist-table td {{ padding: 6px 14px; border: 1px solid #ddd; }}
  .dist-table th {{ background: #ecf0f1; }}
  .note {{ color: #888; font-size: 0.9em; margin-top: 30px; }}
</style>
</head>
<body>

<h1>奇門遁甲 × K-Bar {title}分析報表</h1>

<div class="summary">
<table>
  <tr><td>資料來源</td><td>{os.path.basename(csv_path)}</td></tr>
  <tr><td>資料筆數</td><td>{n}</td></tr>
  <tr><td>特徵數（One-Hot 後）</td><td>{n_features}</td></tr>
  <tr><td>有效規則數</td><td>{len(rules)}</td></tr>
  <tr><td>產出時間</td><td>{now}</td></tr>
</table>
</div>

<h2>市場分布</h2>
<table class="dist-table">
  <tr><th>方向</th><th>筆數</th><th>比例</th></tr>
  <tr><td>漲</td><td>{dir_dist.get(1, 0)}</td><td>{dir_dist.get(1, 0)/n*100:.1f}%</td></tr>
  <tr><td>平</td><td>{dir_dist.get(0, 0)}</td><td>{dir_dist.get(0, 0)/n*100:.1f}%</td></tr>
  <tr><td>跌</td><td>{dir_dist.get(-1, 0)}</td><td>{dir_dist.get(-1, 0)/n*100:.1f}%</td></tr>
</table>

<div class="base-rate">
  基準率（隨機猜「{'漲' if is_bull else '跌'}」的機率）：<b>{base_rate*100:.1f}%</b>
  — 置信度必須高於此值，規則才有意義
</div>

<h2>關聯規則（依提升度排序）</h2>
<p>以下每條規則的含義：當奇門盤面出現「前提條件」時，{'漲' if is_bull else '跌'}的機率為「置信度」，
相比隨機猜測提升了「提升度」倍。</p>
{rules_to_html_table(rules, 50)}

<div class="note">
<p><b>指標說明：</b></p>
<ul>
  <li><b>支持度</b>：該規則在全部資料中出現的比例</li>
  <li><b>置信度</b>：前提出現時，{'漲' if is_bull else '跌'}的條件機率（需高於基準率 {base_rate*100:.1f}%）</li>
  <li><b>提升度</b>：比隨機猜測好多少倍。&gt;1.2 值得關注，&gt;1.5 強關聯</li>
  <li><b>覆蓋率</b>：這條規則抓到了所有{'漲' if is_bull else '跌'}裡面的幾%。越高代表這個條件出現頻率越高、影響範圍越廣</li>
  <li><b>確信度</b>：前提對結論的依賴強度，越高表示規則越可靠</li>
  <li><b>筆數</b>：符合條件的實際資料量，建議 &gt;20 筆才可信</li>
</ul>
<p>報表產出時間: {now}</p>
</div>

</body>
</html>"""


def export_report(rules: pd.DataFrame, csv_path: str,
                  n_features: int, direction: int,
                  output_dir: str):
    """匯出單一方向的 CSV + HTML 報表。"""
    suffix = "bull" if direction == 1 else "bear"
    label = "做多" if direction == 1 else "做空"

    os.makedirs(output_dir, exist_ok=True)

    # CSV
    csv_out = os.path.join(output_dir, f"rules_{suffix}.csv")
    out = rules.copy()
    out["antecedents"] = out["antecedents"].apply(_frozenset_to_str)
    out["consequents"] = out["consequents"].apply(_frozenset_to_str)
    cols = ["antecedents", "consequents", "support", "confidence",
            "lift", "conviction", "coverage", "count"]
    out = out[[c for c in cols if c in out.columns]]
    out.to_csv(csv_out, index=False, encoding="utf-8-sig")
    print(f"  {label} CSV: {csv_out}")

    # HTML
    html_out = os.path.join(output_dir, f"rules_{suffix}.html")
    html = _build_html_report(rules, csv_path, n_features, direction)
    with open(html_out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"  {label} HTML: {html_out}")


# ============================================================
# 4. 主流程
# ============================================================

def run_analysis(csv_path: str,
                 output_dir: str = "output",
                 min_support: float = 0.04,
                 min_lift: float = 1.1):
    """
    分別針對做多（漲）與做空（跌）執行關聯規則分析，各自匯出報表。

    Parameters
    ----------
    csv_path : str
        資料集 CSV 路徑。
    output_dir : str
        報表輸出目錄。
    min_support : float
        最小支持度。
    min_lift : float
        最小提升度（取代 confidence 作為主要篩選）。
    """
    print("=" * 60)
    print("奇門遁甲 × K-Bar 關聯規則分析（多空分離）")
    print("=" * 60)

    df_raw = pd.read_csv(csv_path)
    n = len(df_raw)
    base_up = (df_raw["direction_2h"] == 1).mean()
    base_down = (df_raw["direction_2h"] == -1).mean()

    all_rules = {}

    conf_over_base = float(os.getenv("RULES_CONF_OVER_BASE", "0.02"))
    for direction, label in [(1, "做多"), (-1, "做空")]:
        base_rate = base_up if direction == 1 else base_down
        # 用基準率作為 confidence 門檻（只需比隨機好就算有效）
        min_conf = base_rate + conf_over_base

        print(f"\n{'='*40}")
        print(f"  {label}分析（基準率 {base_rate*100:.1f}%，confidence 門檻 {min_conf*100:.1f}%）")
        print(f"{'='*40}")

        print(f"\n[1/3] 載入與編碼")
        encoded_df, target_columns = load_and_encode_binary(csv_path, direction)
        print(f"  矩陣: {encoded_df.shape[0]} 筆 x {encoded_df.shape[1]} 欄")

        print(f"\n[2/3] 挖掘規則")
        rules = mine_rules(encoded_df, target_columns,
                           min_support=min_support,
                           min_confidence=min_conf)

        if not rules.empty:
            # 額外用 lift 過濾
            rules = rules[rules["lift"] >= min_lift].reset_index(drop=True)
            print(f"  lift ≥ {min_lift} 過濾後: {len(rules)} 條")

        if rules.empty:
            print(f"  {label}：未找到有效規則")
        else:
            print(f"\n[3/3] 匯出{label}報表")
            export_report(rules, csv_path, encoded_df.shape[1],
                          direction, output_dir)

        all_rules[label] = rules

    # 摘要
    print(f"\n{'='*60}")
    print(f"分析完成！")
    for label, rules in all_rules.items():
        print(f"  {label}: {len(rules)} 條規則")
    print(f"報表位置: {output_dir}/rules_bull.* 和 {output_dir}/rules_bear.*")

    return all_rules


# ============================================================
# 使用範例
# ============================================================

if __name__ == "__main__":
    PROJECT_ROOT = os.path.join(os.path.dirname(__file__), "..")

    symbol = os.getenv("DATASET_SYMBOL", "GOLD_")
    start = os.getenv("DATASET_START_DATE", "2025-01-01")
    end = os.getenv("DATASET_END_DATE", "2026-03-31")
    min_support = float(os.getenv("RULES_MIN_SUPPORT", "0.02"))
    min_lift = float(os.getenv("RULES_MIN_LIFT", "1.1"))

    csv_filename = f"{symbol}_qmdj_dataset_{start}_{end}.csv"
    CSV_PATH = os.path.join(PROJECT_ROOT, "output", csv_filename)
    OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output")

    print(f"商品: {symbol}  日期: {start} ~ {end}")
    print(f"資料: {csv_filename}")
    print(f"min_support={min_support}  min_lift={min_lift}\n")

    all_rules = run_analysis(
        csv_path=CSV_PATH,
        output_dir=OUTPUT_DIR,
        min_support=min_support,
        min_lift=min_lift,
    )

    for label, rules in all_rules.items():
        if not rules.empty:
            print(f"\n=== {label} Top 10 ===")
            top = rules.head(10).copy()
            top["antecedents"] = top["antecedents"].apply(_frozenset_to_str)
            top["consequents"] = top["consequents"].apply(_frozenset_to_str)
            print(top[["antecedents", "consequents", "confidence", "lift", "count"]]
                  .to_string(index=False))
