/*
 * 98-history.js — 版本历史 + 差异比较
 *
 * 自动保存最近 20 个快照 (autosave 时):
 *   - 命名快照 (Ctrl+Shift+S)
 *   - 恢复到任意快照
 *   - 与当前对比并显示差异
 *
 * 使用 diff-match-patch 做差异比较，diff2html 可视化。
 */
MX.plug.register({
  name: 'history',
  version: '1.0.0',
  init(){
    if(!window.diff_match_patch){ console.warn('diff-match-patch not loaded'); return; }
    const dmp = new diff_match_patch();

    function snapshot(){
      try{
        return JSON.stringify({ wb: WB, ts: Date.now() });
      }catch(e){ return null; }
    }
    function restore(snap){
      try{
        const obj = JSON.parse(snap);
        Object.assign(WB, obj.wb);
        hfBuild(); refreshAll(); renderTabs();
      }catch(e){ toast('恢复失败：'+e.message); }
    }

    const MAX = 20;
    function pushHist(){
      const list = loadList();
      list.unshift({ ts: Date.now(), snap: snapshot() });
      list.length = MAX;
      try{ localStorage.setItem('myexcel.hist.'+WB.name, JSON.stringify(list)); }catch(e){}
    }
    function loadList(){
      try{ return JSON.parse(localStorage.getItem('myexcel.hist.'+WB.name)||'[]'); }
      catch(e){ return []; }
    }

    /* 每次自动保存时记录 */
    let lastHistTs = 0;
    const origAutosave = window.autosave;
    window.autosave = function(){
      origAutosave();
      if(Date.now()-lastHistTs > 30000){ /* 30 秒最多记录一次 */
        pushHist();
        lastHistTs = Date.now();
      }
    };

    window.openHistory = function(){
      openModal('modalHistory');
      const list = loadList();
      $('histList').innerHTML = list.length ? list.map((h,i)=>{
        const date = dayjs(h.ts).format('YYYY-MM-DD HH:mm:ss');
        return `<div data-i="${i}" style="padding:6px;border-bottom:1px solid #eee;cursor:pointer">📌 ${date} <button data-restore="${i}" class="btn">恢复</button> <button data-diff="${i}" class="btn ghost">比较</button></div>`;
      }).join('') : '<i>暂无历史</i>';
      $('histList').querySelectorAll('[data-restore]').forEach(b=>{
        b.onclick = e=>{ e.stopPropagation(); const i=+b.dataset.restore; if(confirm('恢复到此版本？当前未保存的更改会丢失')){ restore(loadList()[i].snap); closeModal('modalHistory'); }};
      });
      $('histList').querySelectorAll('[data-diff]').forEach(b=>{
        b.onclick = e=>{ e.stopPropagation(); const i=+b.dataset.diff; showDiff(loadList()[i].snap); };
      });
    };

    function showDiff(oldSnap){
      const oldObj = JSON.parse(oldSnap);
      const oldCSV = flattenCSV(oldObj.wb);
      const newCSV = flattenCSV(WB);
      const d = dmp.diff_main(oldCSV, newCSV);
      dmp.diff_cleanupSemantic(d);
      const html = d.map(([op,text])=>{
        if(op===0) return `<span>${esc(text)}</span>`;
        if(op===-1) return `<ins style="background:#c8e6c9;text-decoration:none">${esc(text)}</ins>`;
        if(op===1) return `<del style="background:#ffcdd2;text-decoration:none">${esc(text)}</del>`;
        return '';
      }).join('');
      $('histDiff').innerHTML = html;
    }

    function flattenCSV(wb){
      return wb.sheets.map(s=>{
        let out = '';
        for(let r=0;r<s.nr;r++) for(let c=0;c<s.nc;c++){
          const cell = s.cells[key(r,c)];
          if(cell) out += `${refStr(r,c)}=${cell.v||''}\n`;
        }
        return out;
      }).join('\n');
    }

    /* Ctrl+Shift+S：命名快照 */
    document.addEventListener('keydown', e=>{
      if(e.ctrlKey && e.shiftKey && e.key==='S'){
        e.preventDefault();
        const name = prompt('为当前快照命名：', dayjs().format('YYYY-MM-DD HH:mm'));
        if(name){
          const list = loadList();
          list.unshift({ ts: Date.now(), snap: snapshot(), name });
          list.length = MAX;
          localStorage.setItem('myexcel.hist.'+WB.name, JSON.stringify(list));
          toast('已保存命名快照');
        }
      }
    });

    MX.plug.addRibbon({ group:'review', label:'历史版本', icon:'🕐', fn: openHistory });

    console.log('[history] Version history registered');
  }
});