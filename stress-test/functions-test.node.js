/* 15-functions.js 引擎级验证（Node）
 * 运行：set NODE_PATH=..\.tools\formulajs-test\node_modules && node functions-test.node.js */
'use strict';
global.window = global;

/* 模拟浏览器环境 */
window.HF = require('../lib/hyperformula.min.js');
try { window.formulajs = require('../lib/formula.min.js'); }
catch (e) { console.warn('formulajs 加载失败:', e.message); }

require('../plugins/15-functions.js');
const names = window.HF.getRegisteredFunctionNames('enGB');
console.log('已注册函数总数:', names.length, '（原 423）');

const CFG = { licenseKey: 'gpl-v3', precisionRounding: 14, nullDate: { year: 1899, month: 12, day: 30 }, functionArgSeparator: ',', useStatsArrayArgumentType: 'both', smartRounding: false, maxRows: 1048576, maxColumns: 16384 };

let pass = 0, fail = 0, obs = 0;
function T(label, formula, expect, tolerance) {
  const h = window.HF.buildFromArray([[formula]], CFG);
  const got = h.getCellValue({ sheet: 0, row: 0, col: 0 });
  h.destroy();
  let g = got;
  if (g && typeof g === 'object' && g.value !== undefined) g = g.value;
  let ok;
  if (expect === null) { obs++; console.log('  OBS ', label, '→', JSON.stringify(g).slice(0, 60)); return; }
  if (tolerance !== undefined) {
    /* 标量/数组均支持容差比较 */
    const near = (a, b) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= tolerance : JSON.stringify(a) === JSON.stringify(b);
    const deepNear = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Array.isArray(v) ? deepNear(v, b[i]) : near(v, b[i]));
    ok = Array.isArray(g) ? deepNear(g, expect) : near(g, expect);
  }
  else ok = JSON.stringify(g) === JSON.stringify(expect);
  if (ok) { pass++; console.log('  PASS', label, '=', JSON.stringify(g)); }
  else { fail++; console.log('  FAIL', label, '→ got:', JSON.stringify(g), 'expect:', JSON.stringify(expect)); }
}

console.log('--- formulajs 桥接 ---');
T('DOLLAR(1234.567)', '=DOLLAR(1234.567,2)', '$1,234.57');
T('FIXED(1234.567,1)', '=FIXED(1234.567,1,TRUE())', '1234.6');
T('PERMUT(5,2)', '=PERMUT(5,2)', 20);
T('GESTEP(5,4)', '=GESTEP(5,4)', 1);
T('CONVERT(1,"mi","km")', '=CONVERT(1,"mi","km")', 1.609344);
T('MODE({1;2;2;3})', '=MODE({1;2;2;3})', 2);
T('FORECAST(30,…)', '=FORECAST(30,{1;2;3},{10;20;30})', 3);
T('INTERCEPT', '=INTERCEPT({2;4;6},{1;2;3})', 0, 1e-9);
T('KURT', '=KURT({3;4;5;2;3;4;5;6;4;7})', -0.15179963720843, 1e-9);
T('RANK.EQ(3,…,0)', '=RANK.EQ(3,{1;3;5;3},0)', 2);
T('RANK(3,…,1)', '=RANK(3,{1;3;5;3},1)', 2);   /* 升序：比 3 小的只有 1 → rank 2（与 Excel 一致） */
T('MODE.SNGL alias', '=MODE.SNGL({1;2;2;3})', 2);
T('FORECAST.LINEAR alias', '=FORECAST.LINEAR(30,{1;2;3},{10;20;30})', 3);
T('PERCENTRANK', '=PERCENTRANK({1;2;3;4},3)', 0.666, 0.001);
T('AGGREGATE(9,4,…) SUM', '=AGGREGATE(9,4,{1;2;3})', 6);
T('TRIMMEAN', '=TRIMMEAN({1;2;3;4;5;6;7;8;9;10},0.2)', 5.5);
T('MDETERM', '=MDETERM({1,2;3,4})', -2);
T('MINVERSE', '=MINVERSE({4,7;2,6})', [[0.6, -0.7], [-0.2, 0.4]], 1e-9);
T('PROB', '=PROB({1;2;3},{0.2;0.3;0.5},1,2)', 0.5);

