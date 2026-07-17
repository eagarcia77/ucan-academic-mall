const fs = require('fs');
const path = require('path');
const main = path.join(__dirname,'public/js/ucan_babylon_mall_v265_accounts_avatars.js');
const server = path.join(__dirname,'server.js');
const html = path.join(__dirname,'public/campus.html');
const js = fs.readFileSync(main,'utf8');
const srv = fs.readFileSync(server,'utf8');
const page = fs.readFileSync(html,'utf8');
const checks = {
  activeScript:/ucan_babylon_mall_v265_accounts_avatars\.js\?build=V271-20260717-XR-PARITY-FLOOR-LOCK/.test(page),
  siderealTime:/function localSiderealDegrees/.test(js),
  altitudeAzimuth:/function raDecToAltAz/.test(js),
  lowPrecisionPlanets:/function planetRaDec/.test(js),
  graphicalMoon:/function drawMoonPhaseDisk/.test(js),
  skyMap:/MAPA CELESTE · SAN GERMÁN/.test(js),
  orientation:/norte arriba · orientación local/.test(js),
  monthlyCalendar:/CALENDARIO ASTRONÓMICO/.test(js),
  nasaEclipses:/Eclipse lunar parcial · visible en las Américas/.test(js),
  cometProxy:/\/api\/astronomy\/comets/.test(srv) && /ssd-api\.jpl\.nasa\.gov/.test(srv),
  visibilityFilter:/allowSky = isNight && weatherGood/.test(js),
  normalScale:/horizonWorldPoint\(altitude, azimuth, 210\)/.test(js)
};
const ok=Object.values(checks).every(Boolean);
console.log(JSON.stringify({ok,version:'V271',checks},null,2));
if(!ok) process.exit(1);
