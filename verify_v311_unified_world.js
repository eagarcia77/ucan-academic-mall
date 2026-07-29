'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const files = {
  persistence:path.join(root, 'lib/persistent-identity-v311.js'),
  world:path.join(root, 'lib/unified-world-v311.js'),
  client:path.join(root, 'public/js/ucan_v311_unified_world.js'),
  aliases:path.join(root, 'public/js/ucan_v311_compat_aliases.js'),
  loader:path.join(root, 'public/js/ucan_v266_keyboard_jump.js'),
  preloader:path.join(root, 'auth-compat-v311-unified.js'),
  docker:path.join(root, 'Dockerfile'),
  package:path.join(root, 'package.json')
};

const source = Object.fromEntries(Object.entries(files).map(([key,file]) => [key, fs.readFileSync(file, 'utf8')]));
const pkg = JSON.parse(source.package);

const checks = {
  persistenceSyntax:true,
  worldSyntax:true,
  clientSyntax:true,
  aliasesSyntax:true,
  loaderSyntax:true,
  preloaderSyntax:true,
  versionV311:source.world.includes("const VERSION = 'V311'") && source.client.includes("const VERSION = 'V311'"),
  oneSceneStrategy:source.world.includes("strategy:'one-scene-one-world'") && source.client.includes('oneScene:true'),
  oneSyncEndpoint:source.world.includes("'/api/unified-world-v311'") && source.client.includes("const API = '/api/unified-world-v311/sync'"),
  browserVrBidirectional:source.world.includes('browserToVr:true') && source.world.includes('vrToBrowser:true') && source.client.includes('browserToVr:true') && source.client.includes('vrToBrowser:true'),
  remoteAvatarsSameScene:source.client.includes('window.UCANAvatar.create(state.scene') && source.client.includes('remoteAvatarV311:true'),
  realXrCameraPose:source.client.includes('state.helper?.baseExperience?.camera') && source.client.includes('inXR:state.inXR'),
  sharedInteraction:source.world.includes("['chat','gesture','reaction','focus','object-state']") && source.client.includes("queueAction('chat'") && source.client.includes("queueAction('gesture'"),
  oldQuestVisualLayersRemoved:!source.loader.includes('ucan_v304_quest_glass_rails_holiday_r4.js') && !source.loader.includes('ucan_v304_global_glass_signs_r5.js') && !source.loader.includes('ucan_v304_signs_terrace_interaction_r6.js') && !source.loader.includes('ucan_v305_vr_signs_interaction_r7.js') && !source.loader.includes('ucan_v305_floor1_terrace_vr_r9.js'),
  oldPresenceClientsRemoved:!source.loader.includes('ucan_v307_presence_xr_bridge.js') && !source.loader.includes('ucan_v308_cross_environment_interaction.js'),
  canonicalLoaderIncludesV311:source.loader.includes('ucan_v311_unified_world.js') && source.loader.includes('oldQuestVisualLayersLoaded:false'),
  diagnosticsCompatibility:source.loader.includes('ucan_v311_compat_aliases.js') && source.aliases.includes('__UCAN_PRESENCE_XR_V307__') && source.aliases.includes('__UCAN_CROSS_ENV_V308__'),
  durableUsersFile:source.persistence.includes("path.join(dataDir, 'users.json')") && source.persistence.includes('identity-backups-v311'),
  atomicBackups:source.persistence.includes('atomicCopy') && source.persistence.includes('before-save') && source.persistence.includes('after-save'),
  automaticRecovery:source.persistence.includes('recoverIfNeeded') && source.persistence.includes('recoveredFrom'),
  backupRetention:source.persistence.includes('MAX_BACKUPS = 60'),
  persistentStatusApi:source.preloader.includes('/api/persistence-v311/status'),
  versionReportsPersistence:source.preloader.includes('persistentAccounts:true') && source.preloader.includes('persistentAvatars:true') && source.preloader.includes('persistentUserRecordsValid'),
  forcedLoaderCacheBust:source.preloader.includes('V311-20260729-CANONICAL-ONE-SCENE-LOADER-R15') && source.preloader.includes('ucan_v266_keyboard_jump.js?build='),
  dockerUsesV311:source.docker.includes('auth-compat-v311-unified.js') && source.docker.includes('ENV DATA_DIR=/app/data') && source.docker.includes('VOLUME ["/app/data"]'),
  packageUsesV311:String(pkg.scripts?.start || '').includes('auth-compat-v311-unified.js'),
  packageAuditsV311:String(pkg.scripts?.test || '').includes('audit:unified-v311')
};

for (const name of ['persistence','world','client','aliases','loader','preloader']) {
  try { new Function(source[name]); }
  catch (error) {
    checks[`${name}Syntax`] = false;
    checks[`${name}SyntaxError`] = error.message;
  }
}

const failed = Object.entries(checks).filter(([,value]) => value !== true);
const report = {
  version:'V311',
  revision:'R15',
  build:'V311-20260729-ONE-SCENE-ONE-WORLD-R15',
  ok:failed.length === 0,
  checks,
  failed:failed.map(([name,value]) => ({ name,value }))
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
