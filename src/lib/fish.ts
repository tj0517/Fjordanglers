// ─── SINGLE SOURCE OF TRUTH FOR FISH SPECIES ──────────────────────────────
// All fish-related constants should be imported from this file.

/** Full list used in forms (experience creation, guide profiles, etc.) */
export const FISH_ALL = [
  // ── Salmonids ──────────────────────────────────────────────────────────
  'Salmon',
  'Sea Trout',
  'Brown Trout',
  'Rainbow Trout',
  'Lake Trout',
  'Arctic Char',
  'Grayling',
  'Whitefish',
  'Brook Trout',
  'Coho Salmon',
  'Chinook Salmon',
  // ── Freshwater predators ───────────────────────────────────────────────
  'Pike',
  'Perch',
  'Zander',
  'Burbot',
  // ── Saltwater — demersal ───────────────────────────────────────────────
  'Cod',
  'Pollock',
  'Haddock',
  'Ling',
  'Brosme',
  'Halibut',
  'Flounder',
  'Wolffish',
  'Spiny Dogfish',
  // ── Saltwater — other ─────────────────────────────────────────────────
  'Sea Bass',
  'Mackerel',
  'Garfish',
  'Norway Redfish',
  // ── Saltwater — NZ ────────────────────────────────────────────────────
  'Saltwater Species: Kingfish & Coastal Predators',
] as const
