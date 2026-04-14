"""
奇門遁甲 x 2H K-Bar 研究資料集產生器
=========================================
批量產生「奇門時盤 + 對應 2 小時 K Bar + 市場衍生標籤」的 CSV 資料集，
供後續大數據分析 / 機器學習使用。

每筆資料 = 一個時辰的奇門盤面 → 對應該時辰區間的市場表現。

使用方式:
    python tools/qmdj_kbar_dataset.py
    （需先啟動 Express 伺服器: node server.js）
"""

import os
import sys
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv

# 確保 tools/ 目錄在 import 路徑
sys.path.insert(0, os.path.dirname(__file__))

from qmdj_client import get_layout, layout_to_dataframe
from fx_kbar import get_m15_bars

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# 從 .env 讀取設定
DIR_THRESHOLD = float(os.getenv("LABEL_DIR_THRESHOLD", "0.001"))
PATH_RANGE_THRESHOLD = float(os.getenv("LABEL_PATH_RANGE_THRESHOLD", "0.001"))
PATH_ONE_SIDED_RATIO = float(os.getenv("LABEL_PATH_ONE_SIDED_RATIO", "3"))
M15_BUFFER_DAYS = int(os.getenv("DATASET_M15_BUFFER_DAYS", "2"))

# ============================================================
# 常數
# ============================================================

DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

# 每個時辰的起始小時（台灣時間 UTC+8）
# 子時 23:00(前日), 丑時 01:00, 寅時 03:00, ..., 亥時 21:00
SHICHEN_START_HOURS = [23, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21]

# 台灣與 UTC 時差
TW_UTC_OFFSET = timedelta(hours=8)


# ============================================================
# 1. 時辰時間序列產生
# ============================================================

def generate_shichen_slots(start_date: str, end_date: str) -> list[dict]:
    """
    產生指定日期範圍內所有時辰的時間區間。

    時辰以台灣時間 (UTC+8) 為準，K-bar 查詢時間轉換為 UTC。

    Parameters
    ----------
    start_date : str
        起始日期（台灣時間），格式 "YYYY-MM-DD"。
    end_date : str
        結束日期（台灣時間），格式 "YYYY-MM-DD"。

    Returns
    -------
    list[dict]
        每個 dict 包含:
        - dizhi: 地支名稱
        - qimen_time_tw: 奇門排盤時間 - 台灣時間 (datetime)
        - bar_start_utc: K Bar 開始時間 - UTC (datetime)
        - bar_end_utc: K Bar 結束時間 - UTC (datetime)
    """
    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)  # 包含結束日

    slots = []
    current = start_dt

    while current < end_dt:
        for i, hour in enumerate(SHICHEN_START_HOURS):
            if hour == 23:
                # 子時 23:00 屬於當天（台灣時間）
                tw_start = current.replace(hour=23, minute=0, second=0)
            else:
                tw_start = current.replace(hour=hour, minute=0, second=0)

            tw_end = tw_start + timedelta(hours=2)

            # 台灣時間 → UTC
            utc_start = tw_start - TW_UTC_OFFSET
            utc_end = tw_end - TW_UTC_OFFSET

            # 用 UTC 時間判斷外匯市場是否休市
            if _is_fx_closed(utc_start):
                continue

            slots.append({
                "dizhi": DIZHI[i],
                "qimen_time_tw": tw_start,
                "bar_start_utc": utc_start,
                "bar_end_utc": utc_end,
            })

        current += timedelta(days=1)

    # 去重並排序
    seen = set()
    unique_slots = []
    for s in slots:
        key = s["qimen_time_tw"]
        if key not in seen:
            seen.add(key)
            unique_slots.append(s)

    unique_slots.sort(key=lambda x: x["qimen_time_tw"])
    return unique_slots


def _is_fx_closed(utc_dt: datetime) -> bool:
    """
    判斷該 UTC 時間外匯市場是否休市。
    規則: 週五 22:00 UTC 收盤 ~ 週日 22:00 UTC 開盤。
    """
    wd = utc_dt.weekday()  # 0=Mon ... 6=Sun
    # 週六全天休市
    if wd == 5:
        return True
    # 週五 22:00 之後休市
    if wd == 4 and utc_dt.hour >= 22:
        return True
    # 週日 22:00 之前休市
    if wd == 6 and utc_dt.hour < 22:
        return True
    return False


# ============================================================
# 2. 市場衍生欄位
# ============================================================

def compute_market_features(open_p: float, high_p: float,
                            low_p: float, close_p: float) -> dict:
    """從 OHLC 計算衍生報酬欄位。"""
    ret_co = (close_p - open_p) / open_p
    return {
        "ret_close_open": round(ret_co, 8),
        "ret_high_open": round((high_p - open_p) / open_p, 8),
        "ret_low_open": round((low_p - open_p) / open_p, 8),
        "range_hl": round((high_p - low_p) / open_p, 8),
        "body_pct": round(abs(close_p - open_p) / open_p, 8),
    }


