/*
 * 97-templates.js — 内置模板 + 最近文件
 *
 * 提供 5 个内置模板 + 用户最近打开过的 5 个文件列表。
 */
MX.plug.register({
  name: 'templates',
  version: '1.0.0',
  init(){
    /* 内置模板 */
    const TEMPLATES = {
      blank: () => null,
      budget: () => {
        const s = newSheet('月度预算');
        const months = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
        const cats = ['餐饮','交通','房租','水电','娱乐','医疗','教育','其他'];
        s.cells['0,0'] = { v:'月度预算表' };
        applyS(s, 0,0, { b:true, sz:16, fg:'#fff', bg:'#1976d2' });
        for (let i=0;i<months.length;i++){
          s.cells[`0,${i+1}`] = { v: months[i] };
          applyS(s, 0, i+1, { b:true, bg:'#e3f2fd' });
        }
        for (let i=0;i<cats.length;i++){
          s.cells[`${i+1},0`] = { v: cats[i] };
          applyS(s, i+1, 0, { b:true });
        }
        for (let i=0;i<cats.length;i++) for (let j=0;j<months.length;j++){
          s.cells[`${i+1},${j+1}`] = { v: Math.round(Math.random()*2000) };
        }
        /* 公式：行小计 + 总计 */
        for (let i=0;i<cats.length;i++){
          s.cells[`${i+1},${months.length+1}`] = { v:`=SUM(B${i+2}:M${i+2})` };
          applyS(s, i+1, months.length+1, { b:true, bg:'#fff8e1' });
        }
        for (let j=0;j<months.length+1;j++){
          s.cells[`${cats.length+1},${j+1}`] = { v: j===0 ? '月支出' : `=SUM(B${2}:B${cats.length+1})` };
          applyS(s, cats.length+1, j+1, { b:true, bg:'#fff8e1' });
        }
        s.nr = cats.length+5; s.nc = months.length+5;
        return s;
      },
      invoice: () => {
        const s = newSheet('发票');
        const rows = [
          ['发票号','INV-2026-001','',''],
          ['客户','','','日期', dayjs().format('YYYY-MM-DD')],
          ['','','',''],
          ['序号','项目','数量','单价','金额'],
          [1,'咨询服务','10','500','=C5*D5'],
          [2,'技术培训','5','800','=C6*D6'],
          [3,'维护服务','3','1200','=C7*D7'],
          ['','','','总计','=SUM(E5:E7)'],
          ['','','','税率','=E8*0.06'],
          ['','','','含税总额','=E8+E9']
        ];
        for(let r=0;r<rows.length;r++) for(let c=0;c<rows[r].length;c++){
          if(rows[r][c]===''||rows[r][c]==null) continue;
          s.cells[`${r},${c}`] = { v: rows[r][c] };
          if(r===0) applyS(s,r,c,{b:true,sz:18,fg:'#fff',bg:'#1976d2'});
          if(r===3) applyS(s,r,c,{b:true,bg:'#e3f2fd',ha:'center'});
          if(r===9||r===10) applyS(s,r,c,{b:true,bg:'#fff8e1'});
        }
        s.nr = 15; s.nc = 10;
        return s;
      },
      gantt: () => {
        const s = newSheet('甘特图');
        s.cells['0,0'] = { v:'任务' };
        s.cells['0,1'] = { v:'开始' };
        s.cells['0,2'] = { v:'结束' };
        s.cells['0,3'] = { v:'进度' };
        s.cells['0,4'] = { v:'工期(天)' };
        applyS(s,0,0,{b:true,bg:'#1976d2',fg:'#fff'});
        ['0,1','0,2','0,3','0,4'].forEach(k=>applyS(s,+k.split(',')[0],+k.split(',')[1],{b:true,bg:'#e3f2fd'}));
        const tasks = [
          ['需求分析', '2026-09-01', '2026-09-07', 1],
          ['系统设计', '2026-09-05', '2026-09-14', 0.6],
          ['编码实现', '2026-09-12', '2026-09-30', 0.4],
          ['测试', '2026-09-25', '2026-10-10', 0],
          ['部署上线', '2026-10-08', '2026-10-12', 0]
        ];
        for(let i=0;i<tasks.length;i++){
          const [name,start,end,prog]=tasks[i];
          s.cells[`${i+1},0`] = { v: name };
          s.cells[`${i+1},1`] = { v: start };
          s.cells[`${i+1},2`] = { v: end };
          s.cells[`${i+1},3`] = { v: prog };
          s.cells[`${i+1},4`] = { v: `=DATEDIF(B${i+2},C${i+2},"D")` };
          if(prog===1) applyS(s,i+1,3,{bg:'#43a047',fg:'#fff'});
          else if(prog>0) applyS(s,i+1,3,{bg:'#fb8c00',fg:'#fff'});
        }
        s.nr = 10; s.nc = 8;
        return s;
      },
      gradebook: () => {
        const s = newSheet('成绩表');
        const subjects = ['语文','数学','英语','物理','化学','总分','平均','排名'];
        const students = ['张三','李四','王五','赵六','钱七'];
        s.cells['0,0'] = { v:'学生' };
        applyS(s,0,0,{b:true,bg:'#1976d2',fg:'#fff'});
        for(let i=0;i<subjects.length;i++){
          s.cells[`0,${i+1}`] = { v: subjects[i] };
          applyS(s,0,i+1,{b:true,bg:'#e3f2fd'});
        }
        for(let r=0;r<students.length;r++){
          s.cells[`${r+1},0`] = { v: students[r] };
          applyS(s,r+1,0,{b:true});
          for(let c=0;c<5;c++){
            s.cells[`${r+1},${c+1}`] = { v: 60 + Math.round(Math.random()*40) };
          }
          s.cells[`${r+1},6`] = { v: `=SUM(B${r+2}:F${r+2})` };
          s.cells[`${r+1},7`] = { v: `=ROUND(AVERAGE(B${r+2}:F${r+2}),1)` };
          s.cells[`${r+1},8`] = { v: `=RANK(G${r+2},$G$2:$G$6)` };
          applyS(s,r+1,6,{b:true,bg:'#fff8e1'});
          applyS(s,r+1,7,{b:true,bg:'#fff8e1'});
          applyS(s,r+1,8,{b:true,bg:'#ffeb3b'});
        }
        s.nr = 8; s.nc = 10;
        return s;
      }
    };

    function applyS(s,r,c,st){
      const k = `${r},${c}`;
      s.cells[k] = s.cells[k] || { v:'' };
      s.cells[k].s = { ...(s.cells[k].s||{}), ...st };
    }

    window.useTemplate = function(tplKey){
      if(tplKey==='blank'){ newWorkbook(true); return; }
      newWorkbook(false);
      const tpl = TEMPLATES[tplKey]();
      if(tpl){ WB.sheets[WB.active] = tpl; WB.name = tpl.name + '_'+dayjs().format('YYYYMMDD_HHmm'); hfBuild(); refreshAll(); renderTabs(); }
    };

    /* 最近文件 (localStorage) */
    function loadRecent(){
      try{ return JSON.parse(localStorage.getItem('myexcel.recent')||'[]'); }
      catch(e){ return []; }
    }
    function saveRecent(name, size){
      let list = loadRecent().filter(r=>r.name!==name);
      list.unshift({ name, size, ts: Date.now() });
      localStorage.setItem('myexcel.recent', JSON.stringify(list.slice(0,5)));
    }
    window.openTemplateGallery = function(){
      openModal('modalTemplates');
      const html = Object.entries(TEMPLATES).map(([k,v])=>{
        const s = v();
        const nm = s ? s.name : '空白工作簿';
        return `<div class="tpl-card" data-tpl="${k}" style="border:1px solid #ddd;border-radius:4px;padding:8px;cursor:pointer;margin:4px;display:inline-block;width:120px;text-align:center">📄<div style="margin-top:4px;font-weight:600">${nm}</div></div>`;
      }).join('');
      $('tplGallery').innerHTML = html;
      $('tplGallery').querySelectorAll('[data-tpl]').forEach(el=>{
        el.onclick = ()=>{ useTemplate(el.dataset.tpl); closeModal('modalTemplates'); };
      });
      const recent = loadRecent();
      $('tplRecent').innerHTML = recent.length ? recent.map((r,i)=>`<div data-r="${i}" style="padding:4px;border-bottom:1px solid #eee;cursor:pointer">📂 ${esc(r.name)} · ${(r.size/1024).toFixed(1)} KB · ${dayjs(r.ts).fromNow ? dayjs(r.ts).fromNow() : ''}</div>`).join('') : '<i>暂无最近文件</i>';
    };

    /* 自动记录最近文件 */
    MX.plug.on('fileOpen', (name, buf)=> saveRecent(name, buf.byteLength));

    MX.plug.addRibbon({ group:'file', label:'模板…', icon:'📑', fn: openTemplateGallery });

    console.log('[templates] '+Object.keys(TEMPLATES).length+' templates registered');
  }
});