/**
 * 奇門遁甲排盤前端 - 互動邏輯 (app.js) v2
 * 對應 qmdj.js v2（cc.txt 優化版）
 */
import {
  buildFullLayout,
  wuxingColor,
  TIANGAN_WUXING,
  STAR_LUCK,
  GATE_LUCK
} from './lib/qmdj.js';
import { buildDailyLayout } from './lib/qmdj_daily.js';

// ====================================================
// 全域狀態
// ====================================================
let mode = 'now';
let chartType = 'hour';    // 'hour' = 時盤, 'day' = 日盤
let currentLayoutData = null;

document.addEventListener('DOMContentLoaded', () => {
  initModeSwitcher();
  initChartTypeSwitcher();
  initOverridePanel();
  initClock();
  initForm();
  initAIDecoder();
  setDatetimeInputToNow();
});

// ====================================================
// 時鐘
// ====================================================
function initClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const dateStr = `${now.getFullYear()} 年 ${now.getMonth()+1} 月 ${now.getDate()} 日`;
  const el = document.getElementById('current-time-display');
  if (el) {
    el.innerHTML = `<div class="time-big">${timeStr}</div><div class="time-sub">${dateStr}</div>`;
  }
}

// ====================================================
// 模式切換
// ====================================================
function initModeSwitcher() {
  const nowBtn    = document.getElementById('btn-mode-now');
  const customBtn = document.getElementById('btn-mode-custom');
  const customForm = document.getElementById('custom-time-form');

  nowBtn.addEventListener('click', () => {
    mode = 'now';
    nowBtn.classList.add('active');
    customBtn.classList.remove('active');
    customForm.style.display = 'none';
  });
  customBtn.addEventListener('click', () => {
    mode = 'custom';
    customBtn.classList.add('active');
    nowBtn.classList.remove('active');
    customForm.style.display = 'block';
    setDatetimeInputToNow();
  });
}

function setDatetimeInputToNow() {
  const input = document.getElementById('custom-datetime');
  if (!input) return;
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  input.value = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// ====================================================
// 表單提交
// ====================================================
function initOverridePanel() {
  const toggle = document.getElementById('override-toggle');
  const body   = document.getElementById('override-body');
  const chevron= document.getElementById('override-chevron');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    chevron.textContent = open ? '▶' : '▼';
  });
}

function getOverride() {
  const yangEl = document.getElementById('override-yang');
  const juEl   = document.getElementById('override-ju');
  const yangVal = yangEl ? yangEl.value : 'auto';
  const juVal   = juEl   ? juEl.value   : 'auto';
  return {
    yang: yangVal === 'auto' ? null : yangVal === 'yang',
    ju:   juVal  === 'auto' ? null : parseInt(juVal)
  };
}

function initForm() {
  const btn = document.getElementById('btn-calculate');
  btn.addEventListener('click', () => {
    let dt;
    if (mode === 'now') {
      dt = new Date();
      // 日盤：固定用今天中午 12:00，確保全天一致
      if (chartType === 'day') {
        dt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 12, 0, 0);
      }
    } else {
      if (chartType === 'day') {
        // 日盤：讀純日期，固定 12:00
        const val = document.getElementById('custom-date').value;
        if (!val) { alert('請選擇日期'); return; }
        const [y, m, d] = val.split('-').map(Number);
        dt = new Date(y, m - 1, d, 12, 0, 0);
      } else {
        // 時盤：讀 datetime-local
        const val = document.getElementById('custom-datetime').value;
        if (!val) { alert('請選擇時間'); return; }
        dt = new Date(val);
      }
    }
    performLayout(dt);
  });
}

