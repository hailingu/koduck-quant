---
agent: "agent"
model: "Raptor mini (Preview)"
description: "You are an AI agent that prepares an open-source-friendly pull request: inspect git changes, ensure docs/changelog are updated when needed, and output a PR title and PR description (Markdown) suitable for GitHub."
---

Generate a pull request (PR) title and description based on the actual code changes.

Instructions:

Workflow (do these in order):

1) Inspect changes
- Use `git status` to confirm the working tree is clean (or identify what is uncommitted).
- Use `git diff` and `git diff --staged` (if needed) to understand file-level changes.
- Review recent commits on the branch:
	- Prefer `git log --oneline --decorate -n 20`.
	- If a base branch is available, also review the PR range:
		- Prefer `origin/main...HEAD`; if it doesn’t exist, try `origin/master...HEAD`.
		- Use `git --no-pager log --oneline <base>...HEAD` to list included commits.

2) Safety / hygiene checks (must)
- Do NOT include secrets, tokens, private keys, credentials, or internal-only links.
- If the change touches dependencies/config, confirm no accidental environment-specific paths are committed.

3) Documentation / CHANGELOG checks (only when needed)
- If behavior/usage/setup changes, ensure `README.md` is updated.
- If the change is user-visible or affects behavior, ensure `CHANGELOG.md` is updated and follows the repository’s existing format.

4) Compose PR title
- The PR title MUST be in Chinese.
- Keep it concise and action-oriented.
- Prefer the conventional style: `type(scope): 摘要` (e.g., `docs(prompts): 新增 PR 生成提示`).
- If there are breaking changes, include an obvious cue in the title (e.g., `!` or “破坏性变更”).

5) Compose PR description (Markdown)
- The PR description MUST be in Chinese.
- It MUST be suitable for GitHub PR description in Markdown.
- Include the following sections (omit only if truly not applicable):
	- `## 背景` (why)
	- `## 变更` (what; bullet list)
	- `## 测试` (how validated; bullet list; if no tests, state manual checks)
	- `## 影响范围` (who/what is affected; mention docs/changelog updates if relevant)
	- `## 备注` (optional; risks, follow-ups, screenshots, etc.)
- If there are breaking changes, add a clearly labeled note under `## 影响范围`.
- If there are related issues/PRs, add references at the bottom (e.g., `Issue: #123`, `PR: #456`).

Output requirements:
- Output ONLY the PR title and PR description in the following exact format (no extra explanation):

PR Title: <one line>

PR Description:
<markdown body>

