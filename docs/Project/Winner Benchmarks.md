# Five Codegeist Winners Worth Studying

Nov 18, 2026 · @Loki

## Why these five

The three 2025 Specialized Industries podium apps are our only direct precedent; the other two are first-place winners that set the bar for engineering and grounded AI.

- **How each was checked:** Atlassian's official winners blogs, each project's Devpost write-up, and the source code where it is public (only Secure Notes, of these five).
- **What we could not check:** the demo videos (YouTube blocked automated access) and the judges' reasoning, which Atlassian never publishes. "What stood out" below means observable strengths, not why the judges chose it.
- **Different rules then:** 2024–2025 used three criteria, and 2025 judges were "not required to test". The 2026 rules use five criteria and expect judges to install and test the app.

## 1. FleetOps — 2025 Specialized Industries, 1st place (+ Best Rovo Apps)

[FleetOps](https://devpost.com/software/fleetops-smart-incident-reporting-for-fleet-operations) turns a driver's photo of a damaged vehicle into a classified, prioritised service ticket linked to the right vehicle record.

|  |  |
| --- | --- |
| **Team** | Deiser, an Atlassian partner (part of Devoteam); 6 people incl. product designers; repeat Codegeist winner |
| **Industry / users** | Fleet operations; fleet managers and service agents |
| **Atlassian used** | Jira Service Management, Jira Assets, Rovo agent, Forge queues, entity properties |
| **Public evidence** | Devpost write-up and YouTube demo; no public code; test guide now offline |

**The problem.** Drivers report incidents with almost no detail. Fleet managers must still classify, prioritise and tie each ticket to the right vehicle.

**How it works** (as the team describes it)

1. A ticket with a photo arrives in Jira Service Management.
2. An AI vision model describes the damage, rewrites the subject, classifies it and rates how critical it is, even when the text is empty.
3. It reads the licence plate, asks for one if missing, and links the ticket to that vehicle in Jira Assets (creating it if needed).
4. It posts an internal comment with recommended next steps.
5. A Rovo agent answers questions such as "which vehicles have open incidents?" by querying Assets.

**What stood out**

- **Ready on install:** it creates the vehicle database (Truck, Van, Trailer) and 50+ sample vehicles automatically, so a judge sees a realistic fleet at once.
- **The industry's real objects live in Atlassian:** vehicles are Assets records, not data in a separate system.
- **Short, visible payoff:** photo in, organised ticket out.
- **Product discipline:** designers on the team, structured discovery, 85% reported test coverage.

**Limits and what not to copy**

- It called an external AI service (OpenAI); the team itself planned to move to Atlassian's own Forge LLMs.
- One Assets setting still needed manual admin set-up, with no fallback for sites without Assets.
- The prior-year report credited it with QR codes, voice input and GPS dispatch; none of these are in the write-up.

**Lesson for us:** put the industry's real records inside Jira, and make the judge's empty site look real within one minute of installing.

## 2. YardMaster — 2025 Specialized Industries, 2nd place (+ Best Rovo Apps)

[YardMaster](https://devpost.com/software/test-6y0chd) runs a truck yard inside Jira: every vehicle is a Jira issue, and every physical move is a workflow step.

|  |  |
| --- | --- |
| **Team** | Priyanshu Agrawal and Shubham Pitekar — 2 people, no company listed |
| **Industry / users** | Logistics yards and loading docks; gate staff, yard and dock supervisors |
| **Atlassian used** | Jira (issues, custom fields, workflows), Confluence, Jira Service Management, Rovo |
| **Public evidence** | Devpost write-up, Vimeo video, \~15 slide and mind-map images; no code, no try-it link |

**The problem.** Yards run on paper, radio and guesswork, so nobody can see which gates, docks and parking spots are in use.

**How it works** (as the team describes it)

1. A truck arriving at the gate becomes a Jira issue with vehicle number, weight, driver and photos.
2. Its physical journey is the issue's workflow: At Gate → Parked or Docked → Gate Out.
3. The app prints a QR code holding the issue key; ground staff scan it with a phone to update the truck.
4. It assigns docks and parking spots based on availability.
5. Confluence gets automatic shift reports; Jira Service Management handles exceptions such as a blocked dock.
6. A Rovo agent answers yard questions in plain language for non-technical staff.

**What stood out**

- **A physical process mapped cleanly onto Jira:** anyone who knows Jira instantly understands "a truck moving is a status change".
- **Several Atlassian products, each with a clear job:** Jira tracks, Confluence reports, the service desk handles exceptions, Rovo answers questions.
- **Small team:** two people placed second against a six-person vendor.

**Limits and what not to copy**

- The public evidence is thin: slides and a video, no code and no way for an outsider to try it.
- It placed when judges were allowed to judge from the write-up and video alone. In 2026 judges are expected to install and test, so thin evidence is far riskier now.

**Lesson for us:** a clear picture of a real-world process inside Jira is persuasive — but in 2026 it must also install and work on a judge's site.

## 3. Compliant Workflows for Jira — 2025 Specialized Industries, 3rd place

[Compliant Workflows for Jira](https://devpost.com/software/compliant-workflows-for-jira) checks a company's live Jira workflow set-up against the rules regulated life-sciences teams are audited on, then explains and fixes each gap.

|  |  |
| --- | --- |
| **Team** | Aaron Morris, solo ([Agile Innovations LLC](https://www.jira-compliance.com)); returning entrant who won a Forge bonus in 2021 |
| **Industry / users** | Pharma and medical devices; Jira admins and quality/regulatory staff |
| **Atlassian used** | Jira admin area (Custom UI with Atlassian's design kit), Forge functions, Jira REST APIs |
| **Public evidence** | Devpost write-up, YouTube demo, company website; no public code |

**The problem.** Jira admins don't know FDA or ISO expectations, and quality staff don't know Jira configuration. The result: closed records anyone can reopen, loose transitions and undocumented set-ups that fail audits.

**How it works** (as the author describes it)

1. It reads the company's real, live Jira workflows.
2. It checks them against compliance rules drawn from common audit and validation failures.
3. It explains each risk in plain language and offers a guided, automated fix.
4. It produces an audit-ready report of the workflow.

**What stood out**

- **A named regulated audience** and a concrete, checkable problem.
- **It fixes a live Atlassian object** — the workflow configuration itself — rather than adding a separate system.
- **No AI and no stored data at all**, yet it placed: domain rules were the value.
- **Runs fully on Atlassian**, which matters to regulated buyers.
- **Candour:** the author wrote openly that early AI-generated code had to be rewritten.

**Limits and what not to copy**

- Electronic signatures are listed as "planned", while the company website markets them — a small overclaim.
- Not yet on the Marketplace; the company site gives a beta date of Q2 2026.

**Lesson for us:** this is the closest relative of KnewWhen — same buyers, same regulated mindset. It shows that precise industry rules applied to real Jira data can place without any AI. Our job is to match that precision and add what it lacks: evidence found automatically.oi

## 4. Secure Notes for Jira — 2025 Apps for Software Teams, 1st place

[Secure Notes for Jira](https://devpost.com/software/secure-notes-for-jira-coegvb) lets teams share passwords and other secrets inside a Jira issue as encrypted, one-time, expiring notes instead of plain text.

|  |  |
| --- | --- |
| **Team** | Vasyl Zakharchenko, Kseniya Moskalenko, Alina Tsabai (now listed under the vendor Trust Logic; Atlassian's webinar post credits Tempo) |
| **Industry / users** | Software, operations and service-desk teams |
| **Atlassian used** | Jira issue panel, global page and admin page; Forge SQL and key-value storage; scheduled jobs and queues; a Rovo agent for audit summaries |
| **Public evidence** | Devpost, YouTube demo, [public source code](https://github.com/vzakharchenko/Forge-Secure-Notes-for-Jira), [Marketplace listing](https://marketplace.atlassian.com/apps/1267328525/secure-notes-for-jira) |

**The problem.** People paste credentials and other secrets into Jira tickets and comments in plain text, where they stay readable forever.

**How it works** (confirmed in the source code)

1. The note is encrypted in the user's browser (AES-GCM with a PBKDF2-derived key) before it is saved.
2. Only the intended recipient can open it, once, before it expires.
3. Scheduled jobs clean up expired notes automatically.
4. Admin dashboards and a Rovo agent summarise who shared and opened what, for audits.

**What stood out**

- **Production-grade engineering:** about 9,300 lines of TypeScript, automated checks, tests, privacy policy and terms.
- **No data leaves Atlassian:** the app declares no external connections, a strong trust signal for a security product.
- **A focused problem everyone recognises,** solved end to end.
- **Existing work extended:** the code started in May 2025, five months before the contest, which the rules allow if the project is rebuilt or substantially updated on Forge.

**Limits and what not to copy**

- Winning did not bring customers: the paid listing shows 2 installs today.
- The prior-year report credited it with RSA-4096 keys and Argon2 hashing; the real code uses neither.

**Lesson for us:** this is the engineering bar for 1st place. Judges can test and inspect the code, so real tests, clean structure and zero data egress are worth as much as features.

## 5. Runbook Rabbit — 2024 High-Velocity Service Management, 1st place (+ Rovo bonus)

[Runbook Rabbit](https://devpost.com/software/runbook-rabbit-let-rovo-be-your-jira-agent-s-new-assistant) reads a team's runbooks for a service-desk agent, suggests the next steps on a ticket and highlights the exact runbook passages it relied on.

|  |  |
| --- | --- |
| **Team** | Julian Wolf, solo; repeat winner (2022 Business 1st with FlowDingo, a Forge prize in 2021) and Atlassian event speaker |
| **Industry / users** | IT and service teams; Jira Service Management agents |
| **Atlassian used** | Jira Service Management, Confluence runbooks, Rovo, Jira Automation |
| **Public evidence** | Devpost write-up and YouTube demo; no public code; not on the Marketplace |

**The problem.** Teams write runbooks, but agents under pressure don't read them, so known fixes are missed and resolution slows.

**How it works** (as the author describes it)

1. Runbooks in Confluence are linked to Jira projects and request types.
2. Jira Automation triggers the analysis when a ticket is created, commented on or updated.
3. A Rovo agent suggests next steps for that ticket from the linked runbooks.
4. It highlights the runbook sentences it used, so the agent can check the advice before acting.
5. Everything runs on Atlassian, with no data sent elsewhere.

**What stood out**

- **AI you can check:** showing the exact source passages keeps the human in control and builds trust.
- **Triggered by normal work:** no one has to remember to ask the AI; it runs when the ticket changes.
- **Early, meaningful use of a new platform feature:** Rovo was brand new in 2024 and this used it for a real job.
- **An experienced builder:** a clear sign that Forge track record matters for 1st place.

**Limits and what not to copy**

- No public code and no Marketplace listing, so long-term value is unproven.
- The author's 2022 winner, FlowDingo, later took months to reach the Marketplace and was eventually archived for lack of customers. Winning is not the same as traction.

**Lesson for us:** this is the model for KnewWhen's AI — suggestions grounded in visible source text, triggered by normal Jira activity, with a person deciding.

## Side by side

All five solve one narrow, real problem inside Atlassian; only FleetOps is confirmed to call an outside service, and only Secure Notes is on the Marketplace.

| Project | Year · award | Team | Core idea | Where the data lives | AI | Leaves Atlassian? | Public code | Marketplace |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FleetOps | 2025 · SI 1st + Rovo | Vendor, 6 | Photo → classified ticket linked to vehicle | Jira Assets + service desk | Vision AI + Rovo | Yes (OpenAI) | No | No |
| YardMaster | 2025 · SI 2nd + Rovo | 2 people | Truck = issue; moves = workflow steps | Jira issues, Confluence | Rovo | Not stated | No | No |
| Compliant Workflows | 2025 · SI 3rd | Solo, returning | Audit + fix live workflows vs regulatory rules | Live Jira config (stores nothing) | None | No | No | No (beta) |
| Secure Notes | 2025 · Software 1st | 3 people, later a vendor | Encrypted one-time secrets in issues | Forge SQL + key-value storage | Rovo (audit summaries) | No | Yes | Yes (paid, 2 installs) |
| Runbook Rabbit | 2024 · Service Mgmt 1st + Rovo | Solo, repeat winner | Runbook-grounded next steps with highlighted sources | Confluence runbooks + service desk | Rovo | No | No | No |

SI = Apps for Specialized Industries.

## What this means for KnewWhen

We borrow five habits from these winners, not their ideas — and avoid the three gaps the 2026 rules now punish.

| Borrow | Seen in | How KnewWhen applies it |
| --- | --- | --- |
| Put the industry's real records inside Jira | FleetOps, YardMaster, Compliant Workflows | Complaints, evidence and decisions live as Jira fields, comments and searchable data |
| Make an empty site look real in a minute | FleetOps | One-click sample cases plus real past history via Jira's own importer |
| Precise industry rules beat generic AI | Compliant Workflows | Deadline engine built from the FDA and EU rule text, with published tests |
| AI you can check, triggered by normal work | Runbook Rabbit | Only word-for-word quotes from Jira records; runs when tickets change |
| Engineering you can inspect, no data leaving Atlassian | Secure Notes, Compliant Workflows | Public tests, an independent check of the deadline maths, Runs on Atlassian eligible |

**Don't copy**

- **Thin evidence** (YardMaster): in 2026 judges install and test, so a video and slides are not enough.
- **Outside AI services** (FleetOps): a lapsed key or bill during the four-week judging window breaks the app.
- **Expecting the win to bring customers** (Secure Notes, FlowDingo): treat the Marketplace listing as a product launch, not a prize.

## Sources

Pages opened by the research team on 17 Nov 2026.

- [Atlassian: Codegeist 2025 winners](https://www.atlassian.com/blog/development/meet-the-winners-of-codegeist-2025-atlassian-williams-racing-edition)
- [Atlassian: Codegeist 2024 winners](https://www.atlassian.com/blog/developer/codegeist-2024-winners)
- [Devpost: FleetOps](https://devpost.com/software/fleetops-smart-incident-reporting-for-fleet-operations)
- [Devpost: YardMaster](https://devpost.com/software/test-6y0chd)
- [Devpost: Compliant Workflows for Jira](https://devpost.com/software/compliant-workflows-for-jira) · [jira-compliance.com](https://www.jira-compliance.com)
- [Devpost: Secure Notes for Jira](https://devpost.com/software/secure-notes-for-jira-coegvb) · [source code](https://github.com/vzakharchenko/Forge-Secure-Notes-for-Jira) · [Marketplace listing](https://marketplace.atlassian.com/apps/1267328525/secure-notes-for-jira)
- [Devpost: Runbook Rabbit](https://devpost.com/software/runbook-rabbit-let-rovo-be-your-jira-agent-s-new-assistant)
- [Atlassian Community: 2025 winners webinar post](https://community.atlassian.com/forums/App-Central-articles/Exclusive-Webinar-%F0%9D%97%9C%F0%9D%97%BB%F0%9D%98%80%F0%9D%97%B6%F0%9D%97%B1%F0%9D%97%B2-%F0%9D%97%96%F0%9D%97%BC%F0%9D%97%B1%F0%9D%97%B2%F0%9D%97%B4%F0%9D%97%B2%F0%9D%97%B6%F0%9D%98%80%F0%9D%98%81-%F0%9D%9F%AE%F0%9D%9F%AC%F0%9D%9F%AE%F0%9D%9F%B1-How-the-winners-built-on/ba-p/3203319)
- [Atlassian Community: FlowDingo — the story of a Codegeist winner](https://community.atlassian.com/forums/App-Central-articles/FlowDingo-The-Story-of-a-Codegeist-Winner/ba-p/2477229)
- [Codegeist 2025 rules](https://codegeistxawr.devpost.com/rules) · [Codegeist 2026 rules](https://codegeist2026.devpost.com/rules)
