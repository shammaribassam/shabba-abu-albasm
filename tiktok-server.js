'use strict';
// Server-side TikTok LIVE bridge. An active LIVE is required.
const {TikTokLiveConnection}=require('tiktok-live-connector');
let connection=null, channel='', status='غير متصل';
const listeners=new Set();
function broadcast(event){for(const res of listeners){try{res.write('data: '+JSON.stringify(event)+'\n\n')}catch{listeners.delete(res)}}}
function events(req,res){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});listeners.add(res);res.write('data: '+JSON.stringify({type:'status',status,channel})+'\n\n');req.on('close',()=>listeners.delete(res));}
async function stop(){const old=connection;connection=null;channel='';status='غير متصل';if(old){try{old.disconnect()}catch{}}broadcast({type:'status',status,channel});}
async function start(username){if(!/^[\w.]{2,32}$/.test(username))throw Error('اسم مستخدم غير صالح');await stop();channel=username;status='جارٍ الاتصال';broadcast({type:'status',status,channel});const conn=new TikTokLiveConnection(username,{processInitialData:false});connection=conn;
conn.on('chat',data=>{if(connection!==conn)return;const name=data.uniqueId||data.user?.uniqueId||data.nickname||'مشارك';const msg=data.comment;if(typeof msg==='string')broadcast({type:'chat',name,msg,platform:'tiktok'});});
conn.on('disconnected',()=>{if(connection===conn){status='انقطع الاتصال';broadcast({type:'status',status,channel})}});
conn.on('error',err=>{if(connection===conn){status='خطأ: '+String(err.message||err).slice(0,140);broadcast({type:'status',status,channel})}});
try{await conn.connect();if(connection===conn){status='متصل ببث @'+username;broadcast({type:'status',status,channel})}}catch(err){if(connection===conn){status='تعذر الاتصال: '+String(err.message||err).slice(0,140);broadcast({type:'status',status,channel})}throw err;}}
function handler(req,res,url,send){if(url.pathname==='/api/tiktok/events'&&req.method==='GET'){events(req,res);return true}if(url.pathname!=='/api/tiktok/connect'&&url.pathname!=='/api/tiktok/disconnect')return false;if(req.method!=='POST'){send(res,405,'Method not allowed');return true}const expected=process.env.ADMIN_KEY;if(!expected||req.headers['x-admin-key']!==expected){send(res,403,'Admin key required');return true}if(url.pathname.endsWith('/disconnect')){stop().then(()=>send(res,200,'{"ok":true}','application/json'));return true}let body='';req.on('data',chunk=>{body+=chunk;if(body.length>1000)req.destroy()});req.on('end',async()=>{try{const username=String(JSON.parse(body).username||'').replace(/^@/,'').trim();await start(username);send(res,200,JSON.stringify({ok:true,status}),'application/json')}catch(err){send(res,422,JSON.stringify({ok:false,error:String(err.message||err)}),'application/json')}});return true;}
module.exports={handler};
