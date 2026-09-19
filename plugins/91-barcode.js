/*
 * 91-barcode.js — 单元格内嵌条形码
 *
 *   =MX.BARCODE("1234567890")              返回单元格内 SVG dataURL
 *   菜单：插入 → 条形码…
 *
 * 使用 JsBarcode 库（支持 EAN-13、CODE128、UPC、QR、ITF 等 30+ 类型）。
 */
MX.plug.register({
  name: 'barcode',
  version: '1.0.0',
  init(){
    function makeBarcode(text, format, w, h){
      if(!window.JsBarcode){ return ''; }
      try{
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, String(text||''), { format: format||'CODE128', width: w||2, height: h||50, displayValue:true, fontSize:14 });
        return canvas.toDataURL('image/png');
      }catch(e){ return ''; }
    }

    if(window.MX && MX._pendingHFFns){
      MX._pendingHFFns['BARCODE'] = function(text){ return makeBarcode(String(text||'')) ? '[条形码]' : '#ERROR!'; };
    }

    window.insertBarcode = function(){
      const text = prompt('条形码内容（数字/字母）：','1234567890');
      if(text==null) return;
      const format = prompt('格式 (CODE128 / EAN13 / EAN8 / UPC / CODE39 / ITF14)：','CODE128');
      if(!format) return;
      const cell = ensureCell(cur.r, cur.c);
      cell.barcode = { text, format };
      autosave(); refreshAll();
      toast('已插入条形码');
    };

    MX.plug.on('cellRender',(td, r, c)=>{
      const cell = getCell(r,c);
      if(cell && cell.barcode){
        const url = makeBarcode(cell.barcode.text, cell.barcode.format);
        td.innerHTML = `<img src="${url}" style="max-width:100%;max-height:60px;display:block;margin:0 auto" title="${esc(cell.barcode.text)}">`;
        td.style.textAlign = 'center';
      }
    });

    MX.plug.addContextMenu({ label:'插入条形码…', fn: insertBarcode });
    MX.plug.addRibbon({ group:'insert', label:'条形码', icon:'▥', fn: insertBarcode });

    console.log('[barcode] Barcodes registered');
  }
});