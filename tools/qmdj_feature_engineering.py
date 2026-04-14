"""
奇門遁甲特徵工程
=================
將原始盤面資料轉為有奇門金融分析意義的特徵，
用於後續關聯規則挖掘或機器學習。

特徵設計依據: config/prompts/analysis_logic_fin.txt (v3.0)
"""

import os
import pandas as pd
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# 多空信號等級門檻（從 .env 讀取）
SIGNAL_STRONG_BULL = int(os.getenv("SIGNAL_STRONG_BULL", "3"))
SIGNAL_BULL = int(os.getenv("SIGNAL_BULL", "1"))
SIGNAL_BEAR = int(os.getenv("SIGNAL_BEAR", "-1"))
SIGNAL_STRONG_BEAR = int(os.getenv("SIGNAL_STRONG_BEAR", "-3"))

# ============================================================
# 五行系統
# ============================================================

TIANGAN_WUXING = {
    "甲": "木", "乙": "木", "丙": "火", "丁": "火", "戊": "土",
    "己": "土", "庚": "金", "辛": "金", "壬": "水", "癸": "水",
}

# 五行生剋
# 生: 木→火→土→金→水→木
# 剋: 木→土→水→火→金→木
SHENG_MAP = {"木": "火", "火": "土", "土": "金", "金": "水", "水": "木"}
KE_MAP = {"木": "土", "土": "水", "水": "火", "火": "金", "金": "木"}

# 九星吉凶
STAR_LUCK = {
    "天蓬": "凶", "天任": "吉", "天衝": "吉", "天輔": "吉",
    "天英": "凶", "天芮": "凶", "天柱": "凶", "天心": "吉", "天禽": "中",
}

# 八門吉凶
GATE_LUCK = {
    "休門": "吉", "生門": "吉", "傷門": "凶", "杜門": "凶",
    "景門": "中", "死門": "凶", "驚門": "凶", "開門": "吉",
}

# 八神含義標籤
GOD_SIGNAL = {
    "值符": "主導", "螣蛇": "震盪騙線", "太陰": "暗中佈局",
    "六合": "盤整", "白虎": "暴跌", "玄武": "短線炒作",
    "九地": "慢牛囤積", "九天": "衝高回落",
}

# 宮位五行
PALACE_WUXING = {
    1: "水", 2: "土", 3: "木", 4: "木",
    5: "土", 6: "金", 7: "金", 8: "土", 9: "火",
}


def _wuxing_relation(wx_a: str, wx_b: str) -> str:
    """判斷 A 對 B 的五行關係。"""
    if wx_a == wx_b:
        return "比和"
    if SHENG_MAP.get(wx_a) == wx_b:
        return "生"
    if KE_MAP.get(wx_a) == wx_b:
        return "剋"
    if SHENG_MAP.get(wx_b) == wx_a:
        return "被生"
    if KE_MAP.get(wx_b) == wx_a:
        return "被剋"
    return "無"


# ============================================================
# 特徵提取
# ============================================================

