# 奇門遁甲排盤 API 開發者文件

這個 API 提供外部系統即時取得「時盤」與「日盤」的完整奇門遁甲排盤結果。

## 📍 Endpoint 資訊
* **URL:** `/api/layout`
* **Method:** `POST`
* **Content-Type:** `application/json`

---

## 📥 請求參數 (Request Body)

請使用 JSON 格式發送請求：

| 參數名稱 | 類型 | 必填 | 說明 | 範例 |
| --- | --- | --- | --- | --- |
| `chartType` | `string` | 否 | 排盤種類。可輸入 `"hour"` (時盤) 或 `"day"` (日盤)。<br>預設值為 `"hour"`。 | `"day"` |
| `timeMode` | `string` | 否 | 時間模式。可輸入 `"now"` (目前時間) 或 `"custom"` (指定時間)。<br>預設值為 `"now"`。 | `"custom"` |
| `datetime` | `string` | 視情況 | 當 `timeMode` 設為 `"custom"` 時**必填**。<br>接受標準的 ISO 或時間字串格式。 | `"2026-03-23T11:05:00"` |

> 💡 **日盤時間說明：** 若 `chartType` 為 `day`，API 內部會自動將傳入的日期標準化為當日中午 12:00 進行排盤，以確保同一天的任何時間點取得的日盤結果完全一致（消除時區或過子時的邊界糾紛）。

---

## 📤 回傳格式 (Response)

API 將會回傳結構化的 JSON，內含所有奇門遁甲的資訊。

### 成功回傳 (HTTP 200)

```json
{
  "success": true,
  "timeInfo": {
    "providedTime": "2026/3/23 下午12:00:00",
    "yearGZ": "丙午年",
    "monthGZ": "辛卯",
    "dayGZ": "丙申",
    "hourGZ": "——"   // 時盤時會顯示如 "甲午"
  },
  "chartType": "日盤",
  "layoutResult": {
    "isYang": true,                // true: 陽遁, false: 陰遁
    "juNum": 7,                    // 局數 (1~9)
    "jieqiName": "冬至",           // 統領的節氣
    "yuan": "陽七局(中60天)",      // 元或局數全稱說明
    "xunStem": "辛",               // 旬首天干
    "xunZhi": "丑",                // 旬首地支
    "zhiFuStar": "天蓬",           // 值符
    "zhiShiGate": "休門",          // 值使
    "diPan": {                     // 地盤干分布 (宮位 1~9: 元素)
      "1": "丙",
      "2": "庚",
      "3": "癸",
      // ...
    },
    "tianPanStar": {               // 天盤星分布
      "1": "天蓬",
      "2": "天芮禽",               // 原本天禽皆與天芮同宮
      // ...
    },
    "finalGates": {                // 八門分布
      "1": "休門",
      "2": "死門",
      // ...
    },
    "finalGods": {                 // 八神分布
      "1": "螣蛇",
      "2": "九地",
      // ...
    },
    "kongWang": ["戌", "亥"],      // 空亡地支
    "kongWangGan": ["甲", "乙"],    // 空亡天干
    "kongWangPalaces": [6]         // 空亡落宮陣列 (例如 6代表乾宮空亡)
  }
}
```

### 錯誤回傳 (HTTP 400 或 500)

```json
{
  "error": "timeMode 是 custom 時必須提供 datetime"
}
```

---

## 💻 程式語言串接範例

### 1. cURL (Bash)
取得「今天目前時間」的「日盤」：
```bash
curl -X POST http://localhost:3000/api/layout \
  -H "Content-Type: application/json" \
  -d '{"chartType": "day", "timeMode": "now"}'
```

### 2. Node.js (Fetch API)
取得指定時間的「時盤」：
```javascript
async function getHourlyChart() {
  const response = await fetch('http://localhost:3000/api/layout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chartType: 'hour',
      timeMode: 'custom',
      datetime: '2026-03-23T11:05:00'
    })
  });
  
  const data = await response.json();
  console.log('值符:', data.layoutResult.zhiFuStar);
  console.log('第一宮的門:', data.layoutResult.finalGates['1']);
}

getHourlyChart();
```

### 3. Python (Requests)
```python
import requests

url = "http://localhost:3000/api/layout"
payload = {
    "chartType": "hour",
    "timeMode": "custom",
    "datetime": "2026-03-23 11:05"
}

response = requests.post(url, json=payload)

if response.status_code == 200:
    data = response.json()
    print("排盤局數:", data['layoutResult']['juNum'])
    print("地盤陣列:", data['layoutResult']["diPan"])
else:
    print("錯誤:", response.text)
```
