/**
 * 奇門遁甲排盤引擎 v2 (qmdj.js)
 * 移植自 cc.txt QiMenPro 金融策略版，大幅修正地盤、八門、八神、空亡計算邏輯
 */

// ============================================================
// 基礎資料
// ============================================================
const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 九宮轉動路徑（不含中5）
const ROTATION_PATH = [1, 8, 3, 4, 9, 2, 7, 6];

// 九星本宮（原始位置）
const ORIG_STARS = {
  1: '天蓬', 8: '天任', 3: '天衝', 4: '天輔',
  9: '天英', 2: '天芮', 7: '天柱', 6: '天心', 5: '天禽'
};

// 八門本宮
const ORIG_GATES = {
  1: '休門', 8: '生門', 3: '傷門', 4: '杜門',
  9: '景門', 2: '死門', 7: '驚門', 6: '開門'
};

// 八神排列
const GODS_LIST = ['值符', '螣蛇', '太陰', '六合', '白虎', '玄武', '九地', '九天'];

// 九星吉凶
const STAR_LUCK = {
  '天蓬': '凶', '天任': '吉', '天衝': '吉', '天輔': '吉',
  '天英': '凶', '天芮': '凶', '天柱': '凶', '天心': '吉', '天禽': '中'
};

// 八門吉凶
const GATE_LUCK = {
  '休門': '吉', '生門': '吉', '傷門': '凶', '杜門': '凶',
  '景門': '中', '死門': '凶', '驚門': '凶', '開門': '吉'
};

// 天干五行
const TIANGAN_WUXING = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土',
  '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水'
};

