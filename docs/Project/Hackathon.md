# Codegeist 2026 — KnewWhen Competition Rulebook & Judging Strategy

> **Purpose:** what KnewWhen must do to qualify, what judges score, what evidence to show, and what must be ready to submit.
> **Verified against official sources on 23 Nov 2026.** Official rules can be amended at any time (Rules §11.5), so re-check the Rules page before submitting.
> **Tags used below:** **[Official]** = stated by the current rules or Atlassian docs · **[Internal]** = KnewWhen's own plan or recommendation, *not* a rule · **[Unverified]** = ambiguous, contradictory, or not confirmable from public sources.

---

## Read first — points that change the plan

1. **The two-app structure in `Knewwhen.md` is not optional; the platform forces it.** An app that has been *submitted for Marketplace listing* can no longer be shared through an installation link. The rules require an installation link for judges *and* the Marketplace bonus requires a listing or review-ticket link. So App A (listing) and App B (judge install link) are both needed. See §8 and §9.
2. **"Runs on Atlassian eligible" is not a 2026 prize track.** The 2024/2025 editions had a Best Runs on Atlassian bonus. The 2026 rules list four bonuses: Best Agents, Best app with Atlassian MCP, Best apps with Teamwork Graph integration, and Best Marketplace published app. Runs on Atlassian is still a real, automatically applied badge, so keep it as a product fact, not as a competition claim. See §2 and §5.
3. **The official deadline is 01:30 IST on Wed 23 Dec 2026** (12:00 pm PT on Tue 22 Dec). It is not "22 Dec IST". See §13.
4. **Forge LLM usage is billed to the developer with no free allowance, and Codegeist provides no credits.** The judge copy (App B) will incur real cost for every LLM call a judge triggers. See §2 and §14.
5. **Bonus prizes are score-ranked, not a checkbox.** Bonus winners are the highest-scoring eligible submissions for that bonus, so the five criteria matter for the Marketplace bonus too. See §5 and §8.
6. **Judges will punish a "single hardcoded demo path."** That phrase is in the Technological Implementation criterion. KnewWhen's one-click sample scenario is helpful for judges but must not be the only thing that works. See §7.

---

## 1. Competition overview

