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
    segments.push(`expected ${issue.expected}`);
  }

  if (issue.received !== undefined) {
    segments.push(`received ${JSON.stringify(issue.received)}`);
  }

  if (issue.hint) {
    segments.push(`hint ${issue.hint}`);
  }

  return segments.join(" | ");
}