// ============================================================
// 節氣資料（2024–2026）
// ============================================================
const JIEQI_DATA = [
  { dt: new Date(2024, 1, 4, 16, 27), name: '立春', yang: true },
  { dt: new Date(2024, 1, 19, 12, 13), name: '雨水', yang: true },
  { dt: new Date(2024, 2, 5, 10, 23), name: '驚蟄', yang: true },
  { dt: new Date(2024, 2, 20, 11, 6), name: '春分', yang: true },
  { dt: new Date(2024, 3, 4, 15, 2), name: '清明', yang: true },
  { dt: new Date(2024, 3, 19, 22, 0), name: '穀雨', yang: true },
  { dt: new Date(2024, 4, 5, 8, 10), name: '立夏', yang: true },
  { dt: new Date(2024, 4, 20, 21, 0), name: '小滿', yang: true },
  { dt: new Date(2024, 5, 6, 12, 10), name: '芒種', yang: true },
  { dt: new Date(2024, 5, 21, 5, 51), name: '夏至', yang: false },
  { dt: new Date(2024, 6, 6, 22, 20), name: '小暑', yang: false },
  { dt: new Date(2024, 6, 22, 15, 44), name: '大暑', yang: false },
  { dt: new Date(2024, 7, 7, 6, 9), name: '立秋', yang: false },
  { dt: new Date(2024, 7, 22, 20, 55), name: '處暑', yang: false },
  { dt: new Date(2024, 8, 7, 9, 11), name: '白露', yang: false },
  { dt: new Date(2024, 8, 22, 18, 44), name: '秋分', yang: false },
  { dt: new Date(2024, 9, 8, 1, 0), name: '寒露', yang: false },
  { dt: new Date(2024, 9, 23, 4, 15), name: '霜降', yang: false },
  { dt: new Date(2024, 10, 7, 4, 20), name: '立冬', yang: false },
  { dt: new Date(2024, 10, 22, 1, 57), name: '小雪', yang: false },
  { dt: new Date(2024, 11, 7, 1, 17), name: '大雪', yang: false },
  { dt: new Date(2024, 11, 21, 19, 21), name: '冬至', yang: true },
  { dt: new Date(2025, 0, 5, 6, 32), name: '小寒', yang: true },
  { dt: new Date(2025, 0, 20, 11, 0), name: '大寒', yang: true },
  { dt: new Date(2025, 1, 3, 22, 10), name: '立春', yang: true },
  { dt: new Date(2025, 1, 18, 18, 7), name: '雨水', yang: true },
  { dt: new Date(2025, 2, 5, 16, 7), name: '驚蟄', yang: true },
  { dt: new Date(2025, 2, 20, 17, 1), name: '春分', yang: true },
  { dt: new Date(2025, 3, 4, 20, 48), name: '清明', yang: true },
  { dt: new Date(2025, 3, 20, 3, 56), name: '穀雨', yang: true },
  { dt: new Date(2025, 4, 5, 14, 1), name: '立夏', yang: true },
  { dt: new Date(2025, 4, 21, 3, 55), name: '小滿', yang: true },
  { dt: new Date(2025, 5, 5, 18, 6), name: '芒種', yang: true },
  { dt: new Date(2025, 5, 21, 11, 42), name: '夏至', yang: false },
  { dt: new Date(2025, 6, 7, 4, 5), name: '小暑', yang: false },
  { dt: new Date(2025, 6, 22, 21, 29), name: '大暑', yang: false },
  { dt: new Date(2025, 7, 7, 11, 52), name: '立秋', yang: false },
  { dt: new Date(2025, 7, 23, 2, 34), name: '處暑', yang: false },
  { dt: new Date(2025, 8, 7, 15, 1), name: '白露', yang: false },
  { dt: new Date(2025, 8, 23, 0, 19), name: '秋分', yang: false },
  { dt: new Date(2025, 9, 8, 6, 41), name: '寒露', yang: false },
  { dt: new Date(2025, 9, 23, 9, 51), name: '霜降', yang: false },
  { dt: new Date(2025, 10, 7, 10, 3), name: '立冬', yang: false },
  { dt: new Date(2025, 10, 22, 7, 36), name: '小雪', yang: false },
  { dt: new Date(2025, 11, 7, 6, 50), name: '大雪', yang: false },
  { dt: new Date(2025, 11, 22, 1, 3), name: '冬至', yang: true },
  { dt: new Date(2026, 0, 5, 12, 22), name: '小寒', yang: true },
  { dt: new Date(2026, 0, 20, 17, 16), name: '大寒', yang: true },
  { dt: new Date(2026, 1, 4, 4, 2), name: '立春', yang: true },
  { dt: new Date(2026, 1, 19, 0, 1), name: '雨水', yang: true },
  { dt: new Date(2026, 2, 5, 22, 1), name: '驚蟄', yang: true },
  { dt: new Date(2026, 2, 20, 22, 46), name: '春分', yang: true },
  { dt: new Date(2026, 3, 5, 2, 40), name: '清明', yang: true },
  { dt: new Date(2026, 3, 20, 9, 39), name: '穀雨', yang: true },
  { dt: new Date(2026, 4, 5, 19, 48), name: '立夏', yang: true },
  { dt: new Date(2026, 4, 21, 8, 37), name: '小滿', yang: true },
  { dt: new Date(2026, 5, 6, 0, 18), name: '芒種', yang: true },
  { dt: new Date(2026, 5, 21, 17, 50), name: '夏至', yang: false },
  { dt: new Date(2026, 6, 7, 10, 10), name: '小暑', yang: false },
  { dt: new Date(2026, 6, 23, 3, 31), name: '大暑', yang: false },
  { dt: new Date(2026, 7, 7, 17, 50), name: '立秋', yang: false },
  { dt: new Date(2026, 7, 23, 8, 30), name: '處暑', yang: false },
  { dt: new Date(2026, 8, 7, 21, 0), name: '白露', yang: false },
  { dt: new Date(2026, 8, 23, 6, 5), name: '秋分', yang: false },
  { dt: new Date(2026, 9, 8, 12, 30), name: '寒露', yang: false },
  { dt: new Date(2026, 9, 23, 15, 38), name: '霜降', yang: false },
  { dt: new Date(2026, 10, 7, 15, 54), name: '立冬', yang: false },
  { dt: new Date(2026, 10, 22, 13, 23), name: '小雪', yang: false },
  { dt: new Date(2026, 11, 7, 12, 40), name: '大雪', yang: false },
  { dt: new Date(2026, 11, 22, 6, 50), name: '冬至', yang: true },
];

