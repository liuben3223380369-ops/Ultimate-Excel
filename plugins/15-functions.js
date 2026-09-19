/*
 * 15-functions.js — 函数库大扩展（对标 Excel 365 / WPS Office 全量函数）
 *
 * 覆盖策略：
 *   1. formulajs（开源 sutoiku/formula.js，MIT）：统计/文本类 20 个（DOLLAR FIXED CONVERT GESTEP PERMUT
 *      MODE FORECAST INTERCEPT KURT TRIMMEAN PERCENTRANK RANK PROB AGGREGATE FREQUENCY GROWTH
 *      LINEST LOGEST MDETERM MINVERSE …）+ 新式别名（RANK.EQ RANK.AVG MODE.MULT MODE.SNGL
 *      FORECAST.LINEAR PERCENTRANK.INC/EXC）
 *   2. 手写金融函数族（标准债券数学）：PRICE YIELD DURATION MDURATION PRICEDISC YIELDDISC DISC
 *      INTRATE RECEIVED ACCRINTM TBILLEQ TBILLPRICE TBILLYIELD + COUP 系列（COUPNCD COUPPCD
 *      COUPDAYBS COUPDAYS COUPDAYSNC COUPNUM）
 *   3. 手写动态数组：XMATCH SORTBY RANDARRAY TAKE DROP EXPAND CHOOSEROWS CHOOSECOLS TOROW TOCOL
 *      WRAPROWS WRAPCOLS
 *   4. 手写文本/查找/信息：LOOKUP CONCAT TEXTSPLIT TEXTBEFORE TEXTAFTER ARRAYTOTEXT VALUETOTEXT
 *      ENCODEURL SINGLE ERROR.TYPE TYPE INFO NUMBERVALUE AVERAGEIFS PERMUTATIONA BINOM.DIST.RANGE
 *   5. 修复 HF.customFunctions 死代码 → 插件注册的 SPARK/QR/BARCODE/IMG 等函数真正生效
 *
 * 引擎对接要点（HyperFormula 3.4 自定义函数协议）：
 *   - implementedFunctions 必须为对象（key=函数名）；translations 外层 key 必须是语言代码 enGB
 *   - argumentType 取值必须大写：NUMBER/STRING/BOOLEAN/RANGE/INTEGER/ANY
 *   - repeatLastArgs 声明变长参数（可选参数用变长 + 回调内兜底，HF 无 optional 键）
 *   - 返回 2D 数组即"数组值"单元格（与 HF 内置 FILTER 行为一致）
 */
