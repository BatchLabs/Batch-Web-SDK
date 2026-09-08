import UUID from "com.batch.shared/helpers/uuid";
import safeGetWindow from "com.batch.shared/helpers/window";

const SESSION_STORAGE_KEY = "com.batch.lp.sessionId";

/** Keeps the id stable for this document when `sessionStorage` is unusable. */
let inMemorySessionId: string | null = null;

/** The landing session id of this visit, kept in `sessionStorage` and falling back to a document-lived id. */
export function resolveLandingSessionId(): string {
  const stored = readStoredSessionId();
  if (stored !== null) {
    return stored;
  }

  const sessionId = inMemorySessionId ?? UUID();
  inMemorySessionId = sessionId;
  storeSessionId(sessionId);
  return sessionId;
}

function readStoredSessionId(): string | null {
  const safeWindow = safeGetWindow();
  if (safeWindow === null) {
    return null;
  }
  try {
    const stored = safeWindow.sessionStorage.getItem(SESSION_STORAGE_KEY);
    return stored !== null && stored.length > 0 ? stored : null;
  } catch (_e) {
    return null;
  }
}

function storeSessionId(sessionId: string): void {
  const safeWindow = safeGetWindow();
  if (safeWindow === null) {
    return;
  }
  try {
    safeWindow.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch (_e) {
    // Storage is blocked or out of quota: the id will not survive a reload.
  }
}