// 節氣三元局數對照（折補法，對齊 qimenpai.com）
// 格式：[上元, 中元, 下元]
const JIEQI_JU_MAP = {
  // 陽遁（冬至 → 芒種）
  '冬至': [1, 7, 4], '小寒': [2, 8, 5], '大寒': [3, 9, 6],
  '立春': [8, 5, 2], '雨水': [9, 6, 3], '驚蟄': [1, 7, 4],  // ← 修正：驚蟄[1,7,4]
  '春分': [3, 9, 6], '清明': [4, 1, 7], '穀雨': [5, 2, 8],
  '立夏': [4, 1, 7], '小滿': [5, 2, 8], '芒種': [6, 3, 9],
  // 陰遁（夏至 → 大雪）
  '夏至': [9, 3, 6], '小暑': [8, 2, 5], '大暑': [7, 1, 4],
  '立秋': [2, 5, 8], '處暑': [1, 4, 7], '白露': [9, 3, 6],
  '秋分': [7, 1, 4], '寒露': [6, 9, 3], '霜降': [5, 8, 2],
  '立冬': [6, 9, 3], '小雪': [5, 8, 2], '大雪': [4, 7, 1],
};

// ============================================================
// 1. 干支計算
// ============================================================
function get60GZ(idx) {
  return TIANGAN[idx % 10] + DIZHI[idx % 12];
}

function getDayIdx(dt) {
  // 基準：2024-02-10 = 甲辰日 (第 40 位)
  const base = new Date(2024, 1, 10, 0, 0, 0);
  // 專業奇門在 23:00 (子初) 即進入下一天
  const adjustedDt = new Date(dt.getTime() + 3600000);
  const dayOffset = Math.floor((adjustedDt - base) / 86400000);
  return ((40 + dayOffset) % 60 + 60) % 60;
}

function getGanzhi(dt) {
  // 日柱
  const dayIdx = getDayIdx(dt);
  const dayGZ = get60GZ(dayIdx);

  // 時支（每 2 小時一辰，0:00-0:59=子時第0, 23:00-23:59=子(隔日)=第11）
  // 子時: 23-1, 丑時: 1-3 ... 亥時: 21-23
  // 23:00+ 也算子時
  const h = dt.getHours();
  const hourIdx = Math.floor(((h + 1) % 24) / 2);  // 23點算子時(0)

  // 五鼠遁元（時干起算）
  const startGanMap = {
    '甲': 0, '己': 0, '乙': 1, '庚': 1, '丙': 2, '辛': 2, '丁': 3, '壬': 3, '戊': 4, '癸': 4
  };
  const startGanIdx = startGanMap[dayGZ[0]];
  const hourGan = TIANGAN[(startGanIdx * 2 + hourIdx) % 10];
  const hourZhi = DIZHI[hourIdx % 12];
  const hourGZ = hourGan + hourZhi;

  // 年柱（以立春為界）
  const year = dt.getFullYear();
  const lichun = JIEQI_DATA.find(j => j.name === '立春' && j.dt.getFullYear() === year);
  const stemYear = (lichun && dt >= lichun.dt) ? year : year - 1;
  const yearIdx = (((stemYear - 4) % 60) + 60) % 60;
  const yearGZ = get60GZ(yearIdx);

  // 月柱（以節為界）
  const monthGZ = getMonthGZ(dt, yearGZ[0]);

  return { yearGZ, monthGZ, dayGZ, hourGZ };
}

