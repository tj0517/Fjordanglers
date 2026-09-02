# Glossary

Terms as used in code, tasks and the admin panel. When a word here conflicts with a
column name in the legacy schema, this file wins and the column gets renamed in stage 4.

| Term | Meaning | Where it lives |
|---|---|---|
| **Inquiry** | One request from an angler for a trip. The unit everything else hangs off. Sources: web form, ads landing (`/plan-your-trip`), manual (admin), inbound e-mail, WhatsApp. | `inquiries` |
| **Angler / customer** | The person who sent the inquiry. From stage 4 a `customers` row keyed by normalised e-mail; before that only columns on `inquiries`. | `customers` |
| **Qualified request** | An inquiry the AI agent (or a founder) marked as worth working: `priority ≠ not_viable` and a country we serve. **Stored** in `inquiries.qualified`, never derived on the fly. Rows before classification existed are `unknown`. | `inquiries.qualified` |
| **Brief** | The structured summary of what the angler wants (dates, party, species, budget, flexibility). Produced by the agent, editable by admin. "Brief completed" is the moment the time-to-offer clock starts. | `inquiries.brief` (JSONB), event `inquiry.brief_completed` |
| **Guide** | A vetted local guide. Has a public profile, experiences, availability, destinations. | `guides` |
| **Experience** | A public trip page a guide offers (today `experience_pages`; renamed `experiences` in stage 4 after the legacy `experiences` table is dropped). Has options (variants with price). | `experience_pages` → `experiences`, `experience_page_options` → `experience_options` |
| **Destination** | A place we sell trips to, as an entity: country + region + season. **Live** when it has ≥3 `active` guides, materials uploaded and a published experience. Not live because one guide said yes. | `destinations`, `guide_destinations` |
| **Assignment** | Which guide is working a given inquiry. `assigned_guide_id` + acceptance state. Distinct from `guide_id`, which is the guide of the experience the inquiry came from. | `inquiries.assigned_guide_id`, `guide_acceptance` |
| **Guide offer** | The guide's answer to FA: price, dates, what is included. Internal. | event `guide.offer_received`, `inquiries.guide_offer_*` |
| **Offer** | The document FA sends the angler, in the guide's name: price incl. FA's fee, trip plan, options, licence info, map, photos. Has a public token URL `/offers/[token]`. From stage 4 a row in `offers` (versioned); before that ~18 `offer_*` columns on `inquiries`. | `offers` |
| **Deposit** | What the angler pays FA via Stripe Checkout to confirm. Equals FA's fee (20% on top of the guide's price). | `payments(kind='deposit')`, today `inquiries.deposit_*` |
| **Booking** | An inquiry with a **paid** deposit. Dated by `paid_at`. The only definition of "booking" used anywhere. | `payments.status='paid'`, today `deposit_paid_at` |
| **Deal** | The commercial result of a booking: trip total, FA commission, currency, FX rate frozen at recognition. Source of every revenue number. | `deals`, today `inquiries.internal_*` |
| **Commission / fee** | FA's revenue on a booking. In the standard case equals the deposit. Stored in cents with currency; reported in PLN at the frozen rate. | `deals.commission_cents` |
| **Status** | One of ten pipeline states on the inquiry (see `01-architecture.md` §4). Changed only via `transition()`. | `inquiries.status` |
| **Stage reached** | Monotonic furthest point in the funnel (`inquiry → offer_sent → deposit_paid → completed`). A cache derived from events; used for "lost at which stage". | `inquiries.stage_reached` |
| **Event** | An append-only record that something happened to an inquiry, with actor and time. Basis of every time/funnel/effort metric. | `inquiry_events` |
| **Manual touch** | An admin-actor event of an *action* type (message sent, status changed, guide assigned, offer edited, deposit link sent). Reads are not touches. | derived from `inquiry_events` |
| **Time to offer** | Median of `offer.sent − inquiry.brief_completed`, reported in three legs: brief→assignment, assignment→guide offer, guide offer→sent. | derived from `inquiry_events` |
| **Coverage** | Share of inquiries that, when they arrived, had ≥1 `active` guide in the destination free on the requested dates. | derived: `guide_destinations`, `guide_blocked_dates` |
| **Message** | One inbound or outbound communication on an inquiry (e-mail, WhatsApp, internal note). Today `lead_messages`; renamed `messages` in stage 4. | `lead_messages` → `messages` |
| **Unmatched message** | An inbound message the matcher could not attach to an inquiry. Triage queue. | `unmatched_messages` |
| **Guide application** | Someone applying to become a guide via `/guides/apply`. Today `leads`; renamed `guide_applications`. Not the same thing as an inquiry. | `leads` → `guide_applications` |
| **Intake form** | An admin-built questionnaire sent to a prospective guide by token link. | `guide_intake_forms`, `guide_intake_responses` |
| **Review** | Post-trip feedback from the angler via token link. | `reviews` |
| **Incident** | Complaint, refund or safety issue on a trip. Denominator for the quality metrics. | `incidents` (stage 4) |
| **Snapshot** | A metric value that does not come from our database (GA4, Instagram, manual entry) stored per period. | `metric_snapshots` |
| **Weekly review** | The founders' Monday ritual: one screen (`/admin`), one week, the numbers on the FigJam plan. | `apps/admin` `(review)/` |
| **FA** | FjordAnglers as an actor in the flow (the founders / the system acting for them). In events `actor_kind='admin'` or `'system'`. | — |
| **STOP gate** | A point in a task where the agent must halt and get explicit approval before continuing (prod writes, migration history, secrets, deletions). | `05-agent-operations.md` |
