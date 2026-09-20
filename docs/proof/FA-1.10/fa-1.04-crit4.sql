\echo '=== FA-1.04 criterion 4: agent classification of a test inquiry'
SELECT id, status, priority, trip_country, qualified, qualified_set_by, agent_status, agent_round FROM inquiries WHERE id='9f9581be-4acb-4d78-af92-fa88abe0a618';
\echo '=== inquiry.qualified_set events for it (expect exactly 1, actor_kind=agent)'
SELECT type, actor_kind, source, payload FROM inquiry_events WHERE inquiry_id='9f9581be-4acb-4d78-af92-fa88abe0a618' AND type='inquiry.qualified_set';
SELECT count(*) AS qualified_set_events FROM inquiry_events WHERE inquiry_id='9f9581be-4acb-4d78-af92-fa88abe0a618' AND type='inquiry.qualified_set';
\echo '=== all events for it, in order'
SELECT type, actor_kind, source FROM inquiry_events WHERE inquiry_id='9f9581be-4acb-4d78-af92-fa88abe0a618' ORDER BY occurred_at, created_at;
