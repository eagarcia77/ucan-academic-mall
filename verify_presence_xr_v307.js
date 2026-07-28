'use strict';

const fs = require('fs');
const path = require('path');
const { createPresenceSystem } = require('./lib/presence-sync-v307');

const root = __dirname;
const backendPath = path.join(root, 'lib/presence-sync-v307.js');
const preloaderPath = path.join(root, 'auth-compat-v307-presence.js');
const runtimePath = path.join(root, 'public/js/ucan_v307_presence_xr_bridge.js');
const loaderPath = path.join(root, 'public/js/ucan_v266_keyboard_jump.js');
const identityPath = path.join(root, 'public/js/ucan_v265_identity.js');
const dockerPath = path.join(root, 'Dockerfile');
const packagePath = path.join(root, 'package.json');

const backend = fs.readFileSync(backendPath, 'utf8');
const preloader = fs.readFileSync(preloaderPath, 'utf8');
const runtime = fs.readFileSync(runtimePath, 'utf8');
const loader = fs.readFileSync(loaderPath, 'utf8');
const identity = fs.readFileSync(identityPath, 'utf8');
const docker = fs.readFileSync(dockerPath, 'utf8');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

function syntaxOkay(code) {
  try { new Function(code); return true; }
  catch (_) { return false; }
}

function responseBox() {
  return {
    status:0,
    data:null,
    headers:{},
    writeHead(status, headers) { this.status = status; this.headers = headers || {}; },
    end(body) { this.data = body ? JSON.parse(String(body)) : null; this.writableEnded = true; },
    writableEnded:false,
    headersSent:false
  };
}

async function invoke(system, method, pathname, query, user, body) {
  const req = { method, body };
  const res = responseBox();
  const url = new URL(`https://ucan.local${pathname}${query || ''}`);
  const sendJson = (target, status, data) => {
    target.status = status;
    target.data = data;
    target.writableEnded = true;
  };
  await system.handle(req, res, pathname, url, user, async request => request.body || {}, sendJson);
  return res;
}

async function main() {
  const system = createPresenceSystem({ ttlMs:10000, updateLimit:20 });
  const user = {
    id:'usr_same_account',
    username:'eduardo',
    displayName:'Eduardo',
    role:'admin',
    avatar:{ topColor:'#007b5f', accessories:[] }
  };
  const browserId = 'presence_browser_test_001';
  const questId = 'presence_quest_test_001';

  const browserJoin = await invoke(system, 'POST', '/api/presence-v2', '', user, {
    clientId:browserId,
    position:{ x:1, y:1.72, z:2 },
    rotationY:0,
    area:'Piso 1',
    device:'browser',
    inXR:false
  });
  const questJoin = await invoke(system, 'POST', '/api/presence-v2', '', user, {
    clientId:questId,
    position:{ x:3, y:1.72, z:4 },
    rotationY:1,
    area:'Piso 1',
    device:'quest',
    inXR:true
  });
  const browserView = await invoke(system, 'GET', '/api/presence-v2', `?clientId=${browserId}`, user);
  const questView = await invoke(system, 'GET', '/api/presence-v2', `?clientId=${questId}`, user);

  const checks = {
    backendSyntax:syntaxOkay(backend),
    preloaderSyntax:syntaxOkay(preloader),
    runtimeSyntax:syntaxOkay(runtime),
    backendKeysByClientId:/const clients = new Map\(\)/.test(backend) && /entry\.clientId !== excludeClientId/.test(backend),
    backendDoesNotExcludeSameUser:!backend.includes('userId === viewerId'),
    sameAccountBrowserJoin:browserJoin.status === 200,
    sameAccountQuestJoin:questJoin.status === 200,
    browserSeesQuestSameAccount:Array.isArray(browserView.data?.participants) && browserView.data.participants.some(item => item.clientId === questId && item.userId === user.id),
    questSeesBrowserSameAccount:Array.isArray(questView.data?.participants) && questView.data.participants.some(item => item.clientId === browserId && item.userId === user.id),
    browserVrBidirectionalFlags:backend.includes('browserToVrVisibility:true') && backend.includes('vrToBrowserVisibility:true'),
    authenticatedPresence:/Inicie sesión para utilizar la presencia/.test(backend),
    preloaderChainsVoice:preloader.includes("require('./auth-compat-v306-voice.js')"),
    preloaderServesPresenceV2:preloader.includes("pathname.startsWith('/api/presence-v2')"),
    preloaderDisablesLegacyPoll:preloader.includes('presenceLoop();setInterval(presenceLoop,2200);') && preloader.includes('__UCAN_LEGACY_PRESENCE_DISABLED_V307__'),
    sourceLegacyPresenceDetected:identity.includes('presenceLoop();setInterval(presenceLoop,2200);'),
    runtimeUsesRealXrCamera:/baseExperience\?\.camera/.test(runtime) && /xrActive\(\)/.test(runtime),
    runtimeCreatesRemoteAvatars:/window\.UCANAvatar\.create/.test(runtime),
    runtimeUsesDeviceClientId:/sessionStorage\.getItem\('ucanPresenceClientV307'\)/.test(runtime),
    runtimeKeepsSameAccountDevices:/sameAccountRemoteDevices/.test(runtime),
    runtimeForcesAvatarVisibility:/mesh\.isVisible = true/.test(runtime) && /mesh\.visibility = 1/.test(runtime),
    runtimeForcesXrLayers:/mesh\.layerMask = ALL_LAYERS/.test(runtime) && /camera\.layerMask = ALL_LAYERS/.test(runtime),
    runtimeSuppressesLegacyDuplicates:/hiddenByPresenceV307/.test(runtime),
    runtimeUpdatesOnlinePanel:/ucanOnlineCount/.test(runtime) && /ucanOnlineList/.test(runtime),
    loaderLoadsPresenceV307:loader.includes('/js/ucan_v307_presence_xr_bridge.js?build=V307-20260728-BROWSER-XR-DEVICE-PRESENCE'),
    dockerStartsPresencePreloader:docker.includes('./auth-compat-v307-presence.js'),
    packageStartsPresencePreloader:String(pkg.scripts?.start || '').includes('auth-compat-v307-presence.js'),
    packageChecksPresenceFiles:String(pkg.scripts?.check || '').includes('lib/presence-sync-v307.js') && String(pkg.scripts?.check || '').includes('ucan_v307_presence_xr_bridge.js'),
    packageRunsPresenceAudit:String(pkg.scripts?.test || '').includes('audit:presence-v307')
  };

  system.close();
  const failures = Object.entries(checks).filter(([, value]) => value !== true);
  const report = {
    version:'V307',
    feature:'Avatares compartidos entre browser y WebXR por dispositivo',
    ok:failures.length === 0,
    checks,
    failures:failures.map(([name, value]) => ({ name, value })),
    physicalValidationRequired:[
      'Abrir una cuenta en browser y la misma cuenta en Meta Quest para confirmar que ambas sesiones se ven.',
      'Repetir con dos cuentas distintas.',
      'Caminar en browser y confirmar movimiento en VR.',
      'Caminar en VR y confirmar movimiento en browser.',
      'Cambiar de piso y confirmar la altura mundial del avatar.'
    ]
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
