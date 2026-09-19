/*
 * 93-markdown.js — Markdown 单元格渲染
 *
 *   cell.markdown = true  → 单元格内容按 Markdown 渲染
 *   菜单：格式 → Markdown
 *
 * 使用 marked.js（MIT）解析 + DOMPurify 防 XSS。
 */
MX.plug.register({
  name: 'markdown',
  version: '1.0.0',
  init(){
    if(!window.marked || !window.DOMPurify){ console.warn('marked/DOMPurify not loaded'); return; }

    function renderMarkdown(text){
      try{
        const html = marked.parse(String(text||''), { breaks:true, gfm:true });
        return DOMPurify.sanitize(html, { ADD_ATTR:['target'] });
      }catch(e){ return esc(text); }
    }

    MX.plug.on('cellRender',(td, r, c)=>{
      const cell = getCell(r,c);
      if(cell && cell.markdown && cell.v && !editing){
        const v = cellVal(r,c);
        td.innerHTML = renderMarkdown(v);
        td.style.textAlign = 'left';
        td.style.verticalAlign = 'top';
        td.style.padding = '4px 8px';
        td.style.fontSize = '12px';
        td.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h=>h.style.cssText='margin:2px 0;font-weight:600');
        td.querySelectorAll('p').forEach(p=>p.style.cssText='margin:2px 0');
        td.querySelectorAll('ul,ol').forEach(l=>l.style.cssText='margin:2px 0;padding-left:18px');
        td.querySelectorAll('code').forEach(c=>c.style.cssText='background:#f5f5f5;padding:1px 4px;border-radius:2px;font-family:Consolas,monospace;font-size:11px');
        td.querySelectorAll('a').forEach(a=>a.style.color='#1565c0');
      }
    });

    /* 编辑时显示原始 Markdown */
    const origStartEdit = window.startEdit;
    window.startEdit = function(initial){
      origStartEdit(initial);
      const cell = getCell(cur.r, cur.c);
      if(cell && cell.markdown){
        $('formulaInput').placeholder = 'Markdown 模式: 支持 **粗体** *斜体* `代码` [链接](url) 标题/列表';
      }
    };

    window.toggleMarkdownCell = function(){
      const cell = ensureCell(cur.r, cur.c);
      cell.markdown = !cell.markdown;
      autosave();
      refreshAll();
      toast(cell.markdown ? '已启用 Markdown 渲染' : '已禁用 Markdown');
    };

    MX.plug.addContextMenu({ label:'切换 Markdown', fn: toggleMarkdownCell });

    console.log('[markdown] Markdown rendering registered');
  }
});