/**
 * 易經起卦前端互動邏輯 (yijing_app.js)
 */
import {
  BAGUA_DATA, WUXING_COLOR, WUXING_SYMBOL, XIANG_SHENG, XIANG_KE,
  performDivination, renderYaoLines
} from './yijing.js';

let yjMode = 'random'; // 'random' | 'manual'

document.addEventListener('DOMContentLoaded', () => {
  initYijingModeSwitcher();

  const calcBtn = document.getElementById('yj-btn-calculate');
  if (calcBtn) calcBtn.addEventListener('click', doYijingCalc);
});

// ====================================================
// 模式切換
// ====================================================
function initYijingModeSwitcher() {
  const randomBtn = document.getElementById('yj-btn-random');
  const manualBtn = document.getElementById('yj-btn-manual');
  const manualForm = document.getElementById('yj-manual-form');
  if (!randomBtn) return;

  randomBtn.addEventListener('click', () => {
    yjMode = 'random';
    randomBtn.classList.add('active');
    manualBtn.classList.remove('active');
    manualForm.style.display = 'none';
  });

  manualBtn.addEventListener('click', () => {
    yjMode = 'manual';
    manualBtn.classList.add('active');
    randomBtn.classList.remove('active');
    manualForm.style.display = 'block';
  });
}

// ====================================================
// 執行起卦
// ====================================================
function doYijingCalc() {
  let n1, n2, n3;

  if (yjMode === 'manual') {
    n1 = parseInt(document.getElementById('yj-num1').value);
    n2 = parseInt(document.getElementById('yj-num2').value);
    n3 = parseInt(document.getElementById('yj-num3').value);
    if (!n1 || !n2 || !n3 || n1<1||n2<1||n3<1) {
      alert('請輸入 1~999 之間的三個數字');
      return;
    }
  }

  const result = performDivination(n1, n2, n3);
  const question = document.getElementById('yj-question').value.trim();

  // 動畫
  const area = document.getElementById('yj-result-area');
  area.style.opacity = '0';
  setTimeout(() => {
    renderYijingResult(result, question);
    area.style.transition = 'opacity 0.5s ease';
    area.style.opacity = '1';
  }, 150);
}

// ====================================================
// 渲染結果
// ====================================================
function renderYijingResult(r, question) {
  renderHexagramCard(r, question);
  renderWuxingRow(r);
  renderTrendCard(r);
  renderYaoSection(r);
  renderCTheory(r);
}

// --- 卦名主卡 ---
function renderHexagramCard(r, question) {
  const el = document.getElementById('yj-hexagram-card');
  const { shangGua, xiaGua, hexagramName, judgment, num1, num2, yaoPos } = r;

  el.innerHTML = `
    <div class="yj-main-card animate-in">
      <div class="yj-main-card-top">
        <div class="yj-gua-symbols">
          <div class="yj-gua-block">
            <div class="yj-gua-symbol">${shangGua.symbol}</div>
            <div class="yj-gua-name">${shangGua.name}</div>
            <div class="yj-gua-sub">${shangGua.nature}・${shangGua.attr}</div>
          </div>
          <div class="yj-gua-plus">×</div>
          <div class="yj-gua-block">
            <div class="yj-gua-symbol">${xiaGua.symbol}</div>
            <div class="yj-gua-name">${xiaGua.name}</div>
            <div class="yj-gua-sub">${xiaGua.nature}・${xiaGua.attr}</div>
          </div>
          <div class="yj-gua-plus">=</div>
          <div class="yj-gua-block yj-gua-main">
            <div class="yj-hexagram-name">${hexagramName}</div>
            <div class="yj-gua-sub">動爻：第 ${yaoPos} 爻</div>
          </div>
        </div>
        ${question ? `<div class="yj-question-tag">問：${question}</div>` : ''}
        <div class="yj-nums">起卦數：${num1} ／ ${num2} ／ ${r.num3}</div>
      </div>
      <div class="yj-judgment">
        <div class="yj-judgment-label">卦辭</div>
        <div class="yj-judgment-text">${judgment}</div>
      </div>
    </div>
  `;
}

// --- 五行能量條 ---
function renderWuxingRow(r) {
  const el = document.getElementById('yj-wuxing-row');
  const { shangGua, xiaGua } = r;
  const shangColor = WUXING_COLOR[shangGua.attr] || '#fff';
  const xiaColor   = WUXING_COLOR[xiaGua.attr]   || '#fff';

  el.innerHTML = `
    <div class="yj-wuxing-row animate-in">
      <div class="yj-wuxing-card" style="border-color:${shangColor}33; background:${shangColor}11;">
        <div class="yj-wx-symbol" style="color:${shangColor}">${WUXING_SYMBOL[shangGua.attr]}</div>
        <div class="yj-wx-label">上卦（用卦）</div>
        <div class="yj-wx-name">${shangGua.name}</div>
        <div class="yj-wx-attr" style="color:${shangColor}">${shangGua.attr}</div>
      </div>
      <div class="yj-wuxing-arrow">→</div>
      <div class="yj-wuxing-card" style="border-color:${xiaColor}33; background:${xiaColor}11;">
        <div class="yj-wx-symbol" style="color:${xiaColor}">${WUXING_SYMBOL[xiaGua.attr]}</div>
        <div class="yj-wx-label">下卦（體卦）</div>
        <div class="yj-wx-name">${xiaGua.name}</div>
        <div class="yj-wx-attr" style="color:${xiaColor}">${xiaGua.attr}</div>
      </div>
    </div>
  `;
}

