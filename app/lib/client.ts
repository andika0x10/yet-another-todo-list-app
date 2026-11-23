function makeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // crypto.randomUUID only exists on HTTPS or localhost.
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

/** Unique id per browser tab. Sent with each change so this tab does not reload itself. */
export const clientId: string = typeof window === "undefined" ? "" : makeId();
