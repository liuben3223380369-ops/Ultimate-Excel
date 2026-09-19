/*
 * 30-csv.js — PapaParse 升级版 CSV
 *
 *  - 自动分隔符检测 (, ; \t |)
 *  - 支持引号转义 / BOM
 *  - 导出保留公式 (以 = 开头原样输出)
 */
MX.plug.register({
  name: 'csv',
  version: '1.1.0',
  init(){
    if(!window.Papa){ console.warn('PapaParse not loaded'); return; }
    const Papa = window.Papa;

    function parseCSV(text){
      /* 自动检测分隔符 */
      const sample = text.slice(0, 4096);
      const counts = {',':0,';':0,'\t':0,'|':0};
      let inQ=false;
      for(const ch of sample){ if(ch=='"')inQ=!inQ; else if(!inQ&&counts[ch]!=null) counts[ch]++; }
      const delim = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
      const res = Papa.parse(text.replace(/^\ufeff/,''), {
        delimiter: delim,
        skipEmptyLines:'greedy',
        dynamicTyping: true,
        transformHeader: h=>h.trim()
      });
      return res.data;
    }

    function exportCSV(){
      const s = WB.sheets[WB.active];
      const aoa = [];
      for(let r=0;r<s.nr;r++){
        const row=[];
        for(let c=0;c<s.nc;c++){
          const cell = s.cells[key(r,c)];
          let v = cell ? (cell.v ?? '') : '';
          if(typeof v === 'number') v = String(v);
          row.push(v);
        }
        aoa.push(row);
      }
      const csv = Papa.unparse(aoa, { delimiter:',', quotes:true, newline:'\r\n' });
      download((s.name||'sheet') + '.csv', '\ufeff' + csv, 'text/csv;charset=utf-8');
      toast('已导出 CSV (PapaParse)');
    }

    function importCSV(){
      const inp = $('fileCSV');
      inp.value = '';
      inp.onchange = ()=>{
        const f = inp.files[0]; if(!f) return;
        const rd = new FileReader();
        rd.onload = ()=>{
          const data = parseCSV(rd.result);
          newWorkbook(false);
          const s = SH();
          s.nr = Math.max(40, data.length + 5);
          s.nc = Math.max(20, (data[0]||[]).length + 3);
          for(let r=0;r<data.length;r++){
            for(let c=0;c<data[r].length;c++){
              const v = data[r][c];
              if(v===''||v==null) continue;
              s.cells[key(r,c)] = { v: typeof v==='string' && v.startsWith('=') ? v : v };
            }
          }
          hfBuild();
          refreshAll();
          toast(`已导入 ${data.length} 行 × ${(data[0]||[]).length} 列`);
        };
        rd.readAsText(f, 'utf-8');
      };
      inp.click();
    }

    /* 替换原 exportCSV / importCSV,若已存在则覆盖 */
    window.exportCSV = exportCSV;
    window.importCSV = importCSV;

    MX.plug.addRibbon({ group:'file', label:'导出 CSV', icon:'📋', fn:exportCSV });
    MX.plug.addRibbon({ group:'file', label:'导入 CSV', icon:'⬇️', fn:importCSV });

    console.log('[csv] PapaParse CSV registered');
  }
});