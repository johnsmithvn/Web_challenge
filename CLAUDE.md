# CLAUDE.md

# Language

- Always reply in Vietnamese unless explicitly requested otherwise.

---

# Primary Workflow

Before implementing any code changes:

1. Read `docs/RULES.md`.
2. Read only the files directly related to the task.
3. Read additional documentation only when required.
4. Create a short implementation plan.
5. If the task affects more than 5 files, architecture, or database schema, wait for user approval before implementation.
6. Implement the smallest correct solution.
7. Prefer modifying existing code over creating new files.
8. Reuse existing components, hooks, utilities, and patterns whenever possible.
9. Run `npm run build` before completing the task.
10. Summarize what changed.

---

# Documentation Loading

Load documentation only when relevant.

| Task | Documentation |
|------|---------------|
| Database | docs/DATABASE.md |
| Architecture | docs/ARCHITECTURE.md |
| Features | docs/FEATURES.md |
| Tasks | docs/TASKS.md |
| Audit | docs/AUDIT_REPORT_*.md |

Never load unrelated documentation.

---

# Design System

For tasks involving:

- UI
- Styling
- CSS
- Components
- Layout
- Responsive Design
- Theme
- UX

Read `DESIGN.md` before making changes.

If the task is unrelated to UI, do not load `DESIGN.md`.

When modifying the design system:

- Update `DESIGN.md` if necessary.
- Run:

npm run design:lint

---

# Coding Philosophy

Always prefer:

- Simplicity
- Readability
- Small reversible changes
- Existing project patterns

Before writing new code, check in this order:

1. Can existing project code solve this?
2. Can React solve this?
3. Can browser APIs solve this?
4. Can Supabase solve this?
5. Can existing dependencies solve this?
6. Only then create new code.

Avoid:

- Over engineering
- Premature abstraction
- Duplicate logic
- One-time helper functions
- Unnecessary dependencies
- Large rewrites

---

# Scope Control

Never:

- Refactor unrelated code.
- Rename files without reason.
- Move folders unnecessarily.
- Modify unrelated components.

Stay inside the requested scope.

---

# Output

Before finishing every implementation:

- Confirm build succeeded.
- Explain what changed.
- Mention important tradeoffs.
- Mention remaining TODOs if any.

Do not claim completion without verification.


## Project Memory

For architecture decisions, historical context, previous bugs, conventions, and implementation rationale:

- Search Engram memory before making assumptions.
- Reuse existing project knowledge when relevant.
- If a significant architectural decision or important bug fix is made, save it to Engram.
- Do not save trivial implementation details.

### Engram usage rules

- **Write memory ONLY through the MCP tool `mem_save`. Never use `engram save` from the CLI/terminal.**
  A CLI save does not get a project key: `engram projects list` stays empty and the default
  `mem_search` (scoped to the project) will not find it. Verified 2026-07-27 — the orphan
  observation had to be re-saved via MCP and soft-deleted.
- This repo's Engram project key is **`web_challenge`**, detected from the git remote
  (`github.com/johnsmithvn/Web_challenge.git`) — not from the folder name `Web_Update`.
- Use the `engram` CLI only for admin commands missing from the `--tools=agent` profile:
  `engram delete`, `engram stats`, `engram projects list`, `engram doctor`.