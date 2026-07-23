'use strict';

const fs = require('fs');

const runtime = fs.readFileSync('public/js/ucan_v306_exterior_ecosystem_solar_cycle.js', 'utf8');
const auth = fs.readFileSync('auth-compat-v306.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const docker = fs.readFileSync('Dockerfile', 'utf8');

let syntaxValid = false;
let syntaxError = null;
try { new Function(runtime); syntaxValid = true; }
catch (error) { syntaxError = error.message; }

let authSyntaxValid = false;
let authSyntaxError = null;
try { new Function(auth); authSyntaxValid = true; }
catch (error) { authSyntaxError = error.message; }

const checks = {
  syntaxValid,
  authSyntaxValid,
  version:/const VERSION = 'V306'/.test(runtime),
  build:/V306-20260723-EXTERIOR-ECOSYSTEM-SOLAR-SAN-GERMAN/.test(runtime),
  location:/latitude:18\.0819/.test(runtime) && /longitude:-67\.0458/.test(runtime) && /America\/Puerto_Rico/.test(runtime),
  exteriorBounds:/minX:-70, maxX:70, minZ:-51, maxZ:51/.test(runtime),
  fourZones:/jardín frontal exterior V306/.test(runtime) && /jardín posterior exterior V306/.test(runtime) && /jardín lateral oeste exterior V306/.test(runtime) && /jardín lateral este exterior V306/.test(runtime),
  exteriorOnly:/exteriorOnly:true/.test(runtime) && /outsideBuilding:true/.test(runtime),
  hidesInterior:/Plaza natural visible UCAN V305/.test(runtime) && /Ecosistema natural estacional UCAN V304/.test(runtime) && /interiorV305GardenDisabled:true/.test(runtime),
  preservesCalendar:/seasonalCalendarPreserved:true/.test(runtime),
  vegetation:/function createTree/.test(runtime) && /function createPalm/.test(runtime) && /function createShrub/.test(runtime) && /function createRock/.test(runtime),
  solarFormula:/function solarParameters/.test(runtime) && /function solarPosition/.test(runtime) && /equationOfTime/.test(runtime) && /declination/.test(runtime),
  sunriseSunset:/function sunriseSunset/.test(runtime) && /90\.833/.test(runtime) && /dynamicSunriseSunset:true/.test(runtime),
  phases:/Amanecer/.test(runtime) && /Atardecer/.test(runtime) && /Crepúsculo/.test(runtime) && /Noche/.test(runtime),
  sky:/Domo exterior solar San Germán V306/.test(runtime) && /function drawSky/.test(runtime) && /solarSkyDomeEnabled/.test(auth),
  sunMoon:/Sol San Germán V306/.test(runtime) && /Luna San Germán V306/.test(runtime) && /solarSunAndMoonVisible/.test(auth),
  lights:/Luz solar dinámica San Germán V306/.test(runtime) && /Ambiente solar dinámico San Germán V306/.test(runtime) && /solarGardenLightsNightAware/.test(auth),
  minuteRefresh:/REFRESH_MS = 60000/.test(runtime) && /automaticMinuteRefresh:true/.test(runtime),
  informationBoard:/Cartel ecosistema exterior y ciclo solar V306/.test(runtime) && /solarInformationBoardPickable/.test(auth),
  questOptimized:/questOptimized:state\.questMode/.test(runtime) && /state\.questMode \? 16 : 24/.test(runtime),
  authVersion:/const VERSION = 'V306'/.test(auth) && /ucan_v306_exterior_ecosystem_solar_cycle\.js/.test(auth),
  authAfterV305:/ucan_v305_ecosystem_visibility_fix/.test(auth) && /visibility, `\$\{visibility\}\\n  \$\{tag\}`/.test(auth),
  authChain:/require\('\.\/auth-compat-v305\.js'\)/.test(auth),
  endpointFlags:/exteriorEcosystemOutsideBuilding = true/.test(auth) && /solarSunriseSunsetDynamic = true/.test(auth),
  headers:/X-UCAN-Exterior-Ecosystem/.test(auth) && /X-UCAN-Solar-Cycle/.test(auth) && /X-UCAN-Solar-Location/.test(auth),
  packageStart:pkg.scripts?.start === 'node -r ./auth-compat-v306.js server.js',
  packageCheck:pkg.scripts?.check?.includes('ucan_v306_exterior_ecosystem_solar_cycle.js') && pkg.scripts?.check?.includes('auth-compat-v306.js'),
  packageAudit:pkg.scripts?.['audit:exterior-ecosystem'] === 'node verify_exterior_ecosystem_solar_v306.js',
  docker:/CMD \["node", "-r", "\.\/auth-compat-v306\.js", "server\.js"\]/.test(docker)
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({
  ok,
  version:'V306',
  checks,
  syntaxError,
  authSyntaxError
}, null, 2));
if (!ok) process.exit(1);
