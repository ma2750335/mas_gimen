"""
FX K-bar 資料擷取工具
從 mas_ea_fx 資料庫撈取 H1 K 線，聚合為 H2 (兩小時) OHLC，
支援起迄日查詢與 CSV 匯出。
"""

import os
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DB_USER = os.getenv("DB_USER", "root")
DB_PASS = os.getenv("DB_PASS", "")
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "mas_ea_fx")

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

_engine = None


def _get_engine():
    global _engine
    if _engine is None:
        _engine = create_engine(DATABASE_URL, pool_pre_ping=True, echo=False)
    return _engine


def get_bars(symbol: str, start_date: str, end_date: str, timeframe: str = "H1") -> pd.DataFrame:
    """
    從資料庫撈取指定 timeframe 的 K 線原始資料。

    Parameters
    ----------
    symbol : str
        商品代碼，如 "XAUUSD", "EURUSD"。
    start_date : str
        起始日期，格式 "YYYY-MM-DD"。
    end_date : str
        結束日期，格式 "YYYY-MM-DD"。
    timeframe : str
        K 線週期，如 "M15", "H1", "H4", "D1"。

    Returns
    -------
    pd.DataFrame
        columns: ts, open, high, low, close, tick_volume
    """
    query = text("""
        SELECT b.ts,
               b.open,
               b.high,
               b.low,
               b.close,
               b.tick_volume
        FROM   fx_bars b
        JOIN   instruments i ON b.instrument_id = i.instrument_id
        WHERE  i.symbol     = :symbol
        AND    b.timeframe  = :timeframe
        AND    b.ts BETWEEN :start_date AND :end_date
        ORDER  BY b.ts ASC
    """)
    engine = _get_engine()
    df = pd.read_sql(query, engine, params={
        "symbol": symbol,
        "timeframe": timeframe,
        "start_date": start_date,
        "end_date": end_date,
    })
    df["ts"] = pd.to_datetime(df["ts"])
    return df


def get_h1_bars(symbol: str, start_date: str, end_date: str) -> pd.DataFrame:
    """撈取 H1 K 線（get_bars 的快捷方式）。"""
    return get_bars(symbol, start_date, end_date, timeframe="H1")


def get_m15_bars(symbol: str, start_date: str, end_date: str) -> pd.DataFrame:
    """撈取 M15 K 線（get_bars 的快捷方式）。"""
    return get_bars(symbol, start_date, end_date, timeframe="M15")


def resample_to_h2(df: pd.DataFrame) -> pd.DataFrame:
    """
    將 H1 K 線聚合為 H2 K 線。

    Parameters
    ----------
    df : pd.DataFrame
        get_h1_bars() 回傳的 H1 資料。

    Returns
    -------
    pd.DataFrame
        H2 OHLC，columns: ts, open, high, low, close, tick_volume
    """
    if df.empty:
        return df

    df = df.set_index("ts")
    h2 = df.resample("2h").agg({
        "open": "first",
        "high": "max",
        "low": "min",
        "close": "last",
        "tick_volume": "sum",
    }).dropna(subset=["open"])

    return h2.reset_index()


def get_h2_bars(symbol: str, start_date: str, end_date: str) -> pd.DataFrame:
    """
    取得 H2 K 線資料（從 H1 聚合）。

    Parameters
    ----------
    symbol : str
        商品代碼，如 "XAUUSD", "EURUSD"。
    start_date : str
        起始日期，格式 "YYYY-MM-DD"。
    end_date : str
        結束日期，格式 "YYYY-MM-DD"。

    Returns
    -------
    pd.DataFrame
        H2 OHLC，columns: ts, open, high, low, close, tick_volume
    """
    h1 = get_h1_bars(symbol, start_date, end_date)
    return resample_to_h2(h1)


def export_csv(df: pd.DataFrame, filepath: str = "fx_h2_bars.csv"):
    """
    將 DataFrame 匯出為 CSV。

    Parameters
    ----------
    df : pd.DataFrame
        K 線資料。
    filepath : str
        輸出 CSV 路徑。
    """
    df.to_csv(filepath, index=False, encoding="utf-8-sig")
    print(f"已匯出 {len(df)} 筆 K 線至 {filepath}")


# --------------- 使用範例 ---------------
if __name__ == "__main__":
    symbol = "GOLD_"
    start = "2026-03-01"
    end = "2026-03-31"

    print(f"查詢 {symbol} H2 K 線: {start} ~ {end}")
    df = get_h2_bars(symbol, start, end)

    if df.empty:
        print("查無資料，請確認商品代碼與日期範圍。")
    else:
        print(f"\n共 {len(df)} 筆 H2 K 線")
        print(df.head(10).to_string(index=False))
        export_csv(df, f"{symbol}_H2_{start}_{end}.csv")
