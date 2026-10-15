'use strict';
(()=>{
const status=document.getElementById('tiktokStatus');if(!status)return;
const key=()=>sessionStorage.getItem('shabba_admin_key')||'';
const events=new EventSource('/api/tiktok/events');
events.onmessage=e=>{try{const x=JSON.parse(e.data);if(x.type==='status')status.textContent=x.status;if(x.type==='chat'&&typeof receive==='function')receive(x.name,x.msg,'tiktok')}catch(err){console.warn(err)}};
events.onerror=()=>{status.textContent='انقطع اتصال تحديثات TikTok بالخادم'};
async function call(path,body){const response=await fetch('/api/tiktok/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Key':key()},body:JSON.stringify(body||{})});const data=await response.json().catch(()=>({error:'تعذر قراءة رد الخادم'}));if(!response.ok)throw Error(data.error||'فشل الاتصال');return data;}
document.getElementById('tiktokConnect').onclick=async()=>{const username=document.getElementById('tiktokChannel').value.trim().replace(/^@/,'');status.textContent='جارٍ الاتصال بالبث...';try{await call('connect',{username})}catch(e){status.textContent=e.message}};
document.getElementById('tiktokDisconnect').onclick=async()=>{try{await call('disconnect')}catch(e){status.textContent=e.message}};
})();