function getMonthGZ(dt, yearGan) {
  // 十二「節」（非「氣」）決定月柱，以驚蟄=卯月為例
  const jieNames = ['立春', '驚蟄', '清明', '立夏', '芒種', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒'];
  const monthZhiArr = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];

  // 五虎遁年起月法
  const startGanMap = {
    '甲': 2, '己': 2, '乙': 4, '庚': 4, '丙': 6, '辛': 6,
    '丁': 8, '壬': 8, '戊': 0, '癸': 0
  };

  // 從 JIEQI_DATA 由最新到最早，找到第一個「節」 dt <= 查詢時間
  let mZhiIdx = 11; // 預設丑（小寒）
  for (let i = JIEQI_DATA.length - 1; i >= 0; i--) {
    const jq = JIEQI_DATA[i];
    if (jq.dt <= dt) {
      const idx = jieNames.indexOf(jq.name);
      if (idx >= 0) { mZhiIdx = idx; break; }
    }
  }

  const startGanIdx = startGanMap[yearGan] ?? 0;
  const monthGan = TIANGAN[(startGanIdx + mZhiIdx) % 10];
  return monthGan + monthZhiArr[mZhiIdx];
}

// ============================================================
// 2. 陰陽遁與局數
// ============================================================
function getYuanJu(dt) {
  let prevJieqi = null;
  for (let i = JIEQI_DATA.length - 1; i >= 0; i--) {
    if (dt >= JIEQI_DATA[i].dt) { prevJieqi = JIEQI_DATA[i]; break; }
  }
  if (!prevJieqi) return { isYang: true, juNum: 1, jieqiName: '未知', yuan: '上元' };

  const isYang = prevJieqi.yang;
  const juArr = JIEQI_JU_MAP[prevJieqi.name] || [1, 7, 4];

  // --- 標準拆補法：三元看符頭 (Fu Tou) ---
  const dayIdx = getDayIdx(dt);
  // 符頭是每 5 天一組的起始 (甲子、己巳、甲戌、己卯...)
  const fuTouIdx = Math.floor(dayIdx / 5) * 5;
  const fuTouZhiIdx = fuTouIdx % 12;

  let juNum = juArr[0], yuanName = '上元';

  // 判定：子午卯酉 -> 上元, 寅申巳亥 -> 中元, 辰戌丑未 -> 下元
  if ([0, 3, 6, 9].includes(fuTouZhiIdx)) {
    juNum = juArr[0]; yuanName = '上元';
  } else if ([2, 5, 8, 11].includes(fuTouZhiIdx)) {
    juNum = juArr[1]; yuanName = '中元';
  } else {
    juNum = juArr[2]; yuanName = '下元';
  }

  return { isYang, juNum, jieqiName: prevJieqi.name, yuan: yuanName };
}

// ============================================================
// 3. 地盤排布（cc.txt 版本：陰遁用 戊乙丙丁癸壬辛庚己）
// ============================================================
function buildDiPan(isYang, juNum) {
  // 三奇六儀基本序列：戊、己、庚、辛、壬、癸、丁、丙、乙
  const stems = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'];
  const diPan = {};
  let curr = juNum;

  for (let i = 0; i < 9; i++) {
    diPan[curr] = stems[i];
    if (isYang) {
      curr = curr === 9 ? 1 : curr + 1;
    } else {
      curr = curr === 1 ? 9 : curr - 1;
    }
  }
  return diPan;
}

// ============================================================
// 4. 旬首計算（cc.txt get_xun_shou）
// ============================================================
function getXunShou(hourGZ) {
  const hGan = hourGZ[0];
  const hZhi = hourGZ[1];
  const ganIdx = TIANGAN.indexOf(hGan);
  const zhiIdx = DIZHI.indexOf(hZhi);

  const xunZhiIdx = ((zhiIdx - ganIdx) % 12 + 12) % 12;
  const xunZhi = DIZHI[xunZhiIdx];

  const xunShouMap = { '子': '戊', '戌': '己', '申': '庚', '午': '辛', '辰': '壬', '寅': '癸' };
  const xunStem = xunShouMap[xunZhi] || '戊';

  return { xunStem, xunZhi, xunZhiIdx };
}

// ============================================================
// 5. 空亡計算（cc.txt 獨有 get_kong_wang）
// ============================================================
function getKongWang(hourGZ) {
  const hGan = hourGZ[0];
  const hZhi = hourGZ[1];
  const ganIdx = TIANGAN.indexOf(hGan);
  const zhiIdx = DIZHI.indexOf(hZhi);

  const kwIdx1 = ((zhiIdx + (10 - ganIdx)) % 12);
  const kwIdx2 = (kwIdx1 + 1) % 12;

  return [DIZHI[kwIdx1], DIZHI[kwIdx2]];
}

