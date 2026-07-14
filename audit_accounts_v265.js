const fs = require('fs');
const path = require('path');

const root = __dirname;
const required = [
  'lib/auth.js','public/login.html','public/admin.html','public/campus.html',
  'public/js/ucan_avatar_shared.js','public/js/ucan_v265_identity.js','data/users.example.json',
  '.devcontainer/devcontainer.json','.devcontainer/start-codespace.sh',
  '.github/workflows/ci.yml','.github/workflows/publish-ghcr.yml'
];
const files = Object.fromEntries(required.map(rel => [rel, fs.existsSync(path.join(root, rel))]));
const server = fs.readFileSync(path.join(root,'server.js'),'utf8');
const identity = fs.readFileSync(path.join(root,'public/js/ucan_v265_identity.js'),'utf8');
const avatar = fs.readFileSync(path.join(root,'public/js/ucan_avatar_shared.js'),'utf8');
const report = {
  version:'V265',
  files,
  authEndpoints:[
    '/api/auth/register','/api/auth/login','/api/auth/logout','/api/auth/me','/api/auth/change-password',
    '/api/profile/avatar','/api/admin/users','/api/presence'
  ].every(route => server.includes(route) || fs.readFileSync(path.join(root,'lib/auth.js'),'utf8').includes(route)),
  securePasswordHashing: fs.readFileSync(path.join(root,'lib/auth.js'),'utf8').includes('crypto.scryptSync'),
  httpOnlyCookie: fs.readFileSync(path.join(root,'lib/auth.js'),'utf8').includes('HttpOnly'),
  roles: fs.readFileSync(path.join(root,'lib/auth.js'),'utf8').includes("role === 'admin'"),
  avatarCustomization:['hairStyle','hairColor','topStyle','topColor','shoeStyle','shoeColor','accessories'].every(key => avatar.includes(key)),
  thirdPersonMode: identity.includes('FollowCamera') && identity.includes('toggleThirdPerson'),
  multiplayerPresence: identity.includes('/api/presence') && server.includes('multiplayerPresence:true'),
  publicationReady: required.slice(7).every(rel => files[rel])
};
report.ok = Object.values(files).every(Boolean) && report.authEndpoints && report.securePasswordHashing && report.httpOnlyCookie && report.roles && report.avatarCustomization && report.thirdPersonMode && report.multiplayerPresence && report.publicationReady;
console.log(JSON.stringify(report,null,2));
if (!report.ok) process.exit(1);
