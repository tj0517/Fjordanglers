-- A1 (docs/REBUILD_PLAN.md, Appendix A) — row-count / size / activity baseline,
-- taken before Stage 1 drops tables. Paste into the Supabase SQL Editor for the
-- production project and save the output as docs/audit/db-row-counts-<date>.md.
select c.relname as table_name, c.reltuples::bigint as est_rows,
       pg_size_pretty(pg_total_relation_size(c.oid)) as size,
       s.n_tup_ins, s.n_tup_upd, s.n_tup_del, s.last_autoanalyze
from pg_class c join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s on s.relid = c.oid
where n.nspname='public' and c.relkind='r' order by est_rows desc;