def label_direction(ret_close_open: float, threshold: float = None) -> int:
    """
    方向標籤。
    > +threshold → 1 (漲)
    < -threshold → -1 (跌)
    其他 → 0 (平/震盪)

    threshold 預設讀取 .env 的 LABEL_DIR_THRESHOLD (0.001 = 0.1%)
    """
    if threshold is None:
        threshold = DIR_THRESHOLD
    if ret_close_open > threshold:
        return 1
    elif ret_close_open < -threshold:
        return -1
    return 0


def label_path_type(m15_df: pd.DataFrame, open_p: float,
                    close_p: float, range_hl: float,
                    threshold: float = None,
                    one_sided_ratio: float = None) -> str:
    """
    路徑標籤（純粹由 M15 子 K 線的高低點時間順序決定，不依賴收盤方向）。

    判斷邏輯：
    - 將 2H 區間切成前半 / 後半
    - 用 M15 的累積報酬曲線計算前半最大漲幅、前半最大跌幅
    - 根據高低點出現在前半或後半，以及兩者的幅度差異來分類

    Parameters
    ----------
    m15_df : pd.DataFrame
        該 2H 區間內的 M15 K 線，columns 至少需有 ts, open, high, low, close。
    open_p : float
        2H K Bar 開盤價。
    close_p : float
        2H K Bar 收盤價（此函式不使用，僅保留介面相容）。
    range_hl : float
        (high - low) / open 比例。
    threshold : float
        區間震盪判定門檻。

    Returns
    -------
    str
        UP_FIRST / DOWN_FIRST / UP_CONTINUE / DOWN_CONTINUE / RANGE
    """
    if threshold is None:
        threshold = PATH_RANGE_THRESHOLD
    if one_sided_ratio is None:
        one_sided_ratio = PATH_ONE_SIDED_RATIO

    if m15_df.empty or len(m15_df) < 2:
        return "RANGE"

    # 波幅太小 → 震盪
    if range_hl < threshold:
        return "RANGE"

    n = len(m15_df)
    mid = n / 2

    # 找最高價和最低價出現的位置（純時間順序）
    high_pos = m15_df["high"].values.argmax()
    low_pos = m15_df["low"].values.argmin()

    high_in_first_half = high_pos < mid
    low_in_first_half = low_pos < mid
    high_first = high_pos < low_pos

    # 計算高低點偏離開盤的幅度
    h = float(m15_df["high"].max())
    l = float(m15_df["low"].min())
    up_range = (h - open_p) / open_p    # 上行幅度
    down_range = (open_p - l) / open_p   # 下行幅度

    # 判斷是否為單邊行情：一邊幅度遠大於另一邊
    is_one_sided_up = up_range > down_range * one_sided_ratio and up_range > threshold
    is_one_sided_down = down_range > up_range * one_sided_ratio and down_range > threshold

    if is_one_sided_up and not high_in_first_half:
        return "UP_CONTINUE"       # 單邊上行，高點在後半
    elif is_one_sided_down and not low_in_first_half:
        return "DOWN_CONTINUE"     # 單邊下行，低點在後半
    elif high_first:
        return "UP_FIRST"          # 先衝高後回落（不管最終收漲收跌）
    elif not high_first:
        return "DOWN_FIRST"        # 先探底後反彈（不管最終收漲收跌）
    else:
        return "RANGE"


# ============================================================
# 3. 聚合 M15 → 時辰 H2 OHLC
# ============================================================

def aggregate_m15_to_shichen(m15_all: pd.DataFrame,
                             bar_start: datetime,
                             bar_end: datetime) -> tuple[dict | None, pd.DataFrame]:
    """
    從 M15 資料中切出指定時辰區間並聚合為 OHLC。

    Returns
    -------
    tuple[dict | None, pd.DataFrame]
        (OHLC dict, 該區間的 M15 子集 DataFrame)
        若該區間無資料則回傳 (None, empty DataFrame)
    """
    mask = (m15_all["ts"] >= bar_start) & (m15_all["ts"] < bar_end)
    subset = m15_all.loc[mask].copy()

    if subset.empty:
        return None, subset

    ohlc = {
        "open": float(subset.iloc[0]["open"]),
        "high": float(subset["high"].max()),
        "low": float(subset["low"].min()),
        "close": float(subset.iloc[-1]["close"]),
    }
    return ohlc, subset


# ============================================================
# 4. 主流程
# ============================================================

