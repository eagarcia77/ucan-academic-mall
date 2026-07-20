'use strict';

const fs = require('fs');

const script = fs.readFileSync('public/js/ucan_v288_celestial_info_window.js', 'utf8');
const compat = fs.readFileSync('auth-compat-v287.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let syntaxValid = false;
let syntaxError = null;
try {
  new Function(script);
  syntaxValid = true;
} catch (error) {
  syntaxError = error.message;
}

const checks = {
  syntaxValid,
  version:/const VERSION = 'V288'/.test(script),
  build:/V288-20260720-COMPACT-CELESTIAL-WINDOW/.test(script),
  desktopCompact:/width:min\(340px/.test(script) && /max-height:min\(440px,62vh\)/.test(script),
  desktopClosable:/ucanSkyCloseV287/.test(script) && /closeDesktopWindow/.test(script),
  xrCompactWindow:/width:2\.85/.test(script) && /height:1\.78/.test(script),
  xrCloseButton:/celestialWindowCloseV288:true/.test(script) && /close3DWindow\(\)/.test(script),
  legacyLargePlaneDisabled:/panel flotante cielo optimizado V287/.test(script) && /legacy\.setEnabled\(false\)/.test(script),
  desktopAndXrRouting:/if \(inXR\(\)\) show3DWindow\(entry\);/.test(script) && /else showDesktopWindow\(entry\);/.test(script),
  escapeCloses:/event\.key === 'Escape'/.test(script),
  pointerClose:/mesh\.metadata\?\.celestialWindowCloseV288/.test(script),
  dropdownSupported:/event\.target\?\.id === 'ucanSkySelectV287'/.test(script),
  programmaticSelectWrapped:/sky\.select = id =>/.test(script),
  auditPublished:/__UCAN_CELESTIAL_WINDOW_AUDIT__/.test(script),
  apiPublished:/__UCAN_CELESTIAL_WINDOW__/.test(script),
  injectedByServer:/CELESTIAL_WINDOW_SCRIPT/.test(compat) && /ucan_v288_celestial_info_window\.js/.test(compat),
  endpointFlags:/desktopCelestialWindowCompact = true/.test(compat) && /xrCelestialWindowCompact = true/.test(compat),
  endpointClosable:/celestialWindowClosableDesktop = true/.test(compat) && /celestialWindowClosableXR = true/.test(compat),
  endpointLegacyDisabled:/legacyLargeCelestialPlaneDisabled = true/.test(compat),
  packageChecksFile:pkg.scripts?.check?.includes('public/js/ucan_v288_celestial_info_window.js') === true,
  packageAudit:pkg.scripts?.['audit:celestial-window'] === 'node audit_celestial_window_v288.js'
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V288', checks, syntaxError }, null, 2));
if (!ok) process.exit(1);
