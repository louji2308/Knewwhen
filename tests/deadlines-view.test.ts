import { describe, expect, it } from 'vitest';
import type { ResolverEnvelope } from '../src/contracts/envelope';
import { deadlinesViewModel, DEADLINES_UI_STRINGS } from '../src/frontend/deadlines-view';
import { scanWording } from '../src/core/wording';

function envelope(
  data: unknown,
  code: ResolverEnvelope<unknown>['code'] = 'OK',
): ResolverEnvelope<unknown> {
  return { data, code, roleHint: 'REVIEWER', correlationId: 'corr-1' };
}

describe('P9.C1 deadlines view model (C-05.8/11, C-11, I-5/I-6)', () => {
  it('turns computed clocks into sensitivity lines without inventing constants', () => {
    const model = deadlinesViewModel(
      envelope({
        status: 'COMPUTED',
        preview: false,
        results: [
          {
            entryId: 'entry-1',
            effectiveDate: '2026-11-24',
            basis: 'JIRA_RECORD_TIMESTAMP',
            clocks: [
              {
                clockId: 'CAL-30',
                label: 'Synthetic calendar clock',
                dueDate: '2026-12-24',
                calendarDaysRemaining: 30,
                workDaysRemaining: 22,
                state: 'OPEN',
                trace: [],
              },
            ],
          },
        ],
        missing: [],
      }),
    );
    expect(model.kind).toBe('RESULT');
    expect(model.sensitivity[0]).toBe('If this was the first knowledge: 30 days left');
    expect(model.clocks[0]).toMatchObject({ clockId: 'CAL-30', dueDate: '2026-12-24' });
  });

  it('shows a preview banner and never uses numbers on a blocked result', () => {
    const preview = deadlinesViewModel(
      envelope({ status: 'COMPUTED', preview: true, results: [], missing: [] }),
    );
    expect(preview.banner).toBe(DEADLINES_UI_STRINGS.preview);
    const blocked = deadlinesViewModel(
      envelope({ status: 'BLOCKED', code: 'RULE_SET_UNREVIEWED' }),
    );
    expect(blocked.kind).toBe('BLOCKED');
    expect(blocked.clocks).toEqual([]);
    expect(blocked.sensitivity).toEqual([]);
    expect(blocked.message).toBe(DEADLINES_UI_STRINGS.unreviewed);
  });

  it('discards extra fields and passes the wording guard', () => {
    const model = deadlinesViewModel(
      envelope({
        status: 'COMPUTED',
        preview: false,
        quote: 'record text must not pass',
        results: [],
        missing: [],
      }),
    );
    expect(JSON.stringify(model)).not.toContain('record text must not pass');
    expect(scanWording([...model.sensitivity, model.message, model.banner])).toEqual({
      status: 'CLEAN',
    });
  });
});
