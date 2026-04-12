/**
 * qmdj_daily.js — 奇門遁甲「日盤」計算引擎
 *
 * ★ 日盤 vs 時盤 核心差異 ★
 * ┌────────────┬───────────────────┬──────────────────────┐
 * │ 項目       │ 時盤 (時家奇門)    │ 日盤 (日家奇門)       │
 * ├────────────┼───────────────────┼──────────────────────┤
 * │ 旬首基準   │ 時干支            │ 日干支                │
 * │ 天盤目標干 │ 時干              │ 日干                  │
 * │ 八門偏移   │ 時支 - 旬首支     │ 日支 - 旬首支         │
 * │ 空亡計算   │ 時干支的空亡      │ 日干支的空亡          │
 * │ 有效時間   │ 每2小時一換       │ 整天固定              │
 * └────────────┴───────────────────┴──────────────────────┘
 */

// ============================================================
// 基礎對照表（與 qmdj.js 共用，但為獨立模組自行定義）
// ============================================================
const TIANGAN    = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const DIZHI      = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const TIANGAN_WUXING = {
  甲:'木', 乙:'木', 丙:'火', 丁:'火', 戊:'土',
  己:'土', 庚:'金', 辛:'金', 壬:'水', 癸:'水',
};

// 洛書九宮的旋轉路徑（1→8→3→4→9→2→7→6 跳過 5）
const ROTATION_PATH = [1, 8, 3, 4, 9, 2, 7, 6];

// 原始天盤九星分布（地盤固定）
const ORIG_STARS = {
  1:'天蓬', 2:'天芮', 3:'天衝', 4:'天輔', 5:'天禽',
  6:'天心', 7:'天柱', 8:'天任', 9:'天英',
};

// 原始八門分布（地盤固定）
const ORIG_GATES = {
  1:'休門', 2:'死門', 3:'傷門', 4:'杜門',
  6:'開門', 7:'驚門', 8:'生門', 9:'景門',
};

// 八神（陽遁順、陰遁逆，從值符宮起）
const GODS_LIST = ['值符','螣蛇','太陰','六合','白虎','玄武','九地','九天'];

// 吉凶評價
const STAR_LUCK = {
  天任:'吉', 天衝:'吉', 天輔:'吉', 天心:'吉',
  天蓬:'凶', 天芮:'凶', 天英:'凶', 天柱:'凶', 天禽:'中', '天芮禽':'中',
};
const GATE_LUCK = {
  休門:'吉', 生門:'吉', 開門:'吉',
  傷門:'凶', 死門:'凶', 驚門:'凶',
  景門:'中', 杜門:'中',
};

