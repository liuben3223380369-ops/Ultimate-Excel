/*
 * 90-qrcode.js — 单元格内嵌二维码
 *
 *   =MX.QR("https://example.com")         返回单元格内 SVG dataURL
 *   菜单：插入 → 二维码…
 *
 * 使用 qrcode-generator 库（纯 JS，无依赖，体积小）。
 */
MX.plug.register({
  name: 'qrcode',
  version: '1.0.0',
  init(){
    function makeQR(text, size){
      if(!window.qrcode){ return ''; }
      const qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      const cellCount = qr.getModuleCount();
      const data = qr.createDataURL(size||4, 0);
      return data;
    }

    /* 注册 HF 函数：MX.QR */
    if(window.MX && MX._pendingHFFns){
      MX._pendingHFFns['QR'] = function(text){
        const url = makeQR(String(text||''), 4);
        return url ? '[二维码]' : '#ERROR!';
      };
    }

    /* 自定义函数插入位置：MX.QR */
    window.insertQRCode = function(){
      const text = prompt('二维码内容（网址/文本/数字）：','https://myexcel.app');
      if(text==null) return;
      const cell = ensureCell(cur.r, cur.c);
      cell.qr = { text, size:4 };
      autosave(); refreshAll();
      toast('已插入二维码（移动鼠标悬停可放大查看）');
    };

    /* 渲染：单元格内嵌 QR */
    MX.plug.on('cellRender',(td, r, c)=>{
      const cell = getCell(r,c);
      if(cell && cell.qr){
        const url = makeQR(cell.qr.text, cell.qr.size||4);
        td.innerHTML = `<img src="${url}" style="width:80px;height:80px;display:block;margin:0 auto" title="${esc(cell.qr.text)}">`;
        td.style.textAlign = 'center';
      }
    });

    MX.plug.addContextMenu({ label:'插入二维码…', fn: insertQRCode });
    MX.plug.addRibbon({ group:'insert', label:'二维码', icon:'▣', fn: insertQRCode });

    console.log('[qrcode] QR codes registered');
  }
});