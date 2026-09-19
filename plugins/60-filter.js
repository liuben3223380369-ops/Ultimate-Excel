/*
 * 60-filter.js — 自动筛选
 *
 * 在工作簿的「活动 Sheet 的冻结表头」上提供下拉筛选。
 * 用户在 Sheet 模型里设置 {filter:{range:'A1:F1', row:0}}
 */
MX.plug.register({
  name: 'filter',
  version: '1.0.0',
  init(){
    function buildFilterMenu(range){
      const a = parseRef(range.split(':')[0]), b = parseRef(range.split(':')[1]||range.split(':')[0]);
      const c0 = a.c, c1 = b.c, r0 = a.r, r1 = b.r;
      const cols = [];
      for(let c=c0;c<=c1;c++){
        const vals = new Set();
        for(let r=r0+1;r<=r1;r++) vals.add(String(cellVal(r,c)));
        cols.push({ c, vals: [...vals].sort() });
      }
      return cols;
    }

    function applyFilter(filter){
      const s = WB.sheets[WB.active];
      s._filter = filter;
      refreshAll();
    }

    MX.plug.on('cellRender',(td, r, c)=>{
      const f = WB.sheets[WB.active]._filter;
      if(!f) return;
      const a = parseRef(f.range.split(':')[0]), b = parseRef(f.range.split(':')[1]||f.range.split(':')[0]);
      if(r===a.r && c>=a.c && c<=b.c){
        if(!td._filterAttached){
          td._filterAttached = true;
          td.style.cursor='pointer';
          td.title='点击筛选';
          td.addEventListener('click',(e)=>{
            if(!e.shiftKey) return;
            e.stopPropagation();
            const cols = buildFilterMenu(f.range);
            showFilterMenu(td, cols, f);
          }, true);
        }
        /* 视觉提示 */
        if(!td.style.background || td.style.background.indexOf('linear-gradient')<0){
          td.style.backgroundImage = 'linear-gradient(to top right, transparent 60%, #1976d2 60%, #1976d2 70%, transparent 70%)';
          td.style.backgroundSize = '14px 14px';
          td.style.backgroundRepeat = 'no-repeat';
          td.style.backgroundPosition = 'right top';
        }
      }
    });

    function showFilterMenu(anchor, cols, currentFilter){
      const old = document.getElementById('filterMenu'); if(old) old.remove();
      const div = document.createElement('div'); div.id='filterMenu';
      div.style.cssText = 'position:absolute;background:#fff;border:1px solid #aaa;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:1000;max-height:480px;overflow-y:auto;padding:6px 0;font-size:12px';
      cols.forEach(col=>{
        const colDiv = document.createElement('div');
        colDiv.innerHTML = `<div style="padding:4px 12px;background:#f3f3f3;font-weight:600">列 ${refStr(0,col.c)} <span style="float:right;color:#888">${col.vals.length} 项</span></div>`;
        colDiv.innerHTML += '<div style="padding:2px 12px"><label><input type="checkbox" data-c="'+col.c+'" data-v="__all__" checked> 全选</label></div>';
        col.vals.forEach(v=>{
          const lab = document.createElement('label'); lab.style.cssText='display:block;padding:2px 24px;cursor:pointer';
          lab.innerHTML = `<input type="checkbox" data-c="${col.c}" data-v="${esc(v)}" checked> ${esc(v||'(空)')}`;
          lab.onmouseover = ()=>lab.style.background='#e3f2fd';
          lab.onmouseout = ()=>lab.style.background='';
          colDiv.appendChild(lab);
        });
        div.appendChild(colDiv);
      });
      div.innerHTML += '<div style="border-top:1px solid #eee;padding:6px;text-align:right"><button class="btn" id="filterApply">应用</button><button class="btn ghost" id="filterClear">清除</button></div>';
      const rect = anchor.getBoundingClientRect();
      div.style.left = (rect.left + window.scrollX) + 'px';
      div.style.top = (rect.bottom + window.scrollY + 2) + 'px';
      div.style.minWidth = '180px';
      document.body.appendChild(div);
      document.getElementById('filterApply').onclick = ()=>{
        const checks = div.querySelectorAll('input[type=checkbox]');
        const allow = {};
        for(const ck of checks){
          if(ck.dataset.v==='__all__') continue;
          allow[ck.dataset.c] = allow[ck.dataset.c] || {};
          if(!ck.checked) allow[ck.dataset.c][ck.dataset.v] = true;
        }
        applyFilter({ ...currentFilter, allow });
        div.remove();
      };
      document.getElementById('filterClear').onclick = ()=>{ delete WB.sheets[WB.active]._filter; refreshAll(); div.remove(); };
      document.addEventListener('mousedown',function dismiss(ev){ if(!div.contains(ev.target) && ev.target!==anchor){ div.remove(); document.removeEventListener('mousedown',dismiss); } });
    }

    /* 钩入 cellVal: 若有过滤,值不在白名单内的行返回空(且行隐藏) */
    const origCellVal = window.cellVal;
    window.cellVal = function(r,c,sheetIdx){
      const v = origCellVal(r,c,sheetIdx);
      const f = WB.sheets[sheetIdx||WB.active]._filter;
      if(!f || !f.allow) return v;
      for(const [colKey, blocked] of Object.entries(f.allow)){
        const colIdx = parseInt(colKey);
        const cellV = String(origCellVal(r, colIdx, sheetIdx));
        if(blocked[cellV] !== undefined){
          return ''; /* 该行被筛掉,返回空以隐藏 */
        }
      }
      return v;
    };

    /* UI 入口 */
    window.openAutoFilter = function(){
      const s = WB.sheets[WB.active];
      const r = prompt('筛选范围 (如 A1:F100):', s._filter ? s._filter.range : 'A1:F100');
      if(!r) return;
      const a = parseRef(r.split(':')[0]), b = parseRef(r.split(':')[1]||r.split(':')[0]);
      applyFilter({ range:r });
      toast('已启用自动筛选，Shift+点击表头筛选');
    };

    MX.plug.addRibbon({ group:'data', label:'自动筛选', icon:'🔻', fn: openAutoFilter });
    MX.plug.addContextMenu({ label:'自动筛选', fn: openAutoFilter });

    console.log('[filter] Auto-filter registered');
  }
});