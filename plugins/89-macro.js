/*
 * 89-macro.js — 宏系统（VBA-lite：JavaScript 宏 + 面板 + 沙箱 API + 持久化）
 *
 * 设计（对标 Excel 宏 / WPS 宏，但用 JavaScript 而非 VBA）：
 *   · 宏 = { id, name, code, autorun, hotkey }
 *   · 面板：列表 + 代码编辑器 + 运行输出控制台 + 导入/导出（JSON）
 *   · 每个宏以 new Function('$', code) 执行，$ 为受限 API（读写单元格/工作表/选区/样式）
 *   · 安全：黑名单静态检查（window/document/localStorage/fetch/eval/import…），命中即拒绝执行
 *   · 持久化：localStorage['myexcel-macros']；autorun 宏在插件启动后自动运行
 *   · 快捷键：Ctrl+Alt+<key> 逐宏绑定；Ctrl+Alt+M 打开宏面板
 *
 * 宏 API 速查（宏代码内的 $ 对象）：
 *   $.toast(msg)            浮动提示                $.log(...)            输出到宏控制台
 *   $.alert/confirm/prompt  对话框
 *   $.get('A1')             读单元格（公式返回计算值） $.set('A1', v)        写单元格（'=…' 视为公式）
 *   $.setStyle('A1', {bg:'#ffcccc', b:1, fc:'#c00'})
 *   $.getRange('A1:C5')     → 2D 数组               $.setRange('A1', [[..]])
 *   $.fill('A1:A10', v)     区域填充                 $.clear('A1:C5')      清空区域
 *   $.forEach('A1:C5', (v, addr, r, c) => …)         遍历区域
 *   $.sel() / $.selAddr()   当前选区                $.setSel('B2')
 *   $.sheetName()           活动表名                 $.sheets()            全部表名
 *   $.activate(name)        切换表                   $.addSheet(name?)
 *   $.run(name)             运行另一宏               $.now() / $.version
 */
