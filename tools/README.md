# tools/ 工具集

本目錄包含奇門遁甲排盤系統的命令列工具與研究用腳本，主要分三類：
**API 客戶端**、**資料擷取**、**研究分析報表**。

---

## 檔案總覽

| 檔案                                                           | 語言    | 用途                             |
| -------------------------------------------------------------- | ------- | -------------------------------- |
| [`qmdj_client.py`](#qmdj_clientpy)                             | Python  | 奇門遁甲排盤 API 客戶端          |
| [`fx_kbar.py`](#fx_kbarpy)                                     | Python  | FX K-bar 資料庫擷取（MySQL）     |
| [`qmdj_kbar_dataset.py`](#qmdj_kbar_datasetpy)                 | Python  | 奇門 × 2H K-Bar 研究資料集產生器 |
| [`qmdj_feature_engineering.py`](#qmdj_feature_engineeringpy)   | Python  | 將原始盤面轉為金融分析特徵       |
| [`qmdj_association_rules.py`](#qmdj_association_rulespy)       | Python  | 多空關聯規則挖掘與報表產出       |
| [`generate_feature_glossary.py`](#generate_feature_glossarypy) | Python  | 特徵標籤解釋報表產出             |
| [`test_api.js`](#test_apijs)                                   | Node.js | API 端點快速測試                 |

---

## 完整工作流程

```
1. 啟動伺服器              → node server.js
2. 產生研究資料集          → python tools/qmdj_kbar_dataset.py
3. 跑關聯規則分析（多/空） → python tools/qmdj_association_rules.py
4. 產出特徵字典            → python tools/generate_feature_glossary.py
5. 開瀏覽器看報表          → output/rules_bull.html
                            → output/rules_bear.html
                            → output/feature_glossary.html
```

所有設定（商品、日期、門檻）統一在專案根目錄 `.env` 維護。

---

## qmdj_client.py

### 用途
串接 Express 伺服器的 `/api/layout` 端點，取得奇門遁甲時盤或日盤的完整排盤資料，並支援轉為 DataFrame 與匯出 CSV。

### 前置條件
- Express 伺服器執行中（`node server.js`）
- Python 套件：`requests`, `pandas`, `python-dotenv`
- `.env` 設定 `PORT`

### 主要函式
| 函式                                    | 說明                                       |
| --------------------------------------- | ------------------------------------------ |
| `get_layout(chart_type, time_mode, dt)` | 呼叫 API 取得排盤 JSON                     |
| `print_layout(data)`                    | 印出人類可讀的排盤摘要                     |
| `layout_to_dataframe(data)`             | 將排盤結果轉為單列 DataFrame（含九宮展開） |
| `export_csv(data, filepath, append)`    | 匯出 CSV，支援單筆/多筆/附加模式           |

### 使用範例
```python
from tools.qmdj_client import get_layout, layout_to_dataframe, export_csv

# 目前時間時盤
data = get_layout(chart_type="hour", time_mode="now")

# 指定時間（台灣時間）
data = get_layout(chart_type="hour", time_mode="custom", dt="2026-04-12T14:00:00")

# 轉 DataFrame 並匯出（utf-8-sig，Excel 直接開）
df = layout_to_dataframe(data)
export_csv(data, "output.csv")
```

---

## fx_kbar.py

### 用途
從 `mas_ea_fx` MySQL 資料庫撈取外匯 K 線資料，支援多種 timeframe 查詢與 H2 聚合。

### 前置條件
- MySQL 資料庫 `mas_ea_fx` 運行中
- `.env` 設定 `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_PORT`, `DB_NAME`
- Python 套件：`pandas`, `sqlalchemy`, `pymysql`, `python-dotenv`

### 主要函式
| 函式                                                | 說明                             |
| --------------------------------------------------- | -------------------------------- |
| `get_bars(symbol, start_date, end_date, timeframe)` | 通用 K 線查詢（M15/H1/H4/D1）    |
| `get_h1_bars(symbol, start_date, end_date)`         | H1 K 線快捷方式                  |
| `get_m15_bars(symbol, start_date, end_date)`        | M15 K 線快捷方式                 |
| `resample_to_h2(df)`                                | 將 H1 資料聚合為 H2 OHLC         |
| `get_h2_bars(symbol, start_date, end_date)`         | 一步取得 H2 K 線（自動 H1 聚合） |
| `export_csv(df, filepath)`                          | 匯出 CSV                         |

### 可用商品
`GOLD_`, `EURUSD`, `GBPUSD`, `USDJPY`（依 DB 實際資料而定）

### 可用 Timeframe
`M15`, `H1`, `H4`, `D1`

### 注意事項
- DB 內 `ts` 欄位為 **UTC 時間**，呼叫端需自行處理時區
- DB 內**沒有原生 H2**，需透過 `get_h2_bars()` 由 H1 聚合

### 使用範例
```python
from tools.fx_kbar import get_bars, get_h2_bars, export_csv

# M15 原始資料
df = get_bars("GOLD_", "2026-03-01", "2026-03-31", timeframe="M15")

# H2 聚合資料
df = get_h2_bars("GOLD_", "2026-03-01", "2026-03-31")

export_csv(df, "gold_h2.csv")
```

---

## qmdj_kbar_dataset.py

### 用途
整合奇門遁甲排盤與 FX K-bar，批量產生研究用資料集。
**每筆資料 = 一個時辰的奇門盤面 + 對應 2 小時市場表現 + 衍生標籤。**

### 前置條件
- Express 伺服器執行中（`node server.js`）
- MySQL 資料庫 `mas_ea_fx` 運行中
- Python 套件：同上兩支工具的依賴

### 時間對齊規則
- 奇門時辰以 **台灣時間（UTC+8）** 為準
- K-bar 查詢自動轉換為 **UTC** 對應資料庫
- 外匯休市時段（週五 22:00 UTC ~ 週日 22:00 UTC）自動跳過

| 時辰 | 台灣時間    | UTC         |
| ---- | ----------- | ----------- |
| 子時 | 23:00-01:00 | 15:00-17:00 |
| 丑時 | 01:00-03:00 | 17:00-19:00 |
| 寅時 | 03:00-05:00 | 19:00-21:00 |
| 卯時 | 05:00-07:00 | 21:00-23:00 |
| 辰時 | 07:00-09:00 | 23:00-01:00 |
| 巳時 | 09:00-11:00 | 01:00-03:00 |
| 午時 | 11:00-13:00 | 03:00-05:00 |
| 未時 | 13:00-15:00 | 05:00-07:00 |
| 申時 | 15:00-17:00 | 07:00-09:00 |
| 酉時 | 17:00-19:00 | 09:00-11:00 |
| 戌時 | 19:00-21:00 | 11:00-13:00 |
| 亥時 | 21:00-23:00 | 13:00-15:00 |

### 輸出欄位
| 區塊     | 欄位                                                                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 主鍵     | `symbol`, `qimen_time_tw`, `dizhi`, `bar_start_utc`, `bar_end_utc`                                                                                  |
| 奇門盤面 | 年柱, 月柱, 日柱, 時柱, 陰陽遁, 局數, 節氣, 元, 旬首干, 旬首支, 值符星, 值使門, 空亡地支, 空亡天干, 空亡宮, 宮1~9（地盤干/天盤星/天盤干/八門/八神） |
| K Bar    | `open`, `high`, `low`, `close`                                                                                                                      |
| 報酬     | `ret_close_open`, `ret_high_open`, `ret_low_open`, `range_hl`, `body_pct`                                                                           |
| 標籤     | `direction_2h`（1/0/-1）, `path_type`                                                                                                               |

### 標籤定義
**direction_2h**（方向標籤）

| 值  | 條件                                    |
| --- | --------------------------------------- |
| 1   | ret_close_open > +`LABEL_DIR_THRESHOLD` |
| -1  | ret_close_open < -`LABEL_DIR_THRESHOLD` |
| 0   | 其他（震盪）                            |

**path_type**（路徑標籤，純由 M15 子 K 線高低點時間順序決定）

| 標籤            | 說明                                                           |
| --------------- | -------------------------------------------------------------- |
| `UP_FIRST`      | 先衝高（最高點先於最低點出現）                                 |
| `DOWN_FIRST`    | 先探底（最低點先於最高點出現）                                 |
| `UP_CONTINUE`   | 單邊上行（上行幅度 > 下行幅度 × `LABEL_PATH_ONE_SIDED_RATIO`） |
| `DOWN_CONTINUE` | 單邊下行（下行幅度 > 上行幅度 × `LABEL_PATH_ONE_SIDED_RATIO`） |
| `RANGE`         | 區間震盪（波幅 < `LABEL_PATH_RANGE_THRESHOLD`）                |

### .env 相關設定
```env
DATASET_SYMBOL=GOLD_
DATASET_START_DATE=2025-01-01
DATASET_END_DATE=2026-03-31
DATASET_M15_BUFFER_DAYS=2
LABEL_DIR_THRESHOLD=0.001
LABEL_PATH_RANGE_THRESHOLD=0.001
LABEL_PATH_ONE_SIDED_RATIO=3
```

### 直接執行
```bash
node server.js                     # 先啟動伺服器
python tools/qmdj_kbar_dataset.py  # 產生資料集
```
輸出：`output/{symbol}_qmdj_dataset_{start}_{end}.csv`

---

## qmdj_feature_engineering.py

### 用途
將原始盤面 DataFrame 轉為**有奇門金融分析意義的特徵**，給後續關聯規則或機器學習用。
特徵設計依據 `config/prompts/analysis_logic_fin.txt` (v3.0)。

### 主要函式
| 函式                   | 說明                                  |
| ---------------------- | ------------------------------------- |
| `extract_features(df)` | 從原始盤面 DataFrame 提取奇門金融特徵 |

### 產出特徵
| 分類     | 特徵                                                   |
| -------- | ------------------------------------------------------ |
| 時干日干 | `時干`, `日干`, `時日關係`（生剋比和）                 |
| 黃金動能 | `辛落宮`, `辛旺衰`, `辛入空亡`                         |
| 阻力指標 | `庚落宮`                                               |
| 值符值使 | `值符星吉凶`, `值使門吉凶`                             |
| 天干格局 | `天干格局`（丙加庚/丁加丁/癸丁等）, `有吉格`, `有凶格` |
| 盈虧線   | `生門落宮`, `戊落宮`, `生門戊關係`                     |
| 主力動向 | `白虎落宮`, `白虎臨辛`                                 |
| 控盤權   | `門宮關係`（門剋宮/宮生門/門生宮/宮剋門）              |
| 綜合     | `多空分數`, `多空信號`（強多/偏多/中性/偏空/強空）     |

### .env 相關設定
```env
SIGNAL_STRONG_BULL=3   # 多空分數 ≥ 此值 → 強多
SIGNAL_BULL=1          # 多空分數 ≥ 此值 → 偏多
SIGNAL_BEAR=-1         # 多空分數 ≤ 此值 → 偏空
SIGNAL_STRONG_BEAR=-3  # 多空分數 ≤ 此值 → 強空
```

### 使用範例
```python
import pandas as pd
from tools.qmdj_feature_engineering import extract_features, ANALYSIS_FEATURES

df = pd.read_csv("output/GOLD__qmdj_dataset_2025-01-01_2026-03-31.csv")
df_feat = extract_features(df)
print(df_feat[ANALYSIS_FEATURES].head())
```

通常**不會單獨執行**，由 `qmdj_association_rules.py` 自動呼叫。

---

## qmdj_association_rules.py

### 用途
對研究資料集做**多空分離的關聯規則挖掘**，找出「奇門盤面條件 → 漲/跌」的規律，並產出 HTML/CSV 報表。

### 前置條件
- 已有 `output/{symbol}_qmdj_dataset_{start}_{end}.csv`
- Python 套件：`pandas`, `mlxtend`, `python-dotenv`

### 工作流程
1. 載入原始資料集 → 執行 `extract_features()` 取得分析特徵
2. **針對「漲」** 做二元編碼，跑 FP-Growth + 關聯規則
3. **針對「跌」** 做二元編碼，跑 FP-Growth + 關聯規則
4. 兩邊各自過濾、去除子集冗餘、排序
5. 產出兩份報表（多/空各一）

### 為什麼要分離多空
- 漲跌的基準率不同（如漲 38%, 跌 30%）
- 統一分析時，跌的規則容易被漲的高 confidence 門檻擋掉
- 分開做可以**用各自的基準率**作為 confidence 門檻

### 報表欄位
| 欄位          | 中文     | 說明                              |
| ------------- | -------- | --------------------------------- |
| `antecedents` | 前提條件 | 奇門盤面組合（最多由演算法決定）  |
| `consequents` | 結論     | 方向=漲 或 方向=跌                |
| `support`     | 支持度   | 規則在全部資料中出現比例          |
| `confidence`  | 置信度   | 前提出現時，結論發生的條件機率    |
| `lift`        | 提升度   | 比隨機猜測好幾倍（>1.2 值得關注） |
| `coverage`    | 覆蓋率   | 抓到了所有漲（或跌）裡面的幾%     |
| `conviction`  | 確信度   | 規則的依賴強度                    |
| `count`       | 筆數     | 符合條件的實際資料量              |

### .env 相關設定
```env
RULES_MIN_SUPPORT=0.02            # 最小支持度
RULES_MIN_LIFT=1.1                # 最小提升度
RULES_LIFT_IMPROVE_THRESHOLD=0.05 # 組合 lift 改善門檻
RULES_CONF_OVER_BASE=0.02         # 置信度高於基準率多少
```

### 直接執行
```bash
python tools/qmdj_association_rules.py
```
輸出：
- `output/rules_bull.html` / `.csv` — 做多分析
- `output/rules_bear.html` / `.csv` — 做空分析

---

## generate_feature_glossary.py

### 用途
產出**奇門特徵標籤解釋報表**，讓使用者對照關聯規則報表看每個 `特徵_值` 的意義。

### 內容
- 8 大分類的特徵說明（時間、值符值使、時日關係、黃金動能、天干格局、盈虧線、控盤權、綜合信號）
- 每個值的詳細解釋
- 多空分數計算方式對照表

### 直接執行
```bash
python tools/generate_feature_glossary.py
```
輸出：`output/feature_glossary.html`

通常只需執行一次，除非特徵設計有變更。

---

## test_api.js

### 用途
Node.js 寫的 API 快速測試腳本，測試 `/api/layout` 端點的時盤與日盤功能。

### 前置條件
- Node.js 18+
- Express 伺服器執行中

### 直接執行
```bash
node tools/test_api.js
```

---

## 環境設定（.env）

所有工具共用專案根目錄的 `.env` 檔案。完整設定如下：

```env
# Express 伺服器
PORT=3001

# OpenAI（解盤用）
OPENAI_API_KEY=sk-...

# Database (mas_ea_fx)
DB_USER=root
DB_PASS=yourpassword
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=mas_ea_fx

# === Dataset 設定（qmdj_kbar_dataset.py）===
DATASET_SYMBOL=GOLD_              # 商品代碼
DATASET_START_DATE=2025-01-01     # 起始日（台灣時間）
DATASET_END_DATE=2026-03-31       # 結束日（台灣時間）
DATASET_M15_BUFFER_DAYS=2         # M15 邊界緩衝天數

# === 標籤判定設定（qmdj_kbar_dataset.py）===
LABEL_DIR_THRESHOLD=0.001         # 漲跌方向門檻（0.001 = 0.1%）
LABEL_PATH_RANGE_THRESHOLD=0.001  # 震盪判定門檻
LABEL_PATH_ONE_SIDED_RATIO=3      # 單邊行情倍率

# === 多空信號等級（qmdj_feature_engineering.py）===
SIGNAL_STRONG_BULL=3
SIGNAL_BULL=1
SIGNAL_BEAR=-1
SIGNAL_STRONG_BEAR=-3

# === 關聯規則分析設定（qmdj_association_rules.py）===
RULES_MIN_SUPPORT=0.02            # 最小支持度
RULES_MIN_LIFT=1.1                # 最小提升度
RULES_LIFT_IMPROVE_THRESHOLD=0.05 # 組合 lift 改善門檻
RULES_CONF_OVER_BASE=0.02         # 置信度高於基準率多少
```

---

## 依賴套件

```bash
pip install requests pandas python-dotenv sqlalchemy pymysql mlxtend
```