// ====================================================
// 時盤/日盤切換
// ====================================================
function initChartTypeSwitcher() {
  const hourBtn      = document.getElementById('btn-type-hour');
  const dayBtn       = document.getElementById('btn-type-day');
  const overrideSection  = document.querySelector('.override-section');
  const hourGroup    = document.getElementById('hour-datetime-group');
  const dayGroup     = document.getElementById('day-date-group');
  if (!hourBtn || !dayBtn) return;

  function switchToHour() {
    chartType = 'hour';
    hourBtn.classList.add('active');
    dayBtn.classList.remove('active');
    if (overrideSection) overrideSection.style.display = '';
    if (hourGroup) hourGroup.style.display = '';
    if (dayGroup)  dayGroup.style.display  = 'none';
  }
  function switchToDay() {
    chartType = 'day';
    dayBtn.classList.add('active');
    hourBtn.classList.remove('active');
    if (overrideSection) overrideSection.style.display = 'none';
    if (hourGroup) hourGroup.style.display  = 'none';
    if (dayGroup)  dayGroup.style.display   = '';
    // 同步日期選擇器到今天
    const dateInput = document.getElementById('custom-date');
    if (dateInput && !dateInput.value) {
      const now = new Date();
      dateInput.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    }
  }

  hourBtn.addEventListener('click', switchToHour);
  dayBtn.addEventListener('click', switchToDay);
}


// ====================================================
function performLayout(dt) {
  const resultArea = document.getElementById('result-area');
  resultArea.classList.remove('visible');
  const override = getOverride();
  setTimeout(() => {
    try {
      const layout = (chartType === 'day')
        ? buildDailyLayout(dt)
        : buildFullLayout(dt, override);
      renderResult(layout, dt);
      resultArea.classList.add('visible');
    } catch(e) {
      console.error('排盤錯誤:', e);
      alert('排盤計算發生錯誤: ' + e.message);
    }
  }, 150);
}

// ====================================================
// 渲染結果
// ====================================================
function renderResult(layout, dt) {
  currentLayoutData = { layout, dt }; // 儲存起來給 AI 解盤用
  
  // 隱藏/重設先前的解盤結果
  const aiResult = document.getElementById('ai-result');
  const aiLoading = document.getElementById('ai-loading');
  if (aiResult) { aiResult.style.display = 'none'; aiResult.innerHTML = ''; }
  if (aiLoading) { aiLoading.style.display = 'none'; }

  renderSiZhu(layout, dt);
  renderJuInfo(layout);
  renderBaguaGrid(layout);
}

// ====================================================
// AI 智能解盤串接
// ====================================================
let analysisMode = 'classic'; // 預設：classic, financial

