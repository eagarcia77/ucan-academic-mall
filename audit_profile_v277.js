const fs=require('fs');
const profile=fs.readFileSync('public/js/ucan_v277_profile_rollback_persistence.js','utf8');
const identity=fs.readFileSync('public/js/ucan_v265_identity.js','utf8');
const compat=fs.readFileSync('auth-compat-v271.js','utf8');
const checks={
 loaded:/UCAN_ROLLBACK_SCRIPT/.test(compat)&&/ucan_v277_profile_rollback_persistence\.js/.test(compat),
 avatarRollback:/ucanAvatarRollback/.test(profile)&&/restore\('avatar','past'\)/.test(profile),
 avatarRedo:/ucanAvatarRedo/.test(profile)&&/restore\('avatar','future'\)/.test(profile),
 profileRollback:/ucanProfileRollback/.test(profile)&&/restore\('profile','past'\)/.test(profile),
 profileRedo:/ucanProfileRedo/.test(profile)&&/restore\('profile','future'\)/.test(profile),
 capturesBeforeSave:/ucanSaveAvatar/.test(profile)&&/ucanSaveProfile/.test(profile)&&/true\);/.test(profile),
 status:/ucanPersistenceStatus/.test(profile)&&/Rollback disponible/.test(profile),
 stalePromptGuard:/enforceCompletionPersistence/.test(profile)&&/avatarConfigured/.test(profile)&&/forcePasswordChange/.test(profile),
 serverFlags:/passwordChangedAt/.test(identity)&&/avatarConfiguredAt/.test(identity),
 diskRepair:/repairCompletionFile/.test(compat)
};
const ok=Object.values(checks).every(Boolean);
console.log(JSON.stringify({ok,version:'V277',checks},null,2));
if(!ok)process.exit(1);