// ============================================================
// 6. 主排盤（cc.txt run() 完整移植）
// ============================================================
function buildFullLayout(dt, override = {}) {
  const { yearGZ, monthGZ, dayGZ, hourGZ } = getGanzhi(dt);
  const auto = getYuanJu(dt);

  // 套用手動覆蓋
  const isYang = (override.yang !== null && override.yang !== undefined) ? override.yang : auto.isYang;
  const juNum = (override.ju !== null && override.ju !== undefined) ? override.ju : auto.juNum;
  const overrideActive = (override.yang !== null && override.yang !== undefined) ||
    (override.ju !== null && override.ju !== undefined);
  const { jieqiName, yuan } = auto;


  // --- 地盤 ---
  const diPan = buildDiPan(isYang, juNum);

  // --- 旬首 ---
  const { xunStem, xunZhi, xunZhiIdx } = getXunShou(hourGZ);

  // 旬首在地盤哪一宮
  const xunPalace = Number(Object.keys(diPan).find(k => diPan[k] === xunStem));
  const zhiFuStar = ORIG_STARS[xunPalace];
  const zhiShiGate = ORIG_GATES[xunPalace === 5 ? 2 : xunPalace];

  // --- 天盤（星）---
  // 時干在地盤的位置；若時干是甲，用旬首天干位置
  const targetStem = (hourGZ[0] !== '甲') ? hourGZ[0] : xunStem;
  const targetP = Number(Object.keys(diPan).find(k => diPan[k] === targetStem));

  const startIdx = ROTATION_PATH.indexOf(xunPalace === 5 ? 2 : xunPalace);
  const targetIdx = ROTATION_PATH.indexOf(targetP === 5 ? 2 : targetP);
  const shift = ((targetIdx - startIdx) % 8 + 8) % 8;

  const tianPanStar = {};
  const tianPanStem = {};
  for (let i = 0; i < 8; i++) {
    const destP = ROTATION_PATH[i];
    const srcP = ROTATION_PATH[(i - shift + 8) % 8];
    // 芮禽同宮：天蓬(2)移動時同時帶天禽(5)
    tianPanStar[destP] = (srcP === 2) ? '天芮禽' : ORIG_STARS[srcP];

    // 天干（芮禽同宮：2宮天干帶5宮天干）
    if (srcP === 2) {
      tianPanStem[destP] = diPan[2] + diPan[5];
    } else {
      tianPanStem[destP] = diPan[srcP];
    }
  }
  // 中宮5
  tianPanStar[5] = ORIG_STARS[5];
  tianPanStem[5] = diPan[5];

  // --- 八門（cc.txt 版：旬首地支→時辰地支偏移量）---
  const zhiIdxMap = {};
  DIZHI.forEach((z, i) => { zhiIdxMap[z] = i; });
  const xunZhiRealIdx = zhiIdxMap[xunZhi];
  const hourZhiIdx = zhiIdxMap[hourGZ[1]];
  const offset = ((hourZhiIdx - xunZhiRealIdx) % 12 + 12) % 12;

  // 值使從旬首宮出發，按陽順/陰逆走 offset 步
  let gatePalace = xunPalace;
  for (let i = 0; i < offset; i++) {
    if (isYang) {
      gatePalace = gatePalace === 9 ? 1 : gatePalace + 1;
    } else {
      gatePalace = gatePalace === 1 ? 9 : gatePalace - 1;
    }
  }
  if (gatePalace === 5) gatePalace = 2; // 中宮5寄坤2

  // 八門依偏移排列
  const gStartIdx = ROTATION_PATH.indexOf(gatePalace);
  const gOrigIdx = ROTATION_PATH.indexOf(xunPalace === 5 ? 2 : xunPalace);
  const gShift = ((gStartIdx - gOrigIdx) % 8 + 8) % 8;

  const finalGates = {};
  for (let i = 0; i < 8; i++) {
    const destP = ROTATION_PATH[i];
    const srcP = ROTATION_PATH[(i - gShift + 8) % 8];
    finalGates[destP] = ORIG_GATES[srcP];
  }

  // --- 八神（cc.txt 版：從 targetP 起排，陽順陰逆）---
  const godStartIdx = ROTATION_PATH.indexOf(targetP === 5 ? 2 : targetP);
  const finalGods = {};
  for (let i = 0; i < 8; i++) {
    let p;
    if (isYang) {
      p = ROTATION_PATH[(godStartIdx + i) % 8];
    } else {
      p = ROTATION_PATH[((godStartIdx - i) % 8 + 8) % 8];
    }
    finalGods[p] = GODS_LIST[i];
  }

  // --- 空亡 ---
  const kongWang = getKongWang(hourGZ);

  // --- 每宮「星源地盤干」與「門源地盤干」（對應 mQimen 三行格式）---
  // Gate 行右邊的干 = 星原本在哪個地盤宮的地盤干（星源地盤干）
  // Star 行左邊的干 = 門原本在哪個地盤宮的地盤干（門源地盤干）
  const stemAtStarSource = {}; // 門行右（星源地盤干，芮禽同宮時顯示雙干）
  const stemAtGateSource = {}; // 星行左（門源地盤干）
  for (let i = 0; i < 8; i++) {
    const destP = ROTATION_PATH[i];
    const starSrcP = ROTATION_PATH[(i - shift + 8) % 8];   // 星從哪來
    const gateSrcP = ROTATION_PATH[(i - gShift + 8) % 8];  // 門從哪來
    // 芮禽同宮：2宮帶5宮，顯示雙干（如丙己）
    stemAtStarSource[destP] = starSrcP === 2
      ? (diPan[2] || '') + (diPan[5] || '')
      : (diPan[starSrcP] || '');
    stemAtGateSource[destP] = diPan[gateSrcP] || '';
  }

  // --- 空亡地支轉天干（供顯示用）---
  const kongWangGan = kongWang.map(zhiToGan);
  const kongWangPalaces = getKongWangPalaces(kongWang);

  return {
    yearGZ, monthGZ, dayGZ, hourGZ,
    isYang, juNum, jieqiName, yuan,
    autoJuNum: auto.juNum,
    overrideActive,
    xunStem, xunZhi, xunPalace,
    zhiFuStar, zhiShiGate,
    diPan, tianPanStar, tianPanStem,
    finalGates, finalGods,
    stemAtStarSource, stemAtGateSource,
    kongWang, kongWangGan, kongWangPalaces
  };
}

