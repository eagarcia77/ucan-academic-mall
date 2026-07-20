const fs=require('fs');
const profile=fs.readFileSync('public/js/ucan_v277_profile_rollback_persistence.js','utf8');
const identity=fs.readFileSync('public/js/ucan_v265_identity.js','utf8');
const auth=fs.readFileSync('lib/auth.js','utf8');
const compat=fs.readFileSync('auth-compat-v271.js','utf8');
const checks={
 layerVersion:/const VERSION='V277'/.test(profile)&&/V277-20260720-XR-NAV-ROLLBACK-PERSISTENCE/.test(profile),
 currentServerBuild:/V283-20260720-UNIFIED-XR-DESKTOP-PARITY/.test(compat),
 loaded:/UCAN_ROLLBACK_SCRIPT/.test(compat)&&/ucan_v277_profile_rollback_persistence\.js/.test(compat),
 avatarRollback:/ucanAvatarRollback/.test(profile)&&/restore\('avatar','past'\)/.test(profile),
 avatarRedo:/ucanAvatarRedo/.test(profile)&&/restore\('avatar','future'\)/.test(profile),
 profileRollback:/ucanProfileRollback/.test(profile)&&/restore\('profile','past'\)/.test(profile),
 profileRedo:/ucanProfileRedo/.test(profile)&&/restore\('profile','future'\)/.test(profile),
 capturesBeforeSave:/ucanSaveAvatar/.test(profile)&&/push\('avatar',old\)/.test(profile)&&/ucanSaveProfile/.test(profile)&&/push\('profile',old\)/.test(profile),
 status:/ucanPersistenceStatus/.test(profile)&&/Rollback disponible/.test(profile),
 stalePromptGuard:/enforceCompletionPersistence/.test(profile)&&/avatarConfigured/.test(profile)&&/forcePasswordChange/.test(profile),
 serverFlags:/passwordChangedAt/.test(auth)&&/avatarConfiguredAt/.test(auth)&&/forcePasswordChange/.test(auth),
 identityProfileUI:/ucanProfileModal/.test(identity)&&/ucanSaveAvatar/.test(identity)&&/ucanSaveProfile/.test(identity),
 diskRepair:/repairCompletionFile/.test(compat)&&/\.v283\.tmp/.test(compat),
 currentAuthLayer:/__UCAN_AUTH_SYSTEM_V283__/.test(compat)
};
const ok=Object.values(checks).every(Boolean);
console.log(JSON.stringify({ok,layerVersion:'V277',serverVersion:'V283',checks},null,2));
if(!ok)process.exit(1);