def extract_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    從原始盤面 DataFrame 提取奇門金融特徵。

    Parameters
    ----------
    df : pd.DataFrame
        qmdj_kbar_dataset 產出的原始資料集。

    Returns
    -------
    pd.DataFrame
        新增特徵欄位後的 DataFrame。
    """
    out = df.copy()

    # ------ 基礎清理 ------
    # 重命名 dizhi → 時辰
    if "dizhi" in out.columns:
        out = out.rename(columns={"dizhi": "時辰"})

    # 移除單一值欄位（如陰陽遁只有一種）
    for col in list(out.columns):
        if out[col].nunique() <= 1 and col not in ["symbol"]:
            out.drop(columns=[col], inplace=True)

    # ------ 1. 時干 vs 日干 生剋 ------
    out["時干"] = out["時柱"].str[0]
    out["日干"] = out["日柱"].str[0]
    out["時干五行"] = out["時干"].map(TIANGAN_WUXING)
    out["日干五行"] = out["日干"].map(TIANGAN_WUXING)
    out["時日關係"] = out.apply(
        lambda r: _wuxing_relation(r["時干五行"], r["日干五行"]), axis=1
    )

    # ------ 2. 辛（黃金）落宮與旺衰 ------
    def find_xin_palace(row):
        """找辛在天盤的落宮。"""
        for p in range(1, 10):
            col = f"宮{p}_天盤干"
            if col in row.index and row[col] == "辛":
                return p
        return None

    out["辛落宮"] = out.apply(find_xin_palace, axis=1)
    out["辛落宮五行"] = out["辛落宮"].map(PALACE_WUXING)
    # 辛=金，落在土宮(2,5,8)被生=旺，落在火宮(9)被剋=衰
    out["辛旺衰"] = out["辛落宮五行"].apply(
        lambda wx: _wuxing_relation("金", wx) if pd.notna(wx) else "無"
    )

    # ------ 3. 庚（阻力）落宮 ------
    def find_geng_palace(row):
        for p in range(1, 10):
            col = f"宮{p}_天盤干"
            if col in row.index and row[col] == "庚":
                return p
        return None

    out["庚落宮"] = out.apply(find_geng_palace, axis=1)

    # ------ 4. 值符星吉凶 ------
    out["值符星吉凶"] = out["值符星"].map(STAR_LUCK)

    # ------ 5. 值使門吉凶 ------
    out["值使門吉凶"] = out["值使門"].map(GATE_LUCK)

    # ------ 6. 天干吉凶格局 ------
    def detect_stem_pattern(row):
        """檢查九宮中是否存在特定天干組合。"""
        patterns = []
        for p in range(1, 10):
            t_col = f"宮{p}_天盤干"
            d_col = f"宮{p}_地盤干"
            if t_col not in row.index or d_col not in row.index:
                continue
            tian = row[t_col]
            di = row[d_col]
            if pd.isna(tian) or pd.isna(di):
                continue
            combo = tian + "加" + di
            if combo == "丙加庚":
                patterns.append("丙加庚(買)")
            elif combo == "庚加丙":
                patterns.append("庚加丙(賣)")
            elif combo == "丁加丁":
                patterns.append("丁加丁(漲)")
            elif combo == "癸加丁" or combo == "丁加癸":
                patterns.append("癸丁(跌)")
            elif combo == "戊加丙":
                patterns.append("戊加丙(漲)")
        return ",".join(patterns) if patterns else "無"

    out["天干格局"] = out.apply(detect_stem_pattern, axis=1)
    out["有吉格"] = out["天干格局"].str.contains("買|漲", na=False)
    out["有凶格"] = out["天干格局"].str.contains("賣|跌", na=False)

    # ------ 7. 生門落宮與甲子戊關係（盈虧線）------
    def find_gate_palace(row, gate_name):
        for p in range(1, 10):
            col = f"宮{p}_八門"
            if col in row.index and row[col] == gate_name:
                return p
        return None

    out["生門落宮"] = out.apply(lambda r: find_gate_palace(r, "生門"), axis=1)

    # 甲子戊 = 戊的位置（地盤干為戊的宮位）
    def find_wu_palace(row):
        for p in range(1, 10):
            col = f"宮{p}_地盤干"
            if col in row.index and row[col] == "戊":
                return p
        return None

    out["戊落宮"] = out.apply(find_wu_palace, axis=1)

    def shengmen_wu_relation(row):
        sm = row.get("生門落宮")
        wu = row.get("戊落宮")
        if pd.isna(sm) or pd.isna(wu):
            return "無"
        sm_wx = PALACE_WUXING.get(int(sm), "")
        wu_wx = PALACE_WUXING.get(int(wu), "")
        return _wuxing_relation(sm_wx, wu_wx)

    out["生門戊關係"] = out.apply(shengmen_wu_relation, axis=1)

    # ------ 8. 值符落宮八神（主力心理）------
    def find_zhifu_god(row):
        """值符所在宮位的八神。"""
        for p in range(1, 10):
            col_god = f"宮{p}_八神"
            col_star = f"宮{p}_天盤星"
            if col_god in row.index and col_star in row.index:
                if row[col_star] == row.get("值符星"):
                    return row[col_god]
        return None

    # ------ 9. 白虎位置（暴跌指標）------
    def find_god_palace(row, god_name):
        for p in range(1, 10):
            col = f"宮{p}_八神"
            if col in row.index and row[col] == god_name:
                return p
        return None

    out["白虎落宮"] = out.apply(lambda r: find_god_palace(r, "白虎"), axis=1)

    # 白虎是否落在辛宮（黃金宮被白虎壓制）
    out["白虎臨辛"] = out.apply(
        lambda r: r.get("白虎落宮") == r.get("辛落宮")
        if pd.notna(r.get("白虎落宮")) and pd.notna(r.get("辛落宮"))
        else False, axis=1
    )

    # ------ 10. 空亡影響 ------
    def xin_in_kongwang(row):
        kw_str = str(row.get("空亡宮", ""))
        xin_p = row.get("辛落宮")
        if pd.isna(xin_p) or not kw_str:
            return False
        return str(int(xin_p)) in kw_str.split(",")

    out["辛入空亡"] = out.apply(xin_in_kongwang, axis=1)

    # ------ 11. 門宮生剋（控盤權）------
    def gate_palace_relation(row):
        """值使門所在宮位的門宮生剋關係。"""
        gate = row.get("值使門")
        if pd.isna(gate):
            return "無"
        gate_wx = GATE_LUCK.get(gate)  # 這裡簡化：用門的本宮五行
        # 找值使門落在哪個宮
        for p in range(1, 10):
            col = f"宮{p}_八門"
            if col in row.index and row[col] == gate:
                palace_wx = PALACE_WUXING.get(p, "")
                # 門的五行用門的本宮五行
                gate_orig = {
                    "休門": 1, "生門": 8, "傷門": 3, "杜門": 4,
                    "景門": 9, "死門": 2, "驚門": 7, "開門": 6,
                }
                gate_native_wx = PALACE_WUXING.get(gate_orig.get(gate, 5), "土")
                rel = _wuxing_relation(gate_native_wx, palace_wx)
                if rel == "剋":
                    return "門剋宮(買方優)"
                elif rel == "被生":
                    return "宮生門(軋空)"
                elif rel == "生":
                    return "門生宮(越買越跌)"
                elif rel == "被剋":
                    return "宮剋門(賣方控)"
                else:
                    return "比和"
        return "無"

    out["門宮關係"] = out.apply(gate_palace_relation, axis=1)

    # ------ 12. 綜合多空信號 ------
    def bull_bear_score(row):
        score = 0
        # 時日關係
        if row.get("時日關係") == "生":
            score += 2
        elif row.get("時日關係") == "剋":
            score -= 2
        # 辛旺衰
        if row.get("辛旺衰") == "被生":
            score += 1
        elif row.get("辛旺衰") == "被剋":
            score -= 1
        # 吉凶格
        if row.get("有吉格"):
            score += 1
        if row.get("有凶格"):
            score -= 1
        # 值符星
        if row.get("值符星吉凶") == "吉":
            score += 1
        elif row.get("值符星吉凶") == "凶":
            score -= 1
        # 值使門
        if row.get("值使門吉凶") == "吉":
            score += 1
        elif row.get("值使門吉凶") == "凶":
            score -= 1
        # 白虎臨辛
        if row.get("白虎臨辛"):
            score -= 2
        # 辛入空亡
        if row.get("辛入空亡"):
            score -= 1
        # 門宮關係
        mg = row.get("門宮關係", "")
        if "買方" in mg or "軋空" in mg:
            score += 1
        elif "越買越跌" in mg or "賣方" in mg:
            score -= 1
        return score

    out["多空分數"] = out.apply(bull_bear_score, axis=1)

    def score_to_signal(s):
        if s >= SIGNAL_STRONG_BULL:
            return "強多"
        elif s >= SIGNAL_BULL:
            return "偏多"
        elif s <= SIGNAL_STRONG_BEAR:
            return "強空"
        elif s <= SIGNAL_BEAR:
            return "偏空"
        return "中性"

    out["多空信號"] = out["多空分數"].apply(score_to_signal)

    return out


# ============================================================
# 取得用於關聯規則的精簡特徵欄位
# ============================================================

ANALYSIS_FEATURES = [
    "時辰",           # 時辰（地支）
    "局數",           # 局數（1~9）
    "節氣",           # 節氣
    "值符星",         # 值符星（不再放值符星吉凶，避免冗餘）
    "值使門吉凶",     # 值使門吉凶（值使門與值符星綁定，只放吉凶）
    "時日關係",       # 時干 vs 日干 五行關係
    "辛旺衰",         # 黃金（辛）落宮旺衰
    "辛入空亡",       # 辛是否落入空亡
    "白虎臨辛",       # 白虎是否壓制黃金宮
    "天干格局",       # 天干吉凶格局（丙加庚/丁加丁等）
    "生門戊關係",     # 盈虧線（生門 vs 甲子戊）
    "門宮關係",       # 控盤權（門宮生剋）
    "多空信號",       # 綜合多空信號
    # 已移除：值符星吉凶（與值符星綁定）、有吉格/有凶格（與天干格局綁定）
]


if __name__ == "__main__":
    import os

    csv_path = os.path.join(os.path.dirname(__file__), "..", "output",
                            "GOLD__qmdj_dataset_2025-01-01_2026-03-31.csv")
    df = pd.read_csv(csv_path)
    result = extract_features(df)

    print(f"原始欄位: {len(df.columns)}")
    print(f"特徵工程後: {len(result.columns)}")
    print()

    # 顯示新特徵分布
    new_cols = [c for c in result.columns if c not in df.columns]
    for c in new_cols:
        print(f"--- {c} ---")
        print(result[c].value_counts().head(8))
        print()
