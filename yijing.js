/**
 * 易經分析引擎 (yijing.js)
 * 移植自 bb.txt Python 程式
 */

// ==========================================
// 第一部分：八卦基礎資料
// ==========================================
const BAGUA_DATA = {
  1: { name: '乾', attr: '金', code: '111', symbol: '☰', desc: '天・剛健', nature: '天' },
  2: { name: '兌', attr: '金', code: '011', symbol: '☱', desc: '澤・喜悅', nature: '澤' },
  3: { name: '離', attr: '火', code: '101', symbol: '☲', desc: '火・光明', nature: '火' },
  4: { name: '震', attr: '木', code: '001', symbol: '☳', desc: '雷・行動', nature: '雷' },
  5: { name: '巽', attr: '木', code: '110', symbol: '☴', desc: '風・滲透', nature: '風' },
  6: { name: '坎', attr: '水', code: '010', symbol: '☵', desc: '水・風險', nature: '水' },
  7: { name: '艮', attr: '土', code: '100', symbol: '☶', desc: '山・停止', nature: '山' },
  8: { name: '坤', attr: '土', code: '000', symbol: '☷', desc: '地・承載', nature: '地' }
};

// 64 卦名稱（上卦 × 下卦，索引 = (上卦-1)*8 + (下卦-1)）
const HEXAGRAM_NAMES = [
  // 上乾(1)
  ['乾為天','天澤履','天火同人','天雷無妄','天風姤','天水訟','天山遯','天地否'],
  // 上兌(2)
  ['澤天夬','兌為澤','澤火革','澤雷隨','澤風大過','澤水困','澤山咸','澤地萃'],
  // 上離(3)
  ['火天大有','火澤睽','離為火','火雷噬嗑','火風鼎','火水未濟','火山旅','火地晉'],
  // 上震(4)
  ['雷天大壯','雷澤歸妹','雷火豐','震為雷','雷風恒','雷水解','雷山小過','雷地豫'],
  // 上巽(5)
  ['風天小畜','風澤中孚','風火家人','風雷益','巽為風','風水渙','風山漸','風地觀'],
  // 上坎(6)
  ['水天需','水澤節','水火既濟','水雷屯','水風井','坎為水','水山蹇','水地比'],
  // 上艮(7)
  ['山天大畜','山澤損','山火賁','山雷頤','山風蠱','山水蒙','艮為山','山地剝'],
  // 上坤(8)
  ['地天泰','地澤臨','地火明夷','地雷復','地風升','地水師','地山謙','坤為地']
];