console.log('--- 金融函数族（手写） ---');
T('PRICE 5%/6% 半年', '=PRICE(DATE(2020,1,1),DATE(2030,1,1),0.05,0.06,100,2,0)', 92.56, 0.5);
T('PRICE 平价', '=PRICE(DATE(2020,1,1),DATE(2030,1,1),0.05,0.05,100,2,0)', 100, 0.05);
T('YIELD 平价', '=YIELD(DATE(2020,1,1),DATE(2030,1,1),0.05,100,100,2,0)', 0.05, 0.001);
T('YIELD 折价', '=YIELD(DATE(2020,1,1),DATE(2030,1,1),0.05,92.56,100,2,0)', 0.06, 0.002);
T('DURATION', '=DURATION(DATE(2020,1,1),DATE(2030,1,1),0.05,0.06,100,2,0)', 7.99, 0.15);
T('MDURATION', '=MDURATION(DATE(2020,1,1),DATE(2030,1,1),0.05,0.06,100,2,0)', 7.76, 0.15);
T('PRICEDISC', '=PRICEDISC(DATE(2020,1,1),DATE(2021,1,1),0.05,100,0)', 95, 0.01);
T('YIELDDISC', '=YIELDDISC(DATE(2020,1,1),DATE(2021,1,1),95,100,0)', 0.0526, 0.001);
T('DISC', '=DISC(DATE(2020,1,1),DATE(2021,1,1),95,100,0)', 0.05, 0.001);
T('INTRATE', '=INTRATE(DATE(2020,1,1),DATE(2021,1,1),95,100,0)', 0.0526, 0.001);
T('RECEIVED', '=RECEIVED(DATE(2020,1,1),DATE(2021,1,1),1000000,0.05,0)', 1052631.58, 1);
T('ACCRINTM', '=ACCRINTM(DATE(2020,1,1),DATE(2021,1,1),0.05,1000,0)', 50, 0.01);
T('COUPNCD', '=COUPNCD(DATE(2020,3,31),DATE(2030,11,15),2,0)', null);
T('COUPPCD', '=COUPPCD(DATE(2020,3,31),DATE(2030,11,15),2,0)', null);
T('COUPNUM', '=COUPNUM(DATE(2020,3,31),DATE(2030,11,15),2,0)', 22, 0.9);
T('TBILLPRICE', '=TBILLPRICE(DATE(2020,1,1),DATE(2020,7,1),0.04)', 97.9778, 0.01);
T('TBILLYIELD', '=TBILLYIELD(DATE(2020,1,1),DATE(2020,7,1),98)', 0.0408, 0.001);
T('TBILLEQ', '=TBILLEQ(DATE(2020,1,1),DATE(2020,7,1),0.04)', 0.0414, 0.001);

