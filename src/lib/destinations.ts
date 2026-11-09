import { type Country, type RegionGroup, COUNTRIES, COUNTRY_REGION } from './countries'
import type { FaqEntry } from './experience-v2-content'

export type DestinationHub = {
  slug: string
  group: RegionGroup
  /** Narrows the region group to specific countries. Absent means all countries in the group. */
  countries?: Country[]
  h1: string
  intro: string
  metaTitle: string
  metaDescription: string

  // ── Editorial fields of the hub page (FA-1.65). Written by hand per hub; every one is
  // optional, and a section whose field is empty is not rendered. ──

  /** Month numbers (1–12) the season is open. Empty = no season section. */
  seasonMonths?: number[]
  /** Month numbers of the best weeks; drawn darker in the season bar. */
  peakMonths?: number[]
  /** One or two sentences under the season bar. */
  seasonNote?: string
  /** Species chips. Non-empty overrides the list derived from the hub's offers (tj D2, 2026-10-23). */
  species?: string[]
  faq?: FaqEntry[]
  /** Articles the hub links to, in order. Empty = no "Read before you go" block (FA-1.83 fills it). */
  articles?: { slug: string; title: string }[]
  heroQuote?: { text: string; author: string; country: string }
  /** The third part of the hero's proof line, e.g. "gear included". Empty = the line ends after the price. */
  proofNote?: string
  /** `whatsapp` is the number in international format, digits only (as `wa.me` takes it). */
  contact?: { name: string; email: string; whatsapp: string }
}

/**
 * The booking answer every hub ends with. Same three steps as the "How it works" block of the
 * hub page (`destination-hub-view.tsx`, HOW_IT_WORKS) — change them together.
 */
const BOOKING_FAQ = (place: string): FaqEntry => ({
  question: `How do I book a guided fishing trip in ${place}?`,
  answer: 'Send an inquiry with your dates, group size and what you want to catch. We check with the guide and come back with availability and a price within two business days. You pay a deposit once the dates are confirmed. Asking costs nothing.',
})

