---
id: FA-M.05
title: Wysyłka zlecenia z karty zapytania — WhatsApp szablonem z linkiem (także po 24 h ciszy) + oś czasu zlecenia
stage: M
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-admin
branch: feat/fa-m.05-send-guide-request
depends_on: [FA-M.03, FA-M.04, FA-M.11]
blocked_by_questions: []
touches_db: false
touches_prod: true
estimate_h: 6
owner: tj
---

# FA-M.05 — Wysyłka zlecenia do przewodnika

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/tasks/FA-M.03.md`, `docs/tasks/FA-M.04.md`
- `src/lib/channels/whatsapp.ts` — dziś szablon wysyłany **bez parametrów** (poza oknem 24 h nie da się przekazać linku)
- `src/lib/messages/send.ts`, `src/actions/messages.ts` (`WHATSAPP_TEMPLATE_GUIDE`) — jedna ścieżka wysyłki
- `src/app/admin/inquiries/[id]/GuideAttachmentTab.tsx` — dzisiejsze przypisanie przewodnika z mini-kalendarzem
- `guide_private.whatsapp` / `phone` — numer przewodnika
- `docs/04-open-questions.md` O-51

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Admin jednym przyciskiem na karcie zapytania wysyła zlecenie wybranemu przewodnikowi: tworzy się rekord zlecenia (FA-M.03), a przewodnik dostaje WhatsApp z linkiem do strony zlecenia — w oknie 24 h zwykłą wiadomością, po 24 h ciszy zatwierdzonym szablonem Mety z linkiem (O-51 → a). Na karcie widać oś czasu: wysłano, otwarto, odpowiedział (co), a po zmianie przewodnika — historię wcześniejszych zleceń.

## Zakres
- [ ] Odczyt stanu: adapter WhatsApp, `sendMessage`, karta przewodnika w adminie; nazwa i parametry szablonu zatwierdzonego w FA-M.11 (wkleja tj).
- [ ] Adapter WhatsApp: szablon z parametrami (zmienna URL / treść), bez łamania dzisiejszych wysyłek szablonu bez parametrów.
- [ ] Akcja admina „Send request”: tworzy zlecenie, wysyła przez `sendMessage` (kanał whatsapp, counterpart guide), emituje `guide.request_sent`; brak numeru WhatsApp przewodnika → czytelny błąd, bez zlecenia.
- [ ] Karta zapytania: przycisk przy przewodniku + oś czasu zleceń (wysłano / otwarto / odpowiedź z datami lub powodem), link do strony zlecenia do skopiowania (zapas z O-51 do czasu zatwierdzenia szablonu).
- [ ] Testy z fake WhatsApp (bez prawdziwej wysyłki).

## Gotowe, gdy
- [ ] Poza oknem 24 h wysyłka idzie szablonem z linkiem w parametrze; w oknie — wiadomością tekstową z linkiem — **jak sprawdzić:** testy adaptera z oboma przypadkami, wklejone body żądań (fake).
- [ ] Istniejąca wysyłka szablonu bez parametrów (wiadomości do klientów/przewodników) działa jak przed zmianą — **jak sprawdzić:** dotychczasowe testy `messages-thread`, `send` zielone.
- [ ] Brak numeru → błąd i brak rekordu zlecenia; pokazane na czerwono — **jak sprawdzić:** test akcji.
- [ ] Oś czasu na karcie pokazuje trzy znaczniki i historię dwóch zleceń dla jednego zapytania — **jak sprawdzić:** zrzut karty z danymi seeda + test komponentu.
- [ ] Żadna prawdziwa wiadomość nie wyszła w testach — **jak sprawdzić:** grep, że ścieżka WhatsApp w testach czyta flagę fake / mock (project.md → security).
- [ ] CI zielone na head.

## Poza zakresem
- Push do przewodnika → FA-M.12.
- Ponaglenie → FA-M.06.
- Wysyłka do kilku przewodników naraz → po MVP.
- Zmiana treści szablonu w Meta → FA-M.11 (tj).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Nowa zmienna env (nazwa szablonu ze zmienną URL) — dopisanie w Vercelu robi tj; agent pokazuje nazwę i wartość do wpisania.
- Żadnej prawdziwej wysyłki WhatsApp z dev/testów.

## Weryfikacja
```
pnpm test -- whatsapp send-guide-request messages-thread
grep -rn "templateName" src/lib/channels/whatsapp.ts
```

## Notatki z realizacji
- **2026-11-10, tj (wf-plan):** O-51 → (a) szablon Mety ze zmienną URL; do zatwierdzenia — link kopiowany ręcznie z karty.
