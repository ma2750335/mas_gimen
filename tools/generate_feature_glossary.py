"""
產出奇門遁甲特徵標籤解釋報表
"""

import os
from datetime import datetime


def generate_glossary(output_dir: str = "output"):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    features = [
        {
            "category": "時間特徵",
            "items": [
                {"name": "時辰", "prefix": "時辰_",
                 "desc": "奇門遁甲十二時辰（台灣時間 UTC+8），每個時辰為 2 小時",
                 "values": [
                     ("子", "23:00-01:00"),
                     ("丑", "01:00-03:00"),
                     ("寅", "03:00-05:00"),
                     ("卯", "05:00-07:00"),
                     ("辰", "07:00-09:00"),
                     ("巳", "09:00-11:00"),
                     ("午", "11:00-13:00"),
                     ("未", "13:00-15:00"),
                     ("申", "15:00-17:00"),
                     ("酉", "17:00-19:00"),
                     ("戌", "19:00-21:00"),
                     ("亥", "21:00-23:00"),
                 ]},
                {"name": "節氣", "prefix": "節氣_",
                 "desc": "當前所處的二十四節氣，決定局數與陰陽遁",
                 "values": [
                     ("冬至~芒種", "陽遁（能量漸增）"),
                     ("夏至~大雪", "陰遁（能量漸減）"),
                 ]},
                {"name": "局數", "prefix": "局數_",
                 "desc": "奇門排盤的局數（1~9），由節氣+上中下元決定，影響天盤地盤的起始排列",
                 "values": [
                     ("1~9", "不同局數代表不同的能量場配置"),
                 ]},
            ]
        },
        {
            "category": "值符值使（大勢判斷）",
            "items": [
                {"name": "值符星", "prefix": "值符星_",
                 "desc": "值符星代表整體行情大勢的主導力量。由時辰旬首決定",
                 "values": [
                     ("天心", "吉 — 趨勢明確不易回調"),
                     ("天任", "吉 — 直線走勢"),
                     ("天衝", "吉 — 跳躍走勢，洗盤劇烈"),
                     ("天輔", "吉 — 飄動走勢，方向不明確"),
                     ("天禽", "中 — 直線緩慢走勢"),
                     ("天蓬", "凶 — 巨幅震盪"),
                     ("天英", "凶 — 銳利，容易出現尖頭反轉"),
                     ("天芮", "凶 — 平緩走勢，窄幅盤整"),
                     ("天柱", "凶 — 台階走勢，階梯狀上漲"),
                 ]},
                {"name": "值使門吉凶", "prefix": "值使門吉凶_",
                 "desc": "值使門代表兩小時內的漲跌幅度與過程。值符星與值使門一對一綁定，此處只取吉凶",
                 "values": [
                     ("吉", "值使門為 休門/生門/開門（三吉門）"),
                     ("中", "值使門為 景門（好景不常）"),
                     ("凶", "值使門為 傷門/杜門/死門/驚門"),
                 ]},
            ]
        },
        {
            "category": "時干日干關係（多空對手盤）",
            "items": [
                {"name": "時日關係", "prefix": "時日關係_",
                 "desc": "時干（市場方向）對日干（自己）的五行生剋關係，判斷市場站在哪一邊",
                 "values": [
                     ("生", "時干生日干 — 市場送錢給你，極度看多"),
                     ("比和", "同五行 — 市場與你同向，中性偏多"),
                     ("被生", "日干生時干 — 你的力量流向市場，偏弱"),
                     ("剋", "時干剋日干 — 市場打壓你，強烈看空"),
                     ("被剋", "日干剋時干 — 你試圖對抗市場，吃力"),
                 ]},
            ]
        },
        {
            "category": "黃金動能（辛）",
            "items": [
                {"name": "辛旺衰", "prefix": "辛旺衰_",
                 "desc": "辛（黃金天干）落宮的五行旺衰，代表黃金當下的上漲動能",
                 "values": [
                     ("被生", "辛=金 落在土宮(2,5,8)，土生金 — 黃金動能強"),
                     ("比和", "辛=金 落在金宮(6,7)，金金同類 — 動能中等"),
                     ("生", "辛=金 落在水宮(1)，金生水 — 動能外洩"),
                     ("剋", "辛=金 落在木宮(3,4)，金剋木 — 動能消耗在攻擊"),
                     ("被剋", "辛=金 落在火宮(9)，火剋金 — 黃金動能最弱"),
                     ("無", "辛未出現在天盤（寄宮中5）"),
                 ]},
                {"name": "辛入空亡", "prefix": "辛入空亡",
                 "desc": "辛（黃金）是否落入空亡宮位",
                 "values": [
                     ("True", "辛所在宮位為空亡 — 黃金能量虛空，訊號不可靠"),
                     ("False", "辛不在空亡 — 正常判讀"),
                 ]},
                {"name": "白虎臨辛", "prefix": "白虎臨辛",
                 "desc": "白虎（暴跌指標）是否與辛（黃金）同宮",
                 "values": [
                     ("True", "白虎壓在黃金宮位 — 強烈做空訊號"),
                     ("False", "白虎未壓制黃金 — 正常判讀"),
                 ]},
            ]
        },
        {
            "category": "天干格局（買賣訊號）",
            "items": [
                {"name": "天干格局", "prefix": "天干格局_",
                 "desc": "九宮中天盤干與地盤干的特定組合，代表多空交戰的訊號",
                 "values": [
                     ("丙加庚(買)", "超跌反彈 — 宜買進"),
                     ("戊加丙(漲)", "資本+爆發力 — 看漲"),
                     ("丁加丁(漲)", "星火燎原 — 標準上漲吉格，穩定走高"),
                     ("庚加丙(賣)", "超漲過熱 — 宜賣出或做空"),
                     ("癸丁(跌)", "癸加丁或丁加癸 — 明確下跌訊號"),
                     ("無", "盤面無特殊天干格局"),
                 ]},
            ]
        },
        {
            "category": "盈虧線（生門 vs 甲子戊）",
            "items": [
                {"name": "生門戊關係", "prefix": "生門戊關係_",
                 "desc": "生門（利潤）所在宮位與戊（甲子戊=資本）所在宮位的五行關係，判斷這 2 小時是否有利潤空間",
                 "values": [
                     ("生", "生門宮生戊宮 — 有利潤空間，可操作"),
                     ("比和", "同五行 — 中性，無明顯優劣"),
                     ("被生", "戊宮生生門宮 — 資本流向利潤端，偏有利"),
                     ("剋", "生門宮剋戊宮 — 利潤剋資本，易套牢虧損"),
                     ("被剋", "戊宮剋生門宮 — 資本壓制利潤，較難獲利"),
                 ]},
            ]
        },
        {
            "category": "控盤權（門宮生剋）",
            "items": [
                {"name": "門宮關係", "prefix": "門宮關係_",
                 "desc": "值使門的本宮五行與其所落宮位的五行關係，判斷買方或賣方控盤",
                 "values": [
                     ("門剋宮(買方優)", "買方吃籌，價格大漲"),
                     ("宮生門(軋空)", "持籌方不利，越賣越漲"),
                     ("比和", "買賣雙方勢均力敵"),
                     ("門生宮(越買越跌)", "買方無法阻止回落"),
                     ("宮剋門(賣方控)", "賣方大量拋售，價格大跌"),
                 ]},
            ]
        },
        {
            "category": "綜合信號",
            "items": [
                {"name": "多空信號", "prefix": "多空信號_",
                 "desc": "綜合上述所有特徵計算的多空分數，轉為信號等級",
                 "values": [
                     ("強多", "分數 ≥ 3 — 多個多頭條件同時成立"),
                     ("偏多", "分數 1~2 — 略偏多"),
                     ("中性", "分數 0 — 多空平衡"),
                     ("偏空", "分數 -1~-2 — 略偏空"),
                     ("強空", "分數 ≤ -3 — 多個空頭條件同時成立"),
                 ]},
            ]
        },
        {
            "category": "目標變數",
            "items": [
                {"name": "方向=漲", "prefix": "",
                 "desc": "2 小時 K Bar 收盤漲幅 > +0.1%",
                 "values": []},
                {"name": "方向=跌", "prefix": "",
                 "desc": "2 小時 K Bar 收盤跌幅 > -0.1%",
                 "values": []},
                {"name": "方向=平", "prefix": "",
                 "desc": "2 小時 K Bar 收盤漲跌幅在 ±0.1% 以內",
                 "values": []},
            ]
        },
    ]

    # Build HTML
    rows_html = ""
    for cat in features:
        cat_name = cat["category"]
        items = cat["items"]
        cat_rowspan = sum(max(len(it["values"]), 1) for it in items)

        first_cat = True
        for item in items:
            item_rowspan = max(len(item["values"]), 1)
            first_item = True

            if item["values"]:
                for val_name, val_desc in item["values"]:
                    row = "<tr>"
                    if first_cat:
                        row += f'<td class="cat" rowspan="{cat_rowspan}">{cat_name}</td>'
                        first_cat = False
                    if first_item:
                        row += f'<td class="feat" rowspan="{item_rowspan}">{item["name"]}</td>'
                        row += f'<td class="feat-desc" rowspan="{item_rowspan}">{item["desc"]}</td>'
                        first_item = False
                    prefix = item["prefix"]
                    display = f"{prefix}{val_name}" if prefix else val_name
                    row += f'<td class="val-name">{display}</td>'
                    row += f'<td>{val_desc}</td>'
                    row += "</tr>\n"
                    rows_html += row
            else:
                row = "<tr>"
                if first_cat:
                    row += f'<td class="cat" rowspan="{cat_rowspan}">{cat_name}</td>'
                    first_cat = False
                row += f'<td class="feat">{item["name"]}</td>'
                row += f'<td class="feat-desc">{item["desc"]}</td>'
                row += '<td>—</td><td>—</td>'
                row += "</tr>\n"
                rows_html += row

    html = f"""<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>奇門遁甲特徵標籤解釋</title>
<style>
  body {{ font-family: "Microsoft JhengHei", "PingFang TC", sans-serif; margin: 40px; background: #f8f9fa; color: #333; }}
  h1 {{ color: #2c3e50; border-bottom: 3px solid #8e44ad; padding-bottom: 10px; }}
  h2 {{ color: #8e44ad; margin-top: 30px; }}
  p.intro {{ color: #555; line-height: 1.8; }}
  table {{ border-collapse: collapse; width: 100%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 20px 0; }}
  th {{ background: #8e44ad; color: #fff; padding: 10px 14px; text-align: left; font-size: 0.95em; }}
  td {{ padding: 8px 14px; border-bottom: 1px solid #eee; vertical-align: top; font-size: 0.9em; line-height: 1.6; }}
  tr:hover {{ background: #f9f0ff; }}
  .cat {{ background: #f3e5f5; font-weight: bold; color: #6a1b9a; font-size: 0.95em; }}
  .feat {{ font-weight: bold; color: #333; white-space: nowrap; }}
  .feat-desc {{ color: #555; max-width: 280px; }}
  .val-name {{ font-family: "Consolas", "Monaco", monospace; background: #fafafa; color: #c62828; white-space: nowrap; }}
  .note {{ color: #888; font-size: 0.85em; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }}

  .score-table {{ width: auto; margin: 15px 0; }}
  .score-table th {{ background: #5c6bc0; padding: 6px 12px; }}
  .score-table td {{ padding: 6px 12px; text-align: center; }}
  .plus {{ color: #2e7d32; font-weight: bold; }}
  .minus {{ color: #c62828; font-weight: bold; }}
</style>
</head>
<body>

<h1>奇門遁甲特徵標籤解釋</h1>

<p class="intro">
本報表說明關聯規則分析中使用的所有奇門遁甲特徵。<br>
報表中的前提條件格式為 <code>特徵名_值</code>，例如 <code>值符星_天芮</code> 代表「值符星為天芮」。<br>
特徵設計依據：<b>奇門時局：金融戰略全解邏輯 v3.0</b>
</p>

<h2>特徵一覽表</h2>

<table>
<tr>
  <th>分類</th>
  <th>特徵名稱</th>
  <th>說明</th>
  <th>報表中的標籤</th>
  <th>標籤含義</th>
</tr>
{rows_html}
</table>

<h2>多空分數計算方式</h2>
<p>「多空信號」由以下條件加總得出：</p>
<table class="score-table">
<tr><th>條件</th><th>分數</th></tr>
<tr><td>時日關係 = 生</td><td class="plus">+2</td></tr>
<tr><td>時日關係 = 剋</td><td class="minus">-2</td></tr>
<tr><td>白虎臨辛 = True</td><td class="minus">-2</td></tr>
<tr><td>辛旺衰 = 被生</td><td class="plus">+1</td></tr>
<tr><td>辛旺衰 = 被剋</td><td class="minus">-1</td></tr>
<tr><td>有吉格（丙加庚/戊加丙/丁加丁）</td><td class="plus">+1</td></tr>
<tr><td>有凶格（庚加丙/癸丁）</td><td class="minus">-1</td></tr>
<tr><td>值符星吉凶 = 吉</td><td class="plus">+1</td></tr>
<tr><td>值符星吉凶 = 凶</td><td class="minus">-1</td></tr>
<tr><td>值使門吉凶 = 吉</td><td class="plus">+1</td></tr>
<tr><td>值使門吉凶 = 凶</td><td class="minus">-1</td></tr>
<tr><td>門宮關係 = 買方優 或 軋空</td><td class="plus">+1</td></tr>
<tr><td>門宮關係 = 越買越跌 或 賣方控</td><td class="minus">-1</td></tr>
<tr><td>辛入空亡 = True</td><td class="minus">-1</td></tr>
</table>
<p>分數 ≥3 → 強多 | 1~2 → 偏多 | 0 → 中性 | -1~-2 → 偏空 | ≤-3 → 強空</p>

<div class="note">
報表產出時間: {now}
</div>

</body>
</html>"""

    os.makedirs(output_dir, exist_ok=True)
    filepath = os.path.join(output_dir, "feature_glossary.html")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"特徵標籤解釋報表: {filepath}")
    return filepath


if __name__ == "__main__":
    output_dir = os.path.join(os.path.dirname(__file__), "..", "output")
    generate_glossary(output_dir)