// ============================================================
// 1. 節氣資料（2024–2026，和時盤共用同一份）
// ============================================================
const JIEQI_DATA = [
  {dt:new Date(2024,1,4,16,27),  name:'立春', yang:true },
  {dt:new Date(2024,2,20,4,6),   name:'春分', yang:true },
  {dt:new Date(2024,3,4,21,2),   name:'清明', yang:true },
  {dt:new Date(2024,4,5,14,10),  name:'立夏', yang:true },
  {dt:new Date(2024,5,21,0,51),  name:'夏至', yang:false},
  {dt:new Date(2024,6,7,3,20),   name:'小暑', yang:false},
  {dt:new Date(2024,7,7,9,9),    name:'立秋', yang:false},
  {dt:new Date(2024,8,23,0,43),  name:'秋分', yang:false},
  {dt:new Date(2024,9,8,0,60),   name:'寒露', yang:false},
  {dt:new Date(2024,10,7,3,20),  name:'立冬', yang:false},
  {dt:new Date(2024,11,7,6,17),  name:'大雪', yang:false},
  {dt:new Date(2024,11,22,0,21), name:'冬至', yang:true },
  {dt:new Date(2025,0,5,11,33),  name:'小寒', yang:true },
  {dt:new Date(2025,0,20,4,59),  name:'大寒', yang:true },
  {dt:new Date(2025,1,3,22,10),  name:'立春', yang:true },
  {dt:new Date(2025,2,5,16,7),   name:'驚蟄', yang:true },
  {dt:new Date(2025,2,20,11,1),  name:'春分', yang:true },
  {dt:new Date(2025,3,4,22,48),  name:'清明', yang:true },
  {dt:new Date(2025,4,5,15,57),  name:'立夏', yang:true },
  {dt:new Date(2025,4,21,4,54),  name:'小滿', yang:true },
  {dt:new Date(2025,5,5,19,56),  name:'芒種', yang:true },
  {dt:new Date(2025,5,21,12,42), name:'夏至', yang:false},
  {dt:new Date(2025,6,7,5,5),    name:'小暑', yang:false},
  {dt:new Date(2025,7,7,15,51),  name:'立秋', yang:false},
  {dt:new Date(2025,8,23,7,19),  name:'秋分', yang:false},
  {dt:new Date(2025,9,8,9,41),   name:'寒露', yang:false},
  {dt:new Date(2025,10,7,12,3),  name:'立冬', yang:false},
  {dt:new Date(2025,11,7,5,4),   name:'大雪', yang:false},
  {dt:new Date(2025,11,22,6,3),  name:'冬至', yang:true },
  {dt:new Date(2026,0,5,12,22),  name:'小寒', yang:true },
  {dt:new Date(2026,0,20,17,44), name:'大寒', yang:true },
  {dt:new Date(2026,1,4,10,38),  name:'立春', yang:true },
  {dt:new Date(2026,1,18,10,52), name:'雨水', yang:true },
  {dt:new Date(2026,2,5,4,16),   name:'驚蟄', yang:true },
  {dt:new Date(2026,2,20,22,45), name:'春分', yang:true }, // ★ 修正：22:45 非 11:45
  {dt:new Date(2026,3,5,9,40),   name:'清明', yang:true },
  {dt:new Date(2026,4,5,22,50),  name:'立夏', yang:true },
  {dt:new Date(2026,4,21,10,36), name:'小滿', yang:true },
  {dt:new Date(2026,5,6,3,22),   name:'芒種', yang:true },
  {dt:new Date(2026,5,21,19,24), name:'夏至', yang:false},
  {dt:new Date(2026,6,7,11,29),  name:'小暑', yang:false},
  {dt:new Date(2026,7,7,20,17),  name:'立秋', yang:false},
  {dt:new Date(2026,8,23,13,5),  name:'秋分', yang:false},
  {dt:new Date(2026,9,8,15,10),  name:'寒露', yang:false},
  {dt:new Date(2026,10,7,18,8),  name:'立冬', yang:false},
  {dt:new Date(2026,11,7,11,13), name:'大雪', yang:false},
  {dt:new Date(2026,11,22,6,50), name:'冬至', yang:true },
];

// 節氣三元局數對照（折補法，對齊 qimenpai.com）
const JIEQI_JU_MAP = {
  '冬至':[1,7,4], '小寒':[4,1,7], '大寒':[7,4,1],
  '立春':[8,5,2], '雨水':[2,5,8], '驚蟄':[1,7,4],
  '春分':[3,9,6], '清明':[6,3,9], '穀雨':[9,6,3],
  '立夏':[8,5,2], '小滿':[2,5,8], '芒種':[5,8,2],
  '夏至':[9,3,6], '小暑':[6,9,3], '大暑':[3,6,9],
  '立秋':[2,5,8], '處暑':[8,2,5], '白露':[5,8,2],
  '秋分':[7,4,1], '寒露':[1,4,7], '霜降':[4,1,7],
  '立冬':[2,5,8], '小雪':[5,8,2], '大雪':[8,2,5],
};

// ============================================================
// 2. 日干支計算（日盤使用整日的 0:00 起始）
// ============================================================
function getDayGanzhi(dt) {
  // ★ 使用本地日期（年月日）計算，避免 UTC 時區偏移問題 ★
  // 基準：2000-01-07 甲子日
  const base = new Date(2000, 0, 7);   // 本地時間 2000-01-07 0:00
  const today = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()); // 截斷時分秒
  const diff = Math.round((today - base) / 86400000); // 相差天數
  const ganIdx = ((diff % 10) + 10) % 10;
  const zhiIdx = ((diff % 12) + 12) % 12;
  return TIANGAN[ganIdx] + DIZHI[zhiIdx];
}

// ============================================================
// 3. 年柱與月柱
// ============================================================
function getYearGan(dt) {
  // 立春後換年
  let year = dt.getFullYear();
  const lichun = JIEQI_DATA.find(j => j.name === '立春' && j.dt.getFullYear() === year);
  if (lichun && dt < lichun.dt) year--;
  const yearGanIdx = (year - 4) % 10;
  return TIANGAN[((yearGanIdx % 10) + 10) % 10];
}

