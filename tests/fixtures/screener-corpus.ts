/**
 * P3.B2 — labelled synthetic screener corpus. Text is transcribed from the
 * canonical demo dataset (Workflow and UI demo.md §10, records H1–H5, A1, A2).
 * All names are fictional (I-12). Labels are authored from the scenario IDs,
 * never from screener output.
 */

import type { LabelledSegment } from '../../src/core/screener-metrics';

export const SCREENER_CORPUS: readonly LabelledSegment[] = [
  {
    id: 'H1',
    label: 'SIGNAL',
    category: 'SC-1',
    text: 'Phone note from Clinic North: the Alpha app froze during dose calculation yesterday and the nurse finished the calculation by hand. They said the patient was sent to the emergency room as a precaution. Passing to engineering.',
  },
  {
    id: 'A1',
    label: 'SIGNAL',
    category: 'SC-1',
    text: 'Our nurse reports the app froze during dose calculation on Tuesday. The patient went to the ER for observation.',
  },
  {
    id: 'H4',
    label: 'SIGNAL',
    category: 'SC-2',
    text: 'After a locale change the Beta app converts readings twice, so values appear in the wrong unit.',
  },
  {
    id: 'H5',
    label: 'SIGNAL',
    category: 'SC-2',
    text: 'Customer says the readings in the Beta app look far too low compared with the meter display.',
  },
  {
    id: 'H2',
    label: 'NO_SIGNAL',
    category: 'SC-4',
    text: 'The Alpha app froze on the login screen after the update. No patient was involved; restarting the tablet fixed it.',
  },
  {
    id: 'H3',
    label: 'NO_SIGNAL',
    category: 'SC-4',
    text: 'Nurses would like the Alpha app to show each step of the dose calculation on screen.',
  },
  {
    id: 'A2',
    label: 'NO_SIGNAL',
    category: 'SC-3',
    text: 'Please add a dark mode option to the settings screen.',
  },
];