// 64 卦卦辭（簡化版）
const HEXAGRAM_JUDGMENTS = {
  '乾為天': '元亨利貞。天行健，君子以自強不息。',
  '坤為地': '元亨，利牝馬之貞。地勢坤，君子以厚德載物。',
  '水雷屯': '元亨利貞，勿用有攸往，利建侯。萬事起頭難，宜謹慎行事。',
  '山水蒙': '亨。匪我求童蒙，童蒙求我。初筮告，再三瀆，瀆則不告。',
  '水天需': '有孚，光亨，貞吉，利涉大川。等待時機，不可輕進。',
  '天水訟': '有孚，窒惕，中吉，終凶。不宜爭訟，以和為貴。',
  '地水師': '貞，丈人吉，無咎。謀定而後動，方能制勝。',
  '水地比': '吉。原筮，元永貞，無咎。宜與人親近合作。',
  '風天小畜': '亨。密雲不雨，自我西郊。積蓄力量，等待時機。',
  '天澤履': '履虎尾，不咥人，亨。謹慎行事，可化危為安。',
  '地天泰': '小往大來，吉亨。通順之象，萬事如意。',
  '天地否': '否之匪人，不利君子貞，大往小來。閉塞之象，暫時忍耐。',
  '天火同人': '同人于野，亨。利涉大川，利君子貞。合作共事，吉祥亨通。',
  '火天大有': '元亨。豐收之象，諸事順遂大吉。',
  '地山謙': '亨，君子有終。謙遜處世，終有所成。',
  '雷地豫': '利建侯行師。歡樂之象，宜積極行事。',
  '澤雷隨': '元亨利貞，無咎。順應形勢，隨機應變。',
  '山風蠱': '元亨，利涉大川。先甲三日，後甲三日。振興改革，破舊立新。',
  '地澤臨': '元亨利貞，至于八月有凶。臨近之象，積極進取。',
  '風地觀': '盥而不薦，有孚顒若。旁觀審視，深思熟慮。',
  '火雷噬嗑': '亨，利用獄。果斷決策，懲惡揚善。',
  '山火賁': '亨，小利有攸往。美飾之象，注重形象。',
  '山地剝': '不利有攸往。剥落之象，宜守不宜進。',
  '地雷復': '亨。出入無疾，朋來無咎。回歸正道，重新出發。',
  '天雷無妄': '元亨利貞，其匪正有眚，不利有攸往。無妄之災，保持正直。',
  '山天大畜': '利貞，不家食吉，利涉大川。積厚而發，大有作為。',
  '山雷頤': '貞吉，觀頤，自求口實。養正積德，謹慎飲食言行。',
  '澤風大過': '棟橈，利有攸往，亨。非常之時，需非常之舉。',
  '坎為水': '有孚，維心亨，行有尚。險難當前，堅守信念。',
  '離為火': '利貞，亨。畜牝牛吉。文明光照，附麗之象。',
  '澤山咸': '亨，利貞，取女吉。感應之象，心靈相通。',
  '雷風恒': '亨，無咎，利貞，利有攸往。恆久之道，堅持到底。',
  '天山遯': '亨，小利貞。退避之時，明哲保身。',
  '雷天大壯': '利貞。壯盛之象，但需謹慎不可過剛。',
  '火地晉': '康侯用錫馬蕃庶，晝日三接。進升之象，前途光明。',
  '地火明夷': '利艱貞。光明受傷，韜光養晦之時。',
  '風火家人': '利女貞。家庭和睦，各司其職。',
  '火澤睽': '小事吉。相背之象，求同存異為宜。',
  '水山蹇': '利西南，不利東北，利見大人，貞吉。艱難之時，需要貴人。',
  '雷水解': '利西南，無所往，其來復吉，有攸往夙吉。解脫之象，逢凶化吉。',
  '山澤損': '有孚，元吉，無咎，可貞，利有攸往。損下益上，先苦後甜。',
  '風雷益': '利有攸往，利涉大川。損上益下，互惠互利。',
  '澤天夬': '揚于王庭，孚號，有厲，告自邑，不利即戎，利有攸往。決斷之時。',
  '天風姤': '女壯，勿用取女。邂逅之象，小心提防。',
  '澤地萃': '亨，王假有廟，利見大人，亨，利貞，用大牲吉，利有攸往。聚合之象。',
  '地風升': '元亨，用見大人，勿恤，南征吉。上升之象，積極進取。',
  '澤水困': '亨，貞，大人吉，無咎。困境之中，君子自強。',
  '水風井': '改邑不改井，無喪無得，往來井井。穩固根基，源遠流長。',
  '澤火革': '己日乃孚，元亨利貞，悔亡。變革之時，改舊換新。',
  '火風鼎': '元吉，亨。鼎新革故，功成名就。',
  '震為雷': '亨。震來虩虩，笑言啞啞。振作奮起，先驚後安。',
  '風山漸': '女歸吉，利貞。循序漸進，水到渠成。',
  '雷澤歸妹': '征凶，無攸利。順應自然，妥善處理。',
  '雷火豐': '亨，王假之，勿憂，宜日中。豐盛之象，盛極思變。',
  '火山旅': '小亨，旅貞吉。旅途之象，隨遇而安。',
  '巽為風': '小亨，利有攸往，利見大人。柔順滲透，潛移默化。',
  '風水渙': '亨，王假有廟，利涉大川，利貞。渙散後重聚，化險為夷。',
  '水澤節': '亨，苦節不可貞。節制有度，適可而止。',
  '風澤中孚': '豚魚吉，利涉大川，利貞。誠信為本，以誠感人。',
  '雷山小過': '亨，利貞，可小事，不可大事。謹小慎微，不可大動。',
  '水火既濟': '亨小，利貞，初吉終亂。大功告成，謹防鬆懈。',
  '火水未濟': '亨，小狐汔濟，濡其尾，無攸利。功虧一簣，再接再厲。',
  '山澤咸': '亨，利貞，取女吉。感應相通，和諧共處。'
};

// 五行相生相剋
const XIANG_SHENG = { '木':'火', '火':'土', '土':'金', '金':'水', '水':'木' };
const XIANG_KE   = { '木':'土', '土':'水', '水':'火', '火':'金', '金':'木' };

// 五行顏色對應
const WUXING_COLOR = {
  '木': '#4ade80', '火': '#f87171', '土': '#fbbf24',
  '金': '#e2e8f0', '水': '#60a5fa'
};

// 五行圖案
const WUXING_SYMBOL = {
  '木': '🌿', '火': '🔥', '土': '⛰', '金': '⚡', '水': '💧'
};

// ==========================================
// 漢明距離計算
// ==========================================
function calcHammingDistance(code1, code2) {
  let dist = 0;
  for (let i = 0; i < code1.length; i++) {
    if (code1[i] !== code2[i]) dist++;
  }
  return dist;
}

