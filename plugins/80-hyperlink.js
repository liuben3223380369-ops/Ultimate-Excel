/*
 * 80-hyperlink.js — 单元格超链接
 *
 *   cell.link = { type:'web'|'email'|'sheet'|'cell', url:'...', display:'...' }
 *
 * UI：超链接文字蓝色下划线，Ctrl+点击跳转
 */
MX.plug.register({
  name: 'hyperlink',
  version: '1.0.0',
  init(){
    /* 渲染：蓝色下划线 */
    MX.plug.on('cellRender',(td, r, c)=>{
      const cell = getCell(r,c);
      if(cell && cell.link){
        td.style.color = '#1565c0';
        td.style.textDecoration = 'underline';
        td.style.cursor = 'pointer';
        if(!td._linkAttached){
          td._linkAttached = true;
          td.addEventListener('click', e=>{
            if(e.ctrlKey||e.metaKey){
              e.preventDefault();
              navigateLink(cell.link, r, c);
            }
          });
          td.title = 'Ctrl+点击跳转: '+ (cell.link.url || cell.link.email || '');
        }
      }
    });

    function navigateLink(link, r, c){
      if(link.type==='web'){ window.open(link.url, '_blank'); }
      else if(link.type==='email'){ window.location.href = 'mailto:'+link.email; }
      else if(link.type==='sheet'){
        const idx = WB.sheets.findIndex(s=>s.name===link.sheet);
        if(idx>=0){ WB.active=idx; renderTabs(); refreshAll(); }
      }
      else if(link.type==='cell'){
        const a = parseRef(link.addr);
        if(a){ setSel(a.r,a.c,a.r,a.c); }
      }
    }

    window.addHyperlinkToSelection = function(){
      openModal('modalLink');
      $('linkType').onchange = ()=>{
        const t = $('linkType').value;
        ['linkUrl','linkEmail','linkSheet','linkAddr','linkText'].forEach(id=>$('link-'+id) && $('link-'+id).style && ($('link-'+id).style.display='none'));
        const map = { web:['linkUrl'], email:['linkEmail'], sheet:['linkSheet','linkAddr'], cell:['linkAddr'] };
        (map[t]||[]).forEach(id=>{ const el=$(id); el && (el.style.display='block'); });
      };
      $('linkApply').onclick = ()=>{
        const type = $('linkType').value;
        const text = $('linkText').value || $('linkUrl').value || $('linkEmail').value || $('linkAddr').value;
        const link = { type, display:text };
        if(type==='web') link.url = $('linkUrl').value;
        else if(type==='email') link.email = $('linkEmail').value;
        else if(type==='sheet'){ link.sheet=$('linkSheet').value; link.addr=$('linkAddr').value; }
        else if(type==='cell') link.addr=$('linkAddr').value;
        const cell = ensureCell(cur.r, cur.c);
        if(text) cell.v = text;
        cell.link = link;
        autosave(); refreshAll();
        closeModal('modalLink');
        toast('已添加超链接');
      };
    };

    MX.plug.addContextMenu({ label:'超链接…', fn: addHyperlinkToSelection });

    console.log('[hyperlink] Cell hyperlinks registered');
  }
});