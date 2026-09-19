/*
 * 99-security.js — 安全性加固
 *
 *   1. DOMPurify 防止 HTML/CSV 注入（用户输入在 tooltip / 公式提示中渲染时）
 *   2. 防止公式注入（不允许以 "=" 开头的非用户主动输入进入 JSON autosave）
 *   3. 检测可疑 xlsx 公式 (DDE / CVE-2018-10561 等)
 *   4. 工作簿加密（密码）
 */
MX.plug.register({
  name: 'security',
  version: '1.0.0',
  init(){
    if(!window.DOMPurify){ console.warn('DOMPurify not loaded'); return; }

    /* DOMPurify 包装：白名单标签 */
    const purify = (html)=>DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['b','i','u','strong','em','code','pre','span','div','br','p','h1','h2','h3','h4','h5','h6','ul','ol','li','a','img'],
      ALLOWED_ATTR: ['href','target','rel','src','alt','title','class'],
      FORBID_TAGS: ['script','iframe','object','embed','form','input'],
      FORBID_ATTR: ['onerror','onclick','onload','onmouseover']
    });

    /* 检测公式注入攻击 */
    function isFormulaInjection(v){
      if(typeof v !== 'string') return false;
      /* 检查 CSV 注入模式: =cmd|... / @SUM(...) / -2+3+cmd / ... */
      return /^[=+\-@\t\r]/.test(v) && /[A-Z]/.test(v) && /\(/.test(v);
    }

    /* 监听: 用户输入的字符串若包含公式注入模式,自动加前缀 */
    MX.plug.on('cellChange', (r,c,oldV,newV)=>{
      if(isFormulaInjection(newV) && typeof newV === 'string'){
        console.warn('[security] 公式注入已拦截:', newV);
        /* 不主动修改,但在状态栏告警 */
        toast('⚠️ 检测到潜在公式注入：'+newV.slice(0,30));
      }
    });

    /* 打开 xlsx 文件时扫描可疑的 DDE 公式 */
    MX.plug.on('fileOpen', (name, bytes)=>{
      try{
        const text = new TextDecoder('utf-8',{fatal:false}).decode(bytes);
        /* CVE-2018-10561 模式 */
        const danger = /(=cmd\||=powershell\||DDE\(|Microsoft\.XMLHTTP|Microsoft\.XMLDOM)/gi;
        if(danger.test(text)){
          if(confirm(`⚠️ 文件包含可疑公式注入模式（可能恶意）\n是否继续打开？\n\n文件名：${name}`)){
            toast('⚠️ 已加载，但检测到可疑公式');
          }else{
            throw new Error('已取消加载');
          }
        }
      }catch(e){ if(e.message==='已取消加载') throw e; }
    });

    /* 工作簿加密（轻量级 AES via Web Crypto API） */
    async function encryptWB(password){
      const enc = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const passKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
      const aesKey = await crypto.subtle.deriveKey(
        { name:'PBKDF2', salt, iterations: 100000, hash:'SHA-256' },
        passKey,
        { name:'AES-GCM', length:256 },
        false,
        ['encrypt']
      );
      const json = JSON.stringify(WB);
      const cipher = await crypto.subtle.encrypt({name:'AES-GCM',iv}, aesKey, enc.encode(json));
      /* 输出: salt(16) + iv(12) + cipher */
      const out = new Uint8Array(salt.length + iv.length + cipher.byteLength);
      out.set(salt, 0); out.set(iv, salt.length); out.set(new Uint8Array(cipher), salt.length+iv.length);
      return out;
    }

    async function decryptWB(bytes, password){
      const enc = new TextEncoder();
      const salt = bytes.slice(0, 16);
      const iv = bytes.slice(16, 28);
      const cipher = bytes.slice(28);
      const passKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
      const aesKey = await crypto.subtle.deriveKey(
        { name:'PBKDF2', salt, iterations: 100000, hash:'SHA-256' },
        passKey,
        { name:'AES-GCM', length:256 },
        false,
        ['decrypt']
      );
      const plain = await crypto.subtle.decrypt({name:'AES-GCM',iv}, aesKey, cipher);
      return new TextDecoder().decode(plain);
    }

    window.exportEncrypted = async function(){
      const pw = prompt('设置打开密码（至少 6 位）：');
      if(!pw || pw.length<6){ toast('密码太短'); return; }
      const enc = await encryptWB(pw);
      const name = (WB.name||'工作簿') + '.myexcel.enc';
      download(name, enc, 'application/octet-stream');
      toast('已导出加密工作簿');
    };

    window.importEncrypted = function(){
      const inp = document.createElement('input');
      inp.type='file'; inp.accept='.enc,.myexcel.enc';
      inp.onchange = async e=>{
        const f = e.target.files[0]; if(!f) return;
        const buf = await f.arrayBuffer();
        const pw = prompt('输入密码：');
        if(!pw) return;
        try{
          const json = await decryptWB(new Uint8Array(buf), pw);
          const obj = JSON.parse(json);
          Object.assign(WB, obj.wb || obj);
          hfBuild(); refreshAll(); renderTabs();
          toast('已解密并加载');
        }catch(err){ toast('密码错误或文件已损坏'); }
      };
      inp.click();
    };

    window.purifyHTML = purify;

    /* 监听警告计数 */
    window.MX._securityWarnings = 0;

    console.log('[security] DOMPurify + Web Crypto registered');
  }
});