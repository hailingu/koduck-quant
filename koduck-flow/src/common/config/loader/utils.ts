import type { ValidationIssue } from "../schema";

/**
 * Formats a validation issue into a human-readable log string.
 *
 * @param issue - The validation issue to format
 * @returns A pipe-separated string containing the path, message, and optional expected/received/hint fields
 */
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