function initAIDecoder() {
  const btn = document.getElementById('btn-ai-analyze');
  const loading = document.getElementById('ai-loading');
  const resultDiv = document.getElementById('ai-result');
  const modeBtns = document.querySelectorAll('.mode-opt');
  
  if (modeBtns) {
    modeBtns.forEach(m => {
      m.addEventListener('click', () => {
        modeBtns.forEach(opt => opt.classList.remove('active'));
        m.classList.add('active');
        analysisMode = m.dataset.mode;
      });
    });
  }

  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (!currentLayoutData) {
      alert('請先進行排盤！');
      return;
    }

    // 準備字串化盤面資訊
    const { layout, dt } = currentLayoutData;
    const {
      yearGZ, monthGZ, dayGZ, hourGZ, isYang, juNum, jieqiName, yuan,
      xunStem, xunZhi, xunPalace, zhiFuStar, zhiShiGate,
      kongWangGan, kongWang, diPan, tianPanStar, tianPanStem, finalGates, finalGods,
      stemAtStarSource, stemAtGateSource
    } = layout;
    // ★ 精準提取 日干(你) 與 時干(行情) 並找出其天盤落宮 ★
    const dayGan  = dayGZ[0];
    const hourGan = hourGZ[0];
    
    const findPalaceByStem = (targetStem) => {
      if (!targetStem) return '未知';
      const target = (targetStem === '甲') ? xunStem : targetStem;
      
      // 優先找完全匹配（主干），若找不到再找包含匹配（寄宮）
      // 使用 stemAtStarSource 因為這是視覺上呈現的天盤位置 (top-right)
      let p = Object.keys(stemAtStarSource).find(k => k !== '5' && stemAtStarSource[k] === target);
      if (!p) {
        p = Object.keys(stemAtStarSource).find(k => k !== '5' && stemAtStarSource[k].includes(target));
      }
      return p || '未知';
    };

    const dayPalace  = findPalaceByStem(dayGan);
    const hourPalace = findPalaceByStem(hourGan);

    // ★ 明確計算 庚(黃金) 與 辛(白銀) 在天盤的正確落宮 ★
    // 數據源統一使用視覺渲染的 stemAtStarSource
    const goldPalace   = findPalaceByStem('庚');
    const silverPalace = findPalaceByStem('辛');

    const currentZhiFuPalace  = Object.keys(finalGods).find(p => finalGods[p] === '值符');
    const currentZhiShiPalace = Object.keys(finalGates).find(p => finalGates[p] === zhiShiGate);

    const dirMap = {4:'東南',9:'南',2:'西南',3:'東',5:'中',7:'西',8:'東北',1:'北',6:'西北'};

    let chartString = `
【時間】：${dt.toLocaleString('zh-TW')}
【四柱】：${yearGZ}年 ${monthGZ}月 ${dayGZ}日 ${hourGZ}時
【局數】：${isYang ? '陽' : '陰'}遁${juNum}局 (${jieqiName} ${yuan})
【旬首】：甲${xunZhi}(${xunStem})
【值符】：${zhiFuStar} (原始第${xunPalace}宮 ➔ 當前落第${currentZhiFuPalace}宮)
【值使】：${zhiShiGate} (當前落第${currentZhiShiPalace}宮)
【空亡】：${kongWang.join('')}

⚠️ 核心分析對象（請嚴格遵循以下角色定義）：
- 【你的代表 (日干)】：${dayGan} (當前落第${dayPalace}宮 ${dirMap[dayPalace] || ''}方)
- 【行情代表 (時干)】：${hourGan} (當前落第${hourPalace}宮 ${dirMap[hourPalace] || ''}方)
- 【黃金代表 (庚)的天盤落宮】：第${goldPalace}宮 ${dirMap[goldPalace] || ''}方
- 【白銀代表 (辛)的天盤落宮】：第${silverPalace}宮 ${dirMap[silverPalace] || ''}方

【九宮格狀態】（天盤干為天盤移位干，地盤干為地盤固定干）：\n`;

    [1,2,3,4,5,6,7,8,9].forEach(p => {
      const isKw = layout.kongWangPalaces && layout.kongWangPalaces.has(p);
      const kwTag = isKw ? '[空亡]' : '';

      if(p===5) {
        chartString += `[中5宮]${kwTag}: 地盤干:${diPan[5]}\n`;
      } else {
        chartString += `[${dirMap[p]}${p}宮]${kwTag}: 神:${finalGods[p]}, 星:${tianPanStar[p]}, 門:${finalGates[p]}, 天盤干:${tianPanStem[p]}, 地盤干:${diPan[p]}\n`;
      }
    });

    // 呼叫後端 API
    btn.disabled = true;
    loading.style.display = 'flex';
    resultDiv.style.display = 'none';

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chartData: chartString, chartType, analysisMode })
      });

      const data = await response.json();
      if (response.ok) {
        // 將換行轉為 <br>
        const formattedResult = data.result.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        resultDiv.innerHTML = `<div class="ai-content-inner">${formattedResult}</div>`;
        resultDiv.style.display = 'block';
      } else {
        resultDiv.innerHTML = `<div class="ai-error">${data.error || '解盤失敗'}</div>`;
        resultDiv.style.display = 'block';
      }
    } catch (err) {
      console.error(err);
      resultDiv.innerHTML = '<div class="ai-error">無法連線到 AI 解盤伺服器，請確認伺服器已啟動。</div>';
      resultDiv.style.display = 'block';
    } finally {
      btn.disabled = false;
      loading.style.display = 'none';
      // 滾動到底部觀看結果
      resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

// --- 四柱 ---
function renderSiZhu(layout, dt) {
  const { yearGZ, monthGZ, dayGZ, hourGZ, kongWang } = layout;
  const pad = n => String(n).padStart(2, '0');

  document.getElementById('info-datetime').innerHTML = `
    <div class="card-label">排盤時間</div>
    <div class="card-value" style="font-size:13px;letter-spacing:1px;line-height:1.5;">
      ${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}<br>
      ${pad(dt.getHours())}:${pad(dt.getMinutes())}
    </div>
  `;
  document.getElementById('info-year').innerHTML = `
    <div class="card-label">年柱</div>
    <div class="card-value">${yearGZ}</div>
    <div class="card-sub">${TIANGAN_WUXING[yearGZ[0]] || ''}</div>
  `;
  document.getElementById('info-month').innerHTML = `
    <div class="card-label">月柱</div>
    <div class="card-value">${monthGZ}</div>
    <div class="card-sub">${TIANGAN_WUXING[monthGZ[0]] || ''}</div>
  `;
  document.getElementById('info-day').innerHTML = `
    <div class="card-label">日柱</div>
    <div class="card-value">${dayGZ}</div>
    <div class="card-sub">${TIANGAN_WUXING[dayGZ[0]] || ''}</div>
  `;
  document.getElementById('info-hour').innerHTML = `
    <div class="card-label">時柱</div>
    <div class="card-value">${hourGZ}</div>
    <div class="card-sub">${TIANGAN_WUXING[hourGZ[0]] || ''}</div>
  `;
}

// --- 局資訊（含空亡）---
function renderJuInfo(layout) {
  const { isYang, juNum, jieqiName, yuan, xunStem, xunZhi, xunPalace, zhiFuStar, zhiShiGate, kongWang, kongWangGan, autoJuNum, overrideActive } = layout;

  const currentZhiFuPalace  = Object.keys(layout.finalGods).find(p => layout.finalGods[p] === '值符');
  const currentZhiShiPalace = Object.keys(layout.finalGates).find(p => layout.finalGates[p] === zhiShiGate);

  const overrideNote = overrideActive
    ? `<span style="font-size:11px;color:#fbbf24;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:6px;padding:2px 8px;">⚙ 手動覆蓋（自動計算: ${autoJuNum}局）</span>`
    : '';

  document.getElementById('ju-info').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
    <span class="ju-badge">
      <span class="${isYang ? 'yang' : 'yin'}">${isYang ? '陽遁' : '陰遁'}</span>
      <span class="num">${juNum}</span>
      <span class="unit">局</span>
      <span class="jieqi">｜ ${jieqiName} ${yuan}</span>
    </span>
    ${overrideNote}
    </div>
    <div class="ju-meta-row">
      <span class="ju-meta-item">
        <span class="ju-meta-label">旬首</span>
        <span class="ju-meta-val">甲${xunZhi}（${xunStem}）</span>
      </span>
      <span class="ju-meta-item">
        <span class="ju-meta-label">值符</span>
        <span class="ju-meta-val">${zhiFuStar}／落 ${currentZhiFuPalace} 宮</span>
      </span>
      <span class="ju-meta-item">
        <span class="ju-meta-label">值使</span>
        <span class="ju-meta-val">${zhiShiGate}／落 ${currentZhiShiPalace} 宮</span>
      </span>
      <span class="ju-meta-item kong-wang">
        <span class="ju-meta-label">空亡</span>
        <span class="ju-meta-val">${kongWang[0]}${kongWang[1]}</span>
      </span>
    </div>
  `;
}

// --- 九宮格 ---
function renderBaguaGrid(layout) {
  const rows = [[4,9,2],[3,5,7],[8,1,6]];
  const dirMap = {4:'東南',9:'南',2:'西南',3:'東',5:'中',7:'西',8:'東北',1:'北',6:'西北'};
  const grid = document.getElementById('bagua-grid');
  grid.innerHTML = '';
  rows.forEach(row => {
    row.forEach(palace => {
      grid.appendChild(createPalaceCell(palace, layout, dirMap[palace]));
    });
  });
}

function createPalaceCell(palace, layout, dir) {
  const {
    diPan, tianPanStar, finalGates, finalGods,
    stemAtStarSource, stemAtGateSource,
    kongWangPalaces
  } = layout;
  const isKongWang = kongWangPalaces && kongWangPalaces.has(palace);

  const cell = document.createElement('div');

  // 方位縮略（給宮格用）
  const dirShort = {
    4:'XUN', 9:'LI', 2:'KUN', 3:'ZHEN',
    5:'', 7:'DUI', 8:'GEN', 1:'KAN', 6:'QIAN'
  };

  // 中宮（palace 5）特殊樣式
  if (palace === 5) {
    const diStem = diPan[5] || '';
    cell.className = 'palace-cell palace-center animate-in';
    cell.innerHTML = `
      <div class="pc-header">
        <span class="pc-palace-num">≡<strong>5</strong></span>
        <span class="pc-dir-en"></span>
      </div>
      <div class="pc-center-body">
        <div class="pc-earth-stem ${wxClass(diStem)}" style="font-size:20px; font-weight:bold;">${diStem}</div>
      </div>
    `;
    return cell;
  }

  const star    = tianPanStar[palace] || '';
  const gate    = finalGates[palace]  || '';
  const god     = finalGods[palace]   || '';
  const diStem  = diPan[palace]       || '';
  const sSrc    = stemAtStarSource[palace] || ''; // 門行右（星源地盤干）
  const gSrc    = stemAtGateSource[palace] || ''; // 星行左（門源地盤干）

  const starLuck = STAR_LUCK[star] || '';
  const gateLuck = GATE_LUCK[gate] || '';

  const gateLuckClass = luckTagClass(gateLuck);
  const starLuckClass = luckTagClass(starLuck);

  // 空亡標記 HTML
  const kwBadge = isKongWang
    ? `<span class="pc-kongwang">空</span>`
    : '';

  cell.className = `palace-cell animate-in${isKongWang ? ' cell-kongwang' : ''}`;
  cell.innerHTML = `
    <div class="pc-header">
      <span class="pc-palace-num">≡<strong>${palace}</strong> <span class="pc-palace-name">${dirShort[palace]}</span></span>
      <span style="display:flex;align-items:center;gap:4px;">${kwBadge}<span class="pc-god ${godClass(god)}">${god}</span></span>
    </div>

    <div class="pc-gate-row">
      <span class="pc-gate ${gateLuckClass !== 'zhong' ? ('gate-' + gateLuckClass) : ''}">${gate}</span>
      <span class="pc-stem-right ${wxClass(sSrc)}">${sSrc}</span>
    </div>

    <div class="pc-star-row">
      <span class="pc-stem-left ${wxClass(gSrc)}">${gSrc}</span>
      <span class="pc-star ${starLuckClass !== 'zhong' ? ('star-' + starLuckClass) : ''}">${star}</span>
      <span class="pc-earth-stem ${wxClass(diStem)}">${diStem}</span>
    </div>
  `;
  return cell;
}


// ====================================================
// 工具
// ====================================================
function wxClass(stem) {
  const wx = TIANGAN_WUXING[stem] || '';
  return {'木':'wx-mu','火':'wx-huo','土':'wx-tu','金':'wx-jin','水':'wx-shui'}[wx] || '';
}
function luckColorClass(luck) {
  return luck === '吉' ? 'wx-mu' : luck === '凶' ? 'wx-huo' : 'wx-tu';
}
function luckTagClass(luck) {
  return luck === '吉' ? 'ji' : luck === '凶' ? 'xiong' : 'zhong';
}
function godClass(god) {
  const ji   = ['值符','九天','太陰','六合'];
  const xiong = ['白虎','玄武','螣蛇'];
  if (ji.includes(god))    return 'god-ji';
  if (xiong.includes(god)) return 'god-xiong';
  return 'god-mid';
}

