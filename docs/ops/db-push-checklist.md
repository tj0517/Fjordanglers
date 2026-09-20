# Przed `supabase db push` na produkcję (`uwxrstbplaoxfghrchcy`)

`db push` robi tj (`docs/05-agent-operations.md` §3). Agent przygotowuje tę listę, nie wykonuje jej.

**Dlaczego lista, a nie pamięć:** `db push` wypisuje wszystkie oczekujące migracje i pyta **raz**
`[Y/n]` o cały zestaw — nie da się wybrać podzbioru. 19 IX 2026 odroczony drop wszedł razem
z resztą, a produkcja miała ~20 minut nowego schematu ze starym kodem (wpis „stage-1 deploy
19 IX 2026” w `docs/deferred-tasks.md`). Instrukcja dla człowieka przy interaktywnym prompcie
nie jest bramką STOP — dlatego lista jest krokiem, który zostawia ślad.

## Kroki

1. **Lista oczekujących migracji:**
   ```
   supabase migration list --linked
   ```
   Każdy wiersz z pustą kolumną `Remote` zostanie zastosowany. Przeczytaj wszystkie takie
   wiersze, jeden po drugim, zanim odpowiesz na prompt.
2. **Każda oczekująca migracja jest zamierzona.** Nazwa z `deferred`, każdy `DROP` tabeli
   albo kolumny, którego kod jeszcze nie przestał używać → **STOP**: wyjmij plik z
   `supabase/migrations/` (odroczone trzymamy poza katalogiem) albo nie potwierdzaj promptu.
3. **Migracje z datami z przyszłości** — `20261001000000`, `20261002000000`, `20261003000000`
   leżą w `supabase/migrations/`. Wpis w deferred mówi, że weszły 19 IX, ale nikt nie
   odczytał tego z produkcji. Krok 1 rozstrzyga to odczytem: jeśli w `Remote` są puste,
   `db push` zastosuje je razem z nową migracją (w tym `20261001000000_…_deferred`, czyli drop) → **STOP**.
4. **Zapytania sprawdzające dla migracji, która coś usuwa.** Dla `20261004000000_guide_contacts.sql`
   (przenosi numer przewodnika z `guides` do `guide_contacts` i dropuje `guides.phone_e164`),
   tylko odczyt, przed pushem:
   ```sql
   SELECT (SELECT count(*) FROM guides WHERE phone_e164 IS NOT NULL) AS with_phone,
          to_regclass('public.guide_contacts') AS already_there,
          (SELECT count(*) FROM pg_depend d JOIN pg_attribute a ON a.attrelid=d.refobjid AND a.attnum=d.refobjsubid
            WHERE d.refobjid='public.guides'::regclass AND a.attname='phone_e164' AND d.deptype<>'a') AS dependents;
   ```
   Oczekiwane: `0 | null | 0`. Inny wynik → **STOP**. (Migracja przenosi dane przed `DROP`, więc
   niepusta kolumna nie kasuje numerów — ale wtedy zapisz, ile wierszy i czyich, zanim ruszysz.)
5. **Po pushu** ponów `supabase migration list --linked` — kolumny `Local` i `Remote` mają się
   zgadzać — i wklej wynik do raportu zadania.
