const fs=require('fs');
const main=fs.readFileSync('public/js/ucan_v266_keyboard_jump.js','utf8');
const html=fs.readFileSync('public/campus.html','utf8');
const checks={
  moduleLoaded:/ucan_v266_keyboard_jump\.js\?build=V271-20260717-XR-PARITY-FLOOR-LOCK/.test(html),
  formProtection:/isTextEntryTarget/.test(main)&&/event\.stopPropagation/.test(main),
  wasdProtected:/KeyW/.test(main)&&/KeyA/.test(main)&&/KeyS/.test(main)&&/KeyD/.test(main),
  jumpEnabled:/event\.code === 'Space'/.test(main)&&/JUMP_HEIGHT/.test(main)&&/updateJump/.test(main),
  noInputPreventDefault:/if \(controlsAreBlocked\(event\)\)/.test(main)
};
const ok=Object.values(checks).every(Boolean);
console.log(JSON.stringify({ok,version:'V266',checks},null,2));
if(!ok)process.exit(1);
