
(()=>{
 const isHost=!!document.getElementById('connect');
 const channel=new EventSource('/api/events');
 let applying=false,initial=true;
 channel.onmessage=e=>{try{
  const incoming=JSON.parse(e.data);
  if(isHost&&initial){initial=false;return}
  applying=true;state=incoming;render();applying=false;
 }catch(err){applying=false}};
 if(!isHost)return;
 const keyName='shabba_admin_key';
 let key=sessionStorage.getItem(keyName);
 if(!key){key=prompt('أدخل مفتاح إدارة الموقع ADMIN_KEY (من إعدادات الاستضافة):')||'';if(key)sessionStorage.setItem(keyName,key)}
 const previous=publish;
 publish=function(){previous();if(applying||!key)return;
  fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Key':key},body:JSON.stringify(state)}).catch(()=>{});
 };
})();
