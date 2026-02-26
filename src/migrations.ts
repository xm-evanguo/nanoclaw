import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { logger } from './logger.js';

interface MigrationSummary {
  instructionFilesCopied: number;
  instructionFilesMerged: number;
  sessionDirsCopied: number;
}

function copyIfMissing(src: string, dest: string): boolean {
  if (!fs.existsSync(src) || fs.existsSync(dest)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function mergeLegacyIntoAgents(src: string, dest: string): boolean {
  if (!fs.existsSync(src) || !fs.existsSync(dest)) return false;

  const legacy = fs.readFileSync(src, 'utf-8').trim();
  if (!legacy) return false;

  const current = fs.readFileSync(dest, 'utf-8');
  if (current.includes(legacy)) return false;

  const hash = sha256(legacy);
  const beginMarker = `<!-- nanoclaw-migration:legacy-claude sha256=${hash} -->`;
  if (current.includes(beginMarker)) return false;

  const merged = [
    current.trimEnd(),
    '',
    beginMarker,
    '## Legacy CLAUDE.md (migrated)',
    '',
    legacy,
    '<!-- /nanoclaw-migration -->',
    '',
  ].join('\n');

  fs.writeFileSync(dest, merged);
  return true;
}

function migrateInstructionFiles(projectRoot: string): {
  copied: number;
  merged: number;
} {
  let copied = 0;
  let merged = 0;

  const explicitPairs: Array<[string, string]> = [
    [
      path.join(projectRoot, 'CLAUDE.md'),
      path.join(projectRoot, 'AGENTS.md'),
    ],
    [
      path.join(projectRoot, 'groups', 'global', 'CLAUDE.md'),
      path.join(projectRoot, 'groups', 'global', 'AGENTS.md'),
    ],
    [
      path.join(projectRoot, 'groups', 'main', 'CLAUDE.md'),
      path.join(projectRoot, 'groups', 'main', 'AGENTS.md'),
    ],
  ];

  for (const [src, dest] of explicitPairs) {
    if (copyIfMissing(src, dest)) {
      copied += 1;
      continue;
    }
    if (mergeLegacyIntoAgents(src, dest)) merged += 1;
  }

  const groupsDir = path.join(projectRoot, 'groups');
  if (!fs.existsSync(groupsDir)) return { copied, merged };

  for (const entry of fs.readdirSync(groupsDir)) {
    const groupDir = path.join(groupsDir, entry);
    if (!fs.statSync(groupDir).isDirectory()) continue;

    const legacyFile = path.join(groupDir, 'CLAUDE.md');
    const agentsFile = path.join(groupDir, 'AGENTS.md');
    if (copyIfMissing(legacyFile, agentsFile)) {
      copied += 1;
      continue;
    }
    if (mergeLegacyIntoAgents(legacyFile, agentsFile)) merged += 1;
  }

  return { copied, merged };
}

function migrateSessionDirs(projectRoot: string): number {
  const sessionsRoot = path.join(projectRoot, 'data', 'sessions');
  if (!fs.existsSync(sessionsRoot)) return 0;

  let copied = 0;
  for (const entry of fs.readdirSync(sessionsRoot)) {
    const groupRoot = path.join(sessionsRoot, entry);
    if (!fs.statSync(groupRoot).isDirectory()) continue;

    const legacyDir = path.join(groupRoot, '.claude');
    const codexDir = path.join(groupRoot, '.codex');
    if (!fs.existsSync(legacyDir) || fs.existsSync(codexDir)) continue;

    fs.cpSync(legacyDir, codexDir, { recursive: true });
    copied += 1;
  }

  return copied;
}

export function runCodexMigration(projectRoot = process.cwd()): MigrationSummary {
  const instructionResult = migrateInstructionFiles(projectRoot);
  const instructionFilesCopied = instructionResult.copied;
  const instructionFilesMerged = instructionResult.merged;
  const sessionDirsCopied = migrateSessionDirs(projectRoot);

  if (
    instructionFilesCopied > 0 ||
    instructionFilesMerged > 0 ||
    sessionDirsCopied > 0
  ) {
    logger.info(
      { instructionFilesCopied, instructionFilesMerged, sessionDirsCopied },
      'Applied one-time Codex migration from CLAUDE.md/.claude',
    );
  }

  return { instructionFilesCopied, instructionFilesMerged, sessionDirsCopied };
}
