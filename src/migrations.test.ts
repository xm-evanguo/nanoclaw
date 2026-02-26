import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runCodexMigration } from './migrations.js';

describe('runCodexMigration', () => {
  let tmpRoot: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-migration-'));
    process.chdir(tmpRoot);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('copies legacy instruction files when AGENTS.md does not exist', () => {
    fs.mkdirSync(path.join(tmpRoot, 'groups', 'main'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'CLAUDE.md'), '# Root\n');
    fs.writeFileSync(
      path.join(tmpRoot, 'groups', 'main', 'CLAUDE.md'),
      '# Main\n',
    );

    const result = runCodexMigration();

    expect(result.instructionFilesCopied).toBeGreaterThanOrEqual(2);
    expect(result.instructionFilesMerged).toBe(0);
    expect(fs.readFileSync(path.join(tmpRoot, 'AGENTS.md'), 'utf-8')).toBe(
      '# Root\n',
    );
    expect(
      fs.readFileSync(path.join(tmpRoot, 'groups', 'main', 'AGENTS.md'), 'utf-8'),
    ).toBe('# Main\n');
  });

  it('merges legacy CLAUDE.md into existing AGENTS.md when content differs', () => {
    fs.writeFileSync(path.join(tmpRoot, 'CLAUDE.md'), '# Legacy\nRemember this.\n');
    fs.writeFileSync(path.join(tmpRoot, 'AGENTS.md'), '# Current\nUse new format.\n');

    const result = runCodexMigration();
    const merged = fs.readFileSync(path.join(tmpRoot, 'AGENTS.md'), 'utf-8');

    expect(result.instructionFilesCopied).toBe(0);
    expect(result.instructionFilesMerged).toBe(1);
    expect(merged).toContain('## Legacy CLAUDE.md (migrated)');
    expect(merged).toContain('Remember this.');
    expect(merged).toContain('nanoclaw-migration:legacy-claude');
  });

  it('is idempotent for merged instruction content', () => {
    fs.writeFileSync(path.join(tmpRoot, 'CLAUDE.md'), '# Legacy\nRemember this.\n');
    fs.writeFileSync(path.join(tmpRoot, 'AGENTS.md'), '# Current\nUse new format.\n');

    const first = runCodexMigration();
    const firstContent = fs.readFileSync(path.join(tmpRoot, 'AGENTS.md'), 'utf-8');
    const second = runCodexMigration();
    const secondContent = fs.readFileSync(path.join(tmpRoot, 'AGENTS.md'), 'utf-8');

    expect(first.instructionFilesMerged).toBe(1);
    expect(second.instructionFilesMerged).toBe(0);
    expect(secondContent).toBe(firstContent);
  });

  it('handles mixed state across groups (copy + merge)', () => {
    fs.mkdirSync(path.join(tmpRoot, 'groups', 'main'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'groups', 'global'), { recursive: true });

    // main: AGENTS exists + customized legacy
    fs.writeFileSync(
      path.join(tmpRoot, 'groups', 'main', 'AGENTS.md'),
      '# Main AGENTS\n',
    );
    fs.writeFileSync(
      path.join(tmpRoot, 'groups', 'main', 'CLAUDE.md'),
      '# Main legacy\ncustom memory\n',
    );

    // global: only legacy exists -> copy
    fs.writeFileSync(
      path.join(tmpRoot, 'groups', 'global', 'CLAUDE.md'),
      '# Global legacy\n',
    );

    const result = runCodexMigration();

    expect(result.instructionFilesCopied).toBe(1);
    expect(result.instructionFilesMerged).toBe(1);

    const mainAgents = fs.readFileSync(
      path.join(tmpRoot, 'groups', 'main', 'AGENTS.md'),
      'utf-8',
    );
    expect(mainAgents).toContain('custom memory');

    expect(
      fs.readFileSync(path.join(tmpRoot, 'groups', 'global', 'AGENTS.md'), 'utf-8'),
    ).toBe('# Global legacy\n');
  });

  it('copies legacy .claude session dirs into .codex', () => {
    const legacySessionDir = path.join(
      tmpRoot,
      'data',
      'sessions',
      'main',
      '.claude',
      'projects',
    );
    fs.mkdirSync(legacySessionDir, { recursive: true });
    fs.writeFileSync(path.join(legacySessionDir, 'session.jsonl'), '{}\n');

    const result = runCodexMigration();
    const codexSessionFile = path.join(
      tmpRoot,
      'data',
      'sessions',
      'main',
      '.codex',
      'projects',
      'session.jsonl',
    );

    expect(result.sessionDirsCopied).toBe(1);
    expect(fs.existsSync(codexSessionFile)).toBe(true);
  });
});
