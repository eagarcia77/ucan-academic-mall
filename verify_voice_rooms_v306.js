'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const frontendPath = path.join(root, 'public/js/ucan_v240_voice.js');
const bridgePath = path.join(root, 'public/js/ucan_v306_voice_xr_bridge.js');
const loaderPath = path.join(root, 'public/js/ucan_v266_keyboard_jump.js');
const backendPath = path.join(root, 'lib/voice-signaling.js');
const preloaderPath = path.join(root, 'auth-compat-v313-parallel.js');
const campusPath = path.join(root, 'public/campus.html');
const dockerPath = path.join(root, 'Dockerfile');
const packagePath = path.join(root, 'package.json');

const frontend = fs.readFileSync(frontendPath, 'utf8');
const bridge = fs.readFileSync(bridgePath, 'utf8');
const loader = fs.readFileSync(loaderPath, 'utf8');
const backend = fs.readFileSync(backendPath, 'utf8');
const preloader = fs.readFileSync(preloaderPath, 'utf8');
const campus = fs.readFileSync(campusPath, 'utf8');
const docker = fs.readFileSync(dockerPath, 'utf8');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const rooms = ['SV-201', 'SV-202', 'SV-203', 'SV-204', 'SV-205', 'ANF-301'];
const forbiddenVisualChain = [
  "require('./auth-compat-v304-r6.js')",
  "require('./auth-compat-v306-voice.js')",
  "require('./auth-compat-v307-presence.js')",
  "require('./auth-compat-v308-world.js')",
  "require('./auth-compat-v309-parity.js')",
  "require('./auth-compat-v311-unified.js')",
  "require('./auth-compat-v312-vr-canonical.js')"
];

const checks = {
  frontendSyntax:true,
  bridgeSyntax:true,
  loaderSyntax:true,
  backendSyntax:true,
  preloaderSyntax:true,
  voiceScriptLoaded:campus.includes('/js/ucan_v240_voice.js'),
  voiceBridgeLoaded:loader.includes('/js/ucan_v306_voice_xr_bridge.js?build=V313-20260729-PARALLEL-VOICE-R17'),
  allRoomsInFrontend:rooms.every(room => frontend.includes(`'${room}'`)),
  allRoomsInBridge:rooms.every(room => bridge.includes(`'${room}'`)),
  allRoomsInBackend:rooms.every(room => backend.includes(`'${room}'`)),
  allRoomsInParallelPreloader:rooms.every(room => preloader.includes(`'${room}'`)),
  microphoneCapture:/navigator\.mediaDevices\.getUserMedia/.test(frontend),
  microphoneDiagnostic:/async function testMicrophone/.test(bridge),
  echoCancellation:/echoCancellation:true/.test(frontend),
  noiseSuppression:/noiseSuppression:true/.test(frontend),
  autoGainControl:/autoGainControl:true/.test(frontend),
  webRtcPeerConnection:/new RTCPeerConnection/.test(frontend),
  outgoingTracks:/pc\.addTrack/.test(frontend),
  incomingTracks:/pc\.ontrack/.test(frontend),
  remoteAudioPlayback:/audio\.srcObject\s*=\s*stream/.test(frontend) && /audio\.play\(\)/.test(frontend),
  perParticipantVolume:/personalVolumes/.test(frontend),
  roomIsolationFrontend:/currentRoom/.test(frontend) && /ROOM_BOUNDS/.test(frontend),
  roomIsolationBackend:/target\.room !== source\.room/.test(backend),
  xrUsesRealCameraPosition:/xr\?\.globalPosition/.test(bridge) && /scene\?\.activeCamera\?\.globalPosition/.test(bridge),
  xrAutomaticRoomSwitch:/joinRoom\?\./.test(bridge) && /selectRoom\?\./.test(bridge),
  sseSignaling:/text\/event-stream/.test(backend) && /peer-joined/.test(backend),
  queuedSignals:/client\.queue\.push/.test(backend),
  heartbeat:/api\/voice\/heartbeat/.test(frontend) && /handleHeartbeat/.test(backend),
  roomLimit:/VOICE_ROOM_LIMIT/.test(preloader) && /roomLimit/.test(backend),
  stunConfigured:/stun:stun\.l\.google\.com:19302/.test(backend),
  turnEnvironmentSupported:/VOICE_TURN_URLS/.test(backend) && /VOICE_TURN_USERNAME/.test(backend) && /VOICE_TURN_CREDENTIAL/.test(backend),
  authenticationRequired:/Inicie sesión para usar el audio/.test(backend),
  voiceCreatedDirectly:/createVoiceSystem/.test(preloader) && /loadIceServersFromEnvironment/.test(preloader),
  cleanParallelPreloader:preloader.includes("require('./auth-compat-v271.js')") && forbiddenVisualChain.every(item => !preloader.includes(item)),
  packageStartUsesParallelPreloader:String(pkg.scripts?.start || '').includes('auth-compat-v313-parallel.js'),
  dockerUsesParallelPreloader:docker.includes('auth-compat-v313-parallel.js'),
  packageChecksVoiceFiles:String(pkg.scripts?.check || '').includes('lib/voice-signaling.js') && String(pkg.scripts?.check || '').includes('auth-compat-v313-parallel.js') && String(pkg.scripts?.check || '').includes('ucan_v306_voice_xr_bridge.js'),
  packageRunsVoiceAudit:String(pkg.scripts?.test || '').includes('audit:voice-v306')
};

for (const [name, code] of [
  ['frontendSyntax', frontend],
  ['bridgeSyntax', bridge],
  ['loaderSyntax', loader],
  ['backendSyntax', backend],
  ['preloaderSyntax', preloader]
]) {
  try { new Function(code); }
  catch (error) {
    checks[name] = false;
    checks[`${name}Error`] = error.message;
  }
}

const failures = Object.entries(checks).filter(([, value]) => value !== true);
const report = {
  version:'V313',
  feature:'Audio WebRTC compartido en browser, móvil, VR y MR',
  architecture:'clean-parallel-preloader',
  ok:failures.length === 0,
  rooms,
  checks,
  failures:failures.map(([name, value]) => ({ name, value })),
  physicalValidationRequired:[
    'Autorizar micrófono en Meta Quest Browser.',
    'Conectar dos cuentas o navegadores a la misma sala.',
    'Confirmar transmisión en ambas direcciones.',
    'Repetir la prueba en ANF-301.',
    'Probar redes distintas; configurar TURN si la conexión directa falla.'
  ]
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
