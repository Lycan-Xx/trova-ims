/** The store's reporting day. Keep this independent from the machine/database timezone. */
export const BUSINESS_TIME_ZONE = 'Africa/Lagos'
// Lagos has no DST. This fixed-offset IANA name is also available in the
// lightweight timezone catalog used by PGlite, while matching Africa/Lagos.
export const BUSINESS_UTC_OFFSET = '+01:00'

export function businessDate(value: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value)
  const fields = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${fields.year}-${fields.month}-${fields.day}`
}
