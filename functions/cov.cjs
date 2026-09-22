const admin=require('firebase-admin');admin.initializeApp({projectId:'drape-9e532'});
admin.firestore().collection('items').get().then(s=>{
  let n=0,cut=0,orig=0,neither=0,proc=0;
  s.forEach(d=>{const x=d.data();n++;
    if(x.croppedUrl)cut++; else if(x.originalUrl)orig++; else neither++;
    if(x.status==='processing'||x.status==='uploading')proc++;});
  console.log(`전체 아이템        ${n}`);
  console.log(`croppedUrl 있음    ${cut}  (${Math.round(100*cut/n)}%)  ← 비소유자가 볼 수 있음`);
  console.log(`원본만 있음        ${orig}  (${Math.round(100*orig/n)}%)  ← 비소유자에겐 빈 화면`);
  console.log(`사진 없음          ${neither}`);
  console.log(`처리중             ${proc}`);
  process.exit(0);
});
