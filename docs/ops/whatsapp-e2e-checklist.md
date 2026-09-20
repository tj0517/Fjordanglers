# WhatsApp E2E Checklist — FA-1.13

Checklista do weryfikacji po deployu na środowisko preview z prawdziwym numerem testowym Meta.

## Wymagania wstępne (robi tj)

- [ ] `WHATSAPP_APP_SECRET` ustawiony w Vercel (wymagany — brak = webhook 401)
- [ ] `WHATSAPP_ACCESS_TOKEN` ustawiony w Vercel
- [ ] `WHATSAPP_PHONE_NUMBER_ID` ustawiony w Vercel
- [ ] `WHATSAPP_VERIFY_TOKEN` ustawiony i webhook zarejestrowany w Meta
- [ ] Szablony `fa_guide_new_inquiry` i `fa_angler_update` zatwierdzone w Meta

## Testy manualne

### 1. Webhook verification
```
curl -X GET "https://<preview-url>/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<WHATSAPP_VERIFY_TOKEN>&hub.challenge=test123"
# Oczekiwane: 200, body = "test123"
```

### 2. Wiadomość z numeru klienta (angler_phone w E.164)
1. Wyślij WA z testowego numeru na numer FA
2. Sprawdź w adminie → wątek zapytania → powinna pojawić się wiadomość inbound
3. W bazie:
```sql
SELECT channel, direction, counterpart, status, external_id, body
FROM messages
WHERE inquiry_id = '<id>'
ORDER BY occurred_at;
```

### 3. Odpowiedź do klienta (okno otwarte)
1. W adminie → karta zapytania → "Send message" → wybierz WhatsApp → napisz treść
2. Wyślij
3. Sprawdź status `sent` w bazie i `external_id`

### 4. Odpowiedź szablonowa (okno zamknięte > 24h)
1. Ustaw datę ostatniej wiadomości przychodzącej > 24h temu (lub poczekaj)
2. Kompozytor powinien pokazać "Window closed. Template will be sent."
3. Kliknij "Send Template"
4. Sprawdź w bazie: `status='sent'`, w Meta delivery log

### 5. Wiadomość od przewodnika
1. Zapisz numer przewodnika przypisanego do zapytania w `guide_contacts` (tabela tylko dla `service_role` —
   numer nie może leżeć w `guides`, bo tę tabelę czyta klucz publikowalny):
   ```sql
   INSERT INTO guide_contacts (guide_id, phone_e164) VALUES ('<guide_id>', '+48XXX')
   ON CONFLICT (guide_id) DO UPDATE SET phone_e164 = EXCLUDED.phone_e164;
   ```
2. Wyślij WA z numeru przewodnika
3. Sprawdź: `counterpart='guide'`, `counterpart_id=<guide_id>` w messages

### 6. Delivery status (sent/delivered/read)
1. Sprawdź w bazie po kilku minutach od wysyłki do realnego numeru:
```sql
SELECT status, external_id FROM messages WHERE channel='whatsapp' AND direction='outbound' ORDER BY occurred_at DESC LIMIT 5;
```

### 7. Niezidentyfikowany numer → unmatched
1. Wyślij WA z nieznanego numeru
2. Sprawdź: pojawia się w `unmatched_messages` z `source='whatsapp'`
3. W adminie → unmatched → można ręcznie przypisać

### 8. Zły podpis → 401
```bash
curl -X POST https://<url>/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=bad" \
  -d '{"object":"whatsapp_business_account","entry":[]}'
# Oczekiwane: 401
```

### 9. Brak podpisu → 401
```bash
curl -X POST https://<url>/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"object":"whatsapp_business_account","entry":[]}'
# Oczekiwane: 401 (Missing x-hub-signature-256 header)
```

## Obserwacja produkcyjna po merge

- Sprawdź logi Vercel pod kątem `[whatsapp-webhook]`
- Sprawdź czy `unmatched_messages` nie rośnie nieoczekiwanie
- Zweryfikuj `messages.status` po 5 minutach od pierwszej wysyłki (powinno być `delivered`)

## STOP gate

**NIE MERGOWAĆ dopóki tj nie potwierdzi, że `WHATSAPP_APP_SECRET` jest ustawiony
w środowisku produkcyjnym Vercel.** Brak sekretu = webhook odrzuca wszystkie żądania
z 401 i Meta przestaje dostarczać wiadomości.
