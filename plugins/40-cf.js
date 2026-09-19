/*
 * 40-cf.js — 条件格式引擎
 *
 * 规则：
 *   { range:'A1:B10', type:'cellValue'|'text'|'duplicate'|'top'|'formula'|'above'|'below',
 *     op:'>'|'>='|'<'|'<='|'=='|'!='|'between'|'contains'|'startsWith',
 *     value:..., value2:..., bg, fg, bold, colorScale|dataBar|iconSet }
 *
 *   type: cellValue    — 比较单元格数值
 *         text         — 文本 contains / startsWith / endsWith
 *         duplicate    — 高亮重复值
 *         top          — 前 N 个/后 N 个/前 N%
 *         aboveAverage — 高于均值
 *         belowAverage — 低于均值
 *         colorScale   — 三色刻度
 *         dataBar      — 数据条
 *         iconSet      — 图标集
 *         formula      — 自定义公式
 */
MX.plug.register({
  name: 'cf',
  version: '1.0.0',
  init(){
    const COLOR_SCALES = {
      redyellowgreen: ['#f8696b','#ffeb84','#63be7b'],
      redgreen: ['#f8696b','#ffffff','#63be7b'],
      yellowred: ['#ffff00','#fc8d59','#b30000'],
      greenyellow: ['#57bb8a','#ffffbf','#f1b6da']
    };
    const ICON_SETS = ['arrows','dots','flags','trafficlights'];

    function parseRange(s){
      /* 'A1:B10' -> [[r0,c0,r1,c1]] */
      const parts = s.split(':');
      if(parts.length===1){
        const a = parseRef(parts[0]); return [[a.r,a.c,a.r,a.c]];
      }
      const a = parseRef(parts[0]), b = parseRef(parts[1]);
      return [[ Math.min(a.r,b.r), Math.min(a.c,b.c), Math.max(a.r,b.r), Math.max(a.c,b.c) ]];
    }

    function expandRules(rules){
      const out=[];
      for(const rule of rules){
        for(const r of parseRange(rule.range||rule.ref||'')){
          out.push({ ...rule, r0:r[0],c0:r[1],r1:r[2],c1:r[3] });
        }
      }
      return out;
    }

    function evalRule(rule, r, c, cell, cellValue, allValues){
      const v = cellValue;
      switch(rule.type){
        case 'cellValue': {
          const num = parseFloat(v);
          const t = parseFloat(rule.value);
          if(isNaN(num)||isNaN(t)) return false;
          if(rule.op==='between') return num>=t && num<=parseFloat(rule.value2);
          return ({'>':(a,b)=>a>b,'>=':(a,b)=>a>=b,'<':(a,b)=>a<b,'<=':(a,b)=>a<=b,'==':(a,b)=>a===b,'!=':(a,b)=>a!==b}[rule.op])(num,t);
        }
        case 'text': {
          const s = String(v||'');
          const t = String(rule.value||'');
          if(rule.op==='contains') return s.includes(t);
          if(rule.op==='startsWith') return s.startsWith(t);
          if(rule.op==='endsWith') return s.endsWith(t);
          if(rule.op==='==') return s===t;
          return false;
        }
        case 'duplicate': {
          const vals = allValues.filter(x=>String(x)===String(v));
          return vals.length>1;
        }
        case 'top': {
          const sorted = [...new Set(allValues.filter(x=>!isNaN(parseFloat(x))))].sort((a,b)=>parseFloat(b)-parseFloat(a));
          const n = rule.topN || 10;
          return sorted.slice(0,n).includes(v);
        }
        case 'aboveAverage': return parseFloat(v) > allValues.reduce((a,b)=>a+(parseFloat(b)||0),0)/allValues.filter(x=>!isNaN(parseFloat(x))).length;
        case 'belowAverage': return parseFloat(v) < allValues.reduce((a,b)=>a+(parseFloat(b)||0),0)/allValues.filter(x=>!isNaN(parseFloat(x))).length;
        case 'formula': {
          try{
            /* 公式以单元格上下文 R[-n]C[-n] 形式评估 */
            const formula = rule.value || '';
            return !!HF_INSTANCE.simpleEval && HF.simpleEval(formula, { sheet:WB.active, row:r, col:c });
          }catch(e){ return false; }
        }
        default: return false;
      }
    }

    function applyRules(){
      const s = WB.sheets[WB.active];
      const rules = (s.cfRules||[]).flatMap(expandRules);
      /* 清除之前条件格式的样式(用 s._cf 标记) */
      for(const k in s.cells){
        if(s.cells[k]._cf){ delete s.cells[k]._cf; }
      }
      /* 重新评估 */
      for(const rule of rules){
        const vals=[];
        for(let r=rule.r0;r<=rule.r1;r++) for(let c=rule.c0;c<=rule.c1;c++) vals.push(cellVal(r,c));
        for(let r=rule.r0;r<=rule.r1;r++) for(let c=rule.c0;c<=rule.c1;c++){
          const cell = getCell(r,c); if(!cell) continue;
          const v = cellVal(r,c);
          if(evalRule(rule,r,c,cell,v,vals)){
            cell.s = cell.s || {};
            if(rule.bg) cell.s.bg = rule.bg;
            if(rule.fg) cell.s.fg = rule.fg;
            if(rule.bold!=null) cell.s.b = rule.bold;
            cell._cf = true;
          }
        }
      }
      /* 颜色刻度 */
      for(const rule of rules.filter(r=>r.type==='colorScale')){
        const scale = COLOR_SCALES[rule.scale] || COLOR_SCALES.redyellowgreen;
        const vals=[];
        for(let r=rule.r0;r<=rule.r1;r++) for(let c=rule.c0;c<=rule.c1;c++){ const v=parseFloat(cellVal(r,c)); if(!isNaN(v)) vals.push({r,c,v}); }
        if(vals.length<2) continue;
        const min = Math.min(...vals.map(x=>x.v)), max = Math.max(...vals.map(x=>x.v));
        for(const x of vals){
          const cell = getCell(x.r,x.c); if(!cell) continue;
          cell.s = cell.s || {};
          const t = (x.v-min)/(max-min||1);
          const color = t<0.5 ? mix(scale[0],scale[1],t*2) : mix(scale[1],scale[2],(t-0.5)*2);
          cell.s.bg = color;
          cell._cf = true;
        }
      }
      /* 数据条 */
      for(const rule of rules.filter(r=>r.type==='dataBar')){
        const color = rule.barColor || '#638ec6';
        const vals=[];
        for(let r=rule.r0;r<=rule.r1;r++) for(let c=rule.c0;c<=rule.c1;c++){ const v=parseFloat(cellVal(r,c)); if(!isNaN(v)) vals.push({r,c,v}); }
        if(vals.length<2) continue;
        const min = Math.min(...vals.map(x=>x.v)), max = Math.max(...vals.map(x=>x.v));
        for(const x of vals){
          const cell = getCell(x.r,x.c); if(!cell) continue;
          cell.s = cell.s || {};
          const t = (x.v-min)/(max-min||1);
          cell._cfBar = { pct:t, color };
          cell._cf = true;
        }
      }
    }

    function mix(a,b,t){
      const A = a.match(/\w\w/g).map(x=>parseInt(x,16));
      const B = b.match(/\w\w/g).map(x=>parseInt(x,16));
      return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');
    }

    /* 渲染钩子：颜色刻度 / 数据条 / 图标集 */
    MX.plug.on('cellRender',(td, r, c)=>{
      const cell = getCell(r,c);
      if(!cell) return;
      if(cell._cfBar){
        const {pct, color} = cell._cfBar;
        td.style.background = `linear-gradient(to right, ${color}55 ${pct*100}%, transparent ${pct*100}%)`;
      }
      if(cell._cfIcon){
        td.innerHTML = cell._cfIcon + '<span style="font-size:11px;color:#666">'+td.textContent+'</span>';
      }
    });

    /* UI */
    window.openConditionalFormat = function(){
      openModal('modalCF');
      const s = WB.sheets[WB.active];
      renderCFRules(s.cfRules||[]);
      $('cfNew').onclick = ()=>{
        const r = $('cfRange').value.trim();
        const type = $('cfType').value;
        const op = $('cfOp').value;
        const value = $('cfValue').value;
        const value2 = $('cfValue2').value;
        const bg = $('cfBg').value;
        const fg = $('cfFg').value;
        if(!r){ toast('请填写范围'); return; }
        s.cfRules = s.cfRules || [];
        s.cfRules.push({ range:r, type, op, value, value2, bg, fg });
        applyRules(); refreshAll();
        renderCFRules(s.cfRules);
      };
      $('cfClear').onclick = ()=>{
        WB.sheets[WB.active].cfRules = [];
        applyRules(); refreshAll();
        renderCFRules([]);
      };
    };

    function renderCFRules(rules){
      $('cfList').innerHTML = rules.length ? rules.map((r,i)=>`<div class="cf-item"><span>${i+1}. ${r.type} ${r.range} ${r.value||''}</span><button data-i="${i}" class="btn ghost">×</button></div>`).join('') : '<i>暂无规则</i>';
      $('cfList').querySelectorAll('button').forEach(b=>{
        b.onclick = ()=>{ WB.sheets[WB.active].cfRules.splice(+b.dataset.i,1); applyRules(); refreshAll(); renderCFRules(WB.sheets[WB.active].cfRules); };
      });
    }

    MX.plug.on('cellChange', applyRules);
    MX.plug.on('sheetActive', applyRules);
    MX.plug.addRibbon({ group:'format', label:'条件格式', icon:'🎨', fn: openConditionalFormat });
    MX.plug.addContextMenu({ label:'条件格式…', fn: openConditionalFormat });

    console.log('[cf] Conditional formatting registered');
  }
});