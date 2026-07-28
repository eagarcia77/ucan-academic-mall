'use strict';
const fs=require('fs');
const read=p=>{if(!fs.existsSync(p))throw new Error(`Falta ${p}`);return fs.readFileSync(p,'utf8');};
const runtime=read('public/js/ucan_v305_floor1_terrace_vr_r8.js');
const loader=read('public/js/ucan_v266_keyboard_jump.js');
const pkg=JSON.parse(read('package.json'));
const checks=[
 ['runtime R8',/revision:'R8'/.test(runtime)&&/FLOOR1-UPRIGHT-TERRACE-JOYSTICK-R8/.test(runtime)],
 ['piso 1 sin inversión Y',/r\.texture\.update\(false\)/.test(runtime)],
 ['piso 1 dos caras frontales',/sideOrientation:B\.Mesh\.FRONTSIDE/.test(runtime)&&/face\(r,'frente',0\)/.test(runtime)&&/face\(r,'reverso',Math\.PI\)/.test(runtime)],
 ['billboard desactivado',/BILLBOARDMODE_NONE/.test(runtime)],
 ['planetas de terraza incluidos',/celestialId/.test(runtime)&&/terracePlanets:true/.test(runtime)],
 ['letreros de terraza incluidos',/terraceSigns:true/.test(runtime)],
 ['joystick por evento',/xr-standard-thumbstick/.test(runtime)&&/onButtonStateChangedObservable/.test(runtime)],
 ['joystick por gamepad',/buttons\?\.\[3\]\?\.pressed/.test(runtime)],
 ['gatillo y A X',/xr-standard-trigger/.test(runtime)&&/a-button/.test(runtime)&&/x-button/.test(runtime)],
 ['panel VR sin inversión',/state\.infoTex\.update\(false\)/.test(runtime)],
 ['API diagnóstica R8',/__UCAN_VR_INTERACTION_V305_R8__/.test(runtime)],
 ['loader carga R8 después de R7',/loadVrSignsR7[\s\S]*loadFloor1TerraceR8/.test(loader)],
 ['package check R8',String(pkg.scripts?.check||'').includes('public/js/ucan_v305_floor1_terrace_vr_r8.js')],
 ['package audit R8',pkg.scripts?.['audit:floor1-terrace-v305-r8']==='node verify_floor1_terrace_vr_v305_r8.js'],
 ['package test R8',String(pkg.scripts?.test||'').includes('audit:floor1-terrace-v305-r8')]
];
let fail=0;for(const [n,ok] of checks){console.log(`${ok?'OK':'FALLO'}: ${n}`);if(!ok)fail++;}
if(fail){console.error(`Auditoría R8 falló con ${fail} problema(s).`);process.exit(1);}console.log('Auditoría V305 R8 completada correctamente.');
