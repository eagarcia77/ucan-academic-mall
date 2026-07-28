'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const files = {
  server:path.join(root, 'lib/world-sync-v308.js'),
  preloader:path.join(root, 'auth-compat-v308-world.js'),
  client:path.join(root, 'public/js/ucan_v308_cross_environment_interaction.js'),
  presence:path.join(root, 'public/js/ucan_v307_presence_xr_bridge.js'),
  voice:path.join(root, 'public/js/ucan_v306_voice_xr_bridge.js'),
  loader:path.join(root, 'public/js/ucan_v266_keyboard_jump.js'),
  docker:path.join(root, 'Dockerfile'),
  package:path.join(root, 'package.json')
};

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
const pkg = JSON.parse(text.package);
const voiceLoaderBlock = text.loader.match(/function loadVoiceBridgeV306\(\)\s*\{[\s\S]*?\n  \}/)?.[0] || '';
const checks = {
  serverSyntax:true,
  preloaderSyntax:true,
  clientSyntax:true,
  endpointConfig:text.server.includes('/api/world-v308/config'),
  endpointEvents:text.server.includes('/api/world-v308/events'),
  endpointPost:text.server.includes('/api/world-v308/event'),
  authenticatedServer:text.preloader.includes('sessionUser(req)'),
  browserToVr:text.server.includes('browserToVr:true') && text.client.includes('browserToVrInteraction:true'),
  vrToBrowser:text.server.includes('vrToBrowser:true') && text.client.includes('vrToBrowserInteraction:true'),
  sameScene:text.client.includes('oneBabylonScene:true') && text.client.includes('sharedSceneInstance'),
  presenceV307:text.client.includes('__UCAN_PRESENCE_XR_V307__'),
  voiceV306:text.client.includes('__UCAN_VOICE__'),
  chat:text.server.includes("'chat'") && text.client.includes("sendEvent('chat'"),
  gestures:text.server.includes("'gesture'") && text.client.includes("sendEvent('gesture'"),
  reactions:text.server.includes("'reaction'") && text.client.includes("sendEvent('reaction'"),
  sharedFocus:text.server.includes("'focus'") && text.client.includes("sendEvent('focus'"),
  objectState:text.server.includes("'object-state'") && text.client.includes('shareObjectState'),
  vrGripControls:/squeeze\|grip/.test(text.client),
  remoteAvatarGesture:text.client.includes('presenceClientIdV307') && text.client.includes('avatar-brazo-d'),
  speechBubble:text.client.includes('burbuja interacción V308'),
  focusMarker:text.client.includes('anillo foco V308'),
  loaderIncludesV308:text.loader.includes('/js/ucan_v308_cross_environment_interaction.js?build=V308-20260728-SINGLE-SCENE-CROSS-ENV-INTERACTION'),
  loaderOrder:voiceLoaderBlock.includes("runtime.addEventListener('load', loadCrossEnvironmentV308") && voiceLoaderBlock.includes('else loadCrossEnvironmentV308()'),
  dockerStartsV308:text.docker.includes('auth-compat-v308-world.js'),
  packageStartsV308:String(pkg.scripts?.start || '').includes('auth-compat-v308-world.js'),
  packageChecksV308:String(pkg.scripts?.check || '').includes('ucan_v308_cross_environment_interaction.js') && String(pkg.scripts?.check || '').includes('world-sync-v308.js'),
  packageAuditsV308:String(pkg.scripts?.test || '').includes('audit:cross-environment-v308')
};

for (const [name, source] of [['server', text.server], ['preloader', text.preloader], ['client', text.client]]) {
  try { new Function(source); }
  catch (error) {
    checks[`${name}Syntax`] = false;
    checks[`${name}SyntaxError`] = error.message;
  }
}

const failed = Object.entries(checks).filter(([, value]) => value !== true);
const report = {
  version:'V308',
  build:'V308-20260728-SINGLE-SCENE-CROSS-ENV-INTERACTION',
  ok:failed.length === 0,
  checks,
  failed:failed.map(([name, value]) => ({ name, value }))
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