(function(){
'use strict';
const HF = window.HyperFormula || window.HF;
const FJ = window.formulajs;
if(!HF || !HF.registerFunctionPlugin) { console.warn('[15-functions] HyperFormula 不可用'); return; }
if(!FJ) { console.warn('[15-functions] formulajs 未加载，统计/文本扩展不可用'); }

const CE = HF.CellError, ET = HF.ErrorType || {};
const ETN = { NULL: 1, DIV0: 2, VALUE: 3, REF: 4, NAME: 5, NUM: 6, NA: 7, SPILL: 9, CALC: 14 };
const err  = (t) => new CE(ET[t] !== undefined ? ET[t] : (ETN[t] || 3));

/* ---------- 范围/标量转换 ---------- */
const isRange = (a) => !!a && typeof a === 'object' && typeof a.valuesFromTopLeftCorner === 'function';
function sv2arr(rv){                       /* SimpleRangeValue → 2D 数组 */
  const w = rv.width(), h = rv.height();
  const vals = Array.from(rv.valuesFromTopLeftCorner());
  const out = [];
  for(let r = 0; r < h; r++) out.push(vals.slice(r*w, r*w + w));
  return out;
}
function rvFlat(rv){ return Array.from(rv.valuesFromTopLeftCorner()); }
function rvFirst(rv){ const v = rvFlat(rv)[0]; return v === undefined ? err('VALUE') : v; }

/* ---------- 日期工具（Excel 序列号，基准 1899-12-30） ---------- */
const DAY = 86400000, EPOCH = Date.UTC(1899, 11, 30);
const serialToDate = (s) => new Date(EPOCH + Math.floor(Number(s)) * DAY);
const dateToSerialUTC = (y, m, d) => (Date.UTC(y, m, d) - EPOCH) / DAY;
function dateToSerial(d){
  if (!(d instanceof Date)) return d;
  return (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - EPOCH) / DAY
       + (d.getUTCHours()*3600 + d.getUTCMinutes()*60 + d.getUTCSeconds()) / 86400;
}
const dY = (d) => d.getUTCFullYear(), dM = (d) => d.getUTCMonth(), dD = (d) => d.getUTCDate();

/* ---------- 输出规整 ---------- */
function out(v){
  if (v instanceof Date) return dateToSerial(v);
  if (typeof v === 'number') return isFinite(v) ? v : err('NUM');
  if (v === null || v === undefined) return err('VALUE');
  return v;
}

/* ---------- 插件骨架 ---------- */
class ExtPlugin extends HF.FunctionPlugin {}
const IF_ = ExtPlugin.implementedFunctions = {};
const DICT = { enGB: {} };
function reg(name, fn){
  const method = 'm_' + name.replace(/[^A-Z0-9]/g, '_');
  IF_[name] = { method, parameters: [{ argumentType: 'ANY' }], repeatLastArgs: 1, vectorizationForbidden: true };
  DICT.enGB[name] = name + ' (MyExcel 扩展)';
  ExtPlugin.prototype[method] = function(ast, state){
    return this.runFunction(ast.args, state, this.metadata(name), fn);
  };
}
/* 参数预处理：symbol(空参)→undefined；范围/内联数组按模式展开
   mode: 'scalar'(默认，取左上角) | 'flat'(1D) | 'matrix'(2D) */
function prep(args, mode){
  return args.map(a => {
    if (typeof a === 'symbol' || a === undefined || a === null) return undefined;
    if (isRange(a)) return mode === 'matrix' ? sv2arr(a) : mode === 'flat' ? rvFlat(a) : rvFirst(a);
    if (Array.isArray(a)) {                  /* 内联数组字面量 {1;2} 是普通 2D 数组 */
      const flat = a.flat();
      if (mode === 'matrix') return a;
      return mode === 'flat' ? flat : flat[0];
    }
    return a;
  });
}
const S = (a) => a === undefined || a === null ? '' : String(a);

/* ============ 一、formulajs 桥接（已验证可用的实现） ============ */
const FJ_TABLE = {
  /* 标量 */
  DOLLAR:'s', FIXED:'s', CONVERT:'s', GESTEP:'s', PERMUT:'s',
  /* 数组入参 */
  MODE:'f', FORECAST:'f', INTERCEPT:'f', KURT:'f', TRIMMEAN:'f', PERCENTRANK:'f',
  RANK:'f', PROB:'f', AGGREGATE:'f', FREQUENCY:'m', GROWTH:'m', LINEST:'m',
  LOGEST:'m', MDETERM:'m', MINVERSE:'m',
  /* 新式命名别名 */
  'FORECAST.LINEAR':'f:FORECAST', 'MODE.MULT':'f:MODE', 'MODE.SNGL':'f:MODE',
  'RANK.EQ':'f:RANK', 'RANK.AVG':'f:RANK', 'PERCENTRANK.INC':'f:PERCENTRANK',
  'PERCENTRANK.EXC':'f:PERCENTRANK'
};
if (FJ) {
  const MODE2STR = { s: 'scalar', f: 'flat', m: 'matrix' };
  for (const [name, spec] of Object.entries(FJ_TABLE)) {
    const mode = MODE2STR[spec.split(':')[0]] || 'scalar';
    const fjName = spec.split(':')[1] || name;
    const f = FJ[fjName];
    if (typeof f !== 'function') continue;
    reg(name, (...args) => {
      if (window.__FJ_DEBUG) console.log('[fjdbg]', name, '→', args.map(a => isRange(a) ? 'R:' + rvFlat(a).join(',') : Array.isArray(a) ? 'A:' + JSON.stringify(a) : String(typeof a) + ':' + String(a)).join(' | '));
      const a = prep(args, mode);
      try {
        const r = f.apply(FJ, a);
        if (typeof r === 'string' && r.startsWith('#')) return r;  /* formulajs 返回错误码字符串 */
        return out(r);
      } catch (e) { return err('NUM'); }
    });
  }
}

/* ============ 二、手写金融函数族（标准债券数学） ============ */
/* basis: 0=US 30/360, 1=实际/实际, 2=实际/360, 3=实际/365, 4=欧洲 30/360 */
function days360(d1, d2, eu){
  let y1 = dY(d1), m1 = dM(d1), dd1 = dD(d1), y2 = dY(d2), m2 = dM(d2), dd2 = dD(d2);
  if (eu) { dd1 = Math.min(30, dd1); dd2 = Math.min(30, dd2); }
  else {
    if (m1 === 1 && dd1 === 31) dd1 = 30;
    if (dd1 === 31) dd1 = 30;
    if (dd2 === 31 && dd1 === 30) dd2 = 30;
  }
  return (y2 - y1) * 360 + (m2 - m1) * 30 + (dd2 - dd1);
}
function yearFrac(d1, d2, basis){
  basis = basis === undefined ? 0 : Number(basis);
  if (basis === 0 || basis === 4) return days360(d1, d2, basis === 4) / 360;
  const a = (d2 - d1) / DAY;
  if (basis === 2) return a / 360;
  if (basis === 3) return a / 365;
  /* basis 1: 实际/实际（Excel 同款） */
  const y1 = dY(d1), y2 = dY(d2);
  const leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  if (y1 === y2) return a / (leap(y1) ? 366 : 365);
  /* 跨年：不足一年按是否覆盖 2/29；否则按年平均长度 */
  if (a < 366) {
    const feb29 = Date.UTC(y1, 1, 29);
    const hasLeapDay = (d1.getTime() <= feb29 && feb29 < d2.getTime()) || (y2 % 4 === 0 && dM(d2) === 1 && dD(d2) === 29);
    return a / (hasLeapDay ? 366 : 365);
  }
  const avg = (Date.UTC(y2 + 1, 0, 1) - Date.UTC(y1, 0, 1)) / DAY / (y2 - y1 + 1);
  return a / avg;
}
/* 按月份差的付息期计数（Excel COUPNUM/PRICE 语义） */
function couponCount(st, mt, freq){
  let months = (dY(mt) - dY(st)) * 12 + (dM(mt) - dM(st));
  if (dD(mt) < dD(st)) months--;
  return Math.max(1, Math.ceil(months * freq / 12 - 1e-9));
}
function couponDates(settle, mature, freq){    /* 返回 [上一付息日, 下一付息日, 期间总天数] */
  const step = 12 / freq;
  let next = new Date(mature);
  while (next.getTime() > settle.getTime()) {
    next = new Date(Date.UTC(dY(next), dM(next) - step, dD(next)));
  }
  const prev = new Date(Date.UTC(dY(next), dM(next) + step, dD(next)));
  return [next, prev];
}
function fargs(args){                           /* 金融函数参数规整 (settle, mature, freq, basis) */
  const a = prep(args, 'scalar');
  return [serialToDate(a[0]), serialToDate(a[1]), a[2], a[3] === undefined ? 0 : Number(a[3])];
}
reg('COUPNCD', (...args) => { const [st, mt, fr, ba] = fargs(args); return out(couponDates(st, mt, Number(fr) || 2)[1]); });
reg('COUPPCD', (...args) => { const [st, mt, fr, ba] = fargs(args); return out(couponDates(st, mt, Number(fr) || 2)[0]); });
reg('COUPDAYBS', (...args) => {
  const [st, mt, fr, ba] = fargs(args);
  const [pcd] = couponDates(st, mt, Number(fr) || 2);
  return ba === 1 ? Math.round((st - pcd) / DAY) : days360(pcd, st, ba === 4);
});
reg('COUPDAYSNC', (...args) => {
  const [st, mt, fr, ba] = fargs(args);
  const [, ncd] = couponDates(st, mt, Number(fr) || 2);
  return ba === 1 ? Math.round((ncd - st) / DAY) : days360(st, ncd, ba === 4);
});
reg('COUPDAYS', (...args) => {
  const [st, mt, fr, ba] = fargs(args);
  if (ba === 1) { const [pcd, ncd] = couponDates(st, mt, Number(fr) || 2); return Math.round((ncd - pcd) / DAY); }
  return ba === 2 || ba === 3 ? 360 / (Number(fr) || 2) : 360;
});
reg('COUPNUM', (...args) => {
  const [st, mt, fr, ba] = fargs(args);
  const freq = Number(fr) || 2;
  if (mt <= st) return err('NUM');
  return couponCount(st, mt, freq);
});
reg('ACCRINTM', (...args) => {                  /* 到期付息证券应计利息 */
  const a = prep(args, 'scalar');
  const st = serialToDate(a[0]), mt = serialToDate(a[1]), rate = Number(a[2]), par = a[3] === undefined ? 1000 : Number(a[3]);
  const ba = a[4] === undefined ? 0 : Number(a[4]);
  if (!(rate > 0) || par <= 0) return err('NUM');
  return par * rate * yearFrac(st, mt, ba);
});
reg('PRICEDISC', (...args) => {
  const a = prep(args, 'scalar');
  const st = serialToDate(a[0]), mt = serialToDate(a[1]), disc = Number(a[2]), red = a[3] === undefined ? 100 : Number(a[3]);
  const ba = a[4] === undefined ? 0 : Number(a[4]);
  return red * (1 - disc * yearFrac(st, mt, ba));
});
reg('YIELDDISC', (...args) => {
  const a = prep(args, 'scalar');
  const st = serialToDate(a[0]), mt = serialToDate(a[1]), pr = Number(a[2]), red = a[3] === undefined ? 100 : Number(a[3]);
  const ba = a[4] === undefined ? 0 : Number(a[4]);
  return ((red - pr) / pr) / yearFrac(st, mt, ba);
});
reg('DISC', (...args) => {
  const a = prep(args, 'scalar');
  const st = serialToDate(a[0]), mt = serialToDate(a[1]), pr = Number(a[2]), red = a[3] === undefined ? 100 : Number(a[3]);
  const ba = a[4] === undefined ? 0 : Number(a[4]);
  return ((red - pr) / red) / yearFrac(st, mt, ba);
});
reg('INTRATE', (...args) => {
  const a = prep(args, 'scalar');
  const st = serialToDate(a[0]), mt = serialToDate(a[1]), inv = Number(a[2]), red = a[3] === undefined ? 100 : Number(a[3]);
  const ba = a[4] === undefined ? 0 : Number(a[4]);
  return ((red - inv) / inv) / yearFrac(st, mt, ba);
});
reg('RECEIVED', (...args) => {
  const a = prep(args, 'scalar');
  const st = serialToDate(a[0]), mt = serialToDate(a[1]), inv = Number(a[2]), disc = Number(a[3]);
  const ba = a[4] === undefined ? 0 : Number(a[4]);
  return inv / (1 - disc * yearFrac(st, mt, ba));
});
reg('TBILLEQ', (...args) => {                   /* 国债等价收益率 */
  const a = prep(args, 'scalar');
  const st = serialToDate(a[0]), mt = serialToDate(a[1]), disc = Number(a[2]);
  const dsm = (mt - st) / DAY;
  if (dsm > 365) return err('NUM');
  return (365 * disc) / (360 - disc * dsm);
});
reg('TBILLPRICE', (...args) => {
  const a = prep(args, 'scalar');
  const st = serialToDate(a[0]), mt = serialToDate(a[1]), disc = Number(a[2]);
  return 100 * (1 - disc * (mt - st) / DAY / 360);
});
reg('TBILLYIELD', (...args) => {
  const a = prep(args, 'scalar');
  const st = serialToDate(a[0]), mt = serialToDate(a[1]), pr = Number(a[2]);
  return ((100 - pr) / pr) * 360 / ((mt - st) / DAY);
});
function bondPrice(st, mt, rate, yld, red, freq, ba){   /* 标准债券定价（付息日近似 DSR=E） */
  if (mt <= st) return err('NUM');
  const fr = freq === undefined ? 2 : Math.trunc(Number(freq));
  if (![1, 2, 4].includes(fr)) return err('NUM');
  const n = couponCount(st, mt, fr);                              /* 剩余付息次数 */
  const t = yearFrac(st, mt, ba) * fr;                            /* 总期数（分数） */
  let price = 0;
  for (let k = 1; k <= n; k++) {
    const tk = t - (n - k);                                        /* 第 k 期距交割的期数 */
    price += (red * rate / fr) / Math.pow(1 + yld / fr, tk);
  }
  price += red / Math.pow(1 + yld / fr, t);
  return price;
}
reg('PRICE', (...args) => {
  const a = prep(args, 'scalar');
  const st = serialToDate(a[0]), mt = serialToDate(a[1]), rate = Number(a[2]), yld = Number(a[3]);
  const red = a[4] === undefined ? 100 : Number(a[4]), fr = a[5] === undefined ? 2 : Number(a[5]);
  const ba = a[6] === undefined ? 0 : Number(a[6]);
  const p = bondPrice(st, mt, rate, yld, red, fr, ba);
  return p instanceof CE ? p : Math.round(p * 1e8) / 1e8;
});
reg('YIELD', (...args) => {                     /* 二分法解 YIELD */
  const a = prep(args, 'scalar');
  const st = serialToDate(a[0]), mt = serialToDate(a[1]), rate = Number(a[2]), pr = Number(a[3]);
  const red = a[4] === undefined ? 100 : Number(a[4]), fr = a[5] === undefined ? 2 : Number(a[5]);
  const ba = a[6] === undefined ? 0 : Number(a[6]);
  let lo = -0.9999, hi = 10;
  const f = (y) => bondPrice(st, mt, rate, y, red, fr, ba) - pr;
  if (f(lo) * f(hi) > 0) return err('NUM');
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; (f(lo) * f(m) <= 0) ? hi = m : lo = m; }
  return Math.round(((lo + hi) / 2) * 1e8) / 1e8;
});
reg('DURATION', (...args) => {                  /* Macaulay 久期（息票债券） */
  const a = prep(args, 'scalar');
  const st = serialToDate(a[0]), mt = serialToDate(a[1]), rate = Number(a[2]), yld = Number(a[3]);
  const fr = a[5] === undefined ? 2 : Math.trunc(Number(a[5]));
  const ba = a[6] === undefined ? 0 : Number(a[6]);
  if (mt <= st || !fr) return err('NUM');
  const n = couponCount(st, mt, fr);
  const t = yearFrac(st, mt, ba);
  const cpn = rate / fr, y = yld / fr;
  let dur = 0, price = 0;
  for (let k = 1; k <= n; k++) {
    const tt = t * fr - (n - k);
    const cf = k === n ? 1 + cpn : cpn;
    const pv = cf / Math.pow(1 + y, tt);
    price += pv; dur += (tt / fr) * pv;
  }
  if (!price) return err('NUM');
  return dur / price;
});
reg('MDURATION', (...args) => {                 /* 修正久期 = Macaulay / (1+y/f) */
  const a = prep(args, 'scalar');
  const st = serialToDate(a[0]), mt = serialToDate(a[1]), rate = Number(a[2]), yld = Number(a[3]);
  const fr = a[5] === undefined ? 2 : Math.trunc(Number(a[5]));
  const ba = a[6] === undefined ? 0 : Number(a[6]);
  if (mt <= st || !fr) return err('NUM');
  const n = couponCount(st, mt, fr);
  const t = yearFrac(st, mt, ba);
  const cpn = rate / fr, y = yld / fr;
  let dur = 0, price = 0;
  for (let k = 1; k <= n; k++) {
    const tt = t * fr - (n - k);
    const cf = k === n ? 1 + cpn : cpn;
    const pv = cf / Math.pow(1 + y, tt);
    price += pv; dur += (tt / fr) * pv;
  }
  if (!price) return err('NUM');
  return (dur / price) / (1 + yld / fr);
});

/* ============ 三、手写：查找/动态数组 ============ */
reg('LOOKUP', (v, vec, res) => {
  const va = prep([vec], 'flat')[0], ra = prep([res], 'flat')[0];
  if (!Array.isArray(va)) return err('NA');
  let last = err('NA');
  for (let i = 0; i < va.length; i++) {
    const x = va[i];
    const nx = Number(x), nv = Number(v);
    const ok = (!isNaN(nx) && !isNaN(nv) && x !== '' && v !== '') ? nx <= nv : S(x).toLowerCase() <= S(v).toLowerCase();
    if (ok && Array.isArray(ra) && i < ra.length) last = ra[i];
  }
  return last;
});
reg('XMATCH', (x, arr, mm, sm) => {
  const a = prep([arr], 'flat')[0];
  if (!Array.isArray(a)) return err('VALUE');
  mm = mm === undefined ? 0 : Number(mm);
  sm = sm === undefined ? 1 : Number(sm);
  const nx = Number(x), isNumX = !isNaN(nx) && x !== '';
  const eq = (y) => { const ny = Number(y); const both = isNumX && !isNaN(ny) && y !== '';
    return both ? ny === nx : S(y).toLowerCase() === S(x).toLowerCase(); };
  const le = (y) => { const ny = Number(y); const both = isNumX && !isNaN(ny) && y !== '';
    return both ? ny <= nx : S(y).toLowerCase() <= S(x).toLowerCase(); };
  let idx = -1;
  if (mm === 0) { for (let i = 0; i < a.length; i++) if (eq(a[i])) { idx = i; break; } }
  else if (mm === -1) {
    for (let i = 0; i < a.length; i++) if (eq(a[i])) { idx = i; break; }
    if (idx < 0) { for (let i = a.length - 1; i >= 0; i--) if (le(a[i])) { idx = i; break; } }
  } else if (mm === 1) { for (let i = a.length - 1; i >= 0; i--) if (le(a[i])) { idx = i; break; } }
  else if (mm === 2) {
    const rx = new RegExp('^' + S(x).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
    for (let i = 0; i < a.length; i++) if (rx.test(S(a[i]))) { idx = i; break; }
  }
  if (idx < 0) return err('NA');
  return sm === -1 ? (a.length - idx) : idx + 1;
});
reg('SORTBY', (arr, by, order) => {
  const A = prep([arr], 'matrix')[0], B = prep([by], 'flat')[0];
  if (!Array.isArray(A) || !Array.isArray(B)) return err('VALUE');
  const ord = order === undefined ? 1 : Number(order) >= 0 ? 1 : -1;
  const idx = A.map((_, i) => i).sort((p, q) => {
    const x = B[p] ?? '', y = B[q] ?? '';
    const nx = Number(x), ny = Number(y);
    const c = (!isNaN(nx) && !isNaN(ny) && x !== '' && y !== '') ? (nx - ny) : S(x).localeCompare(S(y), 'zh-Hans-CN');
    return c * ord;
  });
  return idx.map(i => A[i].slice());
});
reg('RANDARRAY', (rows, cols, min, max, whole) => {
  const r = Math.max(1, rows === undefined ? 1 : Math.floor(Number(rows) || 1));
  const c = Math.max(1, cols === undefined ? 1 : Math.floor(Number(cols) || 1));
  const lo = min === undefined ? 0 : Number(min), hi = max === undefined ? 1 : Number(max);
  const out2 = [];
  for (let i = 0; i < r; i++) { const row = []; for (let j = 0; j < c; j++) {
    const v = lo + Math.random() * (hi - lo); row.push(whole ? Math.floor(v) : v); } out2.push(row); }
  return out2;
});
function takeDrop(A, n, drop){
  if (n === undefined) return null;
  const t = Math.trunc(Number(n)) || 0;
  if (!drop && t === 0) return [];
  if (t >= 0) return drop ? A.slice(t) : A.slice(0, t);
  return drop ? A.slice(0, A.length + t) : A.slice(A.length + t);
}
function transpose(A){ return A[0].map((_, c) => A.map(r => r[c])); }
reg('TAKE', (arr, rows, cols) => {
  const A = prep([arr], 'matrix')[0];
  if (!Array.isArray(A)) return err('VALUE');
  const rs = takeDrop(A, rows), A2 = rs === null ? A : rs;
  const cs = takeDrop(transpose(A2), cols);
  return cs === null ? A2 : transpose(cs);
});
reg('DROP', (arr, rows, cols) => {
  const A = prep([arr], 'matrix')[0];
  if (!Array.isArray(A)) return err('VALUE');
  const rs = takeDrop(A, rows, true), A2 = rs === null ? A : rs;
  const cs = takeDrop(transpose(A2), cols, true);
  return cs === null ? A2 : transpose(cs);
});
reg('EXPAND', (arr, rows, cols, pad) => {
  const A = prep([arr], 'matrix')[0];
  if (!Array.isArray(A)) return err('VALUE');
  const R = Math.max(1, Math.trunc(Number(rows) || A.length)), C = Math.max(1, Math.trunc(Number(cols) || A[0].length));
  const P = pad === undefined ? '#N/A' : pad;
  const out2 = [];
  for (let i = 0; i < R; i++) { const row = []; for (let j = 0; j < C; j++) row.push(i < A.length && j < A[i].length ? A[i][j] : P); out2.push(row); }
  return out2;
});
reg('CHOOSEROWS', (arr, ...rows) => {
  const A = prep([arr], 'matrix')[0];
  if (!Array.isArray(A)) return err('VALUE');
  const pick = (n) => { const t = Math.trunc(Number(n)); return t >= 0 ? A[t - 1] : A[A.length + t]; };
  return rows.map(pick).filter(r => r !== undefined);
});
reg('CHOOSECOLS', (arr, ...cols) => {
  const A = prep([arr], 'matrix')[0];
  if (!Array.isArray(A)) return err('VALUE');
  return A.map(row => cols.map(n => { const t = Math.trunc(Number(n)); return t >= 0 ? row[t - 1] : row[row.length + t]; }));
});
reg('TOROW', (arr, ignore, scan) => {
  const A = prep([arr], 'matrix')[0];
  if (!Array.isArray(A)) return err('VALUE');
  let flat = [];
  if (Number(scan) === 1) { for (let c = 0; c < A[0].length; c++) for (let r = 0; r < A.length; r++) flat.push(A[r][c]); }
  else flat = A.flat();
  if (Number(ignore) === 1) flat = flat.filter(v => v !== '');
  if (Number(ignore) === 2) flat = flat.filter(v => v !== undefined && v !== null);
  return [flat];
});
reg('TOCOL', (arr, ignore, scan) => {
  const A = prep([arr], 'matrix')[0];
  if (!Array.isArray(A)) return err('VALUE');
  let flat = [];
  if (Number(scan) === 1) { for (let c = 0; c < A[0].length; c++) for (let r = 0; r < A.length; r++) flat.push(A[r][c]); }
  else flat = A.flat();
  if (Number(ignore) === 1) flat = flat.filter(v => v !== '');
  if (Number(ignore) === 2) flat = flat.filter(v => v !== undefined && v !== null);
  return flat.map(v => [v]);
});
reg('WRAPROWS', (vec, n, pad) => {
  const v = prep([vec], 'flat')[0];
  if (!Array.isArray(v)) return err('VALUE');
  const w = Math.trunc(Number(n)); if (!(w > 0)) return err('VALUE');
  const P = pad === undefined ? '#N/A' : pad;
  const out2 = [];
  for (let i = 0; i < v.length; i += w) { const row = v.slice(i, i + w); while (row.length < w) row.push(P); out2.push(row); }
  return out2;
});
reg('WRAPCOLS', (vec, n, pad) => {
  const v = prep([vec], 'flat')[0];
  if (!Array.isArray(v)) return err('VALUE');
  const w = Math.trunc(Number(n)); if (!(w > 0)) return err('VALUE');
  const P = pad === undefined ? '#N/A' : pad;
  const out2 = [];
  for (let i = 0; i < v.length; i += w) { const col = v.slice(i, i + w); while (col.length < w) col.push(P); out2.push(col); }
  return transpose(out2);
});

/* ============ 四、手写：文本函数 ============ */
reg('CONCAT', (...args) => {
  let s = '';
  for (const a of args) {
    if (a === undefined || typeof a === 'symbol') continue;
    if (isRange(a)) { for (const v of rvFlat(a)) s += (v === null || v === undefined) ? '' : String(v); }
    else if (Array.isArray(a)) { for (const v of a.flat()) s += (v === null || v === undefined) ? '' : String(v); }
    else s += String(a);
  }
  return s;
});
const esc = (d) => S(d).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
reg('TEXTBEFORE', (text, delim, instance, ignoreCase) => {
  const t = S(toScalarArg(text)), d = S(toScalarArg(delim));
  if (!d) return err('VALUE');
  const inst = instance === undefined ? 1 : Math.trunc(Number(instance));
  const flags = Number(ignoreCase) === 1 ? 'i' : '';
  if (inst >= 0) {
    let idx = -1, from = 0;
    for (let k = 0; k < inst; k++) { const m = new RegExp(esc(d), flags).exec(t.slice(from)); if (!m) return err('NA'); idx = from + m.index; from = idx + 1; }
    return t.slice(0, idx);
  } else {
    const all = [...t.matchAll(new RegExp(esc(d), 'g' + flags))];
    const k = all.length + inst;
    if (k < 0 || !all[k]) return err('NA');
    return t.slice(0, all[k].index);
  }
});
reg('TEXTAFTER', (text, delim, instance, ignoreCase) => {
  const t = S(toScalarArg(text)), d = S(toScalarArg(delim));
  if (!d) return err('VALUE');
  const inst = instance === undefined ? 1 : Math.trunc(Number(instance));
  const flags = Number(ignoreCase) === 1 ? 'i' : '';
  const rx = new RegExp(esc(d), flags);
  if (inst >= 0) {
    let from = 0, m = null;
    for (let k = 0; k < inst; k++) { m = rx.exec(t.slice(from)); if (!m) return err('NA'); from += m.index + m[0].length; }
    return t.slice(from);
  } else {
    const all = [...t.matchAll(new RegExp(esc(d), 'g' + flags))];
    const k = all.length + inst;
    if (k < 0 || !all[k]) return err('NA');
    return t.slice(all[k].index + all[k][0].length);
  }
});
function toScalarArg(a){
  if (isRange(a)) return rvFirst(a);
  if (Array.isArray(a)) return a.flat()[0];
  return a;
}
reg('TEXTSPLIT', (text, colDelim, rowDelim, ignoreEmpty) => {
  const t = S(toScalarArg(text));
  const cd = colDelim === undefined || colDelim === null ? null : S(toScalarArg(colDelim));
  const rd = rowDelim === undefined || rowDelim === null ? null : S(toScalarArg(rowDelim));
  const ie = ignoreEmpty === undefined ? true : !(Number(ignoreEmpty) === 0);
  const splitOne = (s, d) => (d === null || d === '') ? [s] : s.split(new RegExp(esc(d)));
  const cols = splitOne(t, cd).filter(x => !ie || x !== '');
  if (!rd) return [cols];
  const rows = cols.map(x => splitOne(x, rd)).flat();
  return rows.filter(x => !ie || x !== '').map(x => [x]);
});
reg('ARRAYTOTEXT', (arr, fmt) => {
  const A = prep([arr], 'matrix')[0];
  if (!Array.isArray(A)) return err('VALUE');
  if (Number(fmt) === 1) return A.map(r => r.map(v => S(v)).join('\t')).join('\n');
  return A.map(r => r.join(', ')).join(', ');
});
reg('VALUETOTEXT', (v) => S(toScalarArg(v)));
reg('NUMBERVALUE', (text, decSep, grpSep) => {
  const t = S(toScalarArg(text)).trim();
  const d = decSep === undefined ? '.' : S(decSep), g = grpSep === undefined ? ',' : S(grpSep);
  if (!t) return 0;
  const cleaned = t.split(g).join('').replace(d, '.').replace(/[^0-9.+-eE]/g, '');
  const n = Number(cleaned);
  return isNaN(n) ? err('VALUE') : n;
});

/* ============ 五、手写：信息/其他 ============ */
reg('SINGLE', (v) => {
  const a = toScalarArg(v);
  if (Array.isArray(a) && Array.isArray(a[0])) return a[0][0];
  if (Array.isArray(a)) return a[0];
  return a;
});
reg('ENCODEURL', (t) => encodeURIComponent(S(toScalarArg(t))));
reg('ERROR.TYPE', (v) => {
  const s = S(toScalarArg(v)).toUpperCase().replace(/\s+/g, '');
  const m = { '#NULL!': 1, '#DIV/0!': 2, '#VALUE!': 3, '#REF!': 4, '#NAME?': 5, '#NUM!': 6, '#N/A': 7, '#SPILL!': 9, '#CALC!': 14 };
  return m[s] !== undefined ? m[s] : err('NA');
});
reg('TYPE', (v) => {
  const a = v;
  if (typeof a === 'number') return 1;
  if (typeof a === 'string' || typeof a === 'symbol') return 2;
  if (typeof a === 'boolean') return 4;
  if (a instanceof CE) return 16;
  if (isRange(a) || Array.isArray(a)) return 64;
  return 1;
});
reg('INFO', (what) => {
  const w = S(toScalarArg(what)).toLowerCase();
  switch (w) {
    case 'directory': case 'origin': return 'MyExcel';
    case 'numfile': return (window.WB && WB.sheets) ? WB.sheets.length : 1;
    case 'osversion': return (window.navigator && navigator.platform) || 'web';
    case 'recalc': return '自动';
    case 'release': return 'MyExcel 2.0';
    case 'system': return 'web';
    case 'memavail': case 'memused': case 'totmem':
      return (window.performance && performance.memory) ? Math.round(performance.memory[w === 'memused' ? 'usedJSHeapSize' : 'jsHeapSizeLimit'] / 1024) : 1048576;
    default: return err('VALUE');
  }
});
reg('PERMUTATIONA', (n, k) => {
  const N = Number(toScalarArg(n)) || 0, K = Number(toScalarArg(k)) || 0;
  if (N < 0 || K < 0) return err('NUM');
  return Math.pow(N, K);
});
reg('BINOM.DIST.RANGE', (n, p, s1, s2) => {
  const N = Math.trunc(Number(toScalarArg(n))), P = Number(toScalarArg(p));
  const S1 = Math.trunc(Number(toScalarArg(s1))), S2 = s2 === undefined ? S1 : Math.trunc(Number(toScalarArg(s2)));
  if (!(N >= 0) || P < 0 || P > 1 || S1 > S2) return err('NUM');
  const cnk = (n2, k) => { k = Math.min(k, n2 - k); let r = 1; for (let i = 1; i <= k; i++) r = r * (n2 - k + i) / i; return Math.round(r); };
  let sum = 0;
  for (let k = Math.max(0, S1); k <= Math.min(N, S2); k++) sum += cnk(N, k) * Math.pow(P, k) * Math.pow(1 - P, N - k);
  return sum;
});
reg('AVERAGEIFS', (avgRange, ...pairs) => {
  const AR = prep([avgRange], 'flat')[0];
  if (!Array.isArray(AR)) return err('VALUE');
  const crits = [];
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const rng = prep([pairs[i]], 'flat')[0], crit = toScalarArg(pairs[i + 1]);
    if (!Array.isArray(rng) || rng.length !== AR.length) return err('VALUE');
    crits.push({ rng, crit });
  }
  const pred = (v, c) => {
    if (typeof c !== 'string') return v === c;
    const m = c.match(/^(>=|<=|<>|>|<|=)(.*)$/);
    if (!m) { const rx = new RegExp('^' + esc(c) .replace(/\\\*/g, '.*').replace(/\\\?/g, '.') + '$', 'i'); return rx.test(S(v)); }
    const op = m[1], rhs = m[2];
    const nv = Number(v), nr = Number(rhs);
    const both = !isNaN(nv) && !isNaN(nr) && v !== '' && rhs !== '';
    const a = both ? nv : S(v).toLowerCase(), b = both ? nr : rhs.toLowerCase();
    switch (op) { case '>': return a > b; case '<': return a < b; case '>=': return a >= b; case '<=': return a <= b; case '<>': return a != b; default: return a == b; }
  };
  let sum = 0, cnt = 0;
  for (let i = 0; i < AR.length; i++) {
    if (crits.every(c => pred(c.rng[i], c.crit))) { const nv = Number(AR[i]); if (!isNaN(nv) && AR[i] !== '') { sum += nv; cnt++; } }
  }
  return cnt ? sum / cnt : err('DIV0');
});

/* ============ 六、修复 HF.customFunctions 死代码（插件桥） ============ */
if (typeof HF.customFunctions !== 'function') {
  HF.customFunctions = function(map){
    if (!map || !Object.keys(map).length) return;
    class BridgePlugin extends HF.FunctionPlugin {}
    BridgePlugin.implementedFunctions = {};
    const dict = { enGB: {} };
    for (const [name, fn] of Object.entries(map)) {
      const method = 'b_' + name.replace(/[^A-Z0-9]/g, '_');
      BridgePlugin.implementedFunctions[name] = { method, parameters: [{ argumentType: 'ANY' }], repeatLastArgs: 1, vectorizationForbidden: true };
      dict.enGB[name] = name + ' (plugin)';
      BridgePlugin.prototype[method] = function(ast, state){
        return this.runFunction(ast.args, state, this.metadata(name), (...args) => {
          const flat = [];
          for (const a of args) {
            if (typeof a === 'symbol' || a === undefined) continue;
            if (isRange(a)) { for (const v of rvFlat(a)) flat.push(v === undefined || v === null ? '' : v); }
            else if (Array.isArray(a)) { for (const v of a.flat()) flat.push(v === undefined || v === null ? '' : v); }
            else flat.push(a);
          }
          return fn.apply(null, flat);
        });
      };
    }
    try { HF.registerFunctionPlugin(BridgePlugin, dict); }
    catch (e) { console.warn('[15-functions] bridge 注册失败:', e); }
  };
}

/* ============ 注册 ============ */
try {
  HF.registerFunctionPlugin(ExtPlugin, DICT);
  console.log('[15-functions] 已注册扩展函数:', Object.keys(IF_).length, '个');
} catch (e) {
  console.error('[15-functions] 注册失败:', e);
}

/* 插件登记：确保 MX._pendingHFFns 存在 → 主应用启动时走 HF.customFunctions 桥 + 重建引擎 */
if (window.MX) {
  MX.plug.register({
    name: 'extended-functions',
    version: '1.0.0',
    init: function(){
      if (window.MX._pendingHFFns === undefined) window.MX._pendingHFFns = {};
    }
  });
}
})();
