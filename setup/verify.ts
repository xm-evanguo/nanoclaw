/**
 * Step: verify — End-to-end health check of the full installation.
 * Replaces 09-verify.sh
 *
 * Uses better-sqlite3 directly (no sqlite3 CLI), platform-aware service checks.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import Database from 'better-sqlite3';

import { STORE_DIR } from '../src/config.js';
import { logger } from '../src/logger.js';
import { getServiceManager, isRoot } from './platform.js';
import { emitStatus } from './status.js';

export function hasRuntimeAuthKey(envContent: string): boolean {
  return /^(CODEX_API_KEY|OPENAI_API_KEY)=/m.test(envContent);
}

export function computeVerifyStatus(checks: {
  service: string;
  containerRuntime: string;
  credentials: string;
  whatsappAuth: string;
  registeredGroups: number;
}): 'success' | 'failed' {
  return checks.service === 'running' &&
    checks.containerRuntime === 'docker' &&
    checks.credentials === 'configured' &&
    checks.whatsappAuth === 'authenticated' &&
    checks.registeredGroups > 0
    ? 'success'
    : 'failed';
}

export async function run(_args: string[]): Promise<void> {
  const projectRoot = process.cwd();
  const homeDir = os.homedir();

  logger.info('Starting verification');

  // 1. Check service status
  let service = 'not_found';
  const mgr = getServiceManager();

  if (mgr === 'systemd') {
    const prefix = isRoot() ? 'systemctl' : 'systemctl --user';
    try {
      execSync(`${prefix} is-active nanoclaw`, { stdio: 'ignore' });
      service = 'running';
    } catch {
      try {
        const output = execSync(`${prefix} list-unit-files`, {
          encoding: 'utf-8',
        });
        if (output.includes('nanoclaw')) {
          service = 'stopped';
        }
      } catch {
        // systemctl not available
      }
    }
  } else {
    // Check for nohup PID file
    const pidFile = path.join(projectRoot, 'nanoclaw.pid');
    if (fs.existsSync(pidFile)) {
      try {
        const pid = fs.readFileSync(pidFile, 'utf-8').trim();
        if (pid) {
          execSync(`kill -0 ${pid}`, { stdio: 'ignore' });
          service = 'running';
        }
      } catch {
        service = 'stopped';
      }
    }
  }
  logger.info({ service }, 'Service status');

  // 2. Check container runtime
  let containerRuntime = 'none';
  try {
    execSync('docker info', { stdio: 'ignore' });
    containerRuntime = 'docker';
  } catch {
    // No runtime
  }

  // 3. Check credentials
  let credentials = 'missing';
  const envFile = path.join(projectRoot, '.env');
  if (fs.existsSync(envFile)) {
    const envContent = fs.readFileSync(envFile, 'utf-8');
    if (hasRuntimeAuthKey(envContent)) {
      credentials = 'configured';
    }
  }

  // 4. Check WhatsApp auth
  let whatsappAuth = 'not_found';
  const authDir = path.join(projectRoot, 'store', 'auth');
  if (fs.existsSync(authDir) && fs.readdirSync(authDir).length > 0) {
    whatsappAuth = 'authenticated';
  }

  // 5. Check registered groups (using better-sqlite3, not sqlite3 CLI)
  let registeredGroups = 0;
  const dbPath = path.join(STORE_DIR, 'messages.db');
  if (fs.existsSync(dbPath)) {
    try {
      const db = new Database(dbPath, { readonly: true });
      const row = db
        .prepare('SELECT COUNT(*) as count FROM registered_groups')
        .get() as { count: number };
      registeredGroups = row.count;
      db.close();
    } catch {
      // Table might not exist
    }
  }

  // 6. Check mount allowlist
  let mountAllowlist = 'missing';
  if (
    fs.existsSync(
      path.join(homeDir, '.config', 'nanoclaw', 'mount-allowlist.json'),
    )
  ) {
    mountAllowlist = 'configured';
  }

  // Determine overall status
  const status = computeVerifyStatus({
    service,
    containerRuntime,
    credentials,
    whatsappAuth,
    registeredGroups,
  });

  logger.info({ status }, 'Verification complete');

  emitStatus('VERIFY', {
    SERVICE: service,
    CONTAINER_RUNTIME: containerRuntime,
    CREDENTIALS: credentials,
    WHATSAPP_AUTH: whatsappAuth,
    REGISTERED_GROUPS: registeredGroups,
    MOUNT_ALLOWLIST: mountAllowlist,
    STATUS: status,
    LOG: 'logs/setup.log',
  });

  if (status === 'failed') process.exit(1);
}
