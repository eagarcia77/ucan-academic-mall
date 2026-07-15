'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const parts = Array.from({ length: 8 }, (_, index) => {
  const name = `part_${String(index).padStart(2, '0')}.txt`;
  return fs.readFileSync(path.join(__dirname, 'v270_parts', name), 'utf8').trim();
});
const encoded = parts.join('');
const expected = '3751a30d6bdce865967e9d8e1c25128c66398f8683f1bb3c5c67a113691e7b0c';
const actual = crypto.createHash('sha256').update(encoded).digest('hex');
if (actual !== expected) {
  throw new Error(`Payload V270 corrupto: ${actual}; esperado: ${expected}`);
}
const source = Buffer.from(encoded, 'base64').toString('utf8');
new Function('require', 'process', '__dirname', '__filename', source)(require, process, __dirname, __filename);
