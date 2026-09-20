/*
 * 95-i18n.js — 界面语言切换（中文 / English）
 *
 * 实现方式：直接对已渲染的界面文案做「原文→译文」映射，切换时重写文本节点。
 * 原文在首次扫描时记录到 data-i18n-zh，因此可反复来回切换、不丢原文。
 *
 * 旧版问题：依赖 [data-i18n] 标记（全项目 0 个）+ DOMContentLoaded（插件启动时早已触发）
 *          + .statusbar（实际是 #statusBar）——三个原因叠加，导致该功能完全不生效。
 */
MX.plug.register({
  name: 'i18n',
  version: '2.0.0',
  init(){
    const EN = {
      /* 菜单栏 */
      '文件':'File','编辑':'Edit','插入':'Insert','格式':'Format','数据':'Data','视图':'View','帮助':'Help','插件':'Plugins',
      /* 文件菜单 */
      '新建工作簿':'New workbook','载入示例工作簿（函数演示）':'Load demo workbook','打开…':'Open…',
      '保存为 Excel(.xlsx)':'Save as Excel (.xlsx)','保存为工程文件(.json)':'Save as project (.json)',
      '导入 CSV…':'Import CSV…','导出当前表为 CSV':'Export sheet as CSV','打印':'Print',
      /* 编辑/插入/格式/数据/视图 */
      '撤销':'Undo','重做':'Redo','查找与替换…':'Find & Replace…','清除内容':'Clear contents',
      '图表…':'Chart…','插入行（上方）':'Insert row above','插入列（左侧）':'Insert column left',
      '合并/拆分单元格':'Merge / Unmerge cells','数值格式':'Number format','百分比格式':'Percent format',
      '货币格式':'Currency format','常规格式':'General format',
      '升序排序':'Sort ascending','降序排序':'Sort descending',
      '放大':'Zoom in','缩小':'Zoom out','恢复100%':'Reset to 100%','切换网格线':'Toggle gridlines','全屏':'Fullscreen',
      '功能与快捷键说明':'Help & shortcuts',
      /* 工具栏 */
      '新建':'New','打开':'Open','保存':'Save','查找':'Find','左对齐':'Align left','居中':'Align center','右对齐':'Align right',
      '图表':'Chart','字体':'Font','字号':'Size','加粗':'Bold','斜体':'Italic','下划线':'Underline',
      /* 插件工具栏/菜单项 */
      '导出 PDF':'Export PDF','导出 CSV':'Export CSV','导入 CSV':'Import CSV','条件格式':'Conditional format',
      '数据验证':'Data validation','自动筛选':'Auto filter','所有批注':'All notes','宏':'Macro','二维码':'QR code',
      '条形码':'Barcode','迷你图':'Sparkline','插入图片':'Insert image','主题':'Theme','模板…':'Templates…','历史版本':'Version history',
      /* 弹窗 */
      '查找与替换':'Find & Replace','重命名工作表':'Rename sheet','插入图表':'Insert chart','帮助 · 功能与快捷键':'Help · Features & shortcuts',
      '关闭':'Close','取消':'Cancel','确定':'OK','添加':'Add','清除全部':'Clear all','完成':'Done','知道了':'Got it',
      '全部替换':'Replace all','查找下一个':'Find next','插入':'Insert','应用':'Apply',
      /* 状态栏 */
      '就绪':'Ready','编辑':'Edit','切换语言':'Switch language'
    };

    let lang = localStorage.getItem('myexcel.lang') || 'zh-CN';

    /* 语言切换按钮（放进状态栏缩放控件左侧） */
    const btn = document.createElement('span');
    btn.id = 'langToggle';
    btn.className = 'st';
    btn.style.cssText = 'cursor:pointer;color:#bfe3cd;text-decoration:underline;flex:none';
    btn.onclick = ()=>setLang(lang === 'zh-CN' ? 'en-US' : 'zh-CN');
    const zb = document.getElementById('zoomBox');
    if(zb && zb.parentNode) zb.parentNode.insertBefore(btn, zb);
    else (document.getElementById('statusBar') || document.body).appendChild(btn);

    /* 需要翻译的界面节点（取元素内第一个非空文本节点，避免破坏图标/子元素） */
    function nodes(){
      const sel = '#menuBar .menu>span, .dropdown .item>span:first-child, #ribbon .tbtn, ' +
                  '.modal .box h3, .modal .box .head, .modal .box .foot .btn';
      const out = [];
      document.querySelectorAll(sel).forEach(el=>{
        if(el.id && el.id.indexOf('mxAsk') === 0) return;        /* 动态标题弹窗跳过 */
        if(el.querySelector('input,select')) return;             /* 颜色选择器/复合控件跳过 */
        const tn = [...el.childNodes].find(n=>n.nodeType === 3 && n.textContent.trim());
        if(tn) out.push({el, tn});
      });
      return out;
    }

    function scan(){
      nodes().forEach(({el, tn})=>{
        if(el.dataset.i18nZh == null) el.dataset.i18nZh = tn.textContent;
      });
    }

    function apply(){
      scan();
      nodes().forEach(({el, tn})=>{
        const zh = el.dataset.i18nZh;
        if(zh == null) return;
        const icon = (zh.match(/^[^\u4e00-\u9fffA-Za-z0-9]*/) || [''])[0];
        const label = zh.slice(icon.length);
        const en = EN[label] || EN[zh.trim()];
        tn.textContent = (lang === 'en-US' && en) ? icon + en : zh;
      });
      document.documentElement.lang = lang === 'en-US' ? 'en' : 'zh-CN';
      btn.textContent = lang === 'zh-CN' ? '中 / EN' : 'EN / 中';
      btn.title = lang === 'zh-CN' ? '切换语言 / Switch language' : 'Switch language / 切换语言';
    }

    function setLang(l){
      lang = l;
      localStorage.setItem('myexcel.lang', l);
      apply();
      toast(l === 'zh-CN' ? '已切换为中文' : 'Switched to English');
    }

    /* 状态栏「就绪/编辑」由主程序动态写入，包一层保持语言一致 */
    const origUpdateStatus = window.updateStatus;
    if(typeof origUpdateStatus === 'function'){
      window.updateStatus = function(){
        origUpdateStatus.apply(this, arguments);
        if(lang !== 'en-US') return;
        const m = document.getElementById('stMsg');
        if(!m) return;
        if(m.textContent === '编辑') m.textContent = 'Edit';
        else if(m.textContent === '就绪') m.textContent = 'Ready';
      };
    }

    window.setLang = setLang;
    MX.i18n = { apply, setLang, get lang(){ return lang; } };

    apply();
    console.log('[i18n] ' + lang);
  }
});
