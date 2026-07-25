const fs=require('fs');
const main=fs.readFileSync('public/js/ucan_v266_keyboard_jump.js','utf8');
const html=fs.readFileSync('public/campus.html','utf8');
const preloader=fs.readFileSync('auth-compat-v304-r4.js','utf8');
const legacyLoader=/ucan_v266_keyboard_jump\.js\?build=V272-20260717-XR-DESKTOP-PARITY-SPEED/.test(html);
const sourceV304Loader=/ucan_v266_keyboard_jump\.js\?build=V304-[^"']+/.test(html);
const runtimeR4=/ucan_v304_quest_glass_rails_holiday_r4\.js\?build=V304-20260725-QUEST-GLASS-RAILS-HOLIDAY-R4/.test(main);
const preloaderR4=/V304-20260725-QUEST-R4-LOADER/.test(preloader);
const checks={
  moduleLoaded:legacyLoader||sourceV304Loader,
  questR4RuntimeValid:runtimeR4,
  runtimeCacheBust:preloaderR4,
  oldQuestRuntimeInactive:!/ucan_v304_quest_visual_entry_r[23]\.js\?build=/.test(main),
  formProtection:/isTextEntryTarget/.test(main)&&/event\.stopPropagation/.test(main),
  wasdProtected:/KeyW/.test(main)&&/KeyA/.test(main)&&/KeyS/.test(main)&&/KeyD/.test(main),
  jumpEnabled:/event\.code === 'Space'/.test(main)&&/JUMP_HEIGHT/.test(main)&&/updateJump/.test(main),
  noInputPreventDefault:/if \(controlsAreBlocked\(event\)\)/.test(main)
};
const ok=Object.values(checks).every(Boolean);
console.log(JSON.stringify({ok,version:'V266',checks,loader:{legacyLoader,sourceV304Loader,runtimeR4,preloaderR4}},null,2));
if(!ok)process.exit(1);
