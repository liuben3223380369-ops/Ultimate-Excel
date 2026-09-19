/*
 * 极致表格 MyExcel — 插件系统核心
 *
 * 每个插件文件加载时调用 MX.plug.register({name, version, init})。
 * 在主应用初始化完成后,MX.plug.boot() 顺序触发每个插件的 init(workbench)。
 *
 * 插件可以：
 *   - 监听事件：on('cellChange', fn), on('cellEdit', fn), on('beforeSave', fn), on('fileOpen', fn), on('sheetActive', fn)
 *   - 添加工具栏按钮/菜单项: addRibbon({group, label, icon, fn})
 *   - 注册上下文菜单项: addContextMenu(fn)
 *   - 注册键盘快捷键: addShortcut({key, fn})
 *   - 注册 HF 自定义函数: registerHF(name, fn)
 *   - 注册 SheetJS xlsx 导入/导出钩子: hookImport(fn), hookExport(fn)
 *   - 注册单元格渲染钩子: renderCell(addr, cell, value) -> {element, css, html}
 */
(function(){
  if(!window.MX){window.MX={};}
  const plugins=[];
  const listeners={};
  const ribbonItems=[];
  const ctxItems=[];
  const shortcuts=[];
  const hfFns={};
  const hooks={import:[], export:[], renderCell:[]};

  function on(evt,fn){ (listeners[evt]=listeners[evt]||[]).push(fn); }
  function emit(evt,...args){ (listeners[evt]||[]).forEach(fn=>{ try{ fn(...args); }catch(e){ console.warn('[plugin event]', evt, e); } }); }

  function addRibbon(item){ ribbonItems.push(item); }
  function addContextMenu(item){ ctxItems.push(item); }
  function addShortcut(s){ shortcuts.push(s); }
  function registerHF(name, fn){ hfFns[name]=fn; }
  function hookImport(fn){ hooks.import.push(fn); }
  function hookExport(fn){ hooks.export.push(fn); }
  function renderCell(...args){ let r; for(const fn of hooks.renderCell){ const x=fn(...args); if(x){r=x; break;} } return r; }

  async function boot(workbench){
    /* 先把所有 HF 自定义函数注册到一个临时 HFConfig,等主应用启动后注入 */
    for(const [name,fn] of Object.entries(hfFns)){
      if(window.MX._pendingHFFns) window.MX._pendingHFFns[name]=fn;
      else window.MX._pendingHFFns={[name]:fn};
    }
    for(const p of plugins){
      try{
        const t0=performance.now();
        /* 单插件 8 秒超时：某个插件挂起不能拖死整个插件系统 */
        await Promise.race([
          Promise.resolve(p.init(workbench, MX)),
          new Promise((_,rej)=>setTimeout(()=>rej(new Error('init timeout (8s)')), 8000))
        ]);
        const dt=(performance.now()-t0).toFixed(1);
        console.log(`[plugin] ${p.name} v${p.version||'?'} ready in ${dt}ms`);
      }catch(e){
        console.warn(`[plugin] ${p.name} failed to boot:`, e);
      }
    }
    emit('booted', workbench);
  }

  MX.plug={
    register(p){ if(!p||!p.name)return; plugins.push(p); },
    on, emit, addRibbon, addContextMenu, addShortcut, registerHF,
    hookImport, hookExport, renderCell,
    _ribbonItems: ribbonItems, _ctxItems: ctxItems, _shortcuts: shortcuts,
    boot
  };
})();