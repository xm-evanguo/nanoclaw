import { runCodexMigration } from '../src/migrations.js';

const result = runCodexMigration(process.cwd());

console.log('=== NANOCLAW MIGRATION: CODEX ===');
console.log(`INSTRUCTION_FILES_COPIED: ${result.instructionFilesCopied}`);
console.log(`INSTRUCTION_FILES_MERGED: ${result.instructionFilesMerged}`);
console.log(`SESSION_DIRS_COPIED: ${result.sessionDirsCopied}`);
console.log('STATUS: success');
console.log('=== END ===');
