"""
奇門遁甲排盤 API 客戶端
串接 /api/layout 端點，取得時盤或日盤的完整排盤資料。
"""

import requests
from datetime import datetime


API_BASE_URL = "http://localhost:3000"


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


# --------------- 使用範例 ---------------
if __name__ == "__main__":
    # 1) 取得目前時間的時盤
    print("=" * 50)
    print("【範例 1】目前時間 - 時盤")
    print("=" * 50)
    data = get_layout(chart_type="hour", time_mode="now")
    print_layout(data)

    # 2) 取得目前時間的日盤
    print("\n" + "=" * 50)
    print("【範例 2】目前時間 - 日盤")
    print("=" * 50)
    data = get_layout(chart_type="day", time_mode="now")
    print_layout(data)

    # 3) 指定時間的時盤
    print("\n" + "=" * 50)
    print("【範例 3】指定時間 - 時盤")
    print("=" * 50)
    data = get_layout(chart_type="hour", time_mode="custom", dt="2026-03-23T11:05:00")
    print_layout(data)

    # 4) 用 datetime 物件指定時間
    print("\n" + "=" * 50)
    print("【範例 4】datetime 物件 - 日盤")
    print("=" * 50)
    target = datetime(2026, 6, 15, 9, 30)
    data = get_layout(chart_type="day", time_mode="custom", dt=target)
    print_layout(data)
