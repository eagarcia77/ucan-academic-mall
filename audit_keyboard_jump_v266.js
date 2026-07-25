const fs=require('fs');
const main=fs.readFileSync('public/js/ucan_v266_keyboard_jump.js','utf8');
const html=fs.readFileSync('public/campus.html','utf8');
const legacyLoader=/ucan_v266_keyboard_jump\.js\?build=V272-20260717-XR-DESKTOP-PARITY-SPEED/.test(html);
const questR2Loader=/ucan_v266_keyboard_jump\.js\?build=V304-20260724-QUEST-R2-LOADER/.test(html);
const questR3Loader=/ucan_v266_keyboard_jump\.js\?build=V304-20260724-QUEST-R3-NONBLOCKING-LOADER/.test(html);
const questLoader=questR2Loader||questR3Loader;
const checks={
  moduleLoaded:legacyLoader||questLoader,
  questR3RuntimeValid:!questLoader||/ucan_v304_quest_visual_entry_r3\.js\?build=V304-20260724-QUEST-VR-NONBLOCKING-R3/.test(main),
  oldQuestRuntimeInactive:!/ucan_v304_quest_visual_entry_r2\.js/.test(main),
  formProtection:/isTextEntryTarget/.test(main)&&/event\.stopPropagation/.test(main),
  wasdProtected:/KeyW/.test(main)&&/KeyA/.test(main)&&/KeyS/.test(main)&&/KeyD/.test(main),
  jumpEnabled:/event\.code === 'Space'/.test(main)&&/JUMP_HEIGHT/.test(main)&&/updateJump/.test(main),
  noInputPreventDefault:/if \(controlsAreBlocked\(event\)\)/.test(main)
};
const ok=Object.values(checks).every(Boolean);
console.log(JSON.stringify({ok,version:'V266',checks,loader:{legacyLoader,questR2Loader,questR3Loader}},null,2));
if(!ok)process.exit(1);
