/**
 * The calendar link key used by tests and CI (tj 2026-11-17: in test code, not in `.env.test`).
 * Deliberately not random: 32 bytes that spell out what they are, so nobody mistakes it for a
 * real key. Production uses its own value, set by tj in Vercel.
 */
export const TEST_CALENDAR_LINK_KEY_TEXT = 'TEST-ONLY-CALENDAR-KEY-NOTSECRET'

/** The same 32 bytes in the form `CALENDAR_LINK_KEY` takes (base64). */
export const TEST_CALENDAR_LINK_KEY = Buffer.from(TEST_CALENDAR_LINK_KEY_TEXT, 'utf8').toString('base64')
