/** Errors with a message that's safe to show the admin. */
export class AdminError extends Error {}

/** Largest single coin change, to catch typos like an extra zero. */
export const MAX_COIN_CHANGE = 10_000_000;
