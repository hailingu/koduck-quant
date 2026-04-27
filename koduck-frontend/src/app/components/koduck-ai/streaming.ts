export const STREAM_INITIAL_IDLE_TIMEOUT_MS = 20000;
export const STREAM_POST_CONTENT_IDLE_TIMEOUT_MS = 8000;
export const STREAM_REQUEST_TIMEOUT_MS = 300000;
export function logStreamTrace(
  localRequestId: string,
  stage: string,
  detail: Record<string, unknown> = {},
) {
  console.info("[koduck-ai][stream]", {
    localRequestId,
    stage,
    ...detail,
  });
}

export function toUserVisibleStreamErrorMessage(rawMessage: string | null | undefined): string {
  const normalized = rawMessage?.trim().toLowerCase() || "";

  if (!normalized) {
    return "连接中断，请重试一次。";
  }

  if (
    normalized.includes("chat stream idle timeout") ||
    normalized.includes("request timeout") ||
    normalized.includes("stream timeout") ||
    normalized.includes("timed out")
  ) {
    return "响应超时，请重试一次。";
  }

  if (
    normalized.includes("networkerror") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("load failed") ||
    normalized.includes("network request failed")
  ) {
    return "网络连接异常，请重试一次。";
  }

  if (
    normalized.includes("aborted") ||
    normalized.includes("interrupted") ||
    normalized.includes("ended before any visible content")
  ) {
    return "响应中断，请重试一次。";
  }

  return "连接中断，请重试一次。";
}
export function parseSseBlocks(
  buffer: string,
): { blocks: Array<{ event: string; data: string }>; remainder: string } {
  const segments = buffer.split("\n\n");
  const remainder = segments.pop() ?? "";
  const blocks = segments
    .map((segment) => {
      const lines = segment.split("\n");
      let event = "message";
      const dataLines: string[] = [];

      for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (!line || line.startsWith(":")) {
          continue;
        }
        if (line.startsWith("event:")) {
          event = line.slice("event:".length).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice("data:".length).trim());
        }
      }

      return {
        event,
        data: dataLines.join("\n"),
      };
    })
    .filter((block) => block.data.length > 0);

  return { blocks, remainder };
}
