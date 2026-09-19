/*
 * 92-sparkline.js — 单元格内迷你折线图
 *
 *   =MX.SPARK(1,2,3,4,5)        返回迷你折线图 SVG dataURL
 *   菜单：插入 → Sparkline
 *
 * 实现思路：纯 JS 画到 canvas → 转 dataURL。
 */
MX.plug.register({
  name: 'sparkline',
  version: '1.0.0',
  init(){
    function sparkPath(values, w, h, color){
      if(values.length<2) return '';
      const min = Math.min(...values), max = Math.max(...values);
      const range = max-min || 1;
      const step = w/(values.length-1);
      let d = '';
      values.forEach((v,i)=>{
        const x = i*step;
        const y = h - ((v-min)/range)*h;
        d += (i===0?'M':'L')+x.toFixed(1)+','+y.toFixed(1)+' ';
      });
      return d.trim();
    }

    function makeSpark(values, type){
      const w=120, h=24;
      const cv = document.createElement('canvas'); cv.width=w*2; cv.height=h*2;
      const ctx = cv.getContext('2d');
      ctx.scale(2,2);
      ctx.strokeStyle = '#1976d2'; ctx.lineWidth = 1.4;
      const nums = values.map(v=>parseFloat(v)||0);
      const d = sparkPath(nums, w, h, '#1976d2');
      if(type==='area'){
        ctx.fillStyle = 'rgba(25,118,210,.25)';
        ctx.beginPath();
        ctx.moveTo(0,h);
        const step = w/(nums.length-1);
        nums.forEach((v,i)=>{ const x=i*step, y=h-((v-Math.min(...nums))/(Math.max(...nums)-Math.min(...nums)||1))*h; ctx.lineTo(x,y); });
        ctx.lineTo(w,h); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.strokeStyle='#1976d2';
      }
      ctx.beginPath();
      const dpath = sparkPath(nums, w, h, '#1976d2');
      ctx.stroke(new Path2D(dpath));
      /* 端点圆 */
      ctx.fillStyle='#1976d2';
      const step=w/(nums.length-1);
      ctx.beginPath(); ctx.arc(0,h-((nums[0]-Math.min(...nums))/(Math.max(...nums)-Math.min(...nums)||1))*h,2,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(w,h-((nums[nums.length-1]-Math.min(...nums))/(Math.max(...nums)-Math.min(...nums)||1))*h,2,0,Math.PI*2); ctx.fill();
      /* 最高/最低点 */
      const maxI = nums.indexOf(Math.max(...nums)), minI = nums.indexOf(Math.min(...nums));
      ctx.fillStyle='#43a047'; ctx.beginPath(); ctx.arc(maxI*step,h-((nums[maxI]-Math.min(...nums))/(Math.max(...nums)-Math.min(...nums)||1))*h,2.5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#e53935'; ctx.beginPath(); ctx.arc(minI*step,h-((nums[minI]-Math.min(...nums))/(Math.max(...nums)-Math.min(...nums)||1))*h,2.5,0,Math.PI*2); ctx.fill();

      if(type==='bar'){
        cv.width=w*2; cv.height=h*2; ctx.clearRect(0,0,w*2,h*2);
        const bw=w/nums.length*0.7, gap=w/nums.length*0.3;
        const max=Math.max(...nums), min=Math.min(...nums);
        nums.forEach((v,i)=>{
          const norm=(v-min)/(max-min||1);
          ctx.fillStyle = v>=0 ? '#1976d2' : '#e53935';
          const barH = norm*h;
          ctx.fillRect(i*(bw+gap), h-barH, bw, barH);
        });
      }
      return cv.toDataURL('image/png');
    }

    if(window.MX && MX._pendingHFFns){
      MX._pendingHFFns['SPARK'] = function(){
        /* 接受 1-30 个参数或一个数组 */
        const args = Array.from(arguments);
        return makeSpark(args, 'line');
      };
      MX._pendingHFFns['SPARK_BAR'] = function(){ return makeSpark(Array.from(arguments), 'bar'); };
      MX._pendingHFFns['SPARK_AREA'] = function(){ return makeSpark(Array.from(arguments), 'area'); };
    }

    window.insertSparkline = function(){
      const type = prompt('类型 (line / bar / area)：', 'line');
      if(!type) return;
      const cell = ensureCell(cur.r, cur.c);
      cell.spark = { type, range: '本行右侧单元格' };
      autosave(); refreshAll();
      toast('已插入 Sparkline（提示：在公式栏 =MX.SPARK(1,2,3) 自定义）');
    };

    MX.plug.addContextMenu({ label:'插入迷你图', fn: insertSparkline });
    MX.plug.addRibbon({ group:'insert', label:'迷你图', icon:'📈', fn: insertSparkline });

    console.log('[sparkline] Sparklines registered');
  }
});