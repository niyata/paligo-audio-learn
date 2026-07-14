# Paligo Integrator

The Paligo Integrator is the coordination role for cross-agent cleanup,
release-safe migrations, and dirty working-tree triage.

## When To Use This Role

Use `agent:integrator` when work involves:

- dirty tree triage across Cursor, Codex, Claude, or human edits
- abandoned or owner-unknown files
- broad rename/refactor work
- URL compatibility routes
- release prep
- splitting large mixed diffs into reviewable slices
- resolving conflicts between agents

## Authority

The Integrator may:

- inspect and classify changed files
- claim owner-unknown files for triage
- split a mixed diff into small migration slices
- prepare compatibility routes before renames
- create or update issues for cleanup/release work
- decide whether a file should be preserved, migrated, split, or escalated

The Integrator may not:

- delete, revert, or discard user/agent work without Product Owner approval
- merge or deploy without Product Owner approval
- perform broad staging such as `git add .`
- rename production routes without a compatibility plan

## File Claim States

Use one of these states when claiming files:

| State | Meaning |
| --- | --- |
| `preserve` | Keep as-is; it belongs to a known work item |
| `migrate` | Move into a new naming/schema/route plan |
| `split` | Separate mixed changes into smaller review units |
| `needs-owner` | Ownership unclear; ask before changing |
| `needs-PO-decision` | Requires Product Owner choice before edits |

## Triage Checklist

1. Run `git status --short --branch`.
2. Read actual diffs before editing.
3. Identify whether each file is user-owned, agent-owned, generated, or unknown.
4. Assign a file claim state.
5. Record the claim in an issue comment or worklog.
6. Keep edits scoped to the claimed slice.
7. Run `git diff --check` and relevant syntax/tests.
8. Summarize what passed, what was not tested, and what remains unsafe.

## Handoff Template

Use the Integrator Handoff template in
[`AGENT-HANDOFF.md`](./AGENT-HANDOFF.md) when transferring work into this role.

## Current Integrator-Specific Policies

- URL/name refactors follow [`url-naming-refactor-plan.md`](../url-naming-refactor-plan.md).
- Inbox production work follows [`inbox-sprint-backlog.md`](./inbox-sprint-backlog.md).
- Exam/workbook line rendering must preserve `.cursor/rules/paligo-annotation-lines.mdc`.
