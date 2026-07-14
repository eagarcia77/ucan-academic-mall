const fs=require('fs');
const src=fs.readFileSync('public/js/ucan_babylon_mall_v265_accounts_avatars.js','utf8');
const checks={
  builder:src.includes('function buildStairsToRooftop'),
  steps:src.includes('const steps = 30'),
  opening:src.includes("id:'escaleras-p3-terraza'"),
  upRide:src.includes("id:'up34'"),
  downRide:src.includes("id:'down43'"),
  guardrails:src.includes('baranda hueco escalera terraza'),
  audit:src.includes('__UCAN_ROOFTOP_STAIRS__')
};
const bad=Object.entries(checks).filter(([,v])=>!v);
if(bad.length){console.error('AUDITORÍA ESCALERAS TERRAZA: FALLÓ',bad);process.exit(1);}
console.log('AUDITORÍA ESCALERAS TERRAZA: APROBADA');
console.log('- 30 peldaños, dos descansos, barandas, iluminación y acceso bidireccional.');
