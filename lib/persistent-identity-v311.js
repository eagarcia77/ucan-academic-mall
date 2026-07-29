'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VERSION = 'V311';
const REVISION = 'R15';
const MAX_BACKUPS = 60;
const SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000;

function validUsersDocument(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.users)) return false;
  return value.users.every(user => user && typeof user === 'object' && String(user.id || '') && String(user.username || '') && user.avatar && typeof user.avatar === 'object');
}

function readValid(file) {
  try {
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return validUsersDocument(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

function digestFile(file) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
  catch (_) { return ''; }
}

function atomicCopy(source, destination) {
  const temp = `${destination}.${process.pid}.${Date.now()}.tmp`;
  fs.copyFileSync(source, temp);
  const descriptor = fs.openSync(temp, 'r');
  try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  fs.renameSync(temp, destination);
}

function installPersistentIdentity(options = {}) {
  if (global.__UCAN_PERSISTENT_IDENTITY_V311__) return global.__UCAN_PERSISTENT_IDENTITY_V311__;

  const dataDir = path.resolve(options.dataDir || process.env.DATA_DIR || path.join(process.cwd(), 'data'));
  const usersFile = path.join(dataDir, 'users.json');
  const backupDir = path.join(dataDir, 'identity-backups-v311');
  const markerFile = path.join(dataDir, '.ucan-persistent-volume-v311.json');
  const originalRenameSync = fs.renameSync.bind(fs);
  const originalWriteFileSync = fs.writeFileSync.bind(fs);

  fs.mkdirSync(dataDir, { recursive:true });
  fs.mkdirSync(backupDir, { recursive:true });

  const status = {
    version:VERSION,
    revision:REVISION,
    dataDir,
    usersFile,
    backupDir,
    writable:false,
    markerPresent:false,
    recovered:false,
    recoveredFrom:null,
    backups:0,
    users:0,
    lastBackupAt:null,
    lastRecoveryAt:null,
    lastHash:'',
    lastError:null
  };

  function listBackups() {
    try {
      return fs.readdirSync(backupDir)
        .filter(name => /^users-\d{8}T\d{6}-[a-f0-9]{8}\.json$/i.test(name))
        .map(name => ({ name, file:path.join(backupDir, name), stat:fs.statSync(path.join(backupDir, name)) }))
        .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
    } catch (_) { return []; }
  }

  function pruneBackups() {
    const backups = listBackups();
    for (const item of backups.slice(MAX_BACKUPS)) {
      try { fs.unlinkSync(item.file); } catch (_) {}
    }
    status.backups = Math.min(backups.length, MAX_BACKUPS);
  }

  function backupCurrent(reason = 'save') {
    const document = readValid(usersFile);
    if (!document) return null;
    const hash = digestFile(usersFile);
    if (!hash) return null;
    const latest = listBackups()[0];
    if (latest && digestFile(latest.file) === hash) {
      status.lastHash = hash;
      status.users = document.users.length;
      return latest.file;
    }
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '');
    const target = path.join(backupDir, `users-${stamp}-${hash.slice(0, 8)}.json`);
    atomicCopy(usersFile, target);
    status.lastBackupAt = new Date().toISOString();
    status.lastHash = hash;
    status.users = document.users.length;
    status.lastBackupReason = reason;
    pruneBackups();
    return target;
  }

  function recoverIfNeeded() {
    const current = readValid(usersFile);
    if (current) {
      status.users = current.users.length;
      status.lastHash = digestFile(usersFile);
      return false;
    }
    for (const item of listBackups()) {
      const backup = readValid(item.file);
      if (!backup) continue;
      atomicCopy(item.file, usersFile);
      status.recovered = true;
      status.recoveredFrom = item.name;
      status.lastRecoveryAt = new Date().toISOString();
      status.users = backup.users.length;
      status.lastHash = digestFile(usersFile);
      return true;
    }
    return false;
  }

  function writeMarker() {
    const payload = {
      version:VERSION,
      revision:REVISION,
      createdAt:readValid(markerFile)?.createdAt || new Date().toISOString(),
      checkedAt:new Date().toISOString(),
      dataDir,
      persistentMountExpected:'/app/data'
    };
    originalWriteFileSync(markerFile, JSON.stringify(payload, null, 2));
    status.markerPresent = true;
  }

  try {
    const probe = path.join(dataDir, `.write-probe-${process.pid}`);
    originalWriteFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    status.writable = true;
    recoverIfNeeded();
    writeMarker();
    backupCurrent('startup');
  } catch (error) {
    status.lastError = { stage:'startup', message:String(error?.message || error), at:new Date().toISOString() };
  }

  fs.renameSync = function renameSyncPersistentIdentity(source, destination) {
    const target = path.resolve(String(destination));
    if (target !== usersFile) return originalRenameSync(source, destination);
    let safetyBackup = null;
    try { safetyBackup = backupCurrent('before-save'); } catch (_) {}
    originalRenameSync(source, destination);
    const next = readValid(usersFile);
    if (!next) {
      if (safetyBackup && fs.existsSync(safetyBackup)) atomicCopy(safetyBackup, usersFile);
      const error = new Error('Se rechazó una actualización inválida de users.json; se restauró la copia anterior.');
      status.lastError = { stage:'save-validation', message:error.message, at:new Date().toISOString() };
      throw error;
    }
    try { backupCurrent('after-save'); }
    catch (error) { status.lastError = { stage:'backup-after-save', message:String(error?.message || error), at:new Date().toISOString() }; }
  };

  const snapshotTimer = setInterval(() => {
    try { backupCurrent('periodic'); }
    catch (error) { status.lastError = { stage:'periodic-backup', message:String(error?.message || error), at:new Date().toISOString() }; }
  }, SNAPSHOT_INTERVAL_MS);
  snapshotTimer.unref?.();

  const api = {
    version:VERSION,
    revision:REVISION,
    dataDir,
    usersFile,
    backupDir,
    backup:() => backupCurrent('manual'),
    recover:recoverIfNeeded,
    getStatus:() => {
      const current = readValid(usersFile);
      status.users = current?.users?.length || 0;
      status.backups = listBackups().length;
      status.markerPresent = fs.existsSync(markerFile);
      status.lastHash = digestFile(usersFile) || status.lastHash;
      return { ...status, userRecordsValid:Boolean(current), persistentMountPath:dataDir, backupsRetained:MAX_BACKUPS };
    }
  };

  global.__UCAN_PERSISTENT_IDENTITY_V311__ = api;
  return api;
}

module.exports = { VERSION, REVISION, installPersistentIdentity, validUsersDocument };
