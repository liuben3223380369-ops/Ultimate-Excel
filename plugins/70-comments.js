/*
 * 70-comments.js — 单元格批注
 *
 *   cell.notes = [{ author:'Alice', text:'...', ts:1700000000000, resolved:false }]
 *
 * UI：右上角红三角标记 → 鼠标悬停气泡显示
 */
MX.plug.register({
  name: 'comments',
  version: '1.0.0',
  init(){
    /* 渲染：单元格右上角小红三角 */
    MX.plug.on('cellRender',(td, r, c)=>{
      const cell = getCell(r,c);
      if(cell && cell.notes && cell.notes.length){
        const note = cell.notes[cell.notes.length-1];
        td.style.background = (td.style.background||'') + (td.style.background?';':'');
        td.style.backgroundImage = 'linear-gradient(135deg, transparent 70%, #e91e63 70%, #e91e63 80%, transparent 80%)';
        td.style.backgroundSize = '12px 12px';
        td.style.backgroundRepeat = 'no-repeat';
        td.style.backgroundPosition = 'right top';
        td.title = (note.author||'我')+': '+note.text;
        /* 悬停气泡 */
        if(!td._noteBubble){
          td._noteBubble = true;
          td.addEventListener('mouseenter', e=>{
            const old = document.getElementById('noteBubble'); if(old) old.remove();
            const div = document.createElement('div'); div.id='noteBubble';
            div.style.cssText='position:fixed;background:#fffde7;border:1px solid #fbc02d;border-radius:4px;padding:8px;max-width:280px;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,.2);z-index:1000';
            div.innerHTML = `<div style="font-weight:600;color:#f57f17">💬 ${esc(note.author||'我')} · ${dayjs(note.ts).format('YYYY-MM-DD HH:mm')}</div><div style="margin-top:4px;white-space:pre-wrap">${esc(note.text)}</div>`;
            const rect = td.getBoundingClientRect();
            div.style.left = (rect.right + 8) + 'px';
            div.style.top = (rect.top) + 'px';
            document.body.appendChild(div);
          });
          td.addEventListener('mouseleave', ()=>{ const old=document.getElementById('noteBubble'); if(old) old.remove(); });
        }
      }
    });

    function addNote(r, c, author, text){
      const s = WB.sheets[WB.active];
      const cell = ensureCell(r,c);
      cell.notes = cell.notes || [];
      cell.notes.push({ author, text, ts: Date.now() });
      autosave();
      refreshCell(r,c);
    }

    window.addNoteToSelection = function(){
      const author = localStorage.getItem('myexcel.user') || '我';
      const text = prompt('批注内容：');
      if(text==null) return;
      addNote(cur.r, cur.c, author, text);
      toast('已添加批注');
    };

    window.viewAllNotes = function(){
      const s = WB.sheets[WB.active];
      const list = [];
      for(const k in s.cells){
        const cell = s.cells[k];
        if(cell.notes && cell.notes.length){
          const [r,c] = k.split(',').map(Number);
          for(const n of cell.notes){
            list.push({ addr: refStr(r,c), author:n.author, text:n.text, ts:n.ts });
          }
        }
      }
      openModal('modalNotes');
      const html = list.length ? list.map(n=>`<div style="padding:6px;border-bottom:1px solid #eee"><b>${esc(n.addr)}</b> · ${esc(n.author)} · ${dayjs(n.ts).format('YYYY-MM-DD HH:mm')}<br><span style="color:#666">${esc(n.text)}</span></div>`).join('') : '<i>暂无批注</i>';
      $('notesList').innerHTML = html;
    };

    MX.plug.addContextMenu({ label:'添加批注…', fn: addNoteToSelection });
    MX.plug.addRibbon({ group:'review', label:'所有批注', icon:'💬', fn: viewAllNotes });

    console.log('[comments] Notes registered');
  }
});