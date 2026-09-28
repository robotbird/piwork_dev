---
name: git
description: Lightweight git workflow that writes a concise English commit message from the current diff and commits. Use when the user asks for "git commit" or "git push" (push commits pending changes first, then pushes). Never commit or push on your own initiative.
---

# Lightweight git workflow

Turn uncommitted work into a clean commit with a concise English message, on explicit user request only.

## Trigger guard (hard rule)

- Run this skill **only** when the user explicitly asks for `git commit` or `git push`.
- Do **not** commit, stage-then-commit, or push as a side effect of finishing any other task. Editing files is not permission to commit.
- `git push` triggers a commit first. `git commit` never pushes.
- Never `git push --force`, rewrite history, or push a different branch than requested.

## Step 1 — Inspect the working tree

```bash
git status --short
git diff --stat
git diff --cached --stat
git log -5 --oneline
```

- If there is nothing to commit (clean tree, or for push: nothing pending and nothing to send), say so and stop. Do not create an empty commit.
- Skim the actual diff (`git diff`, and `git diff --cached` if something is already staged) before writing the message. Never describe changes you have not read.
- Do not stage obvious junk or secrets. If a suspicious file shows up (`.env`, credentials, large binaries, build output), leave it out and tell the user.

## Step 2 — Write the message

Match the repo's existing style. Subject line only for small changes; add a short body when the change is non-trivial.

- **Language:** English.
- **Subject:** imperative mood, ≤ ~60 characters, no trailing period, no `[tags]` or emoji.
  - Good: `Move tests under tests/ and add architecture docs`
  - Good: `Fix SSE resume cursor offset on reconnect`
  - Bad: `update`, `fix bug`, `Changes.`
- **Body (optional):** one blank line, then `- ` bullets for what and why. Add a `Validation:` line only if checks were actually run in this session.
- Describe the why, not a file-by-file inventory. Keep the whole message readable in one screen.

Examples:

```text
Add LocalRpc backend driving pi --mode rpc via official RpcClient

- Map pi RPC records to Runtime command/event with a shared normalizer
- Terminate runs on agent_settled and watchdog process death
```

```text
Fix stale role label after member update
```

## Step 3 — Commit

```bash
git add -A          # only intended changes; adjust paths if needed
git commit -m "<subject>" -m "<body>"   # omit the second -m when there is no body
```

Then report the new commit hash and subject (`git log -1 --oneline`).

## Step 4 — Push (only for `git push`)

Only after Step 3 succeeds:

```bash
git push            # add -u origin <branch> only when the branch has no upstream
```

If the push is rejected, report the reason and stop — do not force or merge without the user's go-ahead.

## Notes

- Keep it lightweight: no hooks, no config changes, no extra tooling.
- If tests or type checks were already run for this change, reuse that result; do not launch a long validation just to commit.
- If the user supplies their own message, use theirs verbatim instead of generating one.