function getMonthGZ_daily(dt) {
  const jieNames     = ['立春','驚蟄','清明','立夏','芒種','小暑','立秋','白露','寒露','立冬','大雪','小寒'];
  const monthZhiArr  = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
  const startGanMap  = {
    甲:2, 己:2, 乙:4, 庚:4, 丙:6, 辛:6,
    丁:8, 壬:8, 戊:0, 癸:0,
  };
  let mZhiIdx = 11;
  for (let i = JIEQI_DATA.length - 1; i >= 0; i--) {
    const jq = JIEQI_DATA[i];
    if (jq.dt <= dt) {
      const idx = jieNames.indexOf(jq.name);
      if (idx >= 0) { mZhiIdx = idx; break; }
    }
  }
  const yearGan = getYearGan(dt);
  const startGanIdx = startGanMap[yearGan] ?? 0;
  const monthGan    = TIANGAN[(startGanIdx + mZhiIdx) % 10];
  return monthGan + monthZhiArr[mZhiIdx];
}

// ============================================================
// 4. 陰陽遁 & 局數（★ 日家專用：冬夏至最靠近甲子日起局法 ★）
//
// 傳統日家排局規則：
//   - 尋找離當前最近（或之前）的【最靠近冬至/夏至的甲子日】作為 180 天大週期的起點
//   - 冬至後：陽一局(60天) -> 陽七局(60天) -> 陽四局(60天)
//   - 夏至後：陰九局(60天) -> 陰三局(60天) -> 陰六局(60天)
// ============================================================
function getYuanJu_daily(dt) {
  const BASE = new Date(2000, 0, 7); // 甲子日
  const targetDate = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const targetDiff = Math.round((targetDate - BASE) / 86400000);

  // 整理出所有年份的冬至與夏至
  const solstices = JIEQI_DATA.filter(jq => jq.name === '冬至' || jq.name === '夏至');

  let bestCycleStartDiff = -Infinity;
  let cycleIsYang = true;
  let governingJieqi = '';

  // 找尋統治目標日期的週期起點
  for (let i = solstices.length - 1; i >= 0; i--) {
    const jq = solstices[i];
    const jqDate = new Date(jq.dt.getFullYear(), jq.dt.getMonth(), jq.dt.getDate());
    const jqDiff = Math.round((jqDate - BASE) / 86400000);

    // 計算最靠近該節氣的甲子日 (四捨五入到最接近的 60 的倍數)
    const jiaziStartDiff = Math.round(jqDiff / 60) * 60;

    // 週期起點必須在當前日期之前 (或同一天)
    if (jiaziStartDiff <= targetDiff) {
      if (jiaziStartDiff > bestCycleStartDiff) {
        bestCycleStartDiff = jiaziStartDiff;
        cycleIsYang = jq.name === '冬至';
        governingJieqi = jq.name;
      }
    }
  }

  // 計算經過天數與區塊
  const daysIntoCycle = targetDiff - bestCycleStartDiff;
  let blockIndex = Math.floor(daysIntoCycle / 60);
  if (blockIndex > 2) blockIndex = 2; // 超過 180 天的閏餘部分，繼續維持最後一局

  let juNum = 1;
  let yuanName = '';
  if (cycleIsYang) {
    juNum = [1, 7, 4][blockIndex];
    yuanName = ['陽一局(首60天)', '陽七局(中60天)', '陽四局(末60天)'][blockIndex];
  } else {
    juNum = [9, 3, 6][blockIndex];
    yuanName = ['陰九局(首60天)', '陰三局(中60天)', '陰六局(末60天)'][blockIndex];
  }

  return { 
    isYang: cycleIsYang, 
    juNum, 
    jieqiName: governingJieqi, 
    yuan: yuanName 
  };
}


