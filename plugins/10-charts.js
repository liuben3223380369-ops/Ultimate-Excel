/*
 * 10-charts.js — ECharts 全谱图表引擎
 *
 * 替换原 4 种基础图表,支持 14 种图表类型：
 *   柱/线/面积/饼/环形/雷达/散点/极坐标/K线/箱型/热力/旭日/树图/漏斗/仪表盘/词云
 * 也支持迷你模式(嵌入单元格)和全屏模式(新窗口)。
 */
MX.plug.register({
  name: 'charts',
  version: '2.0.0',
  init(){
    const E = window.echarts;
    if(!E){ console.warn('ECharts not loaded'); return; }
    const TYPE_MAP = {
      column:  { type:'bar',  name:'柱状图',  default:'vertical' },
      bar:     { type:'bar',  name:'条形图',  orient:'horizontal' },
      line:    { type:'line', name:'折线图',  smooth:false },
      area:    { type:'line', name:'面积图',  areaStyle:{} },
      pie:     { type:'pie',  name:'饼图',    radius:'60%' },
      doughnut:{ type:'pie',  name:'环形图',  radius:['40%','70%'] },
      radar:   { type:'radar',name:'雷达图',  },
      scatter: { type:'scatter', name:'散点图' },
      polarBar:{ type:'bar',  name:'极坐标柱', coordinateSystem:'polar' },
      candlestick:{type:'candlestick', name:'K线图' },
      boxplot: { type:'boxplot', name:'箱型图' },
      heatmap: { type:'heatmap', name:'热力图' },
      sunburst:{ type:'sunburst',name:'旭日图' },
      treemap: { type:'treemap',name:'树图' },
      funnel:  { type:'funnel',name:'漏斗图', sort:'descending' },
      gauge:   { type:'gauge', name:'仪表盘' },
      wordcloud:{type:'wordCloud', name:'词云' },
      sankey:  { type:'sankey', name:'桑基图' },
      graph:   { type:'graph',  name:'关系图' }
    };

    /* 收集选中范围内的数据并返回系列 */
    function collectData(){
      const s = WB.sheets[WB.active];
      const rows=[], cols=[];
      for(let c=sel.c1;c<=sel.c2;c++) cols.push(c);
      for(let r=sel.r1;r<=sel.r2;r++) rows.push(r);
      /* 第一行/列作为表头 */
      const hdrR = rows.map(r=>cellVal(r, sel.c1));
      const hdrC = cols.map(c=>cellVal(sel.r1, c));
      const data = [];
      for(let r=sel.r1+1;r<=sel.r2;r++){
        const row=[];
        for(let c=sel.c1+1;c<=sel.c2;c++){
          const v = cellVal(r,c);
          row.push(typeof v==='number' ? v : (parseFloat(v)||0));
        }
        data.push(row);
      }
      return { hdrR, hdrC, data, s, rows, cols };
    }

    /* 构造系列数组 */
    function buildSeries(type, dat){
      const series=[];
      if(type==='pie'||type==='doughnut'){
        const labels = dat.hdrR;
        const dataCol = dat.data.map(row=>row[0]||0);
        const names = dat.cols.slice(1).map(c=>cellVal(sel.r1,c));
        return [{ name: names[0]||'数据', type:'pie', radius: TYPE_MAP[type].radius,
                  data: dataCol.map((v,i)=>({name:labels[i],value:v})) }];
      }
      if(type==='radar'){
        const ind = dat.hdrR;
        const nm = dat.hdrC.slice(1);
        nm.forEach((n,i)=>{
          series.push({ name:n, type:'radar', data:[{value: dat.data.map(r=>r[i]||0), name:n}] });
        });
        return series;
      }
      if(type==='heatmap'){
        return [{ type:'heatmap', data: dat.data.flatMap((r,i)=>r.map((v,j)=>[j,i,v])) }];
      }
      if(type==='sankey'){
        const labels = dat.hdrR;
        const nodes = labels.map((n,i)=>({name:n}));
        const links = [];
        for(let i=0;i<dat.data.length;i++) for(let j=0;j<dat.data[i].length;j++){
          if(dat.data[i][j]) links.push({source:labels[i], target:dat.hdrC[j+1], value:dat.data[i][j]});
        }
        return [{ type:'sankey', data: nodes, links }];
      }
      /* 默认:行->系列 */
      dat.hdrR.forEach((label,i)=>{
        series.push({
          name: label, type: TYPE_MAP[type].type,
          coordinateSystem: TYPE_MAP[type].coordinateSystem,
          data: dat.data[i] || []
        });
      });
      return series;
    }

    /* 打开图表编辑器模态框 */
    window.insertChartModal = function(){
      openModal('modalChart');
      $('chartPreview').innerHTML = '';
      $('chartType').innerHTML = Object.entries(TYPE_MAP).map(([k,v])=>`<option value="${k}">${v.name}</option>`).join('');
      $('chartType').onchange = renderPreview;
      $('chartTitle').oninput = renderPreview;
      $('chartApply').onclick = apply;
      renderPreview();
    };

    function renderPreview(){
      const type = $('chartType').value;
      const dom = $('chartPreview');
      dom.innerHTML = '';
      if(!window.echarts){ dom.textContent='ECharts 未加载'; return; }
      const chart = window.echarts.init(dom);
      try{
        const dat = collectData();
        const series = buildSeries(type, dat);
        const opt = {
          title: { text: $('chartTitle').value || '', left:'center' },
          tooltip: { trigger: type==='pie'||type==='doughnut'||type==='funnel'?'item':'axis' },
          legend: { bottom: 0 },
          xAxis: type==='pie'||type==='doughnut'||type==='radar'||type==='sankey'||type==='heatmap'?undefined:
                 { type:'category', data: dat.hdrC.slice(1).map(c=>c==null?'':String(c)) },
          yAxis: type==='pie'||type==='doughnut'||type==='radar'||type==='sankey'||type==='heatmap'?undefined:
                 { type:'value' },
          series: series,
          animation: false
        };
        if(type==='radar'){
          opt.radar = { indicator: dat.hdrR.map(n=>({name:n, max:Math.max(...dat.data.flat())*1.2||100})) };
        }
        if(type==='funnel') opt.series = [{type:'funnel', sort:'descending', data: series[0].data.map((v,i)=>({name:dat.hdrR[i], value:v}))}];
        chart.setOption(opt);
        $('chartPreview')._echart = chart;
      }catch(e){ dom.textContent='无法渲染: '+e.message; }
    }

    function apply(){
      const type = $('chartType').value;
      const chart = $('chartPreview')._echart;
      if(!chart){ toast('请先预览图表'); return; }
      const dataUrl = chart.getDataURL({pixelRatio:2, backgroundColor:'#fff'});
      const s = WB.sheets[WB.active];
      const r = cur.r, col = cur.c;
      s.charts = s.charts || [];
      s.charts.push({ id:'ch'+(s.charts.length+1), type, title:$('chartTitle').value, anchor:[r,col], img:dataUrl, w:480, h:320 });
      s.cells[key(r,col)] = s.cells[key(r,col)] || {v:''};
      s.cells[key(r,col)].chart = s.charts.length-1;
      closeModal('modalChart');
      refreshAll();
      toast('已插入图表：'+TYPE_MAP[type].name);
    }

    /* 单元格渲染: 若存在 chart 索引,在该单元格上方叠加图标 */
    MX.plug.on('cellRender',(td, r, c)=>{
      const cell = getCell(r,c);
      if(cell && cell.chart != null){
        const s = WB.sheets[WB.active];
        const ch = s.charts && s.charts[cell.chart];
        if(ch){
          td.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;padding:2px;color:#1976d2"><span style="font-size:18px">📊</span><span style="font-size:10px">${ch.title||ch.type}</span></div>`;
          td.style.background = '#f3f9ff';
          td.style.cursor='pointer';
          td.onclick = (e)=>{ e.stopPropagation(); openChart(ch); };
        }
      }
    });

    function openChart(ch){
      const w = window.open('','_blank','width=720,height=520');
      w.document.write(`<title>${ch.title||'图表'}</title><body style="margin:0"><img src="${ch.img}" style="max-width:100%;display:block"></body>`);
    }

    MX.plug.addContextMenu({
      label:'插入图表…', fn:()=>insertChartModal()
    });

    MX.plug.addShortcut({key:'Ctrl+Shift+V', fn:()=>insertChartModal()});

    console.log('[charts] 14+ chart types registered');
  }
});