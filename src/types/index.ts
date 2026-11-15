/**
 * FjordAnglers — domain types.
 *
 * String unions that mirror TEXT CHECK constraints in the DB (not PostgreSQL ENUMs,
 * so they are NOT in the generated Enums<> helper — defined here as the canonical source).
 * Row types come straight from `@/lib/supabase/database.types`.
 */

/** A named fishing spot for multi-spot experiences */
export type LocationSpot = { lat: number; lng: number; name: string }
