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

- Browser confirmation that the app appears under Jira Apps, the admin page opens, and the panel shows its loading state — installation records exist, but no clean-site UI journey was run.
- Live execution of the empty SQL migration: the runner is deployed on the approved daily trigger, but no invocation was observed (PF-SQL-2 **Unresolved**).
- Verification A and Verification B, outside-organisation install, production deploy, listing, publish and share. These remain conditional (AGENTS §13, §10.2).
