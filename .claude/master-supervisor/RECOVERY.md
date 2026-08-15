# Recovery Procedure

## Resuming after any interruption

1. `cd C:\Users\paulg\OneDrive\Desktop\Taytay_Rizal_Social_Welfare_Angular`
2. `git status && git log --oneline -10 && git diff --stat`
3. Read `.claude/master-supervisor/state.json` → `currentTab`, `lastLocalCommit`.
4. Read `.claude/master-supervisor/MEMORY.md` → next action.
5. Reconcile: compare the dirty tree against the last commit. **Preserve
   partial work.** A failed command does not mean nothing was written.
6. `npm run verify` to establish whether the tree is green before adding to it.
7. Continue from the precise cutoff. Do not restart the TAB.

## Never

- `git push`, `git push --force`, remote merge, PR, deploy — no remote exists
  and none may be created.
- `git reset --hard`, `git clean -fd` — pre-existing user work must survive.
- Weakening a `tools/check-*.mjs` checker to make a change pass. Each was
  validated against planted regressions; a passing build after a weakened
  checker is a false negative, which is worse than a red build.
- Claiming PASS for a command that did not run. Use `PASS` / `FAIL` /
  `NOT_AVAILABLE` / `NOT_APPLICABLE` / `BLOCKED_BY_ENVIRONMENT` accurately.

## Shell note — this cost time once

The Bash tool here is **Git Bash**, not PowerShell. PowerShell here-strings
(`@'...'@`) are not shell syntax and will be committed literally: a `@` was
prepended to a commit subject line this way and had to be amended out. For
multi-line commit messages use a bash heredoc:

```sh
git commit -F - <<'EOF'
subject

body
EOF
```

## Events

### 2026-08-16 — supervision area bootstrapped

Discovered mid-project at TAB 12. Implementation was committed
(`26a2601`), but the decision-log append, the checker and two spec files were
uncommitted. Merged `_tab12-append.md` into `decision-log.md`, ran full
`npm run verify` (PASS — 829 tests), committed as `50dd3e6`. No work was lost
and nothing pre-existing was discarded.

## Environment facts worth not rediscovering

- `npm run verify` takes roughly 90 s end to end; the test run alone is ~42 s.
- The build emits a 123.67 kB initial bundle across ~50 lazy chunks.
- Git reports `LF will be replaced by CRLF` on staging. Expected on Windows,
  not an error. Source-introspection tests must not assume `\n`.