export const DESTINATION_HUBS: DestinationHub[] = [
  {
    slug: 'patagonia',
    group: 'Patagonia',
    h1: 'Patagonia Fly Fishing Trips',
    intro: 'Guides in Argentina and Chile. Juan Leobono guides the Upper Limay, the Manso and the lakes of Nahuel Huapi National Park from Bariloche. Alex Prior has guided the Aysén spring creeks and freestone rivers out of Coyhaique since 1989. Javier Leppe guides Chinook salmon and sea-run browns in Chilean Tierra del Fuego, walk and wade. Natales Fly Fishing, an Orvis-endorsed outfitter in Puerto Natales, guides Torres del Paine and the Río Penitente. Another guide covers Punta Arenas and Tierra del Fuego.',
    metaTitle: 'Patagonia Fly Fishing Trips',
    metaDescription: 'Fly fishing guides in Patagonia: Juan Leobono in Bariloche, Alex Prior in Coyhaique, Javier Leppe and Natales Fly Fishing in Chile. Trout, sea-run browns, Chinook.',
    seasonMonths: [10, 11, 12, 1, 2, 3, 4, 5],
    peakMonths: [11, 12, 1, 2, 3],
    seasonNote: 'Natales Fly Fishing gives the Magallanes season as 16 October to 14 April. Alex Prior fishes Aysén from November to April. Around Bariloche in Argentina the offer runs from November to May: dry fly from late November to January, migratory browns on the Limay from mid-March to May.',
    // `species` stays empty: the chips are derived from the hub's live offers, and each one filters at least one offer.
    species: [],
    faq: [
      {
        question: 'Do I need fly fishing experience in Patagonia?',
        answer: 'No. Juan Leobono in Bariloche and Natales Fly Fishing in Puerto Natales both take beginners and experienced anglers, and adapt the day to your level.',
      },
      {
        question: 'When is the fishing season in Patagonia?',
        answer: 'Natales Fly Fishing gives the Magallanes season as 16 October to 14 April, with peak conditions between December and March. Alex Prior fishes Aysén from November to April. The Bariloche offer in Argentina runs from November to May.',
      },
      {
        question: 'Are gear and fishing licences included?',
        answer: 'Natales Fly Fishing includes rods, reels, flies, terminal tackle and all required licences, with waders and boots if you need them. Juan Leobono provides rods, reels, lines, leaders and flies if you need them. Alex Prior\'s day rate in Aysén covers guide, licence, flies, boat when needed, transport and lunch.',
      },
      {
        question: 'How many anglers fish with one guide?',
        answer: 'Juan Leobono takes up to two anglers plus the guide per boat, and every trip is private. The Punta Arenas and Tierra del Fuego offer keeps a strict maximum of two anglers per guide.',
      },
      {
        question: 'What if the weather turns bad?',
        answer: 'Natales Fly Fishing says Patagonia weather is highly variable and trips run in most conditions, with daily adjustments for the best and safest fishing.',
      },
    ],
  },
  {
    slug: 'iceland',
    group: 'Nordic',
    countries: ['Iceland'],
    h1: 'Iceland Fly Fishing Trips',
    intro: 'Andri Fannberg has guided out of Reykjavík for ten years. Brynjar Arnarsson runs river expeditions from the same base. Brown trout, arctic char and Atlantic salmon, depending on the river and the month. You talk to the guide who takes you out.',
    metaTitle: 'Iceland Fly Fishing Trips',
    metaDescription: 'Andri Fannberg and Brynjar Arnarsson guide from Reykjavík. Brown trout, arctic char and Atlantic salmon. You talk to the guide who takes you out.',
    seasonMonths: [4, 5, 6, 7, 8, 9],
    peakMonths: [5, 6, 7],
    seasonNote: 'Guided seasons run from April or May to September; May to July are the months guides most often name as best. Salmon fishing follows fixed daily hours; trout and char days are more flexible.',
    // `species` stays empty: the chips are derived from the hub's live offers, and each one filters at least one offer.
    species: [],
    faq: [
      {
        question: 'When is the fishing season in Iceland?',
        answer: 'The guides\' seasons run from April or May to September. Bergur Birgisson names May to July as best, Magnús Haukur April to July. Andri Fannberg\'s peak is June to August.',
      },
      {
        question: 'Is the fishing licence included?',
        answer: 'It depends on the guide. Andri Fannberg\'s price includes the licence, and he handles river access. On Brynjar Arnarsson\'s trips the guiding fee is a flat rate and the licence is charged per person.',
      },
      {
        question: 'Do I need to bring my own gear?',
        answer: 'Not with Brynjar Arnarsson: his guiding fee includes premium fly and spinning gear, and you are welcome to bring your own rod. Andri Fannberg hires out rods, reels, waders and wading boots for an extra fee.',
      },
      {
        question: 'Do guides pick me up in Reykjavík?',
        answer: 'Andri Fannberg always includes pickup from central Reykjavík. Brynjar Arnarsson picks you up at your Reykjavík accommodation, around 09:00, in a 4x4.',
      },
      {
        question: 'Is a guided day in Iceland suitable for beginners?',
        answer: 'Brynjar Arnarsson says yes: his guides read the water with you and coach you hands-on, although some rivers, such as the West Ranga, can be technically challenging.',
      },
    ],
  },
  {
    slug: 'norway',
    group: 'Nordic',
    countries: ['Norway'],
    h1: 'Guided Fishing Trips in Norway',
    intro: 'Four guides, four different Norways. Toni Corenius guides fly fishing in Finnmark, from single-day salmon beats to multi-day tundra expeditions. Inge Rønning guides trophy brown trout on the Mistra River in eastern Norway. Øystein Davidsen guides shore fishing around Egersund. Marcin of Go Fishing Norway guides pike and sea fishing around Kristiansand. You talk to the guide who takes you out.',
    metaTitle: 'Guided Fishing Trips in Norway',
    metaDescription: 'Four guides in Norway: Toni Corenius in Finnmark, Inge Rønning on the Mistra, Øystein Davidsen in Egersund and Go Fishing Norway. Trout, salmon, pike, sea fish.',
    // The bar is the union of the offers' months; no peak months (tj, 2026-11-09). The note says it is a union.
    seasonMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    peakMonths: [],
    seasonNote: 'The bar shows every month in which at least one guide fishes. Seasons differ by guide and water: the Mistra trout run is in May and June, Finnmark fishing is in May–June and September–October. Each guide\'s months are in the FAQ below.',
    // `species` stays empty: the chips are derived from the hub's live offers, and each one filters at least one offer.
    species: [],
    articles: [
      { slug: 'fishing-regulations-norway-2026', title: 'Fishing in Norway 2026: Regulations, Licenses, and Limits – A Complete Guide' },
    ],
    faq: [
      {
        question: 'When is the fishing season in Norway?',
        answer: 'It depends on the guide and the water. Inge Rønning guides the Mistra River from May to August, and the trout run is in May and June. Toni Corenius fishes Finnmark in May–June and September–October, best in May, June, September and October. Go Fishing Norway runs from April to November, best from June to August. Øystein Davidsen guides shore fishing around Egersund all year, best from May to September.',
      },
      {
        question: 'Do I need a fishing licence in Norway?',
        answer: 'Not for sea fishing from the shore or a boat. Freshwater fishing needs a local fiskekort for the lake or river, sold online through Inatur and locally. Salmon and sea trout in rivers need the national fiskeravgift on top, a local fiskekort for the beat, and disinfected gear. Toni Corenius\'s offer lists the fishing licence where applicable; ask the other guides what their price covers.',
      },
      {
        question: 'What fish can I catch in Norway?',
        answer: 'Brown trout on the Mistra. Salmon, sea trout, arctic char, grayling and cod in Finnmark. Pike, perch, cod, saithe and wolffish around Kristiansand. Pollock, sea bass, haddock, mackerel and sea trout around Egersund.',
      },
      {
        question: 'Is fishing gear included?',
        answer: 'On all four offers the guide provides it: rods, reels and lures with Go Fishing Norway, rods, reels and baits with Inge Rønning, all gear and tackle with Øystein Davidsen, and all fishing gear with Toni Corenius. Each offer page lists what else is included.',
      },
      BOOKING_FAQ('Norway'),
    ],
  },
  {
    slug: 'sweden',
    group: 'Nordic',
    countries: ['Sweden'],
    h1: 'Guided Fishing Trips in Sweden',
    intro: 'Five guides, from the Baltic coast to Lapland. Berra Mårdh and Dan Bjurshammar (FiskeDan) guide pike and perch around Stockholm and Lake Mälaren. Joakim Åberg guides zander, perch and pike on the lakes of Alingsås, 50 km east of Gothenburg. Piotr Wawrzyniuk, known as Pexfish, guides sea trout and pike in Blekinge and Skåne. Kalix Jakt & Fisketurism (KJOFT) in Kalix guides salmon, trout and char in Swedish Lapland. You talk to the guide who takes you out.',
    metaTitle: 'Guided Fishing Trips in Sweden',
    metaDescription: 'Five guides in Sweden: Berra Mårdh and FiskeDan near Stockholm, Joakim Åberg near Gothenburg, Pexfish in Blekinge, Kalix Jakt & Fisketurism (KJOFT) in Lapland. Pike, zander, salmon.',
    // The bar is the union of the offers' months; no peak months (tj, 2026-11-09). The note says it is a union.
    seasonMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    peakMonths: [],
    seasonNote: 'The bar shows every month in which at least one guide fishes. Seasons differ by guide and water: lake fishing around Alingsås runs from April to December, sea trout in Blekinge is best from January to March. Each guide\'s months are in the FAQ below.',
    // `species` stays empty: the chips are derived from the hub's live offers, and each one filters at least one offer.
    species: [],
    faq: [
      {
        question: 'When is the fishing season in Sweden?',
        answer: 'It depends on the guide. Berra Mårdh guides all year, best from April to September. Dan Bjurshammar (FiskeDan) runs from March to November, best from April to August. Joakim Åberg runs from April to December, best from May to September. Pexfish fishes from January to October: sea trout from January to March, lake fishing from May to October. Kalix Jakt & Fisketurism (KJOFT) is best from June to August and also guides ice fishing.',
      },
      {
        question: 'Is the fishing licence included?',
        answer: 'The offers of Dan Bjurshammar (FiskeDan), Joakim Åberg and KJOFT list the fishing licence as included. Berra Mårdh\'s and Pexfish\'s offers do not say, so ask when you send your inquiry.',
      },
      {
        question: 'What fish can I catch in Sweden?',
        answer: 'Pike, perch and zander around Stockholm, Lake Mälaren, Alingsås and in Blekinge. Sea trout in the Stockholm archipelago and on the Baltic coast of Blekinge. Atlantic salmon, brown trout, arctic char and grayling around Kalix and in Swedish Lapland.',
      },
      {
        question: 'Is a guided day in Sweden suitable for beginners?',
        answer: 'All five offers are listed for all levels. Joakim Åberg\'s profile says beginners, hobby anglers and professionals can book, and families with children are welcome aboard.',
      },
      BOOKING_FAQ('Sweden'),
    ],
  },
  {
    slug: 'finland',
    group: 'Nordic',
    countries: ['Finland'],
    h1: 'Guided Fishing Trips in Finland',
    intro: 'Three offers, from Helsinki to Lapland. Lapland Fishing LTD guides salmon, grayling, pike and ice fishing around the River Kemi, with pickup from Rovaniemi. SouthEast Fishing Finland guides pike, perch and zander on Lake Saimaa from Lappeenranta, with live sonar on board. A third offer fishes the Baltic archipelago and lakes near Helsinki for pike, zander, perch and sea trout.',
    metaTitle: 'Guided Fishing Trips in Finland',
    metaDescription: 'Guided fishing in Finland: Lapland Fishing LTD on the River Kemi, SouthEast Fishing Finland on Lake Saimaa, and a Helsinki offer. Salmon, pike, zander, perch.',
    // The bar is the union of the offers' months; no peak months (tj, 2026-11-09). The note says it is a union.
    seasonMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    peakMonths: [],
    seasonNote: 'The bar shows every month in which at least one guide fishes. Seasons differ by guide and water: Lapland Fishing LTD fishes from May to October, plus ice fishing in March and April, and SouthEast Fishing Finland runs from May to November. Each guide\'s months are in the FAQ below.',
    // `species` stays empty: the chips are derived from the hub's live offers, and each one filters at least one offer.
    species: [],
    faq: [
      {
        question: 'When is the fishing season in Finland?',
        answer: 'Lapland Fishing LTD fishes from May to October, with salmon best in June, July and August, and ice fishing in March and April. SouthEast Fishing Finland runs from May to November, best from May to October. The Helsinki offer is listed as open all year.',
      },
      {
        question: 'What fish can I catch in Finland?',
        answer: 'Atlantic salmon, grayling, arctic char, pike and whitefish around the River Kemi and in Lapland. Pike, perch and zander on Lake Saimaa. Pike, zander, perch, sea trout and burbot near Helsinki.',
      },
      {
        question: 'Do I need a fishing permit in Finland?',
        answer: 'Lapland Fishing LTD explains on its offer page that Finland has a national fishing permit and, on top of it, local permits for the water. Ask your guide which ones your trip needs.',
      },
      {
        question: 'Is fishing gear included?',
        answer: 'SouthEast Fishing Finland provides all gear and tackle for the day. The Helsinki offer includes all fishing gear, the guide boat and fuel, and thermal coveralls and boots if you ask in advance. Lapland Fishing LTD sells all-inclusive packages from half a day to seven days.',
      },
      BOOKING_FAQ('Finland'),
    ],
  },
  {
    slug: 'new-zealand',
    group: 'New Zealand',
    h1: 'New Zealand Fly Fishing Trips',
    intro: 'Guides on the North and South Islands. Josh Hart guides the Tongariro and Tauranga-Taupō rivers from Tūrangi, and the Whakapapa and Whanganui beyond. Dustin Habener of Wild Waters Fly guides the rivers and lakes around Taupō and the coastal flats of Tauranga Harbour, for trout and kingfish. Kristina Placko and Daryl Paskell guide walk-and-stalk brown trout fishing in Southland, from Lumsden.',
    metaTitle: 'New Zealand Fly Fishing Trips',
    metaDescription: 'Fly fishing guides in New Zealand: Josh Hart and Dustin Habener around Taupō, Kristina Placko and Daryl Paskell in Southland. Trout, and kingfish on the coast.',
    seasonMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    peakMonths: [11, 12, 1, 2, 3],
    seasonNote: 'Taupō fishes all year, and its winter run of rainbow trout from June to August is its signature period. Southland guiding runs from October to April: Kristina Placko does not guide from May to September.',
    // `species` stays empty: the chips are derived from the hub's live offers, and each one filters at least one offer.
    species: [],
    faq: [
      {
        question: 'Do I need a fishing licence in New Zealand?',
        answer: 'Yes. A valid freshwater fishing licence is required by law in New Zealand, and you can buy it online before your trip. Dustin Habener can advise which type you need for where you fish. In Southland, Kristina Placko says licences are bought online from Fish & Game NZ, and most guided days use a standard non-resident day licence. Sea fishing needs no licence.',
      },
      {
        question: 'When is the best time to fish in New Zealand?',
        answer: 'Taupō fishes all year, with winter spawning runs and summer sight-fishing. Southland guiding runs from October to April, with December to February the prime sight-fishing months. Dustin Habener says saltwater fly fishing is generally better from November to May.',
      },
      {
        question: 'Do I need fly fishing experience?',
        answer: 'No. Dustin Habener teaches casting, fly selection, river reading and fish handling. Kristina Placko tailors each day to your experience and fitness, from a first trout on a fly to technical backcountry sight-fishing.',
      },
      {
        question: 'Do I need to bring my own gear?',
        answer: 'On Dustin Habener\'s Taupō offer, equipment can be supplied as part of the guide fee. In Southland, rods, waders, boots and tackle can be provided for an extra fee per person. You are welcome to bring your own.',
      },
      BOOKING_FAQ('New Zealand'),
    ],
  },
]

/** Returns the full list of countries for a hub (resolves from region group if no override). */
export function getHubCountries(hub: DestinationHub): Country[] {
  if (hub.countries != null) return hub.countries
  return COUNTRIES.filter(c => COUNTRY_REGION[c] === hub.group)
}

/** Map from country name -> hub slug, built once at module load. */
const COUNTRY_TO_HUB_SLUG: Partial<Record<string, string>> = {}
for (const hub of DESTINATION_HUBS) {
  for (const country of getHubCountries(hub)) {
    COUNTRY_TO_HUB_SLUG[country] = hub.slug
  }
}

/** Returns the hub slug for a country, or null if no hub covers that country. */
export function getHubSlugForCountry(country: string): string | null {
  return COUNTRY_TO_HUB_SLUG[country] ?? null
}

/** Finds a hub by slug. Returns undefined for unknown slugs. */
export function getHubForSlug(slug: string): DestinationHub | undefined {
  return DESTINATION_HUBS.find(h => h.slug === slug)
}
