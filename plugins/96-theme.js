/*
 * 96-theme.js — 主题系统
 *
 * 内置 Light / Dark / HighContrast 三套主题。
 * 通过切换根节点 [data-theme] 实现。
 */
MX.plug.register({
  name: 'theme',
  version: '1.0.0',
  init(){
    const THEMES = {
      light: { name:'浅色', icon:'☀️' },
      dark:  { name:'深色', icon:'🌙' },
      contrast: { name:'高对比度', icon:'🌓' }
    };

    const CSS = `
      :root[data-theme="dark"] {
        --bg:#1e1e1e; --bg2:#2a2a2a; --bg3:#333; --fg:#e0e0e0; --fg2:#999;
        --accent:#1976d2; --border:#444; --grid:#555; --hover:#383838; --sel:#264f78;
        --headerBg:#333; --headerFg:#ddd;
      }
      :root[data-theme="contrast"] {
        --bg:#000; --bg2:#000; --bg3:#000; --fg:#fff; --fg2:#fff;
        --accent:#ff0; --border:#fff; --grid:#fff; --hover:#333; --sel:#ff0;
        --headerBg:#000; --headerFg:#ff0;
      }
      :root { color-scheme: light dark; }
      [data-theme="dark"] .grid td { border-color: var(--grid); }
      [data-theme="dark"] body { background: var(--bg); color: var(--fg); }
      [data-theme="dark"] .ribbon { background: var(--bg2); border-bottom-color: var(--border); }
      [data-theme="dark"] .statusbar { background: var(--bg2); border-top-color: var(--border); color: var(--fg2); }
      [data-theme="dark"] .modal { background: var(--bg2); color: var(--fg); border-color: var(--border); }
      [data-theme="dark"] input, [data-theme="dark"] select, [data-theme="dark"] textarea { background: var(--bg); color: var(--fg); border-color: var(--border); }
      [data-theme="dark"] .ctx-menu { background: var(--bg2); color: var(--fg); border-color: var(--border); }
      [data-theme="dark"] .ctx-menu div:hover { background: var(--hover); }
      [data-theme="dark"] .tabs { background: var(--bg2); border-top-color: var(--border); }
      [data-theme="dark"] .tab { color: var(--fg); }
      [data-theme="dark"] .tab.active { background: var(--bg); }
      [data-theme="dark"] .grid th { background: var(--headerBg); color: var(--headerFg); }
      [data-theme="dark"] #toast { background: var(--accent); }
      [data-theme="dark"] .col-hdr, [data-theme="dark"] .row-hdr { background: var(--headerBg); color: var(--headerFg); }
      [data-theme="contrast"] * { font-weight: 600 !important; }
    `;

    let styleEl = document.getElementById('theme-css');
    if(!styleEl){
      styleEl = document.createElement('style');
      styleEl.id = 'theme-css';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = CSS;

    function setTheme(t){
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('myexcel.theme', t);
      refreshAll();
      toast('主题：'+THEMES[t].name);
    }

    const initial = localStorage.getItem('myexcel.theme') || 'light';
    document.documentElement.setAttribute('data-theme', initial);

    window.cycleTheme = function(){
      const order = ['light','dark','contrast'];
      const cur = localStorage.getItem('myexcel.theme') || 'light';
      setTheme(order[(order.indexOf(cur)+1)%order.length]);
    };

    MX.plug.addRibbon({ group:'view', label:'主题', icon:'🎨', fn: cycleTheme });
    MX.plug.addContextMenu({ label:'切换主题', fn: cycleTheme });

    console.log('[theme] Theme system registered ('+initial+')');
  }
});