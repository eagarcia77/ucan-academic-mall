'use strict';

const fs = require('fs');

const runtime = fs.readFileSync('public/js/ucan_v291_quest_celestial_glass.js', 'utf8');
const compat = fs.readFileSync('auth-compat-v287.js', 'utf8');
const main = fs.readFileSync('public/js/ucan_babylon_mall_v265_accounts_avatars.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let syntaxValid = false;
let syntaxError = null;
try {
  new Function(runtime);
  syntaxValid = true;
} catch (error) {
  syntaxError = error.message;
}

const controlsIndex = compat.indexOf('ucan_v290_quest_controls_interaction.js');
const compatIndex = compat.indexOf('ucan_v289_quest_xr_compat.js');
const visualIndex = compat.indexOf('ucan_v291_quest_celestial_glass.js');
const mainIndex = compat.indexOf('ucan_babylon_mall_v265_accounts_avatars.js');

const checks = {
  syntaxValid,
  version:/const VERSION = 'V291'/.test(runtime),
  build:/V291-20260720-QUEST-CELESTIAL-GLASS/.test(runtime),
  longRay:/const CELESTIAL_RAY_LENGTH = 240/.test(runtime),
  maximumDistance:/const CELESTIAL_MAX_DISTANCE = 265/.test(runtime),
  angularFallback:/CELESTIAL_ANGLE_LIMIT = 7\.5/.test(runtime) && /function angularCelestialPick/.test(runtime),
  exactRaycast:/pickWithRay\?\.\(ray, mesh => isCelestial\(mesh\), false\)/.test(runtime),
  celestialMetadata:/metadata\.celestialId \|\| metadata\.celestialData \|\| metadata\.celestialObject/.test(runtime),
  compactWindow:/__UCAN_CELESTIAL_WINDOW__\?\.show\?\.\(id\)/.test(runtime),
  triggerPolling:/pressed && !record\.triggerDown/.test(runtime),
  originalGlassDetected:/cristal claro moderno/.test(main) && /cristal oscuro/.test(main) && /cristal puerta/.test(main),
  originalDepthPrepassKnown:/m\.needDepthPrePass = true/.test(main),
  glassNameDetection:/cristal\|vidrio/.test(runtime),
  depthPrepassDisabled:/material\.needDepthPrePass = false/.test(runtime),
  depthWritesDisabled:/material\.disableDepthWrite = true/.test(runtime),
  alphaBlending:/MATERIAL_ALPHABLEND/.test(runtime) && /ALPHA_COMBINE/.test(runtime),
  backFacesVisible:/material\.backFaceCulling = false/.test(runtime),
  shadowsDisabled:/mesh\.receiveShadows = false/.test(runtime),
  restoreAfterXR:/function restoreGlass/.test(runtime) && /state\.materialOriginals\.clear\(\)/.test(runtime),
  xrOnlyPatch:/if \(active && !state\.inXR\)/.test(runtime) && /else if \(!active && state\.inXR\)/.test(runtime),
  auditApi:/__UCAN_QUEST_VISUAL_AUDIT__/.test(runtime),
  injectedByServer:/QUEST_VISUAL_SCRIPT/.test(compat) && /questVisualVersion = 'V291'/.test(compat),
  correctOrder:controlsIndex >= 0 && compatIndex > controlsIndex && visualIndex > compatIndex && mainIndex >= 0,
  serverFlags:/questCelestialRayLength = 240/.test(compat) && /questGlassCompatibility = true/.test(compat),
  responseHeader:/X-UCAN-XR-Visuals/.test(compat),
  packageChecksScript:pkg.scripts?.check?.includes('public/js/ucan_v291_quest_celestial_glass.js'),
  packageAudit:pkg.scripts?.['audit:quest-visuals'] === 'node verify_meta_visuals_v291.js'
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks, syntaxError }, null, 2));
if (!ok) process.exit(1);