// 地支轉對應天干（空亡顯示用）
const ZHI_TO_GAN = {
  '子': '癸', '丑': '己', '寅': '甲', '卯': '乙', '辰': '戊',
  '巳': '丙', '午': '丁', '未': '己', '申': '庚', '酉': '辛',
  '戌': '戊', '亥': '壬'
};
function zhiToGan(zhi) { return ZHI_TO_GAN[zhi] || zhi; }

// 地支→所屬宮位（用來在宮格內標示空亡）
const ZHI_TO_PALACE = {
  '子': 1, '丑': 8, '寅': 8, '卯': 3,
  '辰': 4, '巳': 4, '午': 9, '未': 2,
  '申': 2, '酉': 7, '戌': 6, '亥': 6,
};
function getKongWangPalaces(kongWang) {
  const palaces = new Set();
  kongWang.forEach(zhi => {
    const p = ZHI_TO_PALACE[zhi];
    if (p) palaces.add(p);
  });
  return palaces;
}



// ============================================================
// 工具函數
// ============================================================
function wuxingColor(stem) {
  const wx = TIANGAN_WUXING[stem[0]];
  const colors = {
    '木': '#4ade80', '火': '#f87171', '土': '#fbbf24', '金': '#e2e8f0', '水': '#60a5fa'
  };
  return colors[wx] || '#ffffff';
}

export {
  buildFullLayout,
  wuxingColor,
  TIANGAN_WUXING,
  STAR_LUCK,
  GATE_LUCK,
  ROTATION_PATH,
  ORIG_STARS,
  ORIG_GATES
};
