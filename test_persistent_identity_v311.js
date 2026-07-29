'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { installPersistentIdentity } = require('./lib/persistent-identity-v311');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ucan-v311-identity-'));
const usersFile = path.join(root, 'users.json');

const historical = {
  version:1,
  users:[{
    id:'usr_historical_001',
    username:'usuariohistorico',
    displayName:'Usuario Histórico',
    email:'historico@example.edu',
    role:'user',
    status:'active',
    createdAt:'2026-01-01T00:00:00.000Z'
  }]
};

fs.writeFileSync(usersFile, JSON.stringify(historical, null, 2));
const persistence = installPersistentIdentity({ dataDir:root });
let status = persistence.getStatus();
assert.equal(status.writable, true, 'El directorio debe ser escribible.');
assert.equal(status.userRecordsValid, true, 'La cuenta histórica debe considerarse válida.');
assert.equal(status.users, 1, 'Debe conservarse la cuenta histórica.');
assert.ok(status.backups >= 1, 'Debe crearse una copia al iniciar.');

const migrated = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
migrated.users[0].avatar = {
  skinTone:'#dca27b', hairStyle:'corto', hairColor:'#17110f',
  topStyle:'camiseta', topColor:'#007b5f', bottomStyle:'pantalón',
  bottomColor:'#152d30', shoeStyle:'tenis', shoeColor:'#ffffff', accessories:['gafas']
};
migrated.users[0].avatarConfigured = true;
migrated.users[0].updatedAt = new Date().toISOString();
const temp = `${usersFile}.tmp`;
fs.writeFileSync(temp, JSON.stringify(migrated, null, 2));
fs.renameSync(temp, usersFile);

status = persistence.getStatus();
assert.equal(status.users, 1, 'El guardado no debe eliminar usuarios.');
assert.ok(status.backups >= 2, 'Debe existir una copia anterior y otra posterior al cambio.');
assert.deepEqual(JSON.parse(fs.readFileSync(usersFile, 'utf8')).users[0].avatar.accessories, ['gafas'], 'Debe conservarse el avatar actualizado.');

fs.writeFileSync(usersFile, '{archivo-corrupto');
assert.equal(persistence.getStatus().userRecordsValid, false, 'La corrupción debe detectarse.');
assert.equal(persistence.recover(), true, 'Debe recuperarse automáticamente una copia válida.');
const recovered = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
assert.equal(recovered.users.length, 1, 'La recuperación debe conservar el usuario.');
assert.equal(recovered.users[0].username, 'usuariohistorico', 'La identidad recuperada debe coincidir.');
assert.ok(recovered.users[0].avatar, 'La copia más reciente debe conservar el avatar.');

console.log(JSON.stringify({
  ok:true,
  version:'V311',
  users:recovered.users.length,
  backups:persistence.getStatus().backups,
  recovered:persistence.getStatus().recovered,
  recoveredFrom:persistence.getStatus().recoveredFrom
}, null, 2));

fs.rmSync(root, { recursive:true, force:true });