// --- 趨勢判斷卡 ---
function renderTrendCard(r) {
  const el = document.getElementById('yj-trend-card');
  const { trendResult, hamming, volatilityLabel, volatilityColor } = r;
  const { trend, desc, icon, color } = trendResult;

  el.innerHTML = `
    <div class="yj-trend-card animate-in" style="border-color:${color}44; background:${color}08;">
      <div class="yj-trend-header">
        <span class="yj-trend-icon">${icon}</span>
        <span class="yj-trend-label" style="color:${color}">${trend}</span>
      </div>
      <div class="yj-trend-desc">${desc}</div>
      <div class="yj-trend-footer">
        <div class="yj-volatility">
          <span class="yj-vol-label">能量波動強度</span>
          <span class="yj-vol-bars">${renderVolBars(hamming)}</span>
          <span class="yj-vol-text" style="color:${volatilityColor}">${volatilityLabel}（漢明距離 ${hamming}）</span>
        </div>
      </div>
    </div>
  `;
}

function renderVolBars(hamming) {
  const colors = ['#4ade80','#4ade80','#fbbf24','#f87171'];
  return [0,1,2].map(i => {
    const filled = i < hamming;
    const c = filled ? (colors[hamming] || '#f87171') : '#333';
    return `<span style="display:inline-block;width:20px;height:8px;border-radius:4px;background:${c};margin:0 2px;"></span>`;
  }).join('');
}

// --- 六爻 + 變卦 ---
function renderYaoSection(r) {
  const el = document.getElementById('yj-yao-section');
  const lines = renderYaoLines(r.shangGua.code, r.xiaGua.code, r.yaoPos);

  const linesHtml = lines.map(({ lineNum, isYang, isDynamic }) => {
    const dynLabel = isDynamic ? '<span class="yao-dynamic">● 動爻</span>' : '';
    if (isYang) {
      return `<div class="yao-line yang ${isDynamic ? 'dynamic' : ''}">
        <span class="yao-num">${lineNum}</span>
        <span class="yao-bar yang-bar"></span>
        <span class="yao-type">陽爻 ——</span>
        ${dynLabel}
      </div>`;
    } else {
      return `<div class="yao-line yin ${isDynamic ? 'dynamic' : ''}">
        <span class="yao-num">${lineNum}</span>
        <span class="yao-bar yin-bar">
          <span></span><span></span>
        </span>
        <span class="yao-type">陰爻 — —</span>
        ${dynLabel}
      </div>`;
    }
  }).join('');

  el.innerHTML = `
    <div class="yj-yao-section animate-in">
      <div class="yj-yao-box">
        <div class="yj-yao-title">本卦六爻（${r.hexagramName}）</div>
        <div class="yao-lines">${linesHtml}</div>
      </div>
      ${r.bianguaName ? `
      <div class="yj-biangua-box">
        <div class="yj-biangua-arrow">→</div>
        <div class="yj-biangua-name">變卦</div>
        <div class="yj-biangua-value">${r.bianguaName}</div>
        <div class="yj-biangua-hint">第 ${r.yaoPos} 爻發動</div>
      </div>` : ''}
    </div>
  `;
}

// --- C理論管理指南 ---
function renderCTheory(r) {
  const el = document.getElementById('yj-c-theory');
  const { trendResult, shangGua, xiaGua, hexagramName } = r;

  const guides = [
    { label: '中心化 (Centrality)',   text: `聚焦當前主要問事，不要分心太多目標。` },
    { label: '控制性 (Control)',       text: `設定明確的止損點，嚴格執行風控。` },
    { label: '變動性 (Contingency)',   text: `如情勢驟變（如${xiaGua.name}爻動），立即調整策略。` },
    { label: '創意性 (Creativity)',    text: `觀察第 ${r.yaoPos} 爻動態，靈活應對轉折。` },
    { label: '協調性 (Coordination)',  text: `注意${shangGua.attr}與${xiaGua.attr}之間的生剋變化。` },
  ];

  el.innerHTML = `
    <div class="yj-ctheory animate-in">
      <div class="yj-ctheory-title">🛡 C理論應變指南</div>
      <div class="yj-ctheory-list">
        ${guides.map((g,i) => `
          <div class="yj-ctheory-item">
            <span class="yj-ctheory-num">${i+1}</span>
            <div>
              <div class="yj-ctheory-label">${g.label}</div>
              <div class="yj-ctheory-text">${g.text}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="yj-motto">
        💡 心法啟示：「閑有家，悔亡」—— 事先備好止損（遮雨棚），才不會事後後悔！
      </div>
    </div>
  `;
}
