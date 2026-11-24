import { describe, expect, it } from 'vitest';
import type { AuditEvent } from '../src/handlers/authorisation';
import { validateSettings, type SettingsV1 } from '../src/services/settings';

const base: SettingsV1 = {
  version: 1,
  watchedProjects: ['KW'],
  reviewerRoles: [],
  qualifiedRoles: [],
  writeBackEnabled: false,
  visibilityChosen: false,
  aiEnabled: false,
  killSwitch: false,
};

describe('P2.C1 settings validation (C-10.2, C-10.4, N-04(b))', () => {
  it('accepts a safe evidence-only configuration', () => {
    expect(validateSettings(base).ok).toBe(true);
  });

  it('rejects write-back with no visibility chosen (unsafe combination)', () => {
    const result = validateSettings({ ...base, writeBackEnabled: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('WRITE_BACK_NO_VISIBILITY');
  });

  it('rejects empty watched projects', () => {
    const result = validateSettings({ ...base, watchedProjects: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NO_WATCHED_PROJECT');
  });

  it('accepts empty roles as the valid first-run state (Arch §13.1); the gate, not settings, blocks actions', () => {
    expect(validateSettings(base).ok).toBe(true);
  });

  it('accepts write-back with visibility and a qualified role', () => {
    const result = validateSettings({
      ...base,
      writeBackEnabled: true,
      visibilityChosen: true,
      qualifiedRoles: ['group-qp'],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown version without throwing', () => {
    const result = validateSettings({ ...base, version: 2 as 1 });
    expect(result.ok).toBe(false);
  });
});

describe('P2.C1 before/after audit payload (G-5, I-6)', () => {
  it('emits codes only, never setting values or record text', async () => {
    const { auditSettingsChange } = await import('../src/services/settings');
    const events: AuditEvent[] = [];
    auditSettingsChange(base, { ...base, aiEnabled: true }, (e) => events.push(e));
    expect(events).toHaveLength(1);
    expect(events[0]!.actionCode).toBe('SETTINGS_CHANGED');
    expect(events[0]!.errorCode).toBe('AI_ENABLED');
    expect(JSON.stringify(events)).not.toContain('group-qp');
    expect(JSON.stringify(events)).not.toContain('true');
  });
});
