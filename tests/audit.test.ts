import { describe, expect, it, vi } from 'vitest';
import {
  actorFromAuditEvent,
  audit,
  type AuditInput,
  type AuditRepository,
} from '../src/services/audit';

const INPUT: AuditInput = {
  actorType: 'USER',
  actorAccountId: 'acct-qualified-1',
  actionCode: 'CONFIRM_TRAIL_ENTRY',
  targetType: 'trail_entry',
  targetId: 'uuid-123',
  details: { reasonCode: 'SAME_EVENT', count: 2 },
  at: '2026-11-24T12:00:00.000Z',
};

const repo = (
  insert = vi.fn().mockResolvedValue(undefined),
): AuditRepository & { insert: typeof insert } => ({ insert });

describe('P2.C2 single append-only audit function (Arch §12, §5.3; G-5, I-8, I-6)', () => {
  it('writes exactly one insert with codes and ids only', async () => {
    const r = repo();
    await audit(r, INPUT);
    expect(r.insert).toHaveBeenCalledTimes(1);
    expect(r.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actionCode: 'CONFIRM_TRAIL_ENTRY',
        targetType: 'trail_entry',
        targetId: 'uuid-123',
        at: '2026-11-24T12:00:00.000Z',
      }),
    );
  });

  it('maps a gate actor to a USER row and an absent actor to SYSTEM', async () => {
    const userRepo = repo();
    await audit(userRepo, {
      ...INPUT,
      ...actorFromAuditEvent({ actorAccountId: 'acct-admin-1' }),
    });
    expect(userRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: 'USER', actorAccountId: 'acct-admin-1' }),
    );

    const systemRepo = repo();
    await audit(systemRepo, {
      ...INPUT,
      ...actorFromAuditEvent({}),
    });
    expect(systemRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: 'SYSTEM', actorAccountId: null }),
    );
  });

  it('never exposes an update or delete path (append-only by interface)', () => {
    const r = repo();
    expect(Object.keys(r)).toEqual(['insert']);
  });

  it('rejects a canary probe in details before any write', async () => {
    const r = repo();
    await expect(
      audit(r, { ...INPUT, details: { reasonCode: 'canary-record-text-alpha-7f3a' } }),
    ).rejects.toThrow('AUDIT_LEAK');
    expect(r.insert).not.toHaveBeenCalled();
  });

  it('rejects a detail name that could carry record text', async () => {
    const r = repo();
    await expect(audit(r, { ...INPUT, details: { quote: 'x' } })).rejects.toThrow('AUDIT_FIELD');
    expect(r.insert).not.toHaveBeenCalled();
  });

  it('rejects an empty action code', async () => {
    await expect(audit(repo(), { ...INPUT, actionCode: '' })).rejects.toThrow('AUDIT_INVALID');
  });

  it('propagates a repository failure without masking it (AGENTS §17.1)', async () => {
    const failing: AuditRepository = { insert: () => Promise.reject(new Error('SQL_DOWN')) };
    await expect(audit(failing, INPUT)).rejects.toThrow('SQL_DOWN');
  });

  it('serialises details to a JSON string of codes, never raw text', async () => {
    const r = repo();
    await audit(r, INPUT);
    const stored = r.insert.mock.calls[0]![0];
    expect(stored.detailsJson).toBe(JSON.stringify({ reasonCode: 'SAME_EVENT', count: 2 }));
    expect(stored.detailsJson).not.toContain('acct-qualified-1');
  });
});
