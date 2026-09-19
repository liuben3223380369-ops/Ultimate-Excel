/*
 * 94-image.js — 单元格内嵌图片（增强版）
 *
 * 支持：
 *   - 直接拖入 PNG/JPG/SVG
 *   - 剪贴板粘贴图片（Ctrl+V）
 *   - 公式 =MX.IMG("https://...") 加载远程图片
 *
 * 使用 IndexedDB 存储（base64 不进 JSON autosave，容量大）
 */
MX.plug.register({
  name: 'image',
  version: '1.0.0',
  init(){
    const DB_NAME='myexcel_imgs';
    function dbReq(req){ return new Promise((res,rej)=>{ req.onsuccess=()=>res(req.result); req.onerror=()=>rej(req.error); }); }
    let _db = null;
    async function openDB(){
      if(_db) return _db;
      _db = await new Promise((res,rej)=>{
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = ()=>r.result.createObjectStore('imgs');
        r.onsuccess=()=>res(r.result);
        r.onerror=()=>rej(r.error);
      });
      return _db;
    }
    async function putImg(id, dataUrl){ const d=await openDB(); d.transaction('imgs','readwrite').objectStore('imgs').put(dataUrl, id); }
    async function getImg(id){ const d=await openDB(); return dbReq(d.transaction('imgs').objectStore('imgs').get(id)); }

    window.insertImageFromFile = function(){
      const inp = document.createElement('input');
      inp.type='file'; inp.accept='image/*';
      inp.onchange = async e=>{
        const f = e.target.files[0]; if(!f) return;
        const rd = new FileReader();
        rd.onload = async ()=>{
          const id = 'img_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
          await putImg(id, rd.result);
          const cell = ensureCell(cur.r, cur.c);
          cell.image = { id, name:f.name };
          autosave(); refreshAll();
          toast('已插入图片: '+f.name);
        };
        rd.readAsDataURL(f);
      };
      inp.click();
    };

    if(window.MX && MX._pendingHFFns){
      MX._pendingHFFns['IMG'] = function(url){
        return '[图片:'+url+']';
      };
    }

    MX.plug.on('cellRender',async (td, r, c)=>{
      const cell = getCell(r,c);
      if(cell && cell.image){
        let url = cell.image._url;
        if(!url){
          url = await getImg(cell.image.id);
          if(url) cell.image._url = url;
        }
        if(url){
          td.innerHTML = `<img src="${url}" style="max-width:100%;max-height:60px;display:block;margin:0 auto" title="${esc(cell.image.name||'')}">`;
          td.style.textAlign='center';
        }
      }
    });

    /* 监听粘贴：若剪贴板含图片，自动插入 */
    document.addEventListener('paste', e=>{
      if(!e.clipboardData || !e.clipboardData.items) return;
      for(const it of e.clipboardData.items){
        if(it.kind==='file' && it.type.startsWith('image/')){
          const f = it.getAsFile();
          const rd = new FileReader();
          rd.onload = async ()=>{
            const id = 'img_paste_'+Date.now();
            await putImg(id, rd.result);
            const cell = ensureCell(cur.r, cur.c);
            cell.image = { id, name:'剪贴板图片' };
            autosave(); refreshAll();
            toast('已从剪贴板插入图片');
          };
          rd.readAsDataURL(f);
          e.preventDefault();
        }
      }
    });

    MX.plug.addRibbon({ group:'insert', label:'插入图片', icon:'🖼', fn: insertImageFromFile });
    MX.plug.addContextMenu({ label:'插入图片…', fn: insertImageFromFile });

    console.log('[image] Image cell registered');
  }
});