| Item | Detail | Source |
|---|---|---|
| Name | Codegeist 2026: *Build with context. Ship with confidence.* | [Official] |
| Sponsor | Atlassian Pty Ltd (Sydney, Australia) | [Official] Rules §2 |
| Administrator | Devpost, Inc. (New York) | [Official] Rules §2 |
| Event page | <https://codegeist2026.devpost.com/> (rules: `/rules`, resources: `/resources`) | [Official] |
| Format | Fully online, public, Devpost-managed. Free to enter; no purchase necessary. | [Official] |
| Prize pool | $120,000+ in cash (3 categories × 3 places + 24 bonus prizes of $1,500) plus 300 participation swag packs | [Official] |
| Theme | Use connected context (Atlassian's Teamwork Graph idea: goals, work, people, decisions, outcomes) to help teams "ship with confidence": surface the right knowledge at the right moment, connect work across silos, or turn organisational data into a decision that moves work forward. | [Official] Overview |
| Scale | About 4,800 registered participants on 23 Nov 2026 (the count moves daily) | [Official] Overview, volatile |

**How KnewWhen maps to the theme:** "When did we first know?" is a *context* problem. The evidence is spread across tickets, comments, reporters and links that no single record contains. KnewWhen connects that scattered context into a documented decision. Use the word **context** deliberately in the description and video, because Stage One checks theme fit (§3).

---

## 2. Mandatory platform and integration requirements

| Requirement | What the rules say | KnewWhen status |
|---|---|---|
| Build on **Atlassian Forge** | "Entrants must build an app using Atlassian's Forge platform." A project "must run on Atlassian Forge." | Met by design (Forge SQL, triggers, issue panel, etc.) |
| Integrate with **at least one** Atlassian product or platform capability | Jira, Confluence, Jira Service Management, Bitbucket, Teamwork Graph, or Rovo | Jira (primary); JSM optional; Rovo agent in the Should tier |
| New or substantially updated | Newly created, **not yet published before the Submission Period** (27 Oct 2026), *or* an older project updated/rebuilt on Forge after 27 Oct, with a Forge manifest and at least one Forge module | **[Internal]** Confirm no public release of KnewWhen existed before 27 Oct 2026 |
| Installable via an **installation link** | Must be installable in a judge's test environment and "function as depicted in the video and/or text description" | App B (§9) |
| Third-party SDKs/APIs/data | Entrant must be authorised under the tool's terms | No third-party egress planned. Regulatory text and federal-holiday calendars are public. |
| Atlassian developer terms | Use of developer tools is subject to <https://developer.atlassian.com/platform/marketplace/atlassian-developer-terms/> | Applies |
| Free Atlassian Cloud Developer licence | Required to access Forge | Applies |

**Explicitly optional [Official]:**
- **Forge LLMs.** The overview says "completely optional." They are not on by default, and you are charged only if your code calls the API. **"Codegeist does not provide credits for Forge LLM usage."** The pricing page confirms there is no free monthly usage allowance and that usage is billed to the app developer's Forge bill ([pricing](https://developer.atlassian.com/platform/forge/runtime-reference/forge-llms-api-pricing/)). Adding the `llm` module also triggers a major version upgrade, and admins are told about LLM use in the Marketplace listing and at install ([LLMs API](https://developer.atlassian.com/platform/forge/runtime-reference/forge-llms-api/)).
- **Rovo, MCP, Teamwork Graph.** Each is only a bonus route. None is needed for entry. KnewWhen's `rovo:agent` would make it *eligible* for Best Agents, but the selected bonus stays Marketplace (§8).

**Runs on Atlassian [Official]:** The badge is applied automatically to eligible Forge apps. The app must not egress data, apart from analytics egress that does not carry in-scope end-user data, and it must use Atlassian-hosted compute and storage. Using Forge LLMs does not disqualify the app. See the [program page](https://developer.atlassian.com/platform/forge/runs-on-atlassian/) and run `forge eligibility` before claiming it. **It is not a 2026 prize track**, so the proposal's "Runs on Atlassian eligible" belongs in the listing and privacy story, where it supports Potential Impact and the Marketplace Privacy & Security tab, not in the bonus selection.

**Judges' environment [Official]:** An Atlassian Forge product manager (Adam Moore, 11 Nov 2026) confirmed that judges use the same demo sites that include Rovo, that Forge LLM works there, and that the installation link is site-agnostic ([community thread](https://community.developer.atlassian.com/t/codegeist-2026-will-judges-test-sites-have-rovo-enabled-and-is-the-forge-llm-module-available-on-them/103823)). That is a staff reply on a forum, not a rule.

---

## 3. Stage One — pass/fail gate

**Official wording [Official] (Rules §6):** Stage One "will determine via pass/fail whether the ideas meet a baseline level of viability, in that the Project **reasonably fits the theme** and **reasonably applies the required APIs/SDKs** featured in the Hackathon."

What this means in practice:
- It is a **gate, not a score.** No result on the five criteria compensates for failing it, and an entry that fails any mandatory *Submission Requirement* (§9) is not an "Eligible Submission" at all.
- **Theme fit:** frame KnewWhen explicitly as connecting context across Jira records into a decision. A reader who only sees "a deadline calculator" could judge it off-theme.
- **"Required APIs/SDKs":** the rules name no minimum API list beyond *Forge* plus *one listed Atlassian product/capability* **[Unverified]**. KnewWhen's real use of Jira REST via Forge, issue/comment/link triggers, Forge SQL, custom fields and the issue panel is the substance. The Devpost field "Explain how your project meets the main technology requirement" is where you state it in plain terms.
- **Mandatory vs. not:** Forge + Jira = mandatory. Forge LLMs, Rovo, Teamwork Graph, MCP and the Marketplace listing = optional.

---

## 4. Categories and why KnewWhen is in *Apps for Specialized Industries*

| Category | Official definition [Official] |
|---|---|
| Apps for Software Teams | Give dev teams the context to ship with confidence (smarter code reviews, deployment awareness, issue triage). |
| Apps for Business Teams | Give business teams the context to act decisively (marketing, sales, HR, finance, support, legal). |
| **Apps for Specialized Industries** | Give experts in healthcare, finance, manufacturing, automotive, or other fields the context to do their best work. "Turn insider knowledge into solutions built for your world." |

**Why Specialized Industries is right:** KnewWhen serves QA/RA leads, complaint units and PRRCs at medical-device makers. Their work is defined by FDA 21 CFR 803 and EU MDR vigilance rules, which are regulated-industry "insider knowledge" in the sense the category describes. A "Business Teams" (support/legal) framing would put it among generic support and legal tools and lose the regulatory specificity that is its strongest differentiator.

**Rule to remember [Official]:** the Sponsor and Administrator "reserve the right to reassign a Project from one Category or Bonus Prize to another if applicable." Keep the description clearly regulated-industry so there is no reason to reassign.

---

## 5. Prize structure

**Grand prizes (1 winner per category, 3 categories) [Official]**

| Place | Cash | Also |
|---|---|---|
| 1st | $15,000 | 2 tickets per winning team to Team 2027 (AMER), travel not included; recognition on Atlassian's blog; signed limited-edition Atlassian Williams Racing swag |
| 2nd | $8,000 | Opportunity to be featured on the winner-announcement blog |
| 3rd | $5,000 | Opportunity to be featured on the winner-announcement blog |

**Bonus prizes [Official]:** 4 bonuses × 6 winners × **$1,500**. The bonuses are Best Agents (Rovo/Assignable agents), Best app with Atlassian MCP, Best apps with Teamwork Graph integration, and **Best Marketplace published app**.
Check: 3 × ($15k + $8k + $5k) = $84,000, plus 24 × $1,500 = $36,000, giving $120,000.

**Participation prize [Official]:** Atlassian Developer Swag Pack, **300** available, first-come first-served, for Entrants of Eligible Submissions including team members, while supplies last, **max 4 per Submission**. One Entrant can win only one participation prize across multiple submissions.
- **[Unverified]** The rules say both "300 winners" and "the first 300 Entrants who submit an Eligible Submission (limit 4 per Submission)." It is unclear whether the cap counts entrants or packs. Because it is first-come, an earlier submission helps, which supports the internal 17 Dec target (§13).

**Stacking rule [Official]:** "The same Submission can win up to one Grand Prize and one Bonus Prize." KnewWhen's maximum is therefore one category placement plus **one** bonus. It cannot win two bonuses.

**How bonus winners are chosen [Official, reading of Rules §6]:** For each prize, potential winners are the eligible Entrants "whose Submissions earn the highest overall scores based on the applicable Judging Criteria." For the Marketplace bonus, that means the six highest-scoring eligible submissions that are published or submitted for listing. The listing makes you *eligible*; the five criteria decide whether you *win*.

**After judging [Official]:** Winners are subject to identity and role verification and post-competition affidavits. Required Forms are due within **10 business days** of being sent. Prizes are delivered within **60 days** of the completed forms. Non-US winners may need a **W-8BEN**. Winners cover their own wiring and currency fees and are responsible for their own taxes. Prizes go to the individual, the team Representative, or the organisation.

---

## 6. Stage Two — judging criteria

Eligible Submissions that pass Stage One are scored on five **equally weighted** criteria **at the judges' "sole and absolute discretion"** [Official]. The overview page shows **20% each**.

| # | Criterion (20%) | Official question [Official] |
|---|---|---|
| 1 | Technological Implementation | Does the app feel like a genuine, working, non-trivial implementation when tested, not just a shallow wrapper or a single hardcoded demo path? |
| 2 | Design | Does the project deliver a complete, coherent product experience, not just a technical proof of concept? |
| 3 | Potential Impact | Does the project make a credible, specific case for solving a real problem for a real audience, and does the solution actually address that problem based on what's demonstrated? |
| 4 | Innovation / Idea | How creative and novel is the concept, and does the project differ from existing concepts? |
| 5 | Presentation | Does the video clearly demonstrate the project working end-to-end? Does the pitch communicate what problem is solved, who it's for, and why it matters? Is the overall presentation easy to follow? |

**Tie-break [Official]:** Ties go to the submission with the higher score on the *first* listed criterion, then the next, and so on, before a judge vote. **Technological Implementation breaks ties first.** Judges "may be employees of the Sponsor or third parties," so assume they are strong on Atlassian and Forge but not on medical-device regulation. Explain domain terms in plain words.

---

## 7. What a strong KnewWhen submission must demonstrate

### Product work that serves several criteria at once
These items are the load-bearing work; the sections below only say *how each criterion sees them*.
- **The lookback ("found, not entered") working on data the judge did not see scripted.** It serves Technological Implementation, Innovation and Impact.
- **The verbatim-quote guarantee and "no signal" as a valid answer.** It serves Technological Implementation and Innovation.
- **The deadline engine, backed by golden tests and an independent oracle.** It serves Technological Implementation and Impact.
- **The decision record plus write-back to Jira fields and a JQL-searchable comment.** It serves Design and Impact, because it proves the output lives inside Jira.
- **The test evidence pack.** It serves Technological Implementation and Presentation.

---

### 7.1 Technological Implementation
- **Means in judging terms:** A judge installs the app, pokes at it, and decides whether it is real. The official question names two failure modes: a *shallow wrapper* and a *single hardcoded demo path*.
- **KnewWhen must implement or show:**
  - Event-driven capture (issue created/updated/commented, link created) with idempotent queue consumers.
  - Paged lookback that respects Forge limits.
  - Forge SQL as system of record.
  - A Signal Finder that rejects any quote not found word-for-word.
  - A rule-based fallback and a kill switch when the LLM is unavailable or capped.
  - The FDA deadline engine, with the EU clocks marked "preview."
- **Visible evidence that convinces:**
  - A judge types their *own* complaint text (not the sample) and gets a sensible result, including "no signal."
  - Oracle and golden-test results on screen or in the README.
  - Precision/recall figures for the lookback, honestly reported.
  - The "Scan this issue now" action working on a judge-created issue.
- **Undermined by:**
  - Everything works only on the sample scenario.
  - Lookback false matches presented as certainty.
  - An LLM output shown without the verbatim check.
  - Trigger handlers that slow the host Jira (Marketplace also rejects apps that degrade host performance, see §11).
  - Should-tier features shipped half-built. `Knewwhen.md` already says to cut them first and protect lookback and evidence.

### 7.2 Design
- **Means in judging terms:** "Complete, coherent product experience." A first-time user should understand what to do next without the author.
- **KnewWhen must implement or show:**
  - A first-run path (Admin page → sample scenario → issue panel → decision) with sensible empty, loading, error and "role not permitted" states.
  - Consistent Atlassian look and feel, including dark mode (use Forge UI Kit / design tokens).
  - Language that never says "reportable / not reportable," because the app must never make that determination.
  - Evidence-strength labelling (system timestamp vs "date received (entered)") that is understandable at a glance.
- **Visible evidence:** The video follows one continuous journey through the UI, and the judge's first five minutes in a fresh site match the video.
- **Undermined by:** A panel that dumps raw data, jargon without explanation, dead-end screens, a Should-tier gadget with no data, or UI that differs from what the video showed.

### 7.3 Potential Impact
- **Means in judging terms:** A *specific* problem, a *real* audience, and proof the solution addresses it *as demonstrated*.
- **KnewWhen must demonstrate:**
  - The concrete mistake it prevents: a clock that started weeks earlier in a ticket nobody labelled a complaint.
  - The named users (QA/RA lead, complaint unit/PRRC, support agents, engineers).
  - The honest market (software-centric device makers running QMS in Jira; low hundreds of organisations per the proposal).
  - The decision-support boundary ("not a regulatory determination or legal advice").
- **Visible evidence:**
  - The on-screen "If this was the first knowledge: 11 days left, not 30" moment, which makes the cost of late recognition tangible.
  - The Marketplace listing or review ticket, which shows it is installable by real customers.
  - Regulatory claims in the text that cite their sources.
- **Undermined by:**
  - Overclaiming ("ensures compliance," "determines reportability").
  - Unsourced statistics. The Covington (Feb 2026) and warning-letter figures in `Knewwhen.md` are from the proposal and were **not re-verified here** **[Unverified]**. Re-check each before it appears in the Devpost text or video.
  - Deadline logic that no QA/RA practitioner has reviewed. That review is an open internal condition (24 Nov), and judges cannot verify the regulation, so credibility rests on the tests and the disclosure.

### 7.4 Innovation / Idea
- **Means in judging terms:** Novel *and* different from what exists.
- **KnewWhen must demonstrate:** The five differentiators in `Knewwhen.md` §4, led by **found, not entered**, then verbatim-only AI evidence, deadline sensitivity, evidence-strength labelling and similar-case precedents.
- **Visible evidence:** One short, fair comparison to how this is done today (spreadsheets, or eQMS tools outside Jira). The proposal's claim that no Marketplace app and no visible Codegeist 2026 entry does this should be **re-checked in the public [project gallery](https://codegeist2026.devpost.com/project-gallery)** the week of submission **[Unverified]**.
- **Undermined by:** Presenting "AI flags complaints" as the idea (that is commodity), or pitching features that the working app does not show.

### 7.5 Presentation
- **Means in judging terms:** The video shows the project *working end-to-end*, and a non-expert understands the problem, the audience and why it matters.
- **KnewWhen must implement or show:** See §10 for the video structure. The Devpost description must also explain the technology requirement and the bonus.
- **Visible evidence:** A video that opens on the problem in one sentence, shows live Jira, ends with the Marketplace evidence, and matches the written install guide.
- **Undermined by:** Mock-ups instead of the real product, domain jargon with no plain-English gloss, features shown that a judge cannot find when testing, and a testing guide that needs the author's help.

---

## 8. Selected bonus — Best Marketplace published app

**Official eligibility [Official] (Rules §4, §8):** "All Eligible Submissions that are **published to the Marketplace or submitted for listing**. Provide either the **link to the listing** or **link to the Marketplace review ticket**." $1,500 × 6 winners.

**What this means:**
- **Approval is not required.** "Submitted for listing" is enough. The evidence is the **listing URL** (if live) or the **review ticket URL** (the ECOHELP ticket created when you submit).
- **The submission must still be an Eligible Submission** (§9). The Marketplace route does not replace the installation link, video or testing instructions.
- **Evidence goes in the Devpost bonus write-up** ("provide any applicable write-up associated with the Bonus Prize selected") and should be mentioned in the video, since the Resources page says the video should show "any relevant bonus prize specifics."
- **Free, Jira-only listing is allowed** for a single-app Jira app. See the multi-app caution below.

**Why two apps [Official]:** The distribution docs state that once an app "has been submitted for listing on Marketplace, or has a license in the app manifest, it can't be shared via installation link," and you must "copy the app's code, create a new, unlicensed version of the app, and share this version." ([Distribute your apps](https://developer.atlassian.com/platform/forge/distribute-your-apps/), updated 30 Oct 2026)

| | App A | App B |
|---|---|---|
| Role | Marketplace submission (bonus evidence) | Judge install link (Eligible Submission requirement) |
| Distribution | **Sharing** (must be "Sharing," not "Sharing within organization," before submitting) | **Sharing**, never submitted for listing, no `licensing` block in the manifest |
| Environment | Deployed to production | Deployed to production |
| Code | Same codebase | Same codebase |

**Compliance points for the two-app plan:**
- Rules do not forbid it, and the platform requires it. The risk is a reviewer thinking the two differ. State in the Devpost description that App A and App B are the same codebase, give both app IDs, and keep them in sync.
- Whether the 2026 Devpost form has an "App ID" field is **[Unverified]**. The 2026 rules do not mention one, but earlier editions' pages did. Check the "Enter a Submission" page after logging in.
- **[Internal]** `Knewwhen.md` freezes App B "until judging ends" (3 Feb 2027, 5:00 pm PT). Winners are announced around 15 Feb and then verified, so freezing through the announcement is safer.

**Cautions:**
- **Multi-app compatibility [Official]:** Apps with a *required* Atlassian app can be listed as **paid only; free listings are not supported** ([App compatibility](https://developer.atlassian.com/platform/forge/app-compatibility/)). That model covers Jira and Confluence only. KnewWhen declares no `app.compatibility` and should keep it that way: no Confluence modules and no required-app declaration. Confirm the draft listing shows Jira only **[Internal]**.
- **Rejected or auto-rejected submissions [Unverified]:** The rules do not say whether a ticket that was rejected counts as "submitted for listing." Community reports describe instant rejection when partner verification is incomplete. Complete verification *before* submitting (§11).
- **Which ticket to cite [Official/Unverified]:** If a vulnerability scan rejects the first ECOHELP ticket, resubmitting creates a *new* ticket. Cite the active one.

---

## 9. Submission requirements

**All of these are required for an Eligible Submission [Official] (Rules §4):**

| # | Requirement | KnewWhen action |
|---|---|---|
| 1 | Project built on Forge, meeting §2 | Met |
| 2 | **Demo video**, under 5 minutes, public on YouTube, link on the form, no third-party trademarks or copyrighted music without permission | §10 |
| 3 | **Original work, solely owned** by the Entrant, no IP violation | §12 |
| 4 | **Installation link** for judges and the review team | App B (§8) via [Start sharing your app](https://developer.atlassian.com/platform/forge/distribute-your-apps/#start-sharing-your-app) |
| 5 | **All instructions needed** to get the app working in a judge's environment, with detailed steps for every configuration step and any integration | §14 testing guide |
| 6 | **Text description** of features and functionality | Write once, reuse for the listing |
| 7 | **Explanation of how the project meets the main technology requirement** | One paragraph: Forge + Jira + modules used |
| 8 | **Select the Category and Bonus Prize(s)**; provide the bonus write-up | Specialized Industries + Best Marketplace published app; paste listing or review-ticket URL |
| 9 | **English**, or an English translation of all materials | English only |

**Devpost mechanics [Official]:**
- Register (Join Hackathon, free Devpost account) before submitting. The registration period ends at the same moment as the submission period.
- You can save **drafts** until the deadline. After it, **no changes** are allowed, except that the Sponsor and Devpost *may* permit edits to remove infringing material or personal information.
- A team or organisation appoints one **Representative** to enter the submission.
- Multiple submissions must each be unique and substantially different.

**App identity to prepare:**
- App name: KnewWhen (subject to the trademark search, due 24 Nov).
- A one-line tagline: "When did your company first know? Found, not entered."
- App IDs for App A and App B.
- The same text used in the Marketplace listing.

**Not verifiable without logging in [Unverified]:** the exact field labels on the "Enter a Submission" page. The list above comes from the rules and overview page, not the form itself.

---

## 10. Demo video

**Official conditions [Official]:**
- **Under 5 minutes.** "Judges are not required to watch beyond five minutes."
- Shows the project **functioning on the device it was built for** (Jira in a browser).
- **Uploaded to YouTube and publicly visible**, with the link on the submission form.
- **No third-party trademarks, copyrighted music or other material** unless you have permission.
- Should show "any relevant bonus prize specifics" (Resources page).
- English, or with an English translation.

**KnewWhen target [Internal]: about 3 minutes**, comfortably under the limit. The proposal's flow stays valid:

| Time | Beat |
|---|---|
| 0:00 | Hook: the clock starts when *any* employee hears of a possible injury |
| 0:15 | Signal: a clinic's request is flagged, with two verbatim quotes |
| 0:40 | Found, not entered: the lookback finds the earlier ticket, "11 days left, not 30" |
| 1:50 | Decision: confirm the date, see precedents, record the decision, JQL finds it in Jira |
| 2:30 | Exception: a feature request returns "no signal found" |
| 2:45 | Close: submitted for Marketplace listing (show the review ticket or listing), install link and test guide in the description |

**Video cautions:**
- Keep competitor product names and logos (eQMS vendors) out of the footage. Real company or device names in the sample data are a trademark risk, so use fictional ones.
- Use no music, or music you have licensed.
- Show the *real* installed app, and show system-timestamp evidence (§14) so "found, not entered" is visibly true.
- Blur personal data in any ticket screenshot, and never show partner-verification material.
- Do not state "runs on Atlassian" as a competition track. Say it as a product property if it is true (`forge eligibility` confirms it).

---

## 11. Marketplace preparation

### 11.1 Sequence [Official]
1. **Deploy to production** and set distribution to **Sharing** ([Distribute](https://developer.atlassian.com/platform/forge/distribute-your-apps/)).
2. **Publish the Developer Space** to Marketplace. A Developer Space admin must do this, and it requires a billing account with billing consent and acceptance of the Marketplace Partner Agreement. It creates the partner profile ([Publish a Developer Space](https://developer.atlassian.com/platform/forge/developer-space/publish-developer-space/)). The vendor you select must be the space that contains the app.
3. **Partner Verification** (one-time, for new app submissions): identity information form plus Partner Security Questionnaire (complete within 14 days or the ticket is rejected), identity check via Stripe with a government ID, and business verification (business name, address, registration and/or tax ID). Rejected partners cannot upload apps ([Due diligence](https://developer.atlassian.com/platform/marketplace/partner-due-diligence/)). The security-workflow page estimates 2–3 business days.
4. **Privacy & Security tab** (mandatory for cloud apps): permission justifications, Atlassian PAT disclosure, accurate privacy information. Complete the **app-specific Forge security questionnaire**; "fail" signals block listing ([Security workflow](https://developer.atlassian.com/platform/marketplace/app-approval-security-workflow/)).
5. **Create the listing** at `marketplace.atlassian.com/manage/apps/create` → Forge app → select the app → submit and accept the Partner Agreement.
6. **Copy the ECOHELP review-ticket link.** The submitter has access by default; others need a support request ([Approval guidelines](https://developer.atlassian.com/platform/marketplace/app-approval-guidelines/)).
7. **Automated vulnerability scan** runs on submission. Critical or certain high-severity findings reject the ticket; fix and resubmit (a new ticket is created).

### 11.2 Listing materials
| Item | Needed? | KnewWhen note |
|---|---|---|
| Listing name in the form "App X for Jira" | Required (Atlassian trademark rule: "*Jira App X*" is rejected, "*App X for Jira*" approved) | Check the final name against the trademark search |
| Description, intended use and non-use | Listing must perform as described | "Decision support, not a regulatory determination or legal advice" |
| Documentation link | Required | Reuse the §14 testing guide plus a user guide |
| Privacy policy; support contact | Required | Also needed for the Privacy tab |
| Scope justification (every API scope, and why) | Requested at submission | Prepare from the scope list in `Knewwhen.md` §7 |
| Remote hostnames and data sent | Requested at submission | "None" if no egress |
| Logo, banner, screenshots | Recommended, not required for free apps | Do it anyway for Design and Presentation |
| Validation notes, supplier-qualification pack | **[Internal]** (the proposal's choice, not a Marketplace rule) | Keep, because they support Impact |
| Register a partner contact in the Atlassian Developer Community | Required | Needed for correspondence |
| Forge-hosted LLM disclosure | Admins are informed automatically; also disclose in the privacy text | Matches the proposal |
| Integration test credentials | Only if a 3P integration exists | None planned |

Marketplace also rejects apps that break or degrade the host UI or performance, infringe Atlassian trademarks, contain advertising for other products, or fail to perform as described ([approval criteria](https://developer.atlassian.com/platform/marketplace/app-approval-guidelines/)).

### 11.3 Timing implications
- **Rules set no Marketplace date**; the only rule-based limit is the submission deadline (22 Dec, 12:00 pm PT). The ticket must exist and be linkable by then.
- **Atlassian's review estimates conflict [Unverified]:** "decision within one week" ([List a Forge app](https://developer.atlassian.com/platform/marketplace/listing-forge-apps/), updated 26 Aug 2026); "10–15 business days" ([Approval guidelines](https://developer.atlassian.com/platform/marketplace/app-approval-guidelines/), updated 15 May 2026); "5–10 business days" (security-workflow page, updated 24 Jul 2025).
- **My arithmetic (weekdays only, no holidays):** 1 Dec + 15 business days = Tue 22 Dec; 8 Dec + 10 to 15 business days = 22 to 29 Dec. So the proposal's **1 Dec** submission target is the last date on which even the longest estimate would finish by the deadline, and **8 Dec** is a *ticket-creation* backstop only. Approval is not needed for the bonus, but an early ticket leaves room to fix scan findings.
- **[Internal] Partner verification was due 20 Nov** and has no stated status in the files I received. It is the main gating item for the bonus.
- **Developers have reported (community posts, not official)** that submissions are auto-rejected within seconds when partner verification is incomplete, that the Marketplace form can show "No Forge apps available" when the app sits in a different Developer Space from the partner profile, and that some submitters cannot open their ECOHELP ticket. Verify each of these early.

### 11.4 Ownership
Name one **Developer Space admin** (billing account, publishing, Partner Agreement) and one **primary Partner contact** (identity verification). The ticket's personal data is visible to that contact, and reassigning the ticket restarts verification, so decide who it is before starting.

---

## 12. Eligibility, IP and entrant conditions

| Topic | Rule [Official] | KnewWhen note |
|---|---|---|
| Who can enter | Individuals at or above the age of majority where they live; teams; registered organisations | The Representative must be eligible |
| Excluded places | Residents of, or organisations domiciled in, Brazil, Quebec, Russia, Belarus, Crimea, Cuba, Iran, North Korea, Syria, Sudan, Myanmar and any other OFAC-designated place; entities on US denied/sanctioned lists | India is not among the listed exclusions |
| Excluded people | Sponsor/Administrator employees, family and household, judges and their employers, affiliates | Confirm no team member falls here |
| Originality and ownership | Submission must be original, **solely owned**, and violate no one's IP, copyright, trademark, patent, contract or privacy rights | The rules do not mention AI-assisted coding either way; the ownership warranties apply to whatever ships |
| Contractors | Technical help from a third party is allowed if the Entrant owns all rights | Keep written assignments |
| Open source | Allowed if licences are followed and you create software that builds on the open-source base | List dependencies and licences. If the app itself is open source, Marketplace expects public source and a matching licence file. |
| Third-party tools/data | Entrant must be authorised under their terms | Use only synthetic sample data; no real patient data |
| Financial/preferential support | The project must not have been developed with Sponsor/Administrator funding, a development contract or a commercial licence | Confirm none exists |
| Licence to Sponsor | Non-exclusive, fully paid licence to use the Submission for judging; promotion rights for the Hackathon period plus 3 years | Accept |
| No malicious code | Submission must be free of viruses, spyware or harmful code | Standard |
| Language | English, or English translations of all materials | English |
| Disqualification | At sponsor's discretion for tampering, rule violations or conflicts of interest | — |
| Rule changes | The rules can be amended at any time; ambiguities must be raised by written request before the deadline | Email the hackathon manager (link on the Overview page) about any item marked **[Unverified]** that matters |
| Disputes | Binding AAA arbitration; New York law | Informational |

---

## 13. Dates and deadlines

### 13.1 Official [Official] (Rules §1)
Pacific Time in October is PDT (UTC−7); from November it is PST (UTC−8). India Standard Time is UTC+5:30 and has no daylight saving.

| Event | Official (Pacific) | UTC | **India Standard Time** |
|---|---|---|---|
| Registration and submission open | Tue 27 Oct 2026, 9:00 am PDT | 16:00 | Tue 27 Oct 2026, 9:30 pm |
| **Registration and submission close** | **Tue 22 Dec 2026, 12:00 pm PST** | 20:00 | **Wed 23 Dec 2026, 1:30 am** |
| Judging begins | Tue 5 Jan 2027, 1:00 pm PST | 21:00 | Wed 6 Jan 2027, 2:30 am |
| Judging ends | Wed 3 Feb 2027, 5:00 pm PST | 01:00 (4 Feb) | Thu 4 Feb 2027, 6:30 am |
| Winners announced "on or around" | Mon 15 Feb 2027, 9:00 am PST | 17:00 | Mon 15 Feb 2027, 10:30 pm |

Devpost's own countdown shows the close as "3:00 pm EST," which matches. At 3:46 pm IST on 23 Nov 2026, **about 29 days 9 hours 44 minutes** remain to the close.

### 13.2 KnewWhen internal targets [Internal] (from `Knewwhen.md`; dates only, no official standing)
| Target | Date | Status on 23 Nov |
|---|---|---|
| Marketplace partner verification (business or tax ID) | 20 Nov | Passed; status not in the files I received |
| Practitioner review of rules (~1 hour) | 24 Nov | Tomorrow |
| Trademark search for "KnewWhen" | 24 Nov | Tomorrow |
| Judge copy tested from an outside org; Marketplace listing submitted | 1 Dec (hard 8 Dec) | Open |
| Core working end-to-end on a clean site | 8 Dec | Open |
| Should-tier items | 15 Dec | Open |
| Devpost submission | 17 Dec | Open; leaves about 6 days 1.5 hours before the official close |

**Rule of thumb:** treat the end of 22 Dec IST as already past. The real cutoff arrives at 1:30 am IST on 23 Dec, in the middle of the night.

---

## 14. Judge experience

**Setup judges will have [Official, staff reply]:** a pre-configured Atlassian demo site with Jira, Confluence, JSM, Rovo and **seeded demo data**. Judges install through the site-agnostic link as site admins ("they must be the admin of that site").

**Design consequences [Internal]:**
- **Install in under a minute with no external accounts.** No third-party egress means nothing to configure or authenticate.
- **Make the first screen obvious.** After install, the Admin page should show a single "Load sample scenario" action.
- **Keep the sample isolated** from the seeded demo data (its own project), so the lookback is not drowned by unrelated issues. Avoid scanning the whole site with the LLM, which would bill you.
- **Do not depend on JSM being present.** It is optional in the proposal, so the sample scenario should also work in a plain Jira project.
- **Make "found, not entered" visibly true.** A one-click sample creates issues *now*, so an earlier mention "19 days before" cannot rest on a system timestamp. If the sample relies on a typed date, a judge may read it as exactly what KnewWhen claims not to do. Prefer the historical CSV (Jira's importer can set *Created*) for the headline scenario, or label clearly which evidence is a system timestamp and which is entered.
- **Provide an "unscripted" path** (see step 8 below) to answer the "single hardcoded demo path" test.
- **Control LLM cost.** Keep per-site caps and the kill switch on for the judge copy. Because pricing has no free allowance, set a budget alert on App B's Developer Space.
- **Check moderation on sample text.** Atlassian says high-risk LLM messages are blocked under its Acceptable Use Policy. Injury narratives should be tested on the hosted model, and the rule-based fallback should cover a block **[Unverified]**.

**Template for the Devpost testing-instructions field** (adapt labels to the final UI; the feature names come from `Knewwhen.md`):

1. **Install:** open the installation link, choose your Jira site, accept permissions. *Expected:* the app appears under Apps / Manage apps.
2. **Configure (about 30 s):** open the KnewWhen Admin page. Note the mode (LLM or Evidence-only).
3. **Load the sample:** click "Load sample scenario" (or import the provided CSV through Jira's importer). *Expected:* a sample project with a few issues.
4. **Signal:** open the clinic request. The issue panel shows two flagged verbatim quotes. *Expected:* each quote appears verbatim in the issue text.
5. **Lookback:** open the awareness trail. *Expected:* an earlier ticket is proposed with a match reason and confidence. Click "Same event?" to confirm.
6. **Deadlines:** *Expected:* the screen shows the deadline under the confirmed date ("11 days left, not 30") and under the alternative date.
7. **Decision:** answer the decision questions as a user with the right role. *Expected:* a Jira comment and JQL-searchable fields appear. Run the supplied JQL.
8. **Unscripted test:** create a new issue with your own text. *Expected:* a signal if it describes a possible injury or malfunction; otherwise "no signal found." Try a feature request.
9. **Cleanup:** state how to remove the sample data.

---

## 15. Final readiness checklist

**Qualification (Stage One and Eligible Submission)**
- [ ] Forge app, built or rebuilt after 27 Oct 2026, with a manifest and Forge modules
- [ ] Integrates with Jira (named in the technology explanation)
- [ ] Description frames the product around **context** and the regulated-industry category
- [ ] Installation link works from an *outside* organisation (App B, Sharing)
- [ ] Testing instructions cover every configuration step
- [ ] Original, solely owned work; contractor and open-source licences checked; no Sponsor funding
- [ ] English throughout; Representative is eligible and registered on Devpost

**Judging (Stage Two)**
- [ ] A judge can type their own text and get a sensible result (no hardcoded path)
- [ ] Lookback evidence is system-timestamp-backed in the headline scenario
- [ ] Oracle/golden-test and precision/recall results are visible
- [ ] First-run flow, empty/error states and dark mode work
- [ ] Decision-support wording everywhere; the app never says "reportable / not reportable"
- [ ] Each statistic in the text has a re-checked source; competitor comparison re-checked against the project gallery
- [ ] Video under 5 minutes (target about 3), plain-English domain explanations

**Bonus (Best Marketplace published app)**
- [ ] Developer Space published; partner verification complete
- [ ] Privacy & Security tab, security questionnaire and scope justifications done
- [ ] App A set to Sharing, deployed to production, submitted for listing
- [ ] Review-ticket (or listing) URL copied; confirmed it is the active ticket
- [ ] Listing shows Jira only; no required-app compatibility declared
- [ ] Devpost write-up links the ticket and states App A = App B code

**Submission**
- [ ] YouTube video public; no third-party trademarks or unlicensed music
- [ ] Category and bonus selected on Devpost; bonus write-up filled
- [ ] Draft saved early; final submit by **17 Dec** (official close: **23 Dec 1:30 am IST**)
- [ ] App B frozen through winners' announcement and verification
- [ ] Billing alert set for Forge LLM usage on App B

---

## References (official)
- Rules: <https://codegeist2026.devpost.com/rules> · Overview: <https://codegeist2026.devpost.com/> · Resources: <https://codegeist2026.devpost.com/resources>
- Distribute via console: <https://developer.atlassian.com/platform/forge/distribute-your-apps/>
- List a Forge app: <https://developer.atlassian.com/platform/marketplace/listing-forge-apps/>
- App approval guidelines: <https://developer.atlassian.com/platform/marketplace/app-approval-guidelines/>
- Security workflow: <https://developer.atlassian.com/platform/marketplace/app-approval-security-workflow/>
- Partner due diligence: <https://developer.atlassian.com/platform/marketplace/partner-due-diligence/>
- Publish a Developer Space: <https://developer.atlassian.com/platform/forge/developer-space/publish-developer-space/>
- App compatibility: <https://developer.atlassian.com/platform/forge/app-compatibility/>
- Runs on Atlassian: <https://developer.atlassian.com/platform/forge/runs-on-atlassian/>
- Forge LLMs API and pricing: <https://developer.atlassian.com/platform/forge/runtime-reference/forge-llms-api/> · <https://developer.atlassian.com/platform/forge/runtime-reference/forge-llms-api-pricing/>
- Staff reply on judges' sites (11 Nov 2026): <https://community.developer.atlassian.com/t/codegeist-2026-will-judges-test-sites-have-rovo-enabled-and-is-the-forge-llm-module-available-on-them/103823>
