# MEMO Hackathon Demo Guide

## Positioning

MEMO is a **developer continuity and project intelligence layer**, not another Kanban board.

It turns GitHub activity into AI-grounded project understanding, detects potentially missing work, suggests explainable ownership, converts approved suggestions into tasks, preserves developer handoffs, and reconstructs context when someone returns.

## Safe demo data

The built-in demo project is intentionally fictional and contains no confidential data. It represents `alexrivera/auth-service` with three fictional contributors, recent commits, merged/open pull requests, an unresolved OAuth issue, an incomplete frontend integration, missing test coverage, tasks, and team memos.

Demo mode never calls GitHub or watsonx.ai and is visibly labeled **DEMO** in the authenticated header and project card. Live GitHub fallback data is separately labeled **DEMO DATA**; AI fallback results are labeled **Fallback analysis (no AI)**.

For a public repository demonstration, create a dedicated repository from the same fictional auth-service scenario. Do not connect a personal or company repository. Required history:

- Contributors: three consenting demo accounts
- Merged PR: backend refresh-token flow
- Open PR: frontend session integration
- Closed issue: token rotation
- Open issue: OAuth callback failure
- Commits touching backend auth, frontend session handling, and integration tests
- Deliberately missing expired-token test
- README note explicitly stating that the repository is synthetic hackathon data

## Reliable 3-minute demo

1. Start on the landing page. State: “MEMO saves developer context and reconstructs it when the team returns.”
2. Choose **Try Demo** for the guaranteed offline path, or **Continue with GitHub** for the live path.
3. Select the Auth Service repository/project.
4. Open **Context** to show normalized commits, PRs, issues, branches, files, and contributors.
5. Open **Intelligence**, select **Suggest**, and click **Update Project**.
6. Explain evidence and confidence on a detected gap. Open its evidence.
7. Choose **Review task**, review the description, priority, evidence, suggested owner, and reasoning, then create and assign it.
8. Open **Kanban** and show the new `MEMO SUGGESTED` Todo task. Drag it once.
9. Click **I'm Done for Today**. Show captured session activity, enter one manual fact, generate the watsonx.ai summary, and save with task creation enabled.
10. Open the saved memo to show author, timestamp, structured context, and GitHub evidence.
11. Open **Catch Me Up**. Expand evidence under What Changed, Your Team, What Needs Attention, and Your Next Step.
12. Close with: “GitHub activity becomes understanding, approved action, a durable handoff, and instant continuity.”

## Failure plan

- GitHub unavailable or rate limited: use **Try Demo**. Never describe demo data as live.
- watsonx.ai unavailable or invalid response: continue with GitHub-derived fallback; point out the explicit fallback label.
- Network interruption: existing pages show retry/empty states; use the built-in demo path if the live flow cannot recover quickly.
- OAuth callback expired: restart sign-in from MEMO instead of reusing an old GitHub callback URL.

## Business value

- Less manual project-status tracking
- Less time reconstructing development context
- Fewer missed tests, integrations, documentation updates, and follow-ups
- Faster developer and team handoffs
- Less duplicated work and rework
- Stronger continuity across sessions and contributors

## IBM technology

- **IBM watsonx.ai** is the runtime intelligence layer for project analysis, missing-work detection, handoff synthesis, catch-up interpretation, and assignment reasoning.
- Model output is validated, evidence-grounded, confidence-labeled, cached for identical inputs, and safely degraded to deterministic GitHub-derived output.
- IBM watsonx Orchestrate is intentionally not included because the current prototype has no workflow where it adds meaningful value beyond the existing review-and-approval controls.

## IBM Bob 2.0 development contribution

IBM Bob 2.0/Codex agent mode was central to implementation and verification:

- Inspected the existing FastAPI, SQLModel, React, and GitHub integration before extending it.
- Implemented project intelligence, evidence-backed gaps, suggested ownership, Kanban provenance, snapshot comparison, Catch Me Up, and developer handoffs.
- Used document understanding to turn sequential hackathon prompts into acceptance criteria and compatible implementation changes.
- Ran migrations, backend tests, frontend type checking, linting, live OpenAPI checks, and route diagnostics.
- Diagnosed stale backend processes, OAuth configuration failures, white-screen component crashes, and misleading/redundant UI.
- Used parallel subagent audit tasks during the final polish pass. Those tasks were initiated but the external agent service returned a usage-limit error, so their findings were not used or represented as completed work; the primary agent performed the audits locally.

This honest session record demonstrates agent-mode orchestration without overstating unavailable subagent output.

## Final operator checklist

- Use `127.0.0.1` consistently for frontend URLs and GitHub callback configuration.
- Start the backend from `backend/` so `.env` and key paths resolve correctly.
- Run `alembic upgrade head` before the demo.
- Confirm `/api/v1/projects/{id}/intelligence/status` reports the intended watsonx model and credentials.
- Confirm the DEMO badge is visible before presenting prepared data.
- Keep a fresh OAuth sign-in available; do not reuse an expired callback.
- Run backend tests and frontend typecheck immediately before judging.