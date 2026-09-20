/*
 * 50-validation.js — 数据验证
 *
 *   { type:'list',  range:'A1:A10', allowed:['是','否'] }
 *   { type:'number', range:'B1:B100', min:0, max:100 }
 *   { type:'date',   range:'C1:C10', min:'2024-01-01' }
 *   { type:'text',   range:'D1:D100', minLen:1, maxLen:50 }
 *   { type:'custom', range:'E1:E10',  formula:'=LEN(E1)>0' }
 */
MX.plug.register({
  name: 'validation',
  version: '1.0.0',
  init(){
    function parseRange(s){
      const a = parseRef(s.split(':')[0]), b = parseRef(s.split(':')[1]||s.split(':')[0]);
      return [[ Math.min(a.r,b.r), Math.min(a.c,b.c), Math.max(a.r,b.r), Math.max(a.c,b.c) ]];
    }
    function expand(r){ return parseRange(r.range).map(x=>({ ...r, r0:x[0],c0:x[1],r1:x[2],c1:x[3] })); }

    function validateInput(r,c,raw){
      const s = WB.sheets[WB.active];
      const rules = (s.validations||[]).flatMap(expand);
      for(const rule of rules){
        if(r<rule.r0||r>rule.r1||c<rule.c0||c>rule.c1) continue;
        const err = checkRule(rule, raw);
        if(err) return err;
      }
      return null;
    }

    function checkRule(rule, v){
      const raw = String(v);
      switch(rule.type){
        case 'list': {
          const list = rule.list || rule.allowed || [];
          if(!list.includes(raw)) return '请从下拉列表中选择：'+list.slice(0,3).join('/')+'…';
          return null;
        }
        case 'number': {
          const n = parseFloat(raw);
          if(isNaN(n)) return '请输入数字';
          if(rule.min!=null && n<rule.min) return '不能小于 '+rule.min;
          if(rule.max!=null && n>rule.max) return '不能大于 '+rule.max;
          return null;
        }
        case 'date': {
          const d = dayjs(raw);
          if(!d.isValid()) return '请输入有效日期';
          if(rule.min && d.isBefore(dayjs(rule.min))) return '不能早于 '+rule.min;
          if(rule.max && d.isAfter(dayjs(rule.max))) return '不能晚于 '+rule.max;
          return null;
        }
        case 'text': {
          if(rule.minLen!=null && raw.length<rule.minLen) return '至少 '+rule.minLen+' 个字符';
          if(rule.maxLen!=null && raw.length>rule.maxLen) return '最多 '+rule.maxLen+' 个字符';
          if(rule.regex && !new RegExp(rule.regex).test(raw)) return '格式不正确';
          return null;
        }
        case 'custom': {
          try{
            const ok = HF.simpleEval(rule.formula.replace(/^=/,''), { sheet:WB.active, row:r, col:c });
            return ok ? null : (rule.msg||'不符合规则');
          }catch(e){ return null; }
        }
      }
      return null;
    }

    /* 单元格渲染：列表类型加下拉箭头 */
    MX.plug.on('cellRender',(td,r,c)=>{
      const rules = (WB.sheets[WB.active].validations||[]).flatMap(expand);
      const rule = rules.find(rule=>r>=rule.r0&&r<=rule.r1&&c>=rule.c0&&c<=rule.c1);
      if(rule && rule.type==='list' && !editing){
        td.style.background = td.style.background||'';
        td.style.backgroundImage = 'linear-gradient(45deg, transparent 90%, #666 90%)';
        td.style.backgroundPosition = 'right 4px center';
        td.style.backgroundRepeat = 'no-repeat';
        td.style.backgroundSize = '8px 8px';
        td.style.paddingRight = '14px';
      }
    });

    /* 单元格点击：弹出列表选项 */
    const origStartEdit = window.startEdit;
    window.startEdit = function(initial){
      const r=cur.r,c=cur.c;
      /* 取当前单元格的真实 DOM 作为下拉列表锚点（旧代码误用 $('ed')=null，双击即抛错，
         既弹不出下拉，还会连带破坏正常编辑） */
      const td = tdMap[key(r,c)];
      const rules = (WB.sheets[WB.active].validations||[]).flatMap(expand);
      const rule = rules.find(rule=>r>=rule.r0&&r<=rule.r1&&c>=rule.c0&&c<=rule.c1);
      if(td && rule && rule.type==='list' && (rule.list||rule.allowed)){
        const items = rule.list || rule.allowed;
        const html = items.map(it=>`<div class="dv-opt" style="padding:6px 12px;cursor:pointer">${esc(it)}</div>`).join('');
        showFloatingMenu(td, html, (el)=>{
          el.style.position='absolute'; el.style.background='#fff'; el.style.border='1px solid #aaa'; el.style.boxShadow='0 2px 8px rgba(0,0,0,.15)'; el.style.zIndex='1000'; el.style.maxHeight='180px'; el.style.overflowY='auto';
          el.querySelectorAll('.dv-opt').forEach(o=>{
            o.onmouseover = ()=>o.style.background='#e3f2fd';
            o.onmouseout = ()=>o.style.background='#fff';
            o.onclick = ()=>{ $('formulaInput').value=o.textContent; commitEdit(); el.remove(); };
          });
          document.addEventListener('mousedown',function dismiss(ev){ if(!el.contains(ev.target)){ el.remove(); document.removeEventListener('mousedown',dismiss); } });
        });
        return;
      }
      origStartEdit(initial);
    };

    function showFloatingMenu(anchor, html, postProcess){
      const old = document.getElementById('dvMenu'); if(old) old.remove();
      const div = document.createElement('div'); div.id='dvMenu'; div.innerHTML = html;
      const rect = anchor.getBoundingClientRect();
      div.style.left = (rect.left + window.scrollX) + 'px';
      div.style.top = (rect.bottom + window.scrollY + 2) + 'px';
      div.style.minWidth = Math.max(120, rect.width) + 'px';
      document.body.appendChild(div);
      if(postProcess) postProcess(div);
    }

    window.openDataValidation = function(){
      openModal('modalDV');
      $('dvNew').onclick = ()=>{
        const range = $('dvRange').value.trim();
        const type = $('dvType').value;
        const listText = $('dvList').value;
        const min = $('dvMin').value;
        const max = $('dvMax').value;
        const formula = $('dvFormula').value;
        if(!range){ toast('请填写范围'); return; }
        const s = WB.sheets[WB.active];
        s.validations = s.validations || [];
        const v = { type, range };
        if(type==='list') v.list = listText.split('\n').map(s=>s.trim()).filter(Boolean);
        else if(type==='number'||type==='date'){ if(min)v.min=min; if(max)v.max=max; }
        else if(type==='custom') v.formula = formula;
        s.validations.push(v);
        refreshAll();
        renderDVList();
      };
      $('dvClear').onclick = ()=>{ WB.sheets[WB.active].validations=[]; refreshAll(); renderDVList(); };
      renderDVList();
    };
    function renderDVList(){
      const list = WB.sheets[WB.active].validations || [];
      $('dvList').innerHTML = list.length ? list.map((r,i)=>`<div>${i+1}. ${r.type} ${r.range} ${(r.list||[]).join('|')||r.min||''}~${r.max||''}</div>`).join('') : '<i>暂无规则</i>';
    }

    /* 监听提交前的验证 */
    const origCommit = window.commitEdit;
    window.commitEdit = function(move){
      const raw = $('formulaInput').value;
      const err = validateInput(cur.r, cur.c, raw);
      if(err){ toast(err); return; }
      origCommit(move);
    };

    MX.plug.addRibbon({ group:'data', label:'数据验证', icon:'✓', fn: openDataValidation });
    MX.plug.addContextMenu({ label:'数据验证…', fn: openDataValidation });

    console.log('[validation] Data validation registered');
  }
});