const fs = require('fs');
const path = require('path');
const root = __dirname;
const jsPath = path.join(root, 'public/js/ucan_babylon_mall_v265_accounts_avatars.js');
const htmlPath = path.join(root, 'public/campus.html');
const js = fs.readFileSync(jsPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');
const checks = {
  mainScriptPresent: fs.existsSync(jsPath),
  viewerFunctions: /function openLivePanelViewer\(/.test(js) && /function setupLivePanelViewer\(/.test(js),
  viewerMarkup: /id="livePanelViewer"/.test(html) && /id="livePanelImage"/.test(html),
  clickablePanels: /mesh\.isPickable = true/.test(js) && /OnPickTrigger/.test(js),
  agendaCards: /function drawAgendaSection\(/.test(js) && /OBJETOS SOBRE EL HORIZONTE/.test(js),
  directNavigation: ['rooftopWeather','rooftopAgenda','rooftopMoon','rooftopSky','rooftopCalendar'].every(key => html.includes(`data-go="${key}"`) && js.includes(`${key}:`)),
  fahrenheit: /temperatureUnit \|\| '°F'/.test(js),
  windMph: /windSpeedUnit \|\| 'mph'/.test(js),
  clearanceAudit: /__UCAN_ASTRO_PANEL_AUDIT__/.test(js),
  elevatedAgenda: /Panel agenda astronómica',[\s\S]*?y \+ 7\.3/.test(js),
  elevatedCalendar: /Calendario astronómico',[\s\S]*?y \+ 7\.3/.test(js),
};
const passed = Object.values(checks).every(Boolean);
const result = { version:'V265', passed, checks };
console.log(JSON.stringify(result, null, 2));
if (!passed) process.exit(1);
