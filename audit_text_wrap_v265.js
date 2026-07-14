const fs = require('fs');
const vm = require('vm');
const path = require('path');

const file = path.join(__dirname, 'public/js/ucan_babylon_mall_v265_accounts_avatars.js');
const source = fs.readFileSync(file, 'utf8');
const match = source.match(/function wrapAstronomyText\(ctx, text, xOrMaxWidth, y, maxWidth, lineHeight\) \{[\s\S]*?\n  \}/);
if (!match) {
  console.error('No se encontró wrapAstronomyText V265.');
  process.exit(1);
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${match[0]}; this.wrapAstronomyText = wrapAstronomyText;`, sandbox);
const drawn = [];
const ctx = {
  measureText(value) { return { width: String(value).length * 10 }; },
  fillText(value, x, y) { drawn.push({ value, x, y }); }
};

const boardLines = sandbox.wrapAstronomyText(ctx, 'Texto de prueba para una pizarra electrónica', 120);
const cursor = sandbox.wrapAstronomyText(ctx, 'Texto de prueba para panel astronómico', 10, 20, 120, 30);
const checks = {
  iterableBoardLines: Array.isArray(boardLines),
  boardHasLines: Array.isArray(boardLines) && boardLines.length > 1,
  astronomyCursorNumeric: Number.isFinite(cursor),
  astronomyDrewText: drawn.length > 0,
  obsoleteFailureRemoved: !source.includes('const wrapped = wrapAstronomyText(ctx, String(line || \'\'), maxWidth);\n      for (const part of wrapped)') || /returnLinesOnly/.test(source)
};
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version: 'V265', checks, boardLines, cursor }, null, 2));
if (!ok) process.exit(1);
