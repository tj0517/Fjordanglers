# WhatsApp Templates — FA-1.13

Szablony zatwierdzane w Meta Business Manager przez tj. Po zatwierdzeniu ustawiamy
nazwy w env i gotowe — żadna zmiana kodu nie jest wymagana.

## Wymagane szablony

### `fa_guide_new_inquiry` (WHATSAPP_TEMPLATE_GUIDE)

**Cel:** Powiadomienie przewodnika o nowym zapytaniu lub wiadomości gdy okno 24h jest
zamknięte.

**Proponowana treść (do wklejenia w Meta):**

```
FjordAnglers: New inquiry awaiting your reply. Log in to the guide portal to respond.
```

**Kategoria:** UTILITY  
**Język:** en_US  
**Zmienne:** brak  

---

### `fa_angler_update` (WHATSAPP_TEMPLATE_ANGLER)

**Cel:** Powiadomienie klienta (wędkarza) gdy okno 24h jest zamknięte.

**Proponowana treść (do wklejenia w Meta):**

```
FjordAnglers: You have a new message from our team. Reply here to continue the conversation.
```

**Kategoria:** UTILITY  
**Język:** en_US  
**Zmienne:** brak  

---

## Jak zarejestrować szablon w Meta

1. Meta Business Manager → WhatsApp → Message Templates → Create template
2. Ustaw Category = **Utility**, Language = **English (United States)**
3. Wklej treść z powyżej
4. Poczekaj na zatwierdzenie (zwykle < 24h)
5. Skopiuj nazwę szablonu do Vercel → `WHATSAPP_TEMPLATE_GUIDE` / `WHATSAPP_TEMPLATE_ANGLER`

## Nazwy szablonów w env

| Env var                   | Default                  | Kiedy używany                         |
|---------------------------|--------------------------|---------------------------------------|
| `WHATSAPP_TEMPLATE_GUIDE` | `fa_guide_new_inquiry`   | Wiadomość do przewodnika, okno closed |
| `WHATSAPP_TEMPLATE_ANGLER`| `fa_angler_update`       | Wiadomość do klienta, okno closed     |

Szablony są wysyłane przez `whatsappAdapter.send()` kiedy `canSendFreeform(lastInboundAt)` zwraca `false`
(ostatnia wiadomość przychodząca starsze niż 24h lub brak wiadomości przychodzącej).
