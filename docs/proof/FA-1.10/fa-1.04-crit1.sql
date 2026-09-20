\echo '=== FA-1.04 criterion 1: qualified distribution'
SELECT qualified, count(*) FROM inquiries GROUP BY 1 ORDER BY 1;
\echo '=== priority distribution (NULL shown as (null))'
SELECT COALESCE(priority,'(null)') AS priority, count(*) FROM inquiries GROUP BY 1 ORDER BY 2 DESC, 1;
\echo '=== trip_country distribution'
SELECT COALESCE(trip_country,'(null)') AS trip_country, count(*) FROM inquiries GROUP BY 1 ORDER BY 2 DESC, 1;
\echo '=== rows satisfying O-10 (priority set, != not_viable, trip_country in COUNTRIES) vs qualified stored'
SELECT qualified,
       count(*) AS rows,
       count(*) FILTER (WHERE priority IS NOT NULL AND priority <> 'not_viable' AND trip_country IN ('Norway','Sweden','Finland','Iceland','Denmark','Argentina','Chile','New Zealand')) AS o10_says_yes,
       count(*) FILTER (WHERE priority = 'not_viable') AS o10_says_no_not_viable
FROM inquiries GROUP BY 1 ORDER BY 1;