(function(){
'use strict';

const STORE_KEY = 'myexcel-macros';
const SAFETY = [
  [/window\./,          'window'],
  [/document\b/,        'document'],
  [/globalThis\b/,      'globalThis'],
  [/localStorage\b/,    'localStorage'],
  [/sessionStorage\b/,  'sessionStorage'],
  [/\beval\s*\(/,       'eval'],
  [/\bFunction\s*\(/,   'Function'],
  [/\bfetch\s*\(/,      'fetch'],
  [/XMLHttpRequest/,    'XMLHttpRequest'],
  [/\bimport\s*\(/,     'import'],
  [/\brequire\s*\(/,    'require'],
  [/\bpostMessage\b/,   'postMessage'],
  [/navigator\b/,       'navigator'],
  [/\blocation\b/,      'location'],
  [/\btop\b|\bparent\b/, 'top/parent']
];
function checkSafety(code){
  for (const [rx, tag] of SAFETY) if (rx.test(code)) return tag;
  return null;
}

let MACROS = [];
function loadMacros(){
  try {
    const a = JSON.parse(localStorage.getItem(STORE_KEY));
    if (Array.isArray(a)) { MACROS = a.filter(m => m && m.name && typeof m.code === 'string'); return; }
  } catch(_){}
  /* 首次使用：预置示例宏 */
  MACROS = [
    { id: uid(), name: '九九乘法表', autorun: false, hotkey: '',
      code:
'/* 在 A1 起生成九九乘法表 */\n'+
'for (let r = 1; r <= 9; r++) {\n'+
'  for (let c = 1; c <= r; c++) {\n'+
'    $.set(String.fromCharCode(64 + c) + r, c + "×" + r + "=" + (c * r));\n'+
'  }\n'+
'}\n'+
'$.toast("九九乘法表已生成");' },
    { id: uid(), name: '标红超100', autorun: false, hotkey: '',
      code:
'/* 把当前选区中 >100 的单元格标红加粗 */\n'+
'const s = $.sel();\n'+
'let n = 0;\n'+
'$.forEach(s.addr, (v, addr) => {\n'+
'  if (typeof v === "number" && v > 100) {\n'+
'    $.setStyle(addr, { bg: "#ffcccc", b: 1, fc: "#c0392b" });\n'+
'    n++;\n'+
'  }\n'+
'});\n'+
'$.toast("已标记 " + n + " 个单元格");' },
    { id: uid(), name: '快速汇总', autorun: false, hotkey: '',
      code:
'/* 在选中列的下一行写入 SUM 公式 */\n'+
'const s = $.sel();\n'+
'const lastRow = s.rows;\n'+
'$.set("A" + (lastRow + 1), "=SUM(A1:A" + lastRow + ")");\n'+
'$.log("汇总公式已写入 A" + (lastRow + 1));' }
  ];
  saveMacros();
}
function saveMacros(){
  try { localStorage.setItem(STORE_KEY, JSON.stringify(MACROS)); } catch(_){}
}
function uid(){ return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

MX.plug.register({
  name: 'macros',
  version: '1.0.0',
  init(){
    loadMacros();

    /* ---------------- 宏 API（每次运行时构建，捕获输出） ---------------- */
    let consoleLines = [];
    function buildAPI(runner){
      const api = {
        version: '1.0',
        now: () => new Date().toISOString(),
        toast: (m) => toast(String(m)),
        alert: (m) => alert(String(m)),
        confirm: (m) => confirm(String(m)),
        prompt: (m, d) => prompt(String(m), d),
        log: (...a) => { consoleLines.push(a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')); },
        sheetName: () => SH().name,
        sheets: () => WB.sheets.map(s => s.name),
        activate: (name) => {
          const i = WB.sheets.findIndex(s => s.name === String(name));
          if (i >= 0) { WB.active = i; renderTabs(); refreshAll(); }
          return i >= 0;
        },
        addSheet: (name) => {
          const nm = uniqueSheetName(String(name || '宏表'));
          WB.sheets.push(newSheet(nm));
          WB.active = WB.sheets.length - 1;
          buildGrid && buildGrid(); renderTabs(); refreshAll();
          return nm;
        },
        get: (addr) => {
          const p = parseRef(String(addr));
          if (!p) throw new Error('无效地址: ' + addr);
          const v = displayValue(p.r, p.c);
          return v === undefined ? '' : v;
        },
        set: (addr, v) => {
          const p = parseRef(String(addr));
          if (!p) throw new Error('无效地址: ' + addr);
          const cell = ensureCell(p.r, p.c);
          cell.v = v;
          runner.dirty = true;
        },
        setStyle: (addr, style) => {
          const p = parseRef(String(addr));
          if (!p) throw new Error('无效地址: ' + addr);
          const cell = ensureCell(p.r, p.c);
          cell.s = Object.assign({}, cell.s, style);
          runner.dirty = true;
        },
        getRange: (addr) => {
          const box = parseBox(addr);
          const out = [];
          for (let r = box.r1; r <= box.r2; r++) {
            const row = [];
            for (let c = box.c1; c <= box.c2; c++) { const v = displayValue(r, c); row.push(v === undefined ? '' : v); }
            out.push(row);
          }
          return out;
        },
        setRange: (addr, data) => {
          const p = parseRef(String(addr));
          if (!p || !Array.isArray(data)) throw new Error('setRange 需要起始地址和二维数组');
          data.forEach((row, i) => (Array.isArray(row) ? row : [row]).forEach((v, j) => {
            const cell = ensureCell(p.r + i, p.c + j);
            cell.v = v;
            runner.dirty = true;
          }));
        },
        fill: (addr, v) => {
          const box = parseBox(addr);
          for (let r = box.r1; r <= box.r2; r++) for (let c = box.c1; c <= box.c2; c++) {
            ensureCell(r, c).v = typeof v === 'function' ? v(refStr(r, c), r - box.r1, c - box.c1) : v;
            runner.dirty = true;
          }
        },
        clear: (addr) => {
          const box = parseBox(addr);
          const s = SH();
          for (let r = box.r1; r <= box.r2; r++) for (let c = box.c1; c <= box.c2; c++) delete s.cells[key(r, c)];
          runner.dirty = true;
        },
        forEach: (addr, fn) => {
          const box = parseBox(addr);
          const out = [];
          for (let r = box.r1; r <= box.r2; r++) for (let c = box.c1; c <= box.c2; c++) {
            const v = displayValue(r, c);
            out.push(fn(v === undefined ? '' : v, refStr(r, c), r - box.r1, c - box.c1));
          }
          return out;
        },
        selAddr: () => refStr(sel.r1, sel.c1) + ':' + refStr(sel.r2, sel.c2),
        sel: () => ({
          addr: refStr(sel.r1, sel.c1) + ':' + refStr(sel.r2, sel.c2),
          r1: sel.r1, c1: sel.c1, r2: sel.r2, c2: sel.c2,
          rows: sel.r2 - sel.r1 + 1, cols: sel.c2 - sel.c1 + 1,
          values: api.getRange(refStr(sel.r1, sel.c1) + ':' + refStr(sel.r2, sel.c2))
        }),
        setSel: (addr) => {
          const box = parseBox(addr);
          setSel(box.r1, box.c1, box.r2, box.c2);
        },
        run: (name) => runMacro(String(name))
      };
      return api;
    }

    /* 'A1:C5' / 'A1' → {r1,c1,r2,c2} */
    function parseBox(addr){
      const parts = String(addr).split(':');
      const p1 = parseRef(parts[0]);
      const p2 = parts[1] ? parseRef(parts[1]) : p1;
      if (!p1 || !p2) throw new Error('无效区域: ' + addr);
      return { r1: Math.min(p1.r, p2.r), c1: Math.min(p1.c, p2.c), r2: Math.max(p1.r, p2.r), c2: Math.max(p1.c, p2.c) };
    }
    /* 单元格显示值（公式经 HF 计算） */
    function displayValue(r, c){
      try {
        if (HF_INSTANCE && HF_INSTANCE.getCellValue) {
          let v = HF_INSTANCE.getCellValue({ sheet: WB.active, row: r, col: c });
          if (v && typeof v === 'object') {
            if (typeof errStr === 'function' && v.__err) return errStr(v);
            if (v.value !== undefined) return v.value;   /* CellError → '#XXX!' */
            if (typeof v === 'object' && v.constructor && /CellError/i.test(v.constructor.name || '')) return '#ERROR!';
          }
          if (v !== undefined && v !== null) return v;
        }
      } catch(_){}
      const cell = getCell(r, c);
      return cell ? cell.v : '';
    }

    /* ---------------- 运行器 ---------------- */
    function runMacro(name, silent){
      const m = MACROS.find(x => x.name === name);
      if (!m) { toast('宏不存在: ' + name); return; }
      const bad = checkSafety(m.code);
      if (bad) {
        toast('宏 "' + name + '" 使用了受限功能（' + bad + '），已拒绝执行');
        console.warn('[macros] 安全拦截:', name, bad);
        return;
      }
      consoleLines = [];
      const runner = { dirty: false };
      const api = buildAPI(runner);
      pushUndo();
      const t0 = performance.now();
      try {
        const fn = new Function('$', '"use strict";\n' + m.code);
        const r = fn(api);
        if (runner.dirty) { hfBuild(); refreshAll(); autosave(); }
        const ms = (performance.now() - t0).toFixed(1);
        if (!silent) toast('宏已运行（' + ms + 'ms）');
        consoleLines.push('✓ ' + name + ' 完成（' + ms + 'ms）');
        if (panelVisible() && currentEditName === name) printConsole();
        return r;
      } catch (e) {
        consoleLines.push('✗ 错误: ' + (e && e.message ? e.message : e));
        if (panelVisible() && currentEditName === name) printConsole(); else toast('宏出错: ' + (e.message || e));
        console.warn('[macros] 运行失败:', name, e);
        return undefined;
      }
    }

    /* ---------------- 面板 UI（自建 DOM，不依赖 index.html 弹窗） ---------------- */
    let currentEditName = null;
    function ensurePanel(){
      if (document.getElementById('macroPanel')) return $('macroPanel');
      const css = document.createElement('style');
      css.textContent = [
        '#macroPanel{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:9999;display:none;align-items:center;justify-content:center;font-size:13px}',
        '#macroPanel.open{display:flex}',
        '#macroPanel .mp-box{width:860px;max-width:94vw;height:600px;max-height:88vh;background:#fff;border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden}',
        '#macroPanel .mp-head{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#217346;color:#fff;font-weight:600}',
        '#macroPanel .mp-head .x{margin-left:auto;cursor:pointer;font-size:18px;padding:0 6px}',
        '#macroPanel .mp-body{flex:1;display:flex;min-height:0}',
        '#macroPanel .mp-list{width:230px;border-right:1px solid #e3e3e3;overflow:auto;padding:6px}',
        '#macroPanel .mp-item{padding:7px 9px;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px}',
        '#macroPanel .mp-item:hover{background:#f0f7f2}',
        '#macroPanel .mp-item.on{background:#d5ecdf;font-weight:600}',
        '#macroPanel .mp-item .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '#macroPanel .badge{font-size:10px;padding:1px 5px;border-radius:8px;background:#217346;color:#fff;font-weight:400}',
        '#macroPanel .badge.hk{background:#e67e22}',
        '#macroPanel .mp-edit{flex:1;display:flex;flex-direction:column;min-width:0;padding:10px 12px;gap:6px}',
        '#macroPanel .mp-edit input[type=text]{border:1px solid #ccc;border-radius:4px;padding:5px 8px;font-size:13px}',
        '#macroPanel textarea{flex:1;border:1px solid #ccc;border-radius:4px;padding:8px;font:12px/1.5 Consolas,monospace;resize:none;tab-size:2}',
        '#macroPanel .mp-out{height:110px;border:1px solid #eee;border-radius:4px;background:#fafafa;overflow:auto;padding:6px 8px;font:11px/1.5 Consolas,monospace;white-space:pre-wrap;color:#444}',
        '#macroPanel .mp-foot{display:flex;gap:8px;align-items:center;padding:8px 12px;border-top:1px solid #eee}',
        '#macroPanel button{border:1px solid #217346;background:#217346;color:#fff;border-radius:4px;padding:5px 14px;cursor:pointer;font-size:12px}',
        '#macroPanel button.ghost{background:#fff;color:#217346}',
        '#macroPanel button.danger{background:#fff;color:#c0392b;border-color:#c0392b}',
        '#macroPanel label.chk{display:flex;align-items:center;gap:4px;font-size:12px;color:#555}'
      ].join('\n');
      document.head.appendChild(css);

      const box = document.createElement('div');
      box.id = 'macroPanel';
      box.innerHTML =
        '<div class="mp-box">' +
          '<div class="mp-head">⚙ 宏管理器<button class="x" data-mp-close>×</button></div>' +
          '<div class="mp-body">' +
            '<div class="mp-list" id="mpList"></div>' +
            '<div class="mp-edit">' +
              '<input type="text" id="mpName" placeholder="宏名称" maxlength="40">' +
              '<textarea id="mpCode" spellcheck="false" placeholder="// JavaScript 宏代码，$ 为 API。示例：\n// $.set("A1", "Hello 宏")"></textarea>' +
              '<div class="mp-out" id="mpOut">就绪。宏 API：$.set/$.get/$.getRange/$.setRange/$.fill/$.clear/$.forEach/$.setStyle/$.sel/$.sheets/$.activate/$.addSheet/$.run/$.log/$.toast</div>' +
            '</div>' +
          '</div>' +
          '<div class="mp-foot">' +
            '<button id="mpNew">新建</button>' +
            '<button id="mpRun">▶ 运行</button>' +
            '<button id="mpSave">保存</button>' +
            '<button id="mpDel" class="danger">删除</button>' +
            '<button id="mpExport" class="ghost">导出</button>' +
            '<button id="mpImport" class="ghost">导入</button>' +
            '<label class="chk"><input type="checkbox" id="mpAuto">启动时自动运行</label>' +
            '<label class="chk">快捷键 Ctrl+Alt+<input type="text" id="mpHot" maxlength="2" style="width:34px;border:1px solid #ccc;border-radius:4px;padding:3px 4px;font-size:12px"></label>' +
            '<input type="file" id="mpFile" accept=".json" style="display:none">' +
          '</div>' +
        '</div>';
      document.body.appendChild(box);
      box.addEventListener('mousedown', e => { if (e.target === box) closePanel(); });
      box.querySelector('[data-mp-close]').onclick = closePanel;
      $('mpNew').onclick = () => newMacro();
      $('mpRun').onclick = () => { saveCurrent(); runMacro(currentEditName); };
      $('mpSave').onclick = () => { saveCurrent(); toast('宏已保存'); };
      $('mpDel').onclick = async () => {
        if (!currentEditName) return;
        if (await MX.ui.confirm('删除宏 "' + currentEditName + '"？','删除宏')) {
          MACROS = MACROS.filter(m => m.name !== currentEditName);
          saveMacros(); renderList(); editMacro(MACROS[0] && MACROS[0].name);
        }
      };
      $('mpExport').onclick = () => {
        const blob = new Blob([JSON.stringify(MACROS, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'myexcel-macros.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      };
      $('mpImport').onclick = () => $('mpFile').click();
      $('mpFile').onchange = e => {
        const f = e.target.files[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = () => {
          try {
            const arr = JSON.parse(rd.result);
            if (!Array.isArray(arr)) throw new Error('格式错误');
            let n = 0;
            for (const m of arr) {
              if (!m || !m.name || typeof m.code !== 'string') continue;
              let nm = m.name;
              while (MACROS.some(x => x.name === nm)) nm = nm + '_导入';
              MACROS.push({ id: uid(), name: nm, code: m.code, autorun: !!m.autorun, hotkey: String(m.hotkey || '').slice(0, 2) });
              n++;
            }
            saveMacros(); renderList();
            toast('已导入 ' + n + ' 个宏');
          } catch (err) { toast('导入失败: ' + err.message); }
        };
        rd.readAsText(f, 'utf-8');
        e.target.value = '';
      };
      $('mpAuto').onchange = () => saveCurrent();
      $('mpHot').onchange = () => saveCurrent();
      $('mpName').onchange = () => saveCurrent(true);
      return box;
    }
    function panelVisible(){ const p = document.getElementById('macroPanel'); return !!(p && p.classList.contains('open')); }
    function openPanel(){
      ensurePanel();
      $('macroPanel').classList.add('open');
      renderList();
      editMacro(currentEditName || (MACROS[0] && MACROS[0].name));
    }
    function closePanel(){ const p = document.getElementById('macroPanel'); if (p) p.classList.remove('open'); }
    function renderList(){
      const el = $('mpList');
      if (!el) return;
      el.innerHTML = MACROS.length ? '' : '<div style="color:#999;padding:10px">暂无宏，点击"新建"</div>';
      for (const m of MACROS) {
        const d = document.createElement('div');
        d.className = 'mp-item' + (m.name === currentEditName ? ' on' : '');
        d.innerHTML = '<span class="nm"></span>' +
          (m.autorun ? '<span class="badge">自</span>' : '') +
          (m.hotkey ? '<span class="badge hk">Ctrl+Alt+' + esc(m.hotkey) + '</span>' : '');
        d.querySelector('.nm').textContent = m.name;
        d.onclick = () => { saveCurrent(); editMacro(m.name); };
        d.ondblclick = () => runMacro(m.name);
        el.appendChild(d);
      }
    }
    function editMacro(name){
      currentEditName = name;
      const m = MACROS.find(x => x.name === name);
      $('mpName').value = m ? m.name : '';
      $('mpCode').value = m ? m.code : '';
      $('mpAuto').checked = !!(m && m.autorun);
      $('mpHot').value = m ? (m.hotkey || '') : '';
      $('mpOut').textContent = '';
      renderList();
    }
    function saveCurrent(rename){
      if (!currentEditName) return;
      const m = MACROS.find(x => x.name === currentEditName);
      if (!m) return;
      const nm = $('mpName').value.trim();
      if (rename && nm && nm !== m.name && !MACROS.some(x => x.name === nm)) {
        m.name = nm; currentEditName = nm;
      }
      m.code = $('mpCode').value;
      m.autorun = $('mpAuto').checked;
      m.hotkey = $('mpHot').value.trim().slice(0, 2);
      saveMacros(); renderList();
    }
    function newMacro(){
      let nm = '宏' + (MACROS.length + 1);
      while (MACROS.some(x => x.name === nm)) nm += '_';
      MACROS.push({ id: uid(), name: nm, code: '// ' + nm + '\n$.toast("Hello from ' + nm + '");', autorun: false, hotkey: '' });
      saveMacros(); editMacro(nm);
    }
    function printConsole(){
      const el = $('mpOut');
      if (el) el.textContent = consoleLines.join('\n') || '（无输出）';
    }

    /* ---------------- 入口：菜单/快捷键/自动运行 ---------------- */
    window.openMacroPanel = openPanel;
    window.runMacroByName = runMacro;
    MX.plug.addRibbon({ group: 'auto', label: '宏', icon: '⚙', fn: openPanel });
    MX.plug.addContextMenu({ label: '宏管理器…', fn: openPanel });

    /* Ctrl+Alt+M 打开面板；宏各自绑 Ctrl+Alt+<hotkey> */
    document.addEventListener('keydown', e => {
      if (!e.ctrlKey || !e.altKey) return;
      const k = (e.key || '').toLowerCase();
      if (k === 'm') { e.preventDefault(); panelVisible() ? closePanel() : openPanel(); return; }
      for (const m of MACROS) {
        if (m.hotkey && m.hotkey.toLowerCase() === k) { e.preventDefault(); runMacro(m.name); return; }
      }
    });

    /* autorun 宏：全部插件就绪后执行 */
    MX.plug.on('booted', () => {
      const autos = MACROS.filter(m => m.autorun);
      if (!autos.length) return;
      setTimeout(() => {
        let ok = 0;
        for (const m of autos) { runMacro(m.name, true); ok++; }
        toast('已自动运行 ' + ok + ' 个宏');
      }, 300);
    });

    /* 编程接口 */
    MX.macro = {
      list: () => MACROS.map(m => ({ name: m.name, autorun: !!m.autorun, hotkey: m.hotkey || '' })),
      run: runMacro,
      create(name, code, opts){
        if (MACROS.some(x => x.name === name)) return false;
        MACROS.push(Object.assign({ id: uid(), name: String(name), code: String(code), autorun: false, hotkey: '' }, opts || {}));
        saveMacros(); renderList();
        return true;
      },
      remove(name){
        const n = MACROS.length;
        MACROS = MACROS.filter(m => m.name !== name);
        saveMacros();
        return MACROS.length < n;
      }
    };

    console.log('[macros] 宏系统就绪:', MACROS.length, '个宏');
  }
});
})();
