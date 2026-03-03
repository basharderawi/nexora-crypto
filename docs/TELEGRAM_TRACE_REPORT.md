# Telegram Message Trace Report

## 1) All Telegram send points

| File | Match | Function that sends |
|------|--------|----------------------|
| `supabase/functions/notify-new-order/index.ts` | `TELEGRAM_API`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `sendMessage` | `Deno.serve` handler (anonymous async handler) |

**Conclusion:** There is **only one** place in the repo that sends Telegram messages: the Supabase Edge Function **notify-new-order**. No Next.js API route calls Telegram.

---

## 2) Code path when a customer creates an order

### BUY (customer buys USDT from you)

1. **UI:** `app/order/page.tsx` – form submit calls `fetch('/api/orders', { method: 'POST', body: JSON.stringify(payload) })`. Payload does not include `side` (API adds it).
2. **API:** `app/api/orders/route.ts` – `POST` handler inserts into `orders` with `side: 'SELL'`, returns `{ id }`. **Does not call Telegram.**
3. **Telegram:** Supabase **Database Webhook** (configured in Supabase Dashboard) fires on `INSERT` into `public.orders` and invokes the Edge Function `notify-new-order` with the new row as payload. The Edge Function builds the message and calls `api.telegram.org` `sendMessage`.

### SELL (customer sells USDT to you)

1. **UI:** `app/sell/page.tsx` – form submit calls `fetch('/api/sell-orders', { method: 'POST', body: JSON.stringify(payload) })`.
2. **API:** `app/api/sell-orders/route.ts` – `POST` handler inserts into `orders` with `side: 'BUY'`, returns `{ id }`. **Does not call Telegram.**
3. **Telegram:** Same as above – Database Webhook → Edge Function `notify-new-order` → sendMessage.

**Why your UI change did not affect Telegram:** The Telegram text is built **only** in the Edge Function from the **webhook payload** (the inserted row). The UI never talks to Telegram; it only talks to the Next.js API, which only writes to the DB. The message is 100% built in `supabase/functions/notify-new-order/index.ts`.

---

## 3) Proof log added

In **`supabase/functions/notify-new-order/index.ts`**, right before the Telegram `fetch`:

```ts
console.log("[TELEGRAM_SEND] route=EdgeFunction(notify-new-order) orderId=", orderId, "side=", record.side, "computedLabel=", label);
```

**Where to see it:** Supabase Edge Function logs (Dashboard → Edge Functions → notify-new-order → Logs). For local runs: `supabase functions serve notify-new-order` and trigger the webhook; logs appear in the terminal. There is no `request.nextUrl.pathname` in the Edge Function (it is invoked by Supabase with a JSON body, not by Next.js).

**To verify:** Create one BUY order (from `/order`) and one SELL order (from `/sell`). In Supabase Edge Function logs you should see:
- BUY order: `side= SELL`, `computedLabel= 🟦 Customer BUY (We SELL USDT)`
- SELL order: `side= BUY`, `computedLabel= 🟩 Customer SELL (We BUY USDT)`

---

## 4) Deployment / runtime

- **(A) Next.js API route:** **No.** `app/api/orders/route.ts` and `app/api/sell-orders/route.ts` do not contain any Telegram code.
- **(B) Supabase Edge Function:** **Yes.** The **only** Telegram sender is `supabase/functions/notify-new-order/index.ts`. It is invoked by Supabase when the Database Webhook runs.
- **(C) Database trigger (pg function calling webhook):** The **webhook** is configured in the Supabase Dashboard (Database → Webhooks): “On INSERT to `public.orders`” → call Edge Function `notify-new-order`. There is **no** SQL trigger or `pg_net`/`http_request` in the repo; the webhook is a Supabase feature that pushes the new row to the function.

**Important:** Ensure the Database Webhook is set to send the **full record** (or at least include the `side` column). If the webhook payload does not include `side`, the Edge Function will show "Type: -" and the fallback label.

---

## 5) Exact code that builds the Telegram text

**File:** `supabase/functions/notify-new-order/index.ts`

**Function:** `buildMessage(record: OrderRecord)`

**Snippet (lines 24–59):**

```ts
function buildMessage(record: OrderRecord): { text: string; label: string; side: string } {
  const side = record.side === "BUY" || record.side === "SELL" ? record.side : (record.side ?? "-");
  const label =
    side === "SELL"
      ? "🟦 Customer BUY (We SELL USDT)"
      : side === "BUY"
        ? "🟩 Customer SELL (We BUY USDT)"
        : "🟢 New Nexora Order";
  const typeLine = side === "BUY" || side === "SELL" ? `Type: ${side}` : "Type: -";

  const id = record.id ?? "-";
  const name = record.full_name ?? "-";
  const city = record.city != null && String(record.city).trim() !== "" ? String(record.city).trim() : "-";
  // ... phone, amount, payment, notes, created ...

  const text = [
    label,
    "",
    typeLine,
    `Name: ${name}`,
    `City: ${city}`,
    // ...
  ].join("\n");
  return { text, label, side };
}
```

**Place to edit to change the message:** Edit `buildMessage` in **`supabase/functions/notify-new-order/index.ts`**. After editing, redeploy the function (e.g. `supabase functions deploy notify-new-order`) for changes to take effect in production.

---

## Summary

| Step | Location |
|------|----------|
| Entry point (UI) | `app/order/page.tsx` (BUY) or `app/sell/page.tsx` (SELL) |
| API | `app/api/orders/route.ts` or `app/api/sell-orders/route.ts` (insert only, no Telegram) |
| Telegram sender | **`supabase/functions/notify-new-order/index.ts`** (Edge Function, invoked by DB webhook) |
| Message template | Same file, function **`buildMessage`** |
| Side-based labels | Already applied: SELL → 🟦 Customer BUY…, BUY → 🟩 Customer SELL… |
| City fallback | Already applied: `record.city != null && String(record.city).trim() !== "" ? ... : "-"` |

If the Telegram message still doesn’t show the new labels, (1) redeploy the Edge Function and (2) confirm the Database Webhook sends the `side` column in the payload.
