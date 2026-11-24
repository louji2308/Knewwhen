/**
 * P9 — the single runtime seam for bundled rule data. The locked `rules/*.json`
 * inputs and the practitioner-reviewed question set are not present in this
 * repository. Passing no raw data to the strict loader is deliberate: no
 * regulatory content, question, answer code or rule bundle is invented here
 * (I-7, AGENTS §7.2). When approved rule data is supplied, replace only the raw
 * source in this module; the loader and all consumers stay unchanged.
 */

import type { RuleBundle } from '../services/deadline';
import { loadQuestionSet, type LoadedQuestionSet } from '../services/question-set';

export const runtimeQuestionSet: LoadedQuestionSet = loadQuestionSet(undefined);

/** No approved rule bundle exists, so deadline calculation stays unavailable. */
export const runtimeRuleBundle: RuleBundle | null = null;

export function currentQuestionSet() {
  return runtimeQuestionSet.status === 'LOADED' ? runtimeQuestionSet.questionSet : null;
}
