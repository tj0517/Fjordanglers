# Zoho Mail — setup outbound copy to Resend inbound

## What this achieves

Mails you send from `hello@fjordanglers.com` in Zoho will be copied to the Resend inbound address. The app recognises the copy as an outbound message from you, matches it to the inquiry by the client's recipient address, and adds it to the thread. FA-1.48 (agent silence after human takeover) reads these rows.

## Step 1 — Configure a Zoho rule for outgoing mail

1. Log into Zoho Mail → Settings → Mail Rules → **Sending rules**.
2. Click **Add Rule**.
3. Set **Condition**: Apply to All Messages (or narrow to `To contains @` to catch all external recipients).
4. Set **Action**: **BCC** → enter the Resend inbound address (the value of `FA_INBOUND_EMAIL`, e.g. `leads@fjordanglers.com`).
5. Save.

> **Alternative**: if Zoho's plan does not allow sending rules, enable the BCC manually on each reply by adding the inbound address to BCC before sending.

## Step 2 — Verify the copy arrives

After sending a test reply from Zoho to a client:

1. Open the Supabase dashboard → Table Editor → `messages`.
2. Filter `direction = outbound` and `channel = email`, sort by `occurred_at` descending.
3. You should see a row with `drafted_by = admin`, `status = sent`, and `body` containing the mail subject and text.
4. Check `inquiry_events` for a `message.sent` event with `actor_kind = admin` and `source = webhook`.

If no row appears:

- Check the Resend dashboard → Inbound → recent events: confirm the mail arrived.
- Check Vercel function logs for `[email-inbound] outbound without matching inquiry` — this fires if the recipient address is not linked to any active inquiry.
- Confirm the client's email in the inquiry matches exactly the recipient you used in Zoho.

## Environment variable (Vercel — tj sets this)

`FA_OUTBOUND_ADDRESSES` — comma-separated list of FA-owned mailboxes to treat as outbound. Defaults to `hello@fjordanglers.com` and the value of `FA_EMAIL`. Set this in Vercel if you add more FA mailboxes in the future.

Example value: `hello@fjordanglers.com,contact@fjordanglers.com`

You do **not** need to set this for the default Zoho mailbox — the code default covers it.
