# Local verification-preparation pack

**Date:** 25 Nov 2026 · **Status:** Draft preparation only · **Not a Verification A or Verification B report** · **No phase is Accepted.**

This pack makes the remaining work executable without pretending that it has already been performed. It was written from the canonical requirements and the verified repository state. It contains no credential, Jira record text, quote, model I/O or personal data.

## Documents

| File | Purpose | Status |
|---|---|---|
| `verification-a-scenarios.md` | Blind, black-box scenario list to be handed to a separate Verification A context before it touches the product. | Written; **Blocked** from execution until a clean outside-organisation install and non-shell build exist. |
| `verification-b-checklist.md` | White-box adversarial checklist for a separate Verification B context. | Written; local evidence mapped, independent adversarial execution **pending**. |
| `evidence-pack-index.md` | `C-12` evidence-pack index: what exists, what is partial and what is missing. | Written; pack is **partial**, not release-complete. |
| `integration-adapter-checklist.md` | Every production port/source that is still absent or unobserved in the Forge adapter. | Written; most ports **Not injected** and fail closed by design. |

## Independence rules for later execution

- Verification A must be a separate context. It receives the requirement documents and the scenario list; it does **not** receive `TODO.md`, `Implementation plan.md`, handoff notes, builder reports or this pack's conclusions about implementation.
- Verification B must be a separate context from both the builder and A. It completes its initial findings before it is shown A's findings (AGENTS §13.3).
- A different model family is not available in this harness. That limitation is recorded; it is not an owner ruling or a §13.5 exception.
- A task review is not phase acceptance. Passing local unit tests is not evidence of a running-product journey.

## Verified baseline used for this pack

- Branch: `master`; repository clean at preparation start.
- Baseline commit: `de6230c` (`docs(ledger): record P10 checkpoint SHA`); preparation checkpoint: `892a7b0` (`docs(prep): add verification preparation pack`).
- Full gate before this pack: `evidence/P1/check-2026-11-25T06-14-01-910Z.txt` — PASS, 67 test files, 519 tests, strict types, ESLint, Prettier, manifest parity, import boundary and `forge lint` “No issues found”.
- Full gate after adding this pack: `evidence/P1/check-2026-11-25T07-19-34-415Z.txt` — PASS with the same 67 files and 519 tests; no source or manifest changed.
- Final gate after ledger reconciliation: `evidence/P1/check-2026-11-25T07-23-53-563Z.txt` — PASS, same 67 files and 519 tests; only documentation and this evidence pack changed.
- Node `v24.22.3`; npm `11.19.1`; Forge CLI `15.1.0`.
- Installed demo apps remain development shell builds: App A v2.2.0 and App B v2.1.0 on `one-atlas-ttud`. No current Core build has been deployed or installed.

## What this pack does not do

It does not deploy, publish, submit, share, create a public link, make a live paid model call, invent rule data, alter `docs/Project/`, or mark any phase Accepted. It only prepares evidence and makes the residual gates explicit.
