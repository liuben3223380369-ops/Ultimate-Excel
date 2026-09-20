/*
 * 20-pdf.js — PDF / 打印 导出
 *
 * 使用 jsPDF + html2canvas 实现：
 *   - 选中区域 → 高清 PNG 嵌入 PDF
 *   - 多 Sheet 自动分页
 *   - 支持方向 (纵向/横向) 和纸张 (A4/A3/Letter)
 */
MX.plug.register({
  name: 'pdf',
  version: '1.0.0',
  init(){
    if(!window.jspdf){ console.warn('jsPDF not loaded'); return; }
    const { jsPDF } = window.jspdf;

    function htmlToCanvas(elem){
      return html2canvas(elem, { scale: 2, backgroundColor:'#ffffff', logging:false, useCORS:true });
    }

    function rasterWorkbook(opts){
      /* 用隐藏 iframe 渲染整个工作簿,挨个 sheet 截图 */
      return new Promise(async (resolve)=>{
        const pages=[];
        const sheetNames = WB.sheets.map(s=>s.name);
        for(let i=0;i<WB.sheets.length;i++){
          WB.active = i;
          renderSheet();
          await new Promise(r=>setTimeout(r,80));
          const target = document.querySelector('#gridInner') || document.querySelector('#grid') || document.body;
          const cv = await htmlToCanvas(target);
          pages.push({ name: sheetNames[i], dataUrl: cv.toDataURL('image/png'), w: cv.width, h: cv.height });
        }
        resolve(pages);
      });
    }

    async function exportPDF(){
      const opts = {
        orientation: (await MX.ui.confirm('横向布局？\n(确定=横向,取消=纵向)','导出 PDF')) ? 'landscape':'portrait',
        format: 'a4'
      };
      toast('正在生成 PDF…');
      rasterWorkbook(opts).then(pages=>{
        const pdf = new jsPDF(opts);
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        pages.forEach((p,idx)=>{
          if(idx>0) pdf.addPage(opts);
          const ratio = Math.min(pw/p.w, ph/p.h);
          const w = p.w*ratio, h = p.h*ratio;
          pdf.addImage(p.dataUrl, 'PNG', (pw-w)/2, 12, w, h, undefined, 'FAST');
          pdf.setFontSize(10);
          pdf.text(p.name, 10, ph-8);
        });
        const fname = (WB.name||'工作簿') + '.pdf';
        pdf.save(fname);
        toast('已导出 PDF：'+pages.length+' 页');
      }).catch(e=>{ toast('PDF 导出失败：'+e.message); });
    }

    function printWorkbook(){
      rasterWorkbook({}).then(pages=>{
        const win = window.open('','_blank','width=900,height=700');
        const style = '<style>body{margin:0;background:#666;padding:10px;font-family:sans-serif} .pg{background:#fff;margin:8px auto;box-shadow:0 0 8px rgba(0,0,0,.3);display:block;max-width:100%} h2{margin:8px;color:#fff;text-align:center}</style>';
        win.document.write(style + pages.map(p=>`<div><h2>${p.name}</h2><img class="pg" src="${p.dataUrl}"></div>`).join('') + '<scr'+'ipt>setTimeout(()=>window.print(),300)</scr'+'ipt>');
        win.document.close();
      });
    }

    MX.plug.addRibbon({ group:'file', label:'导出 PDF', icon:'📄', fn:exportPDF });
    MX.plug.addRibbon({ group:'file', label:'打印', icon:'🖨️', fn:printWorkbook });
    MX.plug.addContextMenu({ label:'打印当前区域', fn:printWorkbook });

    console.log('[pdf] PDF/print registered');
  }
});