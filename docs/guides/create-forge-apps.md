# Create the two KnewWhen Forge apps (owner task P1.B4)

**Version:** 1.0 · **Date:** 24 Nov 2026 · **Owner:** the KnewWhen owner · **Status:** Verified procedure from official Atlassian docs and the local CLI; not yet executed.
**Authority:** `AGENTS.md` §0.1 (verify before depending), §3 (status words), §10.2 (who may create/deploy/publish), §16.2 (secrets).
**Requirement IDs:** P1.B4 (owner-owned), P1.B2 (app shell and install), P1.B1 (manifest templates), N-03(a), N-08; decisions D-008, D-009, D-010.
**Purpose:** obtain two real Forge app IDs (ARIs) so the approved manifest templates can be finalised, linted and deployed. This guide **does not** deploy, install, publish or share anything.

---

## 1. What you are creating

KnewWhen uses one codebase and two registered Forge apps:

| App | Purpose | Constraint |
|---|---|---|
| **App A** | Marketplace listing identity. | May have a `licensing` block only if the listing needs one (still an owner/listing determination). |
| **App B** | Judge installation-link identity. | Must remain **unlicensed** and shareable by link; it is frozen after the last outside-organisation test. |

You are creating only the **registrations** and their IDs. The generated starter code is disposable: the P1.B2 work puts the approved KnewWhen manifest and source into the app later, from the same commit.

**You do not need to choose modules, scopes or templates carefully.** Any Jira/UI Kit template is fine because only the generated `app.id` is used.

---

## 2. Before you start (Verified 24 Nov 2026)

- You are already logged in (`forge whoami` verified the owner account) and the demo site `one-atlas-ttud` is active. Do **not** create another site.
- Every new Forge app must belong to a **Developer Space**. Check what you have first (§3).
- Use a scratch folder **outside** `C:\Users\LOUJAN B\Knewwhen`. Do not create apps inside the repository: `forge create` writes a second `manifest.yml` and a `package.json`, which would break the project's single-manifest checks.
- Never paste an Atlassian API token, password, account ID or any credential into chat, a file, a prompt or a command line. A `forge login` token is prompted for interactively; you have already logged in, so this guide needs no credential at all.

---

## 3. Step 0 — check your Developer Space

Run:

```powershell
forge developer-spaces list
```

- If at least one space is listed, note its **id** (or name). You can pass it with `-s <space-id>` to skip the selection prompt.
- If none is listed, create one in the Developer Console: go to <https://developer.atlassian.com/>, select the profile icon → **Developer Console**, then **Create Developer Space** from the space switcher (or the banner), give it a name (letters, numbers, spaces, dashes and underscores only), and select **Create**. The first creator becomes space admin and billing admin; you may be asked for billing consent or a payment method. An empty space also offers to create an app.

**Why this matters:** apps not assigned to a Developer Space have CLI workflows and console access blocked, and customers cannot interact with them (official "Create a Developer Space" and "Work with apps in Developer Spaces" pages).

---

## 4. Step 1 — create App A

From a scratch folder, not the repository:

```powershell
mkdir "C:\Users\LOUJAN B\forge-apps"
cd "C:\Users\LOUJAN B\forge-apps"
forge create
```

Answer the prompts (official Jira hello-world flow):

1. **App name** (up to 50 characters) — suggest `knewwhen-listing`.
2. **Atlassian app** — `Jira`.
3. **Category** — `UI Kit`.
4. **Template** — `jira-issue-panel` (any UI Kit template works; only the ID is kept).
5. **Developer Space** — select the space from Step 0, or supply `-s <space-id>` on the command.
6. Read and accept the terms if prompted. `-y` accepts them without prompting; only use it if you have read them.

If you prefer one command with the space fixed and the interactive template prompts retained:

```powershell
forge create -s <space-id>
```

Local CLI is `15.1.0`; its `forge create --help` lists `--template`, `--directory`, `--developer-space-id`, `--personal` and `--accept-terms`. The current online reference also lists `--preset`, `--skip-dependencies` and `--non-interactive`, which this local version does **not** show — stick to the interactive prompts above.

Do **not** pass `--personal`: every KnewWhen app must live in the Developer Space.

---

## 5. Step 2 — copy only the App A ID

Open the generated `manifest.yml` in `C:\Users\LOUJAN B\forge-apps\<app-name>\manifest.yml`. Find the `app.id` value. It is an Atlassian resource identifier of this shape:

```yaml
app:
  id: "ari:cloud:ecosystem::app/406d303d-0393-4ec4-ad7c-1435be94583a"
```

