"""
奇門遁甲排盤 API 客戶端
串接 /api/layout 端點，取得時盤或日盤的完整排盤資料。
支援將排盤結果轉為 DataFrame 並匯出 CSV。
"""

import os
import requests
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

API_BASE_URL = f"http://localhost:{os.getenv('PORT', '3000')}"


def get_layout(chart_type="hour", time_mode="now", dt=None):
    """
    呼叫奇門遁甲排盤 API。

    Parameters
    ----------
    chart_type : str
        "hour" (時盤) 或 "day" (日盤)。
    time_mode : str
        "now" (目前時間) 或 "custom" (指定時間)。
    dt : str | datetime | None
        當 time_mode 為 "custom" 時必填。
        可傳入 ISO 格式字串 (如 "2026-03-23T11:05:00") 或 datetime 物件。

    Returns
    -------
    dict
        API 回傳的完整 JSON 資料。
    """
    payload = {
        "chartType": chart_type,
        "timeMode": time_mode,
    }

    if time_mode == "custom":
        if dt is None:
            raise ValueError("time_mode 為 'custom' 時必須提供 dt 參數")
        if isinstance(dt, datetime):
            dt = dt.strftime("%Y-%m-%dT%H:%M:%S")
        payload["datetime"] = dt

    resp = requests.post(f"{API_BASE_URL}/api/layout", json=payload)
    resp.raise_for_status()
    return resp.json()


def print_layout(data):
    """印出排盤的人類可讀文字。"""
    if not data.get("success"):
        print("錯誤:", data.get("error", "未知錯誤"))
        return

    print(data["visualText"])

    # 額外印出結構化摘要
    info = data["timeInfo"]
    layout = data["layoutResult"]
    print(f"盤種: {data['chartType']}")
    print(f"四柱: {info['yearGZ']} {info['monthGZ']}月 {info['dayGZ']}日 {info['hourGZ']}時")
    print(f"局數: {'陽' if layout['isYang'] else '陰'}遁{layout['juNum']}局")
    print(f"值符: {layout['zhiFuStar']}  值使: {layout['zhiShiGate']}")
    print(f"空亡: {layout.get('kongWang', [])}")


def layout_to_dataframe(data):
    """
    將排盤 API 回傳的資料轉為單列 DataFrame。

    Parameters
    ----------
    data : dict
        get_layout() 回傳的完整 JSON 資料。

    Returns
    -------
    pd.DataFrame
        包含所有排盤資訊的單列 DataFrame。
    """
    if not data.get("success"):
        raise ValueError(f"排盤失敗: {data.get('error', '未知錯誤')}")

    info = data["timeInfo"]
    layout = data["layoutResult"]

    row = {
        "時間": info["providedTime"],
        "盤種": data["chartType"],
        "年柱": info["yearGZ"],
        "月柱": info["monthGZ"],
        "日柱": info["dayGZ"],
        "時柱": info["hourGZ"],
        "陰陽遁": "陽遁" if layout["isYang"] else "陰遁",
        "局數": layout["juNum"],
        "節氣": layout["jieqiName"],
        "元": layout.get("yuan", ""),
        "旬首干": layout["xunStem"],
        "旬首支": layout["xunZhi"],
        "值符星": layout["zhiFuStar"],
        "值使門": layout["zhiShiGate"],
        "空亡地支": ",".join(layout.get("kongWang", [])),
        "空亡天干": ",".join(layout.get("kongWangGan", [])),
        "空亡宮": ",".join(str(p) for p in layout.get("kongWangPalaces", [])),
    }

    # 展開九宮資料 (1~9 宮)
    for p in range(1, 10):
        ps = str(p)
        row[f"宮{p}_地盤干"] = layout["diPan"].get(ps, "")
        row[f"宮{p}_天盤星"] = layout["tianPanStar"].get(ps, "")
        row[f"宮{p}_天盤干"] = layout["tianPanStem"].get(ps, "")
        if p != 5:  # 中宮無門神
            row[f"宮{p}_八門"] = layout["finalGates"].get(ps, "")
            row[f"宮{p}_八神"] = layout["finalGods"].get(ps, "")

    return pd.DataFrame([row])


def export_csv(data, filepath="qmdj_output.csv", append=False):
    """
    將排盤資料匯出為 CSV 檔案。

    Parameters
    ----------
    data : dict | list[dict]
        get_layout() 回傳的 JSON 資料，可傳單筆或多筆 list。
    filepath : str
        輸出 CSV 路徑。
    append : bool
        True 時以附加模式寫入（不重複寫入表頭）。
    """
    if isinstance(data, dict):
        data = [data]

    df = pd.concat([layout_to_dataframe(d) for d in data], ignore_index=True)

    if append and os.path.exists(filepath):
        df.to_csv(filepath, mode="a", header=False, index=False, encoding="utf-8-sig")
    else:
        df.to_csv(filepath, index=False, encoding="utf-8-sig")

    print(f"已匯出 {len(df)} 筆資料至 {filepath}")
    return df


# --------------- 使用範例 ---------------
if __name__ == "__main__":
    # 1) 取得目前時間的時盤，轉 DataFrame
    print("=" * 50)
    print("【範例 1】目前時間 - 時盤 → DataFrame")
    print("=" * 50)
    data = get_layout(chart_type="hour", time_mode="now")
    print_layout(data)
    df = layout_to_dataframe(data)
    print("\nDataFrame:")
    print(df.to_string(index=False))

    # 2) 多筆資料匯出 CSV
    print("\n" + "=" * 50)
    print("【範例 2】多筆排盤 → CSV")
    print("=" * 50)
    results = [
        get_layout(chart_type="hour", time_mode="custom", dt="2026-03-23T11:05:00"),
        get_layout(chart_type="day", time_mode="custom", dt="2026-03-23T11:05:00"),
    ]
    df = export_csv(results, filepath="qmdj_output.csv")
