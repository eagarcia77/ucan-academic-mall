'use strict';

const http = require('http');

const VERSION = 'V306';
const BUILD = 'V306-20260723-EXTERIOR-ECOSYSTEM-SOLAR-SAN-GERMAN';
const PATH = '/js/ucan_v306_exterior_ecosystem_solar_cycle.js';
const SCRIPT = `${PATH}?build=${BUILD}`;
const LOCATION = Object.freeze({
  name:'San Germán, Puerto Rico',
  latitude:18.0819,
  longitude:-67.0458,
  timeZone:'America/Puerto_Rico'
});

const nativeWriteHead = http.ServerResponse.prototype.writeHead;
const nativeEnd = http.ServerResponse.prototype.end;

function insertExteriorLayer(text) {
  let html = String(text).replace(/\s*<script src="\/js\/ucan_v306_exterior_ecosystem_solar_cycle\.js[^"]*"><\/script>/g, '');
  const tag = `<script src="${SCRIPT}"></script>`;
  const visibility = html.match(/<script src="\/js\/ucan_v305_ecosystem_visibility_fix\.js\?build=[^"]+"><\/script>/)?.[0];
  if (visibility) return html.replace(visibility, `${visibility}\n  ${tag}`);
  const seasonal = html.match(/<script src="\/js\/ucan_v304_seasonal_natural_ecosystem\.js\?build=[^"]+"><\/script>/)?.[0];
  if (seasonal) return html.replace(seasonal, `${seasonal}\n  ${tag}`);
  const main = html.match(/<script src="\/js\/ucan_babylon_mall_v265_accounts_avatars\.js\?build=[^"]+"><\/script>/)?.[0];
  if (main) return html.replace(main, `${main}\n  ${tag}`);
  return html.replace('</body>', `  ${tag}\n</body>`);
}

function updateVersion(data) {
  if (!data || typeof data !== 'object') return data;
  const versionPayload = Object.prototype.hasOwnProperty.call(data, 'version') ||
    Object.prototype.hasOwnProperty.call(data, 'build') ||
    Object.prototype.hasOwnProperty.call(data, 'releaseVersion') ||
    Object.prototype.hasOwnProperty.call(data, 'environmentVersion') ||
    Object.prototype.hasOwnProperty.call(data, 'ecosystemVisibilityVersion');
  if (!versionPayload) return data;
  data.releaseVersion = VERSION;
  data.releaseBuild = BUILD;
  data.exteriorEcosystemVersion = VERSION;
  data.exteriorEcosystemBuild = BUILD;
  data.exteriorEcosystemScript = SCRIPT;
  data.exteriorEcosystemEnabled = true;
  data.exteriorEcosystemOutsideBuilding = true;
  data.exteriorEcosystemExteriorOnly = true;
  data.exteriorEcosystemInteriorV305Disabled = true;
  data.exteriorEcosystemBaseV304GeometryDisabled = true;
  data.exteriorEcosystemSeasonalCalendarPreserved = true;
  data.exteriorEcosystemFourPerimeterZones = true;
  data.exteriorEcosystemBrowserAndQuest = true;
  data.exteriorEcosystemQuestOptimized = true;
  data.solarCycleVersion = VERSION;
  data.solarCycleBuild = BUILD;
  data.solarCycleLocation = LOCATION.name;
  data.solarCycleLatitude = LOCATION.latitude;
  data.solarCycleLongitude = LOCATION.longitude;
  data.solarCycleTimeZone = LOCATION.timeZone;
  data.solarCycleDynamicPosition = true;
  data.solarSunriseSunsetDynamic = true;
  data.solarDawnSunsetNightDynamic = true;
  data.solarAutomaticMinuteRefresh = true;
  data.solarSkyDomeEnabled = true;
  data.solarSunAndMoonVisible = true;
  data.solarGardenLightsNightAware = true;
  data.solarInformationBoardPickable = true;
  return data;
}

function transform(text) {
  const value = String(text);
  const trimmed = value.trim();
  if (/^\s*[\[{]/.test(trimmed)) {
    try { return JSON.stringify(updateVersion(JSON.parse(value))); }
    catch (_) {}
  }
  if (/<html|<body|<script/i.test(value)) return insertExteriorLayer(value);
  return value;
}

http.ServerResponse.prototype.writeHead = function writeHeadV306(statusCode, statusMessage, headers) {
  let message = statusMessage;
  let nextHeaders = headers;
  if (statusMessage && typeof statusMessage === 'object') {
    nextHeaders = statusMessage;
    message = undefined;
  }
  if (nextHeaders && typeof nextHeaders === 'object') {
    nextHeaders = { ...nextHeaders };
    for (const key of Object.keys(nextHeaders)) {
      if (key.toLowerCase() === 'content-length') delete nextHeaders[key];
    }
    nextHeaders['X-UCAN-Exterior-Ecosystem'] = VERSION;
    nextHeaders['X-UCAN-Solar-Cycle'] = VERSION;
    nextHeaders['X-UCAN-Solar-Location'] = 'San-German-PR';
    nextHeaders['X-UCAN-Release'] = VERSION;
  }
  if (message === undefined) return nativeWriteHead.call(this, statusCode, nextHeaders);
  return nativeWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.end = function endV306(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      const buffer = Buffer.isBuffer(body);
      const text = buffer ? body.toString(typeof encoding === 'string' ? encoding : 'utf8') : body;
      const updated = transform(text);
      body = buffer ? Buffer.from(updated, 'utf8') : updated;
    }
  } catch (error) {
    console.error('[UCAN V306 exterior ecosystem compatibility]', error);
  }
  return nativeEnd.call(this, body, encoding, callback);
};

require('./auth-compat-v305.js');

console.info(`[UCAN ${VERSION}] Ecosistema exterior y ciclo solar de San Germán cargados.`);
