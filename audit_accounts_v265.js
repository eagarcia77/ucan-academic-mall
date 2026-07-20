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
const compat = fs.readFileSync(path.join(root,'auth-compat-v271.js'),'utf8');
const auth = fs.readFileSync(path.join(root,'lib/auth.js'),'utf8');
const identity = fs.readFileSync(path.join(root,'public/js/ucan_v265_identity.js'),'utf8');
const avatar = fs.readFileSync(path.join(root,'public/js/ucan_avatar_shared.js'),'utf8');
const report = {
  sceneVersion:'V265',
  serverVersion:'V283',
  files,
  authEndpoints:[
    '/api/auth/register','/api/auth/login','/api/auth/logout','/api/auth/me','/api/auth/change-password',
    '/api/profile/avatar','/api/admin/users','/api/presence'
  ].every(route => server.includes(route) || auth.includes(route)),
  securePasswordHashing: auth.includes('crypto.scryptSync'),
  httpOnlyCookie: auth.includes('HttpOnly'),
  roles: auth.includes("role === 'admin'"),
  avatarCustomization:['hairStyle','hairColor','topStyle','topColor','shoeStyle','shoeColor','accessories'].every(key => avatar.includes(key)),
  thirdPersonMode: identity.includes('FollowCamera') && identity.includes('toggleThirdPerson'),
  multiplayerPresence: identity.includes('/api/presence') && auth.includes('const presence = new Map()') && auth.includes('presenceSnapshot'),
  unifiedServerActive: /V283-20260720-UNIFIED-XR-DESKTOP-PARITY/.test(compat) && /__UCAN_AUTH_SYSTEM_V283__/.test(compat) && /singleUnifiedXrController:true/.test(compat),
  publicationReady: required.slice(7).every(rel => files[rel])
};
report.ok = Object.values(files).every(Boolean) && report.authEndpoints && report.securePasswordHashing && report.httpOnlyCookie && report.roles && report.avatarCustomization && report.thirdPersonMode && report.multiplayerPresence && report.unifiedServerActive && report.publicationReady;
console.log(JSON.stringify(report,null,2));
if (!report.ok) process.exit(1);