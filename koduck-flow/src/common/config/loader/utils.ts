import type { ValidationIssue } from "../schema";

export function formatValidationIssueForLog(issue: ValidationIssue): string {
  const segments: string[] = [`${issue.path}: ${issue.message}`];

  if (issue.expected) {
    segments.push(`期望 ${issue.expected}`);
  }

  if (issue.received !== undefined) {
    segments.push(`实际 ${JSON.stringify(issue.received)}`);
  }

  if (issue.hint) {
    segments.push(`提示 ${issue.hint}`);
  }

  return segments.join(" | ");
}
