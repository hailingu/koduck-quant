const INTERNAL_ENTITY_ID_SEGMENT_PATTERN =
  /\s*[（(]\s*(?:tool_)?entity[_\s-]?id\s*[:=]\s*\d+\s*[)）]\s*/gi;
const INTERNAL_ENTITY_ID_TOKEN_PATTERN =
  /\b(?:tool_)?entity[_\s-]?id\s*[:=]\s*\d+\b/gi;
const INTERNAL_PROFILE_ID_SEGMENT_PATTERN =
  /\s*[（(]\s*(?:tool_)?profile[_\s-]?id\s*[:=]\s*\d+\s*[)）]\s*/gi;
const INTERNAL_PROFILE_ID_TOKEN_PATTERN =
  /\b(?:tool_)?profile[_\s-]?id\s*[:=]\s*\d+\b/gi;
const INTERNAL_ENTRY_CODE_ID_SEGMENT_PATTERN =
  /\s*[（(]\s*[A-Z][A-Z_]{1,63}\s+id\s*[:=]\s*\d+[\s,，，、;；:：\-—–]*[^)）]*[)）]\s*/g;
const INTERNAL_ENTRY_CODE_ID_TOKEN_PATTERN =
  /\b[A-Z][A-Z_]{1,63}\s+id\s*[:=]\s*\d+\b/g;
const INTERNAL_ENTRY_CODE_TOKEN_PATTERN =
  /\b(?:TEAM_TENURE|HONOR_EVENT|CAREER|BIO|OFFICE|FAMILY|HONOR)\b/g;

export function sanitizeAssistantDisplayContent(content: string): string {
  return content
    .replace(INTERNAL_ENTITY_ID_SEGMENT_PATTERN, " ")
    .replace(INTERNAL_ENTITY_ID_TOKEN_PATTERN, "")
    .replace(INTERNAL_PROFILE_ID_SEGMENT_PATTERN, " ")
    .replace(INTERNAL_PROFILE_ID_TOKEN_PATTERN, "")
    .replace(INTERNAL_ENTRY_CODE_ID_SEGMENT_PATTERN, " ")
    .replace(INTERNAL_ENTRY_CODE_ID_TOKEN_PATTERN, "")
    .replace(INTERNAL_ENTRY_CODE_TOKEN_PATTERN, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]+\n/g, "\n\n")
    .trim();
}

export function normalizeMarkdownContent(content: string): string {
  const source = sanitizeAssistantDisplayContent(content)
    .replace(/\r\n/g, "\n")
    .replace(/\|\s*\|(?=\s*(?:[-:]{3,}|[^|\n]+?\s*\|))/g, "|\n|")
    .trim();
  const rawLines = source.split("\n");

  const isTableLike = (line: string): boolean => {
    const trimmed = line.trim();
    const pipeCount = (trimmed.match(/\|/g) || []).length;
    return pipeCount >= 2;
  };

  const sanitizeTableLine = (line: string): string | null => {
    const trimmed = line.trim();
    if (!trimmed || /^(\|\s*)+$/.test(trimmed)) {
      return null;
    }

    let tableLine = trimmed;
    if (!tableLine.startsWith("|")) {
      tableLine = `| ${tableLine}`;
    }
    if (!tableLine.endsWith("|")) {
      tableLine = `${tableLine} |`;
    }

    return tableLine
      .replace(/\|\s+/g, "| ")
      .replace(/\s+\|/g, " |")
      .replace(/\|{2,}/g, "|");
  };

  const appendExpandedText = (bucket: string[], line: string) => {
    const expanded = line
      .replace(/([^\n])\s*(#{1,6}\s+)/g, "$1\n\n$2")
      .replace(/([^\n])\s*(>\s)/g, "$1\n$2")
      .replace(/([^\n])\s*(\d+\.\s+)/g, "$1\n$2")
      .replace(/([^\n])\s*(---+)\s*/g, "$1\n\n$2\n\n");

    bucket.push(...expanded.split("\n"));
  };

  const splitTablePrefix = (line: string): { prefix: string; table: string } => {
    const firstPipeIndex = line.indexOf("|");
    if (firstPipeIndex <= 0) {
      return { prefix: "", table: line };
    }

    const prefix = line.slice(0, firstPipeIndex).trim();
    const table = line.slice(firstPipeIndex).trim();
    const tablePipeCount = (table.match(/\|/g) || []).length;
    if (!prefix || tablePipeCount < 2) {
      return { prefix: "", table: line };
    }

    return { prefix, table };
  };

  const expandCompactTableRows = (line: string): string[] =>
    line
      .replace(/\|\s*\|(?=\s*(?:[-:]{3,}|[^|\n]+?\s*\|))/g, "|\n|")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

  const mergedLines: string[] = [];
  for (let i = 0; i < rawLines.length; i += 1) {
    const current = rawLines[i].trim();
    const next = rawLines[i + 1]?.trim() ?? "";
    const nextNext = rawLines[i + 2]?.trim() ?? "";

    if (/^\|\*+\s*$/.test(current) && next && nextNext.startsWith("|")) {
      mergedLines.push(`${current}${next}${nextNext}`);
      i += 2;
      continue;
    }

    if (/^(\|\s*)+$/.test(current)) {
      continue;
    }

    mergedLines.push(rawLines[i]);
  }

  const normalizedLines: string[] = [];
  let inTableBlock = false;
  let tableHeaderColumns = 0;
  let separatorInserted = false;

  for (const rawLine of mergedLines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      normalizedLines.push("");
      inTableBlock = false;
      tableHeaderColumns = 0;
      separatorInserted = false;
      continue;
    }

    if (isTableLike(trimmed)) {
      const { prefix, table } = splitTablePrefix(trimmed);
      if (prefix) {
        appendExpandedText(normalizedLines, prefix);
        if (normalizedLines.at(-1) !== "") {
          normalizedLines.push("");
        }
      }

      for (const tableRow of expandCompactTableRows(table)) {
        const tableLine = sanitizeTableLine(tableRow);
        if (!tableLine) {
          continue;
        }

        const isSeparatorLike = /^[\s|:-]+$/.test(tableLine);
        const cellCount = tableLine
          .split("|")
          .map((part) => part.trim())
          .filter(Boolean).length;

        if (!inTableBlock) {
          inTableBlock = true;
          tableHeaderColumns = cellCount;
          separatorInserted = false;
          normalizedLines.push(tableLine);
          continue;
        }

        if (!separatorInserted && !isSeparatorLike && tableHeaderColumns > 0) {
          normalizedLines.push(
            `| ${Array.from({ length: tableHeaderColumns }, () => "---").join(" | ")} |`,
          );
          separatorInserted = true;
        }

        if (isSeparatorLike) {
          separatorInserted = true;
        }

        normalizedLines.push(tableLine);
      }
      continue;
    }

    inTableBlock = false;
    tableHeaderColumns = 0;
    separatorInserted = false;
    appendExpandedText(normalizedLines, rawLine);
  }

  return normalizedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