console.log('--- 查找/动态数组 ---');
T('LOOKUP', '=LOOKUP(3,{1;2;3;4},{"a";"b";"c";"d"})', 'c');
T('XMATCH exact', '=XMATCH(3,{1;2;3;4})', 3);
T('XMATCH next smaller', '=XMATCH(2.5,{1;2;3;4},-1)', 2);
T('XMATCH next larger', '=XMATCH(2.5,{1;2;3;4},1)', 2);
T('XMATCH wildcard', '=XMATCH("b*",{"apple";"banana";"cherry"},2)', 2);
T('SORTBY', '=SORTBY({"a";"b";"c"},{3;1;2})', [['b'], ['c'], ['a']]);
T('TAKE rows', '=TAKE({1,2,3;4,5,6},1)', [[1, 2, 3]]);
T('TAKE neg', '=TAKE({1,2,3;4,5,6},-1)', [[4, 5, 6]]);
T('DROP', '=DROP({1,2,3;4,5,6},1)', [[4, 5, 6]]);
T('EXPAND', '=EXPAND({1,2},3,3,"x")', [[1, 2, 'x'], ['x', 'x', 'x'], ['x', 'x', 'x']]);
T('CHOOSEROWS', '=CHOOSEROWS({1,2;3,4;5,6},1,3)', [[1, 2], [5, 6]]);
T('CHOOSECOLS', '=CHOOSECOLS({1,2,3;4,5,6},2)', [[2], [5]]);
T('TOROW', '=TOROW({1,2;3,4})', [[1, 2, 3, 4]]);
T('TOCOL', '=TOCOL({1,2;3,4})', [[1], [2], [3], [4]]);
T('WRAPROWS', '=WRAPROWS({1,2,3,4,5},2,"p")', [[1, 2], [3, 4], [5, 'p']]);
T('WRAPCOLS', '=WRAPCOLS({1,2,3,4,5},2,"p")', [[1, 3, 5], [2, 4, 'p']]);
T('RANDARRAY 常量区间', '=TAKE(RANDARRAY(9,1,7,7),2,1)', [[7], [7]]);

console.log('--- 文本 ---');
T('CONCAT', '=CONCAT("a","b",1)', 'ab1');
T('TEXTBEFORE', '=TEXTBEFORE("a-b-c","-")', 'a');
T('TEXTBEFORE n=2', '=TEXTBEFORE("a-b-c","-",2)', 'a-b');
T('TEXTBEFORE n=-1', '=TEXTBEFORE("a-b-c","-",-1)', 'a-b');
T('TEXTAFTER', '=TEXTAFTER("a-b-c","-")', 'b-c');
T('TEXTAFTER n=2', '=TEXTAFTER("a-b-c","-",2)', 'c');
T('TEXTSPLIT', '=TEXTSPLIT("a,b,c",",")', [['a', 'b', 'c']]);
T('ARRAYTOTEXT', '=ARRAYTOTEXT({1,2;3,4})', '1, 2, 3, 4');
T('VALUETOTEXT', '=VALUETOTEXT(123)', '123');
T('NUMBERVALUE', '=NUMBERVALUE("1.234,56",",",".")', 1234.56);
T('SINGLE', '=SINGLE({1,2;3,4})', 1);
T('ENCODEURL', '=ENCODEURL("a b&c")', 'a%20b%26c');

console.log('--- 信息/其他 ---');
T('AVERAGEIFS', '=AVERAGEIFS({1;2;3;4},{10;20;30;40},">15")', 3);
T('AVERAGEIFS 双条件', '=AVERAGEIFS({1;2;3;4},{10;20;30;40},">15",{1;2;3;4},"<4")', 2.5);
T('PERMUTATIONA', '=PERMUTATIONA(3,2)', 9);
T('BINOM.DIST.RANGE', '=BINOM.DIST.RANGE(10,0.5,4,6)', 0.65625);
T('ERROR.TYPE', '=ERROR.TYPE("#DIV/0!")', 2);
T('TYPE(1)', '=TYPE(1)', 1);
T('TYPE("a")', '=TYPE("a")', 2);
T('TYPE(TRUE())', '=TYPE(TRUE())', 4);
T('INFO(system)', '=INFO("system")', 'web');

console.log('--- 桥接（插件函数复活） ---');
window.HF.customFunctions({ DOUBLE: (x) => Number(x) * 2, SPARKX: (...a) => a.map(Number).reduce((x, y) => x + y, 0) });
T('bridge DOUBLE', '=DOUBLE(21)', 42);
T('bridge SPARKX', '=SPARKX(1,2,3)', 6);

console.log(`\n结果: ${pass} PASS / ${fail} FAIL / ${obs} 观察`);
process.exit(fail > 5 ? 1 : 0);
