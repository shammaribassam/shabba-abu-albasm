
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {handler:tiktokHandler}=require('./tiktok-server');
const {handler:kickHandler}=require('./kick-server');

const root=__dirname,port=Number(process.env.PORT||3000),clients=new Set();
let snapshot=null;
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.txt':'text/plain; charset=utf-8'};

function send(res,status,body,type='text/plain; charset=utf-8'){
 res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});
 res.end(body);
}

http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');

 if(url.pathname==='/health')return send(res,200,'ok');

 if(tiktokHandler(req,res,url,send))return;
 if(kickHandler(req,res,url,send))return;

 if(url.pathname==='/api/events'){
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
  clients.add(res);
  res.write(': connected\n\n');
  if(snapshot)res.write('data: '+JSON.stringify(snapshot)+'\n\n');
  req.on('close',()=>clients.delete(res));
  return;
 }

 if(url.pathname==='/api/state'&&req.method==='POST'){
  const expected=process.env.ADMIN_KEY;
  if(!expected||req.headers['x-admin-key']!==expected)return send(res,403,'Admin key required');

  let chunks=[],bytes=0;
  req.on('data',c=>{
   bytes+=c.length;
   if(bytes>1000000){req.destroy();return}
   chunks.push(c);
  });

  req.on('end',()=>{
   try{
    const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!data||!['gaming','anime','series','football','countries'].includes(data.category))return send(res,400,'Invalid state');

    snapshot=data;
    for(const client of clients){
     try{
      client.write('data: '+JSON.stringify(snapshot)+'\n\n');
     }catch(e){
      clients.delete(client);
     }
    }
    send(res,200,'ok');
   }catch(e){
    send(res,400,'Invalid JSON');
   }
  });
  return;
 }

 if(req.method!=='GET')return send(res,405,'Method not allowed');

 let rel;
 try{
  rel=decodeURIComponent(url.pathname);
 }catch{
  return send(res,400,'Bad path');
 }

 if(rel==='/')rel='/index.html';
 if(!/^\/[\w.\/-]+$/.test(rel)||rel.includes('..'))return send(res,403,'Forbidden');

 const file=path.join(root,rel);
 if(!file.startsWith(root+path.sep))return send(res,403,'Forbidden');

 fs.readFile(file,(err,buf)=>
  err?send(res,404,'Not found'):send(res,200,buf,types[path.extname(file)]||'application/octet-stream')
 );
}).listen(port,'0.0.0.0',()=>console.log('Shabba cloud running on '+port));