The UUID above is an official documentation example, **not** a KnewWhen ID. Your value will be different. Send me the **full ARI**, with the `ari:cloud:ecosystem::app/` prefix, labelled **App A**. A bare UUID is not enough.

You do not need to send the rest of the generated manifest. The app ID is an identifier, not a credential; nothing else from that folder should be pasted into the repository.

---

## 6. Step 3 — create App B and copy its ID

Repeat §4 in the same scratch folder with a different name, then copy its `app.id` as in §5:

```powershell
cd "C:\Users\LOUJAN B\forge-apps"
forge create -s <space-id>
```

Suggested name: `knewwhen-judge`. Use the same Developer Space. Select any Jira/UI Kit template again. Send the second full ARI labelled **App B**.

The two ARIs must be different. If you accidentally repeat a name and the CLI reports the app already exists, choose a different name rather than reusing the first registration.

---

## 7. Step 4 — what I do with the two IDs

1. Write them into `manifests/app-config.json` (currently `app-a-placeholder` / `app-b-placeholder`).
2. Re-render `manifests/app-a.yml` and `manifests/app-b.yml` and run `npm run check`; the locked-file hook will require an approval tag, using the existing owner decision D-009.
3. In P1.B2, create the repository's single root `manifest.yml` from the App A template, run `forge lint`, deploy to the development environment and install on `one-atlas-ttud`, recording the real results.
4. Nothing is deployed, listed, published or shared by this ID step.

---

## 8. Alternative: create in the Developer Console

If you create the apps through the Developer Console instead of the CLI, open each app in the console and read **App ID** from its **Overview** page (the "App details" panel). Send those two full ARIs with the same A/B labels. The CLI route is recommended because it also writes the exact ARI into a manifest you can read without interpreting the UI.

If an app shows **Assign** in the Developer Space column, select it and assign it to your space before continuing. Do not transfer an app during the first two days of a month (invoice pending).

---

## 9. Do not do these

- Do not run `forge create`, `forge register`, `forge deploy` or `forge install` inside the KnewWhen repository.
- Do not run `forge register` on any folder containing our approved manifest: it **replaces** `app.id` with a new registration and would break the two-app identity.
- Do not add a `licensing` block to App B, enable sharing, create a Marketplace listing, or submit to Devpost. The owner alone performs those later, with approval.
- Do not paste tokens, credentials, account IDs or record text into chat, files, prompts, logs or commits.

---

## 10. Troubleshooting (from the official pages)

| Symptom | Action |
|---|---|
| "No available spaces" | Create a Developer Space (§3) first. |
| App appears with an **Assign** button | Assign it to the target space; only space Admins/Developers with app admin rights can do this. |
| CLI or console workflows blocked for the app | Developer Space setup is incomplete; complete setup and billing consent, then retry. |
| "name is null or longer than 50 characters" | Re-run with a name of 1–50 characters. |
| Want to undo an accidental second registration | Do not silently rewrite history. Tell me; restore the previous `app.id` in the affected folder is documented by Atlassian, but KnewWhen's manifest changes need an owner decision tag. |

---

## 11. Official sources (all opened 24 Nov 2026)

- Overview of Developer Spaces — <https://developer.atlassian.com/platform/forge/developer-space/developer-spaces-introduction/>
- Create a Developer Space — <https://developer.atlassian.com/platform/forge/developer-space/create-developer-space/>
- Work with apps in Developer Spaces — <https://developer.atlassian.com/platform/forge/developer-space/developer-space-apps/>
- Build and launch your Forge app — <https://developer.atlassian.com/platform/forge/build-and-launch-your-forge-app/>
- Build a Jira hello world app (`forge create` flow) — <https://developer.atlassian.com/platform/forge/build-a-hello-world-app-in-jira/>
- CLI reference: create — <https://developer.atlassian.com/platform/forge/cli-reference/create/>
- CLI reference: developer-spaces — <https://developer.atlassian.com/platform/forge/cli-reference/developer-spaces/>
- CLI reference: register — <https://developer.atlassian.com/platform/forge/cli-reference/register/>
- CLI reference: install — <https://developer.atlassian.com/platform/forge/cli-reference/install/>
- Manifest overview (`app.id` is a CLI-supplied ARI) — <https://developer.atlassian.com/platform/forge/manifest-reference/>
- Manage your apps (Developer Console → App ID) — <https://developer.atlassian.com/platform/forge/manage-your-apps/>
- Local command output: `forge create --help`, `forge developer-spaces --help`, `forge --help` (CLI `15.1.0`, 24 Nov 2026).

These facts are recorded in `docs/platform-facts.md` §15. No product decision is made by this guide.