def build_dataset(symbol: str, start_date: str, end_date: str,
                  output_path: str | None = None) -> pd.DataFrame:
    """
    建立奇門遁甲 x 2H K-Bar 研究資料集。

    Parameters
    ----------
    symbol : str
        商品代碼，如 "GOLD_", "EURUSD"。
    start_date : str
        起始日期，格式 "YYYY-MM-DD"。
    end_date : str
        結束日期，格式 "YYYY-MM-DD"。
    output_path : str | None
        CSV 輸出路徑，None 則不匯出。

    Returns
    -------
    pd.DataFrame
        完整研究資料集。
    """
    print(f"[1/4] 產生時辰序列（台灣時間）: {start_date} ~ {end_date}")
    slots = generate_shichen_slots(start_date, end_date)
    print(f"       共 {len(slots)} 個時辰")

    # 批量撈 M15（UTC，前後各多撈幾天確保時差邊界完整）
    m15_start = (datetime.strptime(start_date, "%Y-%m-%d") - timedelta(days=M15_BUFFER_DAYS)).strftime("%Y-%m-%d")
    m15_end = (datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=M15_BUFFER_DAYS)).strftime("%Y-%m-%d")
    print(f"[2/4] 撈取 M15 資料（UTC）: {m15_start} ~ {m15_end}")
    m15_all = get_m15_bars(symbol, m15_start, m15_end)
    print(f"       共 {len(m15_all)} 根 M15 K 線")

    if m15_all.empty:
        print("  M15 資料為空，請確認商品代碼與日期範圍。")
        return pd.DataFrame()

    # 逐時辰處理
    print(f"[3/4] 逐時辰排盤 + 計算標籤...")
    rows = []
    success = 0
    skip = 0

    for i, slot in enumerate(slots):
        # 用 UTC 時間查 M15，聚合 H2 OHLC
        ohlc, m15_subset = aggregate_m15_to_shichen(
            m15_all, slot["bar_start_utc"], slot["bar_end_utc"]
        )

        if ohlc is None:
            skip += 1
            continue

        # 用台灣時間呼叫奇門 API（Node.js 解析為本機時區 = 台灣）
        try:
            qm_data = get_layout(
                chart_type="hour",
                time_mode="custom",
                dt=slot["qimen_time_tw"],
            )
            qm_row = layout_to_dataframe(qm_data).iloc[0].to_dict()
        except Exception as e:
            print(f"  排盤失敗 ({slot['qimen_time_tw']}): {e}")
            skip += 1
            continue

        # 市場衍生欄位
        features = compute_market_features(
            ohlc["open"], ohlc["high"], ohlc["low"], ohlc["close"]
        )

        # 標籤
        direction = label_direction(features["ret_close_open"])
        path = label_path_type(
            m15_subset, ohlc["open"], ohlc["close"], features["range_hl"]
        )

        # 組合一筆完整資料
        row = {
            "symbol": symbol,
            "qimen_time_tw": slot["qimen_time_tw"].strftime("%Y-%m-%d %H:%M:%S"),
            "dizhi": slot["dizhi"],
            "bar_start_utc": slot["bar_start_utc"].strftime("%Y-%m-%d %H:%M:%S"),
            "bar_end_utc": slot["bar_end_utc"].strftime("%Y-%m-%d %H:%M:%S"),
        }

        # 移除 qmdj_client 的「時間」和「盤種」欄位（已有 qimen_time 和 bar_start）
        qm_row.pop("時間", None)
        qm_row.pop("盤種", None)
        row.update(qm_row)

        # K Bar OHLC
        row["open"] = ohlc["open"]
        row["high"] = ohlc["high"]
        row["low"] = ohlc["low"]
        row["close"] = ohlc["close"]

        # 衍生欄位
        row.update(features)

        # 標籤
        row["direction_2h"] = direction
        row["path_type"] = path

        rows.append(row)
        success += 1

        # 進度
        if (i + 1) % 50 == 0 or (i + 1) == len(slots):
            print(f"  進度: {i + 1}/{len(slots)}  (成功: {success}, 跳過: {skip})")

    df = pd.DataFrame(rows)

    # 匯出 CSV
    if output_path and not df.empty:
        # 確保輸出目錄存在
        out_dir = os.path.dirname(output_path)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        print(f"[4/4] 匯出 CSV: {output_path}")
        df.to_csv(output_path, index=False, encoding="utf-8-sig")
        print(f"       完成！共 {len(df)} 筆資料")
    else:
        print(f"[4/4] 完成，共 {len(df)} 筆資料（未匯出 CSV）")

    return df


# ============================================================
# 使用範例
# ============================================================

if __name__ == "__main__":
    symbol = os.getenv("DATASET_SYMBOL", "GOLD_")
    start = os.getenv("DATASET_START_DATE", "2025-01-01")
    end = os.getenv("DATASET_END_DATE", "2026-03-31")

    OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "output")

    print(f"商品: {symbol}  日期: {start} ~ {end}")
    df = build_dataset(
        symbol=symbol,
        start_date=start,
        end_date=end,
        output_path=os.path.join(OUTPUT_DIR, f"{symbol}_qmdj_dataset_{start}_{end}.csv"),
    )

    if not df.empty:
        print("\n前 5 筆資料:")
        print(df.head().to_string(index=False))
