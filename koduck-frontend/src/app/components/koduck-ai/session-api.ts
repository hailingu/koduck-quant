import type { Message, SessionLookupEnvelope, SessionTranscriptEntry, SessionTranscriptEnvelope } from "./types";

const SESSION_LOOKUP_RETRY_DELAYS_MS = [150, 400];

function mapTranscriptEntriesToMessages(entries: SessionTranscriptEntry[]): Message[] {
  return entries
    .filter(
      (entry): entry is Required<Pick<SessionTranscriptEntry, "entry_id" | "role" | "content" | "timestamp">> =>
        typeof entry.entry_id === "string" &&
        (entry.role === "user" || entry.role === "assistant") &&
        typeof entry.content === "string" &&
        typeof entry.timestamp === "number",
    )
    .map((entry) => ({
      id: entry.entry_id,
      memoryEntryId: entry.entry_id,
      role: entry.role,
      content: entry.content,
      type: "text",
      timestamp: entry.timestamp,
    }));
}

export async function fetchSessionExists(
  sessionId: string,
  signal: AbortSignal,
): Promise<boolean | null> {
  const token = window.localStorage.getItem("koduck.auth.token");

  for (let attempt = 0; attempt <= SESSION_LOOKUP_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal,
      });

      if (response.ok) {
        const body = (await response.json()) as SessionLookupEnvelope;
        if (!body.success) {
          return null;
        }

        return body.data?.exists === true;
      }

      if (
        response.status !== 502 &&
        response.status !== 503 &&
        response.status !== 504
      ) {
        return null;
      }
    } catch {
      return null;
    }

    const delay = SESSION_LOOKUP_RETRY_DELAYS_MS[attempt];
    if (delay == null) {
      return null;
    }

    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, delay);
      const onAbort = () => {
        window.clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        resolve();
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });

    if (signal.aborted) {
      return null;
    }
  }

  return null;
}

export async function fetchSessionTranscript(
  sessionId: string,
  signal?: AbortSignal,
): Promise<Message[] | null> {
  const token = window.localStorage.getItem("koduck.auth.token");
  const response = await fetch(
    `/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/transcript`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal,
    },
  );

  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as SessionTranscriptEnvelope;
  if (!body.success) {
    return null;
  }

  return mapTranscriptEntriesToMessages(body.data?.entries ?? []);
}
