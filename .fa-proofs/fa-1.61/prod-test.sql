-- FA-1.61 — prod test after the #147 deploy: one normal inquiry from tjezionekspam@gmail.com, no trap.
-- Schema read from prod 2026-10-15 (pg_constraint): referencing inquiries →
--   inquiry_events, messages, inquiry_trip_details, offers (→ offer_options), reviews: ON DELETE CASCADE;
--   unmatched_messages.matched_inquiry_id: ON DELETE SET NULL;
--   inquiry_events.message_id → messages: ON DELETE RESTRICT  ← hence the explicit delete order in step 3.

-- ── 1. Find the test inquiry (read-only) ───────────────────────────────────
select id, created_at, source, status
from inquiries
where angler_email = 'tjezionekspam@gmail.com'
  and created_at > now() - interval '3 hours'
order by created_at desc;

-- ── 2. Did the AI work run after the response, and how many seconds later? (read-only) ──
-- Paste the id from step 1 into the first line. Expected for a normal inquiry:
--   inquiry.created at ~0 s; agent.auto_send_decided a few seconds later (local: 6.7–18.1 s);
--   a messages row drafted_by='agent' (status 'draft', or 'sent' if the agent decided to send);
--   v2 (/experiences/*) also inquiry.qualified_set.
-- NOTE: these seconds look the same before and after FA-1.61 (the AI ran ~10–14 s after insert
-- before too). They prove the after() work COMPLETED on Vercel. That the 201 no longer waits is shown
-- by the POST /api/inquiries duration in DevTools → Network (before: 15–32 s; expected now: ~1–2 s).
with i as (
  select id, created_at from inquiries where id = '<ID>'
)
select 'event'                                   as kind,
       e.type                                    as what,
       e.occurred_at                             as at,
       round(extract(epoch from e.occurred_at - i.created_at)::numeric, 1) as s_after_created,
       e.payload->>'sent'                        as sent,
       e.payload->>'score'                       as score,
       e.payload->'reasons'                      as reasons
from i join inquiry_events e on e.inquiry_id = i.id
union all
select 'message', m.direction || '/' || m.status || '/' || coalesce(m.drafted_by, '-'),
       m.created_at,
       round(extract(epoch from m.created_at - i.created_at)::numeric, 1),
       null, null, null
from i join messages m on m.inquiry_id = i.id
order by at;

-- ── 3. DELETE the test inquiry (PROD WRITE — run by tj) ────────────────────
-- Atomic: aborts without deleting anything unless exactly one row matches the id AND the test e-mail.
do $$
declare
  v_id uuid := '<ID>';
begin
  if (select count(*) from inquiries
      where id = v_id and angler_email = 'tjezionekspam@gmail.com') <> 1 then
    raise exception 'FA-1.61: no single test inquiry % for tjezionekspam@gmail.com — nothing deleted', v_id;
  end if;
  delete from inquiry_events where inquiry_id = v_id;  -- first: events may point at this inquiry's messages (RESTRICT)
  delete from messages       where inquiry_id = v_id;
  delete from inquiries      where id = v_id;          -- cascades trip_details, offers/offer_options, reviews
end $$;

-- ── 4. After the delete (read-only) — expected: all 0 ──────────────────────
select (select count(*) from inquiries            where id = '<ID>')                 as inquiries,
       (select count(*) from inquiry_events       where inquiry_id = '<ID>')         as inquiry_events,
       (select count(*) from messages             where inquiry_id = '<ID>')         as messages,
       (select count(*) from inquiry_trip_details where inquiry_id = '<ID>')         as trip_details,
       (select count(*) from offers               where inquiry_id = '<ID>')         as offers,
       (select count(*) from reviews              where inquiry_id = '<ID>')         as reviews,
       (select count(*) from unmatched_messages   where matched_inquiry_id = '<ID>') as unmatched_messages;
