/** The ID of the user an admin is managing (never the signed-in admin). */

/**
 * Reads the ID of the user being managed. The backend's user IDs are numbers (Long), so
 * only a positive whole number is accepted. This is never the signed-in admin's username
 * or role: sending "superadmin" here is what made the server fail to convert it to a Long.
 */
export function readUserId(raw: string): number | { error: string } {
  const v = raw.trim();
  if (!v) return { error: "Enter the user's ID." };
  if (!/^\d+$/.test(v)) return { error: /^[a-z_][\w.-]*$/i.test(v) ? "That looks like a username or role. Enter the user's numeric ID, like 42." : "A user ID is a whole number, like 42." };
  const n = Number(v);
  if (!Number.isSafeInteger(n)) return { error: "That user ID is too large." };
  if (n <= 0) return { error: "A user ID is 1 or more." };
  return n;
}

/** Throws before any request is sent if the ID isn't a positive whole number. */
export function assertUserId(id: number): string {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("A valid numeric user ID is needed before contacting the server.");
  return String(id);
}
