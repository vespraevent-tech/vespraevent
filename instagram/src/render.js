const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const {posts,css}=require('./posts.js');
(async()=>{const b=await chromium.launch();const out=path.resolve(__dirname,'..');
for(const [name,slides] of Object.entries(posts)){fs.mkdirSync(path.join(out,name),{recursive:true});
 for(let i=0;i<slides.length;i++){const html=`<!doctype html><meta charset="utf-8"><style>${css}</style><body>${slides[i](i+1,slides.length)}</body>`;
  fs.writeFileSync(path.join(__dirname,'tmp.html'),html);
  const p=await b.newPage({viewport:{width:1080,height:1350}});await p.goto('file://'+path.join(__dirname,'tmp.html'));await p.waitForTimeout(1500);
  await p.screenshot({path:path.join(out,name,`${String(i+1).padStart(2,'0')}.png`)});await p.close();}}
await b.close();console.log('ok')})();