// ==========================================
// 趨勢判斷
// ==========================================
function analyzeTrend(shangAttr, xiaAttr) {
  // 上卦=用（市場）、下卦=體（本金）
  if (XIANG_SHENG[shangAttr] === xiaAttr) {
    return {
      trend: '看漲 (Bullish)',
      label: '吉',
      desc: '市場能量在灌溉我方，趨勢大好！',
      icon: '📈',
      color: '#4ade80'
    };
  } else if (XIANG_SHENG[xiaAttr] === shangAttr) {
    return {
      trend: '平淡',
      label: '中',
      desc: '我方消耗能量去生市場，建議小額試探。',
      icon: '➡️',
      color: '#fbbf24'
    };
  } else if (XIANG_KE[shangAttr] === xiaAttr) {
    return {
      trend: '看跌 (Bearish)',
      label: '凶',
      desc: '市場能量在攻擊我方，建議做空或觀望！',
      icon: '📉',
      color: '#f87171'
    };
  } else if (XIANG_KE[xiaAttr] === shangAttr) {
    return {
      trend: '強勢',
      label: '吉',
      desc: '我方剋制市場，代表有獲利機會！',
      icon: '💪',
      color: '#4ade80'
    };
  } else {
    return {
      trend: '震盪 (Ranging)',
      label: '中',
      desc: '兩者能量相同，適合休息，不宜出手。',
      icon: '🔄',
      color: '#fbbf24'
    };
  }
}

// ==========================================
// 主起卦函數
// ==========================================
function performDivination(n1, n2, n3) {
  // 允許傳入隨機數，或者自動隨機
  const num1 = (n1 !== undefined) ? n1 : Math.floor(Math.random() * 999) + 1;
  const num2 = (n2 !== undefined) ? n2 : Math.floor(Math.random() * 999) + 1;
  const num3 = (n3 !== undefined) ? n3 : Math.floor(Math.random() * 999) + 1;

  let shangIdx = num1 % 8;
  if (shangIdx === 0) shangIdx = 8;
  let xiaIdx = num2 % 8;
  if (xiaIdx === 0) xiaIdx = 8;
  let yaoPosIdx = num3 % 6;
  if (yaoPosIdx === 0) yaoPosIdx = 6;

  const shangGua = BAGUA_DATA[shangIdx];
  const xiaGua   = BAGUA_DATA[xiaIdx];

  // 六十四卦名
  const hexagramName = HEXAGRAM_NAMES[shangIdx - 1][xiaIdx - 1];
  const judgment = HEXAGRAM_JUDGMENTS[hexagramName] || '（卦辭待補充）';

  // 漢明距離（上下卦間的能量差距）
  const hamming = calcHammingDistance(shangGua.code, xiaGua.code);

  // 變卦（動爻翻轉）
  const shangCode = shangGua.code.split('');
  const xiaCode   = xiaGua.code.split('');
  // 動爻在整卦的位置（從下往上：1-6，1-3 屬下卦，4-6 屬上卦）
  let bianShang = [...shangCode];
  let bianXia   = [...xiaCode];
  if (yaoPosIdx >= 4) {
    const pos = yaoPosIdx - 4; // 0,1,2
    bianShang[pos] = bianShang[pos] === '1' ? '0' : '1';
  } else {
    const pos = yaoPosIdx - 1;
    bianXia[pos] = bianXia[pos] === '1' ? '0' : '1';
  }
  const bianShangCode = bianShang.join('');
  const bianXiaCode   = bianXia.join('');

  // 找變卦名
  const bianShangIdx = Object.values(BAGUA_DATA).findIndex(g => g.code === bianShangCode);
  const bianXiaIdx   = Object.values(BAGUA_DATA).findIndex(g => g.code === bianXiaCode);
  let bianguaName = '';
  if (bianShangIdx >= 0 && bianXiaIdx >= 0) {
    bianguaName = HEXAGRAM_NAMES[bianShangIdx][bianXiaIdx];
  }

  // 趨勢判斷
  const trendResult = analyzeTrend(shangGua.attr, xiaGua.attr);

  // 波動強度評級
  let volatilityLabel, volatilityColor;
  if (hamming === 0)      { volatilityLabel = '極低';  volatilityColor = '#4ade80'; }
  else if (hamming === 1) { volatilityLabel = '低';    volatilityColor = '#86efac'; }
  else if (hamming === 2) { volatilityLabel = '中等';  volatilityColor = '#fbbf24'; }
  else                    { volatilityLabel = '高';    volatilityColor = '#f87171'; }

  return {
    num1, num2, num3,
    shangGua, xiaGua,
    shangIdx, xiaIdx,
    yaoPos: yaoPosIdx,
    hexagramName,
    judgment,
    hamming,
    volatilityLabel, volatilityColor,
    trendResult,
    bianguaName
  };
}

// ==========================================
// 繪製卦象（六爻符號）
// ==========================================
function renderYaoLines(shangCode, xiaCode, yaoPos) {
  // 合併六爻：下卦3爻 + 上卦3爻（從下往上）
  const allLines = [...xiaCode.split('').reverse(), ...shangCode.split('').reverse()];
  // yaoPos: 1=最下, 6=最上
  return allLines.map((bit, i) => {
    const lineNum = i + 1;
    const isDynamic = (lineNum === yaoPos);
    const isYang = (bit === '1');
    return { lineNum, isYang, isDynamic };
  }).reverse(); // 顯示時從上往下
}

export {
  BAGUA_DATA,
  HEXAGRAM_NAMES,
  HEXAGRAM_JUDGMENTS,
  WUXING_COLOR,
  WUXING_SYMBOL,
  XIANG_SHENG,
  XIANG_KE,
  performDivination,
  renderYaoLines,
  calcHammingDistance
};
