require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

// 服務靜態前端檔案
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let openai;
if (OPENAI_API_KEY && OPENAI_API_KEY !== 'your_openai_api_key_here') {
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
}

// ============================================================
// 讀取外部設定檔 (啟動時載入所有模式)
// ============================================================
function loadFile(filename) {
  try {
    const p = path.join(__dirname, filename);
    if (!fs.existsSync(p)) return '';
    return fs.readFileSync(p, 'utf8');
  } catch (err) {
    console.error(`⚠️ 無法讀取 ${filename}: ${err.message}`);
    return '';
  }
}

// 傳統經典模式 (Classic)
const classicLogicHour   = loadFile('analysis_logic.txt');
const classicLogicDaily  = loadFile('analysis_logic_daily.txt');
const classicPromptHour  = loadFile('prompt_format_hour.txt');
const classicPromptDaily = loadFile('prompt_format_daily.txt');

// 金融實戰模式 (Financial v2)
const finLogicHour       = loadFile('analysis_logic_fin.txt');
const finLogicDaily      = loadFile('analysis_logic_fin_daily.txt');
const finPromptHour      = loadFile('prompt_format_fin_hour.txt');
const finPromptDaily     = loadFile('prompt_format_fin_daily.txt');

console.log(`✅ 系統邏輯:   傳統模式 [時:${!!classicLogicHour} 日:${!!classicLogicDaily}] | 金融模式 [時:${!!finLogicHour} 日:${!!finLogicDaily}]`);

// ============================================================
// API：解盤
// ============================================================
app.post('/api/analyze', async (req, res) => {
  if (!openai) {
    return res.status(500).json({ error: '請在 .env 檔案中設定 OPENAI_API_KEY' });
  }

  try {
    const { chartData, chartType, analysisMode } = req.body;

    if (!chartData) {
      return res.status(400).json({ error: '缺少排盤資料(chartData)' });
    }

    const isDaily = chartType === 'day';
    const isFin   = analysisMode === 'financial';

    let systemPrompt = '';
    let promptTemplate = '';

    if (isFin) {
      systemPrompt   = isDaily ? finLogicDaily  : finLogicHour;
      promptTemplate = isDaily ? finPromptDaily : finPromptHour;
    } else {
      systemPrompt   = isDaily ? classicLogicDaily  : classicLogicHour;
      promptTemplate = isDaily ? classicPromptDaily : classicPromptHour;
    }

    if (!systemPrompt || !promptTemplate) {
      return res.status(500).json({ error: '找不到對應模式的解盤邏輯或模板文件' });
    }

    // 將模板中的佔位符替換為實際盤面資訊
    const prompt = promptTemplate.replace('{{CHART_DATA}}', chartData);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // 確保使用正確模型名稱
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: prompt }
      ],
      temperature: 0.1,
    });

    res.json({ result: completion.choices[0].message.content });

  } catch (error) {
    console.error('OpenAI API 錯誤:', error);
    res.status(500).json({ error: '解盤過程發生錯誤，請稍後再試。', details: error.message });
  }
});

