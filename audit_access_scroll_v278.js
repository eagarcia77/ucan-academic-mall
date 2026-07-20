const fs=require('fs');
const login=fs.readFileSync('public/login.html','utf8');
const access=fs.readFileSync('public/js/ucan_v278_scroll_direct_access.js','utf8');
const compat=fs.readFileSync('auth-compat-v271.js','utf8');
const checks={
  layerBuild:/V278-20260720-SCROLL-DIRECT-AVATAR-ACCESS/.test(access),
  currentServerBuild:/V282-20260720-QUEST-BROWSER-ONE-WAY-ESCALATOR-PARITY/.test(compat),
  noPasswordRedirect:!/campus\?password=change/.test(login),
  avatarDirectLogin:/avatarReady\?['"]\/campus['"]:['"]\/campus\?avatar=1['"]/.test(login),
  serverClearsGate:/avatarReady && user\.forcePasswordChange === true/.test(compat)&&/user\.forcePasswordChange = false/.test(compat),
  profileScroller:/scrollTarget\('profile'\)/.test(access),
  boardScroller:/scrollTarget\('board'\)/.test(access),
  liveScroller:/scrollTarget\('live'\)/.test(access),
  skyScroller:/scrollTarget\('sky'\)/.test(access),
  visibleScrollbar:/scrollbar-width:auto/.test(access)&&/::-webkit-scrollbar/.test(access),
  upDownButtons:/↑ Subir/.test(access)&&/↓ Bajar/.test(access),
  gamepadScrolling:/navigator\.getGamepads/.test(access)&&/gamepadScrolling:true/.test(access),
  touchScrolling:/touch-action:pan-y/.test(access)&&/-webkit-overflow-scrolling:touch/.test(access),
  directAvatarGuard:/directAccessWhenAvatarConfigured:true/.test(access)&&/user\.avatarConfigured = true/.test(access),
  loadedByCampus:/UCAN_SCROLL_ACCESS_SCRIPT/.test(compat)&&/studioWithRollbackAndScroll/.test(compat)
};
const ok=Object.values(checks).every(Boolean);
console.log(JSON.stringify({ok,layerVersion:'V278',serverVersion:'V282',checks},null,2));
if(!ok)process.exit(1);
