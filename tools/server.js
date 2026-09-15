const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','outputs');
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);
  if(p==='/')p='/index.html';
  fs.readFile(path.join(root,p),(err,data)=>{
    // index.html 自带内联图标，favicon 404 只会在每次开页时往控制台吐一行噪音
    if(err){
      if(p==='/favicon.ico'){res.writeHead(204);return res.end();}
      res.writeHead(404);return res.end('not found');
    }
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    res.end(data);
  });
}).listen(4321,()=>console.log('serving on http://localhost:4321'));