// ============================================================
// API：取得外部排盤結果 (結構化 JSON)
// 外部可傳輸： 
// {
//   "chartType": "day" | "hour",
//   "timeMode": "now" | "custom",
//   "datetime": "2026-03-23 11:05" (如果 timeMode 是 custom)
// }
// ============================================================
app.post('/api/layout', async (req, res) => {
  try {
    const { chartType = 'hour', timeMode = 'now', datetime } = req.body;

    let dt;
    if (timeMode === 'now') {
      dt = new Date();
    } else {
      if (!datetime) return res.status(400).json({ error: 'timeMode 是 custom 時必須提供 datetime' });
      dt = new Date(datetime);
      if (isNaN(dt.getTime())) return res.status(400).json({ error: '無效的時間格式' });
    }

    // 若是日盤，固定在當日 12:00
    if (chartType === 'day') {
      dt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 12, 0, 0);
    }

    // 動態載入前端的排盤模組
    let layout;
    if (chartType === 'day') {
      const qmdjDaily = await import('./qmdj_daily.js');
      layout = qmdjDaily.buildDailyLayout(dt);
    } else {
      const qmdjHour = await import('./qmdj.js');
      layout = qmdjHour.buildFullLayout(dt, { yang: null, ju: null });
    }

    // 將 Set 轉換為 Array 以便 JSON 回傳
    if (layout.kongWangPalaces instanceof Set) {
      layout.kongWangPalaces = Array.from(layout.kongWangPalaces);
    }

    // ====== 製作人類可讀的終端機排版 (Visual Text) ======
    const currentZhiFuPalace  = Object.keys(layout.finalGods).find(p => layout.finalGods[p] === '值符');
    const currentZhiShiPalace = Object.keys(layout.finalGates).find(p => layout.finalGates[p] === layout.zhiShiGate);

    let visualText = 
`=========================================
【時間】 ${dt.toLocaleString('zh-TW')}
【四柱】 ${layout.yearGZ}年 ${layout.monthGZ}月 ${layout.dayGZ}日 ${layout.hourGZ}時
【局數】 ${layout.isYang ? '陽' : '陰'}遁${layout.juNum}局 (${layout.jieqiName} ${layout.yuan})
【旬首】 甲${layout.xunZhi}(${layout.xunStem})
【值符】 ${layout.zhiFuStar} (落第${currentZhiFuPalace}宮)  |  【值使】 ${layout.zhiShiGate} (落第${currentZhiShiPalace}宮)
【空亡】 ${layout.kongWang ? layout.kongWang.join('') : ''}
-----------------------------------------
【九宮格狀態排盤】
`;

    const dirMap = {4:'東南',9:'南',2:'西南',3:'東',5:'中',7:'西',8:'東北',1:'北',6:'西北'};
    // 九宮格按照 4,9,2 / 3,5,7 / 8,1,6 的視覺順序輸出
    const gridRows = [ [4,9,2], [3,5,7], [8,1,6] ];
    
    gridRows.forEach((row) => {
      let rowHeader = '';
      let rowContent = '';
      row.forEach(p => {
        const isKw = layout.kongWangPalaces && layout.kongWangPalaces.includes(p);
        const kwTag = isKw ? '[空]' : '    ';
        
        if (p === 5) { // 中宮
          rowHeader += ` | 〖 中 5 宮 〗${kwTag}    `.padEnd(28, ' ');
          rowContent += ` | 地盤干: ${layout.diPan[5]}          `.padEnd(28, ' ');
        } else {
          const star = layout.tianPanStar[p];
          const gate = layout.finalGates[p];
          const god = layout.finalGods[p];
          const tStem = layout.tianPanStem[p];
          const dStem = layout.diPan[p];
          rowHeader += ` | 〖 ${dirMap[p]} ${p} 宮 〗${kwTag}    `.padEnd(29, ' ');
          rowContent += ` | 神:${god} 星:${star} 門:${gate} 天干:${tStem} 地干:${dStem} `.padEnd(29, ' ');
        }
      });
      visualText += rowHeader + ' |\n' + rowContent + ' |\n------------------------------------------------------------------------------------------\n';
    });

    res.json({
      success: true,
      timeInfo: {
        providedTime: dt.toLocaleString('zh-TW'),
        yearGZ: layout.yearGZ,
        monthGZ: layout.monthGZ,
        dayGZ: layout.dayGZ,
        hourGZ: layout.hourGZ
      },
      chartType: chartType === 'day' ? '日盤' : '時盤',
      visualText: visualText,
      layoutResult: layout
    });

  } catch (error) {
    console.error('排盤發生錯誤:', error);
    res.status(500).json({ error: '伺服器內部錯誤', details: error.message });
  }
});

// ============================================================
// 啟動伺服器
// ============================================================
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your_openai_api_key_here') {
    console.warn('⚠️  警告: 尚未設定 OPENAI_API_KEY，解盤功能無法使用。');
  }
});
