'use strict';

const fs = require('fs');
const path = require('path');
const root = __dirname;
const files = {
  frontend:path.join(root, 'public/js/ucan_v240_voice.js'),
  bridge:path.join(root, 'public/js/ucan_v306_voice_xr_bridge.js'),
  loader:path.join(root, 'public/js/ucan_v323_social_loader.js'),
  backend:path.join(root, 'lib/voice-signaling.js'),
  parallelPreloader:path.join(root, 'auth-compat-v313-parallel.js'),
  upperPreloader:path.join(root, 'auth-compat-v323-browser-panel.js'),
  campus:path.join(root, 'public/campus.html'),
  docker:path.join(root, 'Dockerfile'),
  package:path.join(root, 'package.json')
};
const text = Object.fromEntries(Object.entries(files).map(([key,file]) => [key, fs.readFileSync(file, 'utf8')]));
const pkg = JSON.parse(text.package);
const rooms = ['SV-201','SV-202','SV-203','SV-204','SV-205','ANF-301'];
const forbiddenVisualChain = [
  "require('./auth-compat-v304-r6.js')","require('./auth-compat-v306-voice.js')",
  "require('./auth-compat-v307-presence.js')","require('./auth-compat-v308-world.js')",
  "require('./auth-compat-v309-parity.js')","require('./auth-compat-v311-unified.js')",
  "require('./auth-compat-v312-vr-canonical.js')"
];
const startsThroughParallelVoice = text.upperPreloader.includes("require('./auth-compat-v313-parallel.js')");
const checks = {
  frontendSyntax:true,bridgeSyntax:true,loaderSyntax:true,backendSyntax:true,parallelPreloaderSyntax:true,upperPreloaderSyntax:true,
  voiceScriptLoaded:text.campus.includes('/js/ucan_v240_voice.js'),
  voiceBridgeLoaded:/\/js\/ucan_v306_voice_xr_bridge\.js\?build=V32[34]-20260730-SHARED-VOICE-R2[78]/.test(text.loader),
  allRoomsInFrontend:rooms.every(room => text.frontend.includes(`'${room}'`)),
  allRoomsInBridge:rooms.every(room => text.bridge.includes(`'${room}'`)),
  allRoomsInBackend:rooms.every(room => text.backend.includes(`'${room}'`)),
  allRoomsInParallelPreloader:rooms.every(room => text.parallelPreloader.includes(`'${room}'`)),
  microphoneCapture:/navigator\.mediaDevices\.getUserMedia/.test(text.frontend),
  microphoneDiagnostic:/async function testMicrophone/.test(text.bridge),
  echoCancellation:/echoCancellation:true/.test(text.frontend),noiseSuppression:/noiseSuppression:true/.test(text.frontend),autoGainControl:/autoGainControl:true/.test(text.frontend),
  webRtcPeerConnection:/new RTCPeerConnection/.test(text.frontend),outgoingTracks:/pc\.addTrack/.test(text.frontend),incomingTracks:/pc\.ontrack/.test(text.frontend),
  remoteAudioPlayback:/audio\.srcObject\s*=\s*stream/.test(text.frontend) && /audio\.play\(\)/.test(text.frontend),
  perParticipantVolume:/personalVolumes/.test(text.frontend),
  roomIsolationFrontend:/currentRoom/.test(text.frontend) && /ROOM_BOUNDS/.test(text.frontend),
  roomIsolationBackend:/target\.room !== source\.room/.test(text.backend),
  xrUsesRealCameraPosition:/xr\?\.globalPosition/.test(text.bridge) && /scene\?\.activeCamera\?\.globalPosition/.test(text.bridge),
  xrAutomaticRoomSwitch:/joinRoom\?\./.test(text.bridge) && /selectRoom\?\./.test(text.bridge),
  sseSignaling:/text\/event-stream/.test(text.backend) && /peer-joined/.test(text.backend),queuedSignals:/client\.queue\.push/.test(text.backend),
  heartbeat:/api\/voice\/heartbeat/.test(text.frontend) && /handleHeartbeat/.test(text.backend),
  roomLimit:/VOICE_ROOM_LIMIT/.test(text.parallelPreloader) && /roomLimit/.test(text.backend),
  stunConfigured:/stun:stun\.l\.google\.com:19302/.test(text.backend),
  turnEnvironmentSupported:/VOICE_TURN_URLS/.test(text.backend) && /VOICE_TURN_USERNAME/.test(text.backend) && /VOICE_TURN_CREDENTIAL/.test(text.backend),
  authenticationRequired:/Inicie sesión para usar el audio/.test(text.backend),
  voiceCreatedDirectly:/createVoiceSystem/.test(text.parallelPreloader) && /loadIceServersFromEnvironment/.test(text.parallelPreloader),
  cleanParallelPreloader:text.parallelPreloader.includes("require('./auth-compat-v271.js')") && forbiddenVisualChain.every(item => !text.parallelPreloader.includes(item)),
  v324PreservesParallelVoice:startsThroughParallelVoice,
  packageStartsVoiceStack:String(pkg.scripts?.start || '').includes('auth-compat-v323-browser-panel.js') && startsThroughParallelVoice,
  dockerUsesVoiceStack:text.docker.includes('auth-compat-v323-browser-panel.js') && startsThroughParallelVoice,
  packageChecksVoiceFiles:String(pkg.scripts?.check || '').includes('lib/voice-signaling.js') && String(pkg.scripts?.check || '').includes('auth-compat-v313-parallel.js') && String(pkg.scripts?.check || '').includes('ucan_v306_voice_xr_bridge.js'),
  packageRunsVoiceAudit:String(pkg.scripts?.test || '').includes('audit:voice-v306')
};
for (const [name,code] of [['frontendSyntax',text.frontend],['bridgeSyntax',text.bridge],['loaderSyntax',text.loader],['backendSyntax',text.backend],['parallelPreloaderSyntax',text.parallelPreloader],['upperPreloaderSyntax',text.upperPreloader]]) {
  try { new Function(code); }
  catch (error) { checks[name]=false; checks[`${name}Error`]=error.message; }
}
const failures=Object.entries(checks).filter(([,value])=>value!==true);
const report={version:'V324',voiceLayer:'V313/V306',feature:'Audio WebRTC compartido en browser, móvil, VR y MR',architecture:'V324 XR parent rig over V323 panel and clean parallel voice preloader',ok:failures.length===0,rooms,checks,failures:failures.map(([name,value])=>({name,value}))};
console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exitCode=1;