import { describe, expect, it } from 'vitest';

import { computeVerifyStatus, hasRuntimeAuthKey } from './verify.js';

describe('hasRuntimeAuthKey', () => {
  it('accepts CODEX_API_KEY', () => {
    expect(hasRuntimeAuthKey('CODEX_API_KEY=sk-test')).toBe(true);
  });

  it('accepts OPENAI_API_KEY', () => {
    expect(hasRuntimeAuthKey('OPENAI_API_KEY=sk-test')).toBe(true);
  });

  it('rejects env files without an auth key', () => {
    const env = [
      'OPENAI_BASE_URL=https://api.openai.com/v1',
      'OPENAI_MODEL=gpt-5',
      'OPENAI_ORG_ID=org_123',
    ].join('\n');

    expect(hasRuntimeAuthKey(env)).toBe(false);
  });
});

describe('computeVerifyStatus', () => {
  it('fails when Docker is unavailable', () => {
    const status = computeVerifyStatus({
      service: 'running',
      containerRuntime: 'none',
      credentials: 'configured',
      whatsappAuth: 'authenticated',
      registeredGroups: 1,
    });

    expect(status).toBe('failed');
  });

  it('fails when auth key is missing', () => {
    const status = computeVerifyStatus({
      service: 'running',
      containerRuntime: 'docker',
      credentials: 'missing',
      whatsappAuth: 'authenticated',
      registeredGroups: 1,
    });

    expect(status).toBe('failed');
  });

  it('succeeds only when all required checks pass', () => {
    const status = computeVerifyStatus({
      service: 'running',
      containerRuntime: 'docker',
      credentials: 'configured',
      whatsappAuth: 'authenticated',
      registeredGroups: 1,
    });

    expect(status).toBe('success');
  });
});
