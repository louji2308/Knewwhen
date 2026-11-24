import { describe, expect, it } from 'vitest';
import {
  analyseWithLlm,
  buildLlmPrompt,
  LlmGatewayError,
  type LlmGateway,
  type LlmPolicy,
  type LlmState,
} from '../src/services/scan/llm';

const policy: LlmPolicy = {
  aiEnabled: true,
  killSwitch: false,
  promptVersion: 'prompt-v1',
  modelId: 'model-v1',
  maxSegmentsPerCall: 2,
  perIssueLimit: 3,
  perSiteLimit: 10,
  breakerThreshold: 2,
};

const state: LlmState = { issueCalls: 0, siteCalls: 0, invalidStreak: 0, breakerOpen: false };

const segments = [
  { segmentId: 'seg-1', text: 'alpha device event observed' },
  { segmentId: 'seg-2', text: 'second synthetic segment' },
];

function gateway(responses: readonly string[]): LlmGateway & { calls: number } {
  let index = 0;
  return {
    calls: 0,
    async call(request) {
      expect(request.prompt).toContain('untrusted');
      expect(request.segmentIds).toEqual(['seg-1', 'seg-2']);
      this.calls += 1;
      const response = responses[index] ?? '{';
      index += 1;
      return { text: response };
    },
  };
}

describe('P6.B1 LLM client contract (C-01.3, C-01.9, Arch §7.4–7.5)', () => {
  it('builds a delimited untrusted-data prompt without returning model input', () => {
    const prompt = buildLlmPrompt(segments, policy.promptVersion);
    expect(prompt).toContain('untrusted');
    expect(prompt).toContain('<KW_RECORD>');
    expect(prompt).toContain('seg-1');
    expect(prompt).not.toContain('confidence');
  });

  it('accepts a strict proposal set and consumes one call from both caps', async () => {
    const fake = gateway(['{"proposals":[{"segmentId":"seg-1","quote":"alpha device"}]}']);
    const result = await analyseWithLlm(segments, fake, policy, state);
    expect(result.outcome.status).toBe('PROPOSALS');
    if (result.outcome.status !== 'PROPOSALS') return;
    expect(result.outcome.proposals).toEqual([{ segmentId: 'seg-1', quote: 'alpha device' }]);
    expect(result.nextState).toEqual({ ...state, issueCalls: 1, siteCalls: 1 });
  });

  it('makes one repair retry before falling back on malformed output', async () => {
    const fake = gateway([
      '{"proposals":[{"segmentId":"seg-1","quote":"alpha","extra":1}]}',
      '{"proposals":[{"segmentId":"seg-1","quote":"alpha"}]}',
    ]);
    const result = await analyseWithLlm(segments, fake, policy, state);
    expect(fake.calls).toBe(2);
    expect(result.outcome.status).toBe('PROPOSALS');
    expect(result.nextState.invalidStreak).toBe(0);
  });

  it.each([
    ['not json', 'LLM_INVALID'],
    ['{"proposals":[{"segmentId":"unknown","quote":"alpha"}]}', 'LLM_INVALID'],
    ['{"proposals":[{"segmentId":"seg-1","quote":"alpha","role":"QP"}]}', 'LLM_INVALID'],
    ['{"proposals":[],"confidence":0.9}', 'LLM_INVALID'],
  ])('falls back with a reason code for unsafe output', async (text, reasonCode) => {
    const fake = gateway([text, text]);
    const result = await analyseWithLlm(segments, fake, policy, state);
    expect(result.outcome).toEqual({ status: 'FALLBACK', reasonCode });
    expect(JSON.stringify(result.outcome)).not.toContain('alpha');
  });

  it('does not call the model when AI is off, killed, capped or tripped', async () => {
    const fake = gateway(['{"proposals":[]}']);
    const cases: ReadonlyArray<[Partial<LlmPolicy>, Partial<LlmState>, string]> = [
      [{ aiEnabled: false }, {}, 'LLM_BLOCKED'],
      [{ killSwitch: true }, {}, 'LLM_BLOCKED'],
      [{}, { breakerOpen: true }, 'LLM_BLOCKED'],
      [{}, { issueCalls: policy.perIssueLimit }, 'LLM_DEFERRED'],
      [{}, { siteCalls: policy.perSiteLimit }, 'LLM_DEFERRED'],
    ];
    for (const [policyPatch, statePatch, reasonCode] of cases) {
      const result = await analyseWithLlm(
        segments,
        fake,
        { ...policy, ...policyPatch },
        { ...state, ...statePatch },
      );
      expect(result.outcome).toEqual({ status: 'FALLBACK', reasonCode });
    }
    expect(fake.calls).toBe(0);
  });

  it('opens the breaker after the configured invalid streak without echoing output', async () => {
    const fake = gateway(['{', '{']);
    const first = await analyseWithLlm(segments, fake, policy, state);
    const second = await analyseWithLlm(segments, fake, policy, first.nextState);
    expect(second.nextState.breakerOpen).toBe(true);
    const third = await analyseWithLlm(segments, fake, policy, second.nextState);
    expect(third.outcome).toEqual({ status: 'FALLBACK', reasonCode: 'LLM_BLOCKED' });
    expect(fake.calls).toBe(4);
  });

  it('maps typed gateway failures to codes and keeps the body out of the result', async () => {
    const timeout: LlmGateway = {
      async call() {
        throw new LlmGatewayError('LLM_TIMEOUT');
      },
    };
    const result = await analyseWithLlm(segments, timeout, policy, state);
    expect(result.outcome).toEqual({ status: 'FALLBACK', reasonCode: 'LLM_TIMEOUT' });
    expect(JSON.stringify(result.outcome)).not.toContain('alpha');
  });
});