// ============================================================
// 5. 地盤排布（★ 與 qmdj.js buildDiPan 完全相同邏輯 ★）
//    陽遁：戊 從 juNum 宮起，順行（+1）到填滿 9 宮
//    陰遁：戊 從 juNum 宮起，逆行（-1）到填滿 9 宮
// ============================================================
function buildDiPan_daily(isYang, juNum) {
  const stemsYang = ['戊','己','庚','辛','壬','癸','丁','丙','乙'];
  const stemsYin  = ['戊','乙','丙','丁','癸','壬','辛','庚','己'];
  const stems = isYang ? stemsYang : stemsYin;
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
// 6. 旬首計算 ★ 日盤：基於 dayGZ ★
// ============================================================
function getXunShou_daily(dayGZ) {
  const dGan = dayGZ[0];
  const dZhi = dayGZ[1];
  const ganIdx = TIANGAN.indexOf(dGan);
  const zhiIdx = DIZHI.indexOf(dZhi);
  const xunZhiIdx = ((zhiIdx - ganIdx) % 12 + 12) % 12;
  const xunZhi    = DIZHI[xunZhiIdx];
  const xunShouMap = {'子':'戊','戌':'己','申':'庚','午':'辛','辰':'壬','寅':'癸'};
  const xunStem    = xunShouMap[xunZhi] || '戊';
  return { xunStem, xunZhi, xunZhiIdx };
}

// ============================================================
// 7. 空亡 ★ 日盤：基於 dayGZ ★
// ============================================================
function getKongWang_daily(dayGZ) {
  const ganIdx = TIANGAN.indexOf(dayGZ[0]);
  const zhiIdx = DIZHI.indexOf(dayGZ[1]);
  const kwIdx1 = ((zhiIdx + (10 - ganIdx)) % 12);
  const kwIdx2 = (kwIdx1 + 1) % 12;
  return [DIZHI[kwIdx1], DIZHI[kwIdx2]];
}

// ============================================================
// 8. 地支→天干（空亡顯示）
// ============================================================
const ZHI_TO_GAN_D = {
  子:'癸', 丑:'己', 寅:'甲', 卯:'乙', 辰:'戊',
  巳:'丙', 午:'丁', 未:'己', 申:'庚', 酉:'辛',
  戌:'戊', 亥:'壬',
};
const ZHI_TO_PALACE_D = {
  子:1, 丑:8, 寅:8, 卯:3, 辰:4, 巳:4,
  午:9, 未:2, 申:2, 酉:7, 戌:6, 亥:6,
};
function zhiToGan_daily(zhi) { return ZHI_TO_GAN_D[zhi] || zhi; }
function getKongWangPalaces_daily(kongWang) {
  const palaces = new Set();
  kongWang.forEach(zhi => { const p = ZHI_TO_PALACE_D[zhi]; if (p) palaces.add(p); });
  return palaces;
}

// ============================================================
// 9. 主日盤排盤（★ 核心與時盤差異在此 ★）
// ============================================================
function buildDailyLayout(dt) {
  // 取得四柱（日盤不需要時柱，但仍提供給顯示用）
  const dayGZ    = getDayGanzhi(dt);          // ★ 日干支（全局基準）
  const yearGan  = getYearGan(dt);
  const monthGZ  = getMonthGZ_daily(dt);
  const yearGZ   = (dt.getFullYear() - (dt < (JIEQI_DATA.find(j => j.name==='立春' && j.dt.getFullYear()===dt.getFullYear())?.dt || new Date(dt.getFullYear(),1,4)) ? 1 : 0)).toString();
  const auto = getYuanJu_daily(dt);
  const { isYang, juNum, jieqiName, yuan } = auto;

  // --- 地盤 ---
  const diPan = buildDiPan_daily(isYang, juNum);

  // --- 旬首 ★ 日盤：用日干支 ★ ---
  const { xunStem, xunZhi } = getXunShou_daily(dayGZ);
  const xunPalace  = Number(Object.keys(diPan).find(k => diPan[k] === xunStem));
  const zhiFuStar  = ORIG_STARS[xunPalace];
  const zhiShiGate = ORIG_GATES[xunPalace === 5 ? 2 : xunPalace];

  // --- 天盤（星） ★ 日盤：目標干為日干 ★ ---
  const targetStem = (dayGZ[0] !== '甲') ? dayGZ[0] : xunStem;
  const targetP    = Number(Object.keys(diPan).find(k => diPan[k] === targetStem));
  const startIdx   = ROTATION_PATH.indexOf(xunPalace === 5 ? 2 : xunPalace);
  const targetIdx  = ROTATION_PATH.indexOf(targetP === 5 ? 2 : targetP);
  const shift      = ((targetIdx - startIdx) % 8 + 8) % 8;

  const tianPanStar = {};
  const tianPanStem = {};
  for (let i = 0; i < 8; i++) {
    const destP = ROTATION_PATH[i];
    const srcP  = ROTATION_PATH[(i - shift + 8) % 8];
    tianPanStar[destP] = (srcP === 2) ? '天芮禽' : ORIG_STARS[srcP];
    tianPanStem[destP] = (srcP === 2) ? diPan[2] + diPan[5] : diPan[srcP];
  }
  tianPanStar[5] = ORIG_STARS[5];
  tianPanStem[5] = diPan[5];

  // --- 八門 ★ 日盤：偏移量用日支 vs 旬首支 ★ ---
  const zhiIdxMap = {};
  DIZHI.forEach((z, i) => { zhiIdxMap[z] = i; });
  const xunZhiRealIdx = zhiIdxMap[xunZhi];
  const dayZhiIdx     = zhiIdxMap[dayGZ[1]];           // ★ 用日支（非時支）
  const offset        = ((dayZhiIdx - xunZhiRealIdx) % 12 + 12) % 12;

  let gatePalace = xunPalace;
  for (let i = 0; i < offset; i++) {
    if (isYang) {
      gatePalace = gatePalace === 9 ? 1 : gatePalace + 1;
    } else {
      gatePalace = gatePalace === 1 ? 9 : gatePalace - 1;
    }
  }
  if (gatePalace === 5) gatePalace = 2;

  const gStartIdx = ROTATION_PATH.indexOf(gatePalace);
  const gOrigIdx  = ROTATION_PATH.indexOf(xunPalace === 5 ? 2 : xunPalace);
  const gShift    = ((gStartIdx - gOrigIdx) % 8 + 8) % 8;

  const finalGates = {};
  for (let i = 0; i < 8; i++) {
    const destP = ROTATION_PATH[i];
    const srcP  = ROTATION_PATH[(i - gShift + 8) % 8];
    finalGates[destP] = ORIG_GATES[srcP];
  }

  // --- 八神（從 targetP 起算，陽順陰逆）---
  const godStartIdx = ROTATION_PATH.indexOf(targetP === 5 ? 2 : targetP);
  const finalGods   = {};
  for (let i = 0; i < 8; i++) {
    const p = isYang
      ? ROTATION_PATH[(godStartIdx + i) % 8]
      : ROTATION_PATH[((godStartIdx - i) % 8 + 8) % 8];
    finalGods[p] = GODS_LIST[i];
  }

  // --- 空亡 ★ 日盤：用日干支 ★ ---
  const kongWang         = getKongWang_daily(dayGZ);
  const kongWangGan      = kongWang.map(zhiToGan_daily);
  const kongWangPalaces  = getKongWangPalaces_daily(kongWang);

  // --- 宮格來源干（mQimen 三行格式）---
  const stemAtStarSource = {};
  const stemAtGateSource = {};
  for (let i = 0; i < 8; i++) {
    const destP    = ROTATION_PATH[i];
    const starSrcP = ROTATION_PATH[(i - shift + 8) % 8];
    const gateSrcP = ROTATION_PATH[(i - gShift + 8) % 8];
    stemAtStarSource[destP] = (starSrcP === 2)
      ? (diPan[2] || '') + (diPan[5] || '')
      : (diPan[starSrcP] || '');
    stemAtGateSource[destP] = diPan[gateSrcP] || '';
  }

  return {
    // 日盤標識
    isDailyChart: true,
    // 干支資訊
    yearGZ: yearGZ,
    monthGZ,
    dayGZ,          // ★ 日干支（日盤的主角）
    hourGZ: '——',   // 日盤無時柱
    // 局數資訊
    isYang, juNum, jieqiName, yuan,
    // 旬首
    xunStem, xunZhi, xunPalace,
    zhiFuStar, zhiShiGate,
    // 盤面
    diPan, tianPanStar, tianPanStem,
    finalGates, finalGods,
    stemAtStarSource, stemAtGateSource,
    // 空亡
    kongWang, kongWangGan, kongWangPalaces,
    // 覆蓋相關（日盤固定不支持手動覆蓋，但提供格式相容性）
    autoJuNum: juNum,
    overrideActive: false,
  };
}

// ============================================================
// 工具函數（供外部使用）
// ============================================================
function wuxingColor_daily(stem) {
  const wx = TIANGAN_WUXING[stem] || '';
  return { 木:'#4ade80', 火:'#f87171', 土:'#fbbf24', 金:'#c0c0c0', 水:'#60a5fa' }[wx] || '#94a3b8';
}

export {
  buildDailyLayout,
  wuxingColor_daily,
  TIANGAN_WUXING,
  STAR_LUCK,
  GATE_LUCK,
  ROTATION_PATH,
  ORIG_STARS,
  ORIG_GATES,
};
