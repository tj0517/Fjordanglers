# Open questions

Decisions that have not been made. **An agent does not resolve these.** If a task depends
on one, the task says so and the agent stops and asks. When a question is decided, it
moves to an ADR and the row here says which one.

| # | Question | Context | Blocks | Status |
|---|---|---|---|---|
| O-01 | `guides.pricing_model` / `commission_rate`: keep as informational fields, move to `deals`, or drop? | Set in the admin guide form, never read by any money calculation. FigJam Finances asks "is 20% still the right number" — a per-guide rate might be the lever. | stage 4 `guides` cleanup | open |
| O-02 | Retire `services/whatsapp-bridge` or keep it? | Two WhatsApp and two e-mail ingestion paths exist with different dedupe. Meta Cloud API + Resend Inbound may cover 100% of traffic. Needs a week of comparing counts. | stage 8 | open |
| O-03 | Time-to-offer target: 3 days or 24 h? | FigJam: "3 days likely caps conversion near 15%, 24h is what 30% needs. Decide after baseline." Needs ~6 weeks of `inquiry_events` data. | metric target only, not schema | open — revisit after 15 Oct |
| O-04 | Rename `experience_pages → experiences` in stage 4, or keep the name and only drop legacy `experiences`? | Rename is cleaner, touches every query and every cache tag. | stage 4 step 4 | open — default: rename |
| O-05 | Money migration: convert existing EUR `NUMERIC` history to cents with historic FX, or freeze history at one rate? | Affects how the "23 000 PLN already earned" baseline is reproduced. | stage 4 backfill | open |
| O-06 | Should `deals.commission` be entered by hand (as `internal_commission_eur` is today) or derived from the accepted offer's deposit? | In the standard case deposit = fee. Non-standard deals (manual, off-platform) exist. | stage 4 `deals` | open — default: derived, with manual override flagged |
| O-07 | Where do ads landing pages live: `(marketing)/lp/[slug]` as code, or a small `landing_pages` table? | Plan says files. Marketing may want to spin variants without a deploy. | stage 7 | open — default: files |
| O-08 | Admin auth: same Supabase project + `profiles.role`, or a separate auth (e.g. allowlisted Google accounts)? | Two founders. Current model works; a separate app makes an allowlist trivial. | stage 3 | open — default: same project |
| O-09 | Does the guide dashboard need offer-response UI (guide types price into the system) or stays e-mail/WhatsApp → admin transcribes? | FigJam Platform goal: "offers generated from the system, founder only approves". Guide-side input is what makes `guide.offer_received` a real event instead of an admin transcription. | stage 7 | open |
| O-10 | Qualified definition: exactly `priority ≠ not_viable AND country ∈ served`, or also require party size / dates present? | Affects M5/M6 baseline. | stage 1 task FA-1.04 | open — default: the simple rule, refine later |
| O-11 | Secrets for agent sessions: today `.claude/settings.local.json` holds the service-role key, Stripe test keys and a GitHub token in plain text. Move to shell env / secret manager and drop service-role from local entirely? | Plan §10 says service-role key does not live on dev machines. | stage 0 | open — recommended: yes, and rotate the GitHub token |
| O-12 | Legal binaries in `checklist_items` vs Notion only? | Plan puts a status strip on `/admin`. Cheap either way. | stage 6 | open — default: table |
