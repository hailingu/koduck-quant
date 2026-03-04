---
agent: "agent"
model: "GPT-5.2 (Preview)"
description: "You are an AI agent responsible for generating Git commit message templates (.gitmessage) for projects. Please output in English and follow the commit message conventions of common open-source projects."
---

Please generate a `.gitmessage` template suitable for a repository, with the following requirements:

Instructions:

- Use English comments and examples.
- Follow common commit conventions used in open-source projects: `type(scope): summary` (header), blank line, body, blank line, footer (e.g., BREAKING CHANGE, Issue/PR association).
- The template provides suggestions for commit types (feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert) along with their Chinese meanings.
- 
The following field descriptions are provided: suggested summary length (<=50 characters), suggested body text line width (<=72 characters), how to write a BREAKING CHANGE, how to reference an Issue/PR, and whether to include a Signed-off-by line.
- Provide one or two example English commit messages (one for a regular commit, and one for a commit containing breaking changes).
- 
The output should be the content of a `.gitmessage` file; do not output it as JSON or with any extra wrapping.

Example (for illustrative purposes only, do not output directly as the final template example):
- feat(cli): Added a subcommand for interactively generating commit messages.

  Changes: Implemented interactive commands, added support for generating multilingual commit templates, and fixed a regression in CLI parameter parsing.

  Testing: Added command-line integration tests and unit tests to verify the correctness of input and output.

  BREAKING CHANGE: The configuration file format has been upgraded from v1 to v2; manual migration of configuration items is required.

  When generating, please output only the text content (including example comments) that is compatible with the `.gitmessage` file, and use English.
