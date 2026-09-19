/*
 * 95-i18n.js — 国际化（中英文双语）
 *
 * 使用 lang="zh-CN" / "en-US" 切换。
 * 工具栏按钮、菜单、模态框标题都会随之变化。
 *
 * 用法：在 init 时遍历 [data-i18n] 元素，根据当前语言设置 textContent。
 */
MX.plug.register({
  name: 'i18n',
  version: '1.0.0',
  init(){
    const I18N = {
      'zh-CN': {
        file:'文件', new:'新建', open:'打开', save:'保存', export:'导出', import:'导入',
        edit:'编辑', undo:'撤销', redo:'重做', cut:'剪切', copy:'复制', paste:'粘贴', find:'查找',
        format:'格式', bold:'粗体', italic:'斜体', underline:'下划线', merge:'合并单元格',
        insert:'插入', chart:'图表', row:'行', col:'列',
        data:'数据', filter:'筛选', sort:'排序', validate:'验证',
        review:'审阅', note:'批注', theme:'主题', help:'帮助', about:'关于',
        light:'浅色', dark:'深色', language:'语言',
        export_pdf:'导出 PDF', print:'打印', export_csv:'导出 CSV', import_csv:'导入 CSV',
        chart_title:'标题', chart_type:'图表类型', chart_preview:'预览', chart_apply:'应用到工作表',
        cond_format:'条件格式', data_validate:'数据验证', auto_filter:'自动筛选', all_notes:'所有批注',
        link:'超链接', web:'网页', email:'邮箱', sheet:'工作表', cell:'单元格',
        insert_qr:'插入二维码', insert_barcode:'插入条形码', insert_image:'插入图片',
        insert_sparkline:'插入迷你图', markdown_cell:'切换 Markdown',
        'Are you sure':'确定吗？', Cancel:'取消', OK:'确定',
        Recent:'最近', Templates:'模板', New_Workbook:'新建工作簿',
        Welcome:'欢迎', ready_to_use:'已就绪 · 支持 400+ 函数 · 兼容 xlsx/xls',
        auto_save:'已自动保存'
      },
      'en-US': {
        file:'File', new:'New', open:'Open', save:'Save', export:'Export', import:'Import',
        edit:'Edit', undo:'Undo', redo:'Redo', cut:'Cut', copy:'Copy', paste:'Paste', find:'Find',
        format:'Format', bold:'Bold', italic:'Italic', underline:'Underline', merge:'Merge cells',
        insert:'Insert', chart:'Chart', row:'Row', col:'Column',
        data:'Data', filter:'Filter', sort:'Sort', validate:'Validate',
        review:'Review', note:'Comment', theme:'Theme', about:'About',
        light:'Light', dark:'Dark', language:'Language',
        export_pdf:'Export PDF', print:'Print', export_csv:'Export CSV', import_csv:'Import CSV',
        chart_title:'Title', chart_type:'Chart type', chart_preview:'Preview', chart_apply:'Apply',
        cond_format:'Conditional format', data_validate:'Data validation', auto_filter:'Auto filter', all_notes:'All notes',
        link:'Hyperlink', web:'Web', email:'Email', sheet:'Sheet', cell:'Cell',
        insert_qr:'Insert QR', insert_barcode:'Insert Barcode', insert_image:'Insert Image',
        insert_sparkline:'Insert Sparkline', markdown_cell:'Toggle Markdown',
        'Are you sure':'Are you sure?', Cancel:'Cancel', OK:'OK',
        Recent:'Recent', Templates:'Templates', New_Workbook:'New workbook',
        Welcome:'Welcome', ready_to_use:'Ready · 400+ functions · xlsx/xls compatible',
        auto_save:'Auto saved'
      }
    };

    let lang = localStorage.getItem('myexcel.lang') || 'zh-CN';

    function apply(){
      document.documentElement.lang = lang;
      const dict = I18N[lang] || I18N['zh-CN'];
      document.querySelectorAll('[data-i18n]').forEach(el=>{
        const key = el.getAttribute('data-i18n');
        if(dict[key]!=null) el.textContent = dict[key];
      });
      document.querySelectorAll('[data-i18n-title]').forEach(el=>{
        const key = el.getAttribute('data-i18n-title');
        if(dict[key]!=null) el.setAttribute('title', dict[key]);
      });
    }

    window.setLang = function(l){
      lang = l;
      localStorage.setItem('myexcel.lang', l);
      apply();
      toast(l==='zh-CN' ? '已切换为中文' : 'Switched to English');
    };

    apply();

    /* 在状态栏加切换按钮 */
    const btn = document.createElement('span');
    btn.style.cssText = 'margin-left:8px;cursor:pointer;color:#888';
    btn.textContent = lang==='zh-CN' ? '中/EN' : 'EN/中';
    btn.title = '切换语言';
    btn.onclick = ()=>setLang(lang==='zh-CN' ? 'en-US' : 'zh-CN');
    document.addEventListener('DOMContentLoaded', ()=>{
      const st = document.querySelector('.statusbar') || document.body;
      st && st.appendChild(btn);
    });

    console.log('[i18n] '+lang);
  }
});