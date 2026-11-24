# P1 evidence index (24 Nov 2026)

All files are raw command output saved at capture time. Nothing here contains a token, credential, Jira record text, quote, model I/O or personal data. Status words follow `AGENTS.md` §3.

## Final proof — P1.B2 / P1.B3

| Evidence | What it proves | Requirement |
|---|---|---|
| `check-2026-11-24T10-26-41-455Z.txt` | Final `npm run check` **PASS**: 5 approved runtime / 7 dev deps, import boundary, strict types, ESLint, manifest parity + root tie, format, **36 tests**, `forge lint` no issues. Root manifest is App A. | P1.B2, P1.B3, N-03(g), N-06, N-08, RV-15 |
| `deploy-app-a-migration-2026-11-24T10-21-00-917Z.txt` | App A `developer-spaces` deployed to **development** as v2.1.0 with the empty migration runner; lint clean; eligible for Runs on Atlassian. | P1.B2, P1.B3 |
| `deploy-app-b-2026-11-24T10-23-18-714Z.txt` | App B `Knewwhen-judge` deployed to **development** as v2.0.0 from the same commit with only the app id switched. | P1.B2, N-08 |
| `install-app-b-2026-11-24T10-24-37-037Z.txt` | App B install on `one-atlas-ttud.atlassian.net` completed (`✔ Install in Jira complete!`), plus `forge install list --json` showing install id `c52a706c-…`, `appVersion 2`, `Up-to-date`. | P1.B2 |
| `install-list-2026-11-24T10-13-20-377Z.txt` | App A install verified: install id `78041f68-…`, Jira, `appVersion 2`, `Up-to-date`. | P1.B2 |
| `upgrade-app-a-2026-11-24T10-22-20-950Z.txt` | Post-deploy upgrade check: "Site is already at the latest version" (deploy had already picked up the new code). | P1.B2 |
| `eligibility-app-a-2026-11-24T10-14-44-987Z.txt` | `forge eligibility` PASS for deployed development v2.0.0. **Eligibility, not an award** (I-13). | P1.B3, I-13 |
| `app-ids-2026-11-24.md` | Both owner-created app ARIs, recorded under P1.B4. | P1.B4, Arch §17.2 |

## Verification and correction evidence (24 Nov 2026, later pass)

| Evidence | What it proves | Requirement |
|---|---|---|
| `check-2026-11-24T11-52-20-648Z.txt` | `npm run check` **PASS** after the trigger-event correction: **37 tests** in 6 files, strict types, lint, manifest parity + root tie, format, `forge lint` "No issues found". | D-VB-01, N-06, N-08, RV-15 |
| `deploy-app-a-events-fix-2026-11-24T11-55-13-759Z.txt` | App A redeployed to **development** as v2.2.0 with the five official Jira event identifiers; lint clean; eligible for Runs on Atlassian. | D-VB-01, C-01, P1.B3 |
| `deploy-app-b-events-fix-2026-11-24T11-57-52-997Z.txt` | App B redeployed to **development** as v2.1.0 from the same corrected model. | D-VB-01, N-08 |
| `upgrade-app-a-events-fix-2026-11-24T11-57-18-891Z.txt`, `upgrade-app-b-events-fix-2026-11-24T11-58-59-150Z.txt` | Both demo-site installs upgraded; "Site is already at the latest version" after the deploys. | P1.B2 |
| `orchestrator-confirm-2026-11-24T11-37-03-990Z.txt` | Orchestrator's own re-run of `npm run check` on commit `16ae7bd` before the correction: PASS, 36 tests. | §13.5 |

**Verification outcomes (reports are in the session record):**
- **Verification B initial: FAIL**, one Major (D-VB-01 — invalid Jira event identifiers). **B re-review after fix: PASS** on closure, no new Blocker or Major. B is a read-only context with no shell; its command claims are Inferred, not independently run.
- **Verification A: Blocked**, not Passed. Blind browser journey confirmed both apps present as `DEV` installs with reachable admin/panel shells, the exact decision-support sentence, and no verdict wording on reachable surfaces (Partial Pass). No sample data, no functional Core surfaces, no clean outside-organisation install and no mutating judge steps. The shell-only state is expected for P1; full Core acceptance stays Blocked.

**Manifest candidate hashes for M-1 (SHA-256, after the correction, 24 Nov 2026):** App A and root `manifest.yml` `296315D7594656E76C6240128D983E50075CBFC2547B64F4B3195EFF30BECD62` (byte-identical, RV-15); App B `37A0CF54665E8E13701F9E1F9E81F21F022543C67C9278E9E07371E7F40AF5BA`; `manifests/baseline.json` `67C618FC831EF1383D095F66E838949F6E141933EF70535C44130274AF11BC69`. These are a candidate record only — the manifest is **not frozen** until M-1.

## Retained failure probes (root cause fixed; not claims of success)

| Evidence | Failure and fix |
|---|---|
| `deploy-app-a-2026-11-24T10-01-08-981Z.txt` | First bundling failure under `noEmit: false`. Fixed by emitting JS for the Forge bundler. |
| `deploy-app-a-2026-11-24T10-04-30-302Z.txt` | `Can't resolve './adapters/forge-resolver.js'` with `NodeNext` + `.js` specifiers. Fixed by `module: ESNext`, `moduleResolution: Bundler`, extensionless imports (PF-RUN-7, D-011). |
| `install-app-a-2026-11-24T10-06-36-493Z.txt` | Bare `-s one-atlas-ttud` became `https://one-atlas-ttud/` and was rejected. Fixed with the full site URL or `-d` (PF-RUN-5). |
| `install-app-a-2026-11-24T10-06-55-037Z.txt` | Server-side error on the full URL; the request had in fact completed — the next attempt reported a duplicate install. No code change. |
| `install-app-a-2026-11-24T10-07-25-022Z.txt` | `getaddrinfo ENOTFOUND o55978.ingest.sentry.io` from CLI Sentry telemetry. Fixed by `forge settings set usage-analytics false` (PF-RUN-6, D-011). The original ~6.3 MB capture repeated one stack trace thousands of times; this file is a labelled excerpt with the distinct error lines preserved verbatim. |
| `install-app-a-2026-11-24T10-11-50-091Z.txt` | Duplicate-install error proving App A was already installed; confirmed with `install-list`. No code change. |

## Earlier P1 baseline checks

`check-2026-11-24T04-*` through `check-2026-11-24T09-*` record the P1.A toolchain, hook probes, P1.B1 manifests and both app IDs. `setup-probe-2026-11-24T04-36-33Z.txt` records the harness setup probe.

## Not verified here

- A **clean** outside-organisation install and the full mutating judge journey (steps 1–9): Verification A observed the apps and shells but was Blocked on both (PF-V-3).
- Live execution of the empty SQL migration: `forge logs -e development -f scheduled -s 2d` returned no invocation (PF-SQL-2 **Unresolved**).
- P1 phase acceptance: B passes after the fix, A is Blocked, and no different model family was available for the two verifier contexts. P1 stays **Active, not Accepted** (PF-V-4, AGENTS §13.5).
- Production deploy, listing, publish and share — owner-gated (§10.2).
