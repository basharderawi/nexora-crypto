// Supabase Edge Function: notify-new-order
// Trigger: Database Webhook on INSERT into public.orders
// Sends a Telegram notification with order details.

const TELEGRAM_API = "https://api.telegram.org";

type OrderRecord = {
  id?: string;
  full_name?: string | null;
  city?: string | null;
  phone?: string | null;
  amount_usdt?: number | null;
  payment_method?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: OrderRecord;
};

function buildMessage(record: OrderRecord): string {
  const id = record.id ?? "-";
  const name = record.full_name ?? "-";
  const city = record.city ?? "-";
  const phone = record.phone ?? "-";
  const amount = record.amount_usdt != null ? String(record.amount_usdt) : "-";
  const payment = record.payment_method ?? "-";
  const notes = record.notes ?? "-";
  const created = record.created_at ?? "-";

  return [
    "🟢 New Nexora Order",
    "",
    `Name: ${name}`,
    `City: ${city}`,
    `Phone: ${phone}`,
    `Amount: ${amount} USDT`,
    `Payment: ${payment}`,
    `Notes: ${notes}`,
    "",
    `Order ID: ${id}`,
    `Created: ${created}`,
  ].join("\n");
}

Deno.serve(async (req: Request): Promise<Response> => {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!token || !chatId) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing Telegram env" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const record = payload?.record;
  if (!record || typeof record !== "object") {
    return new Response(
      JSON.stringify({ success: false, error: "Missing record in payload" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const text = buildMessage(record);
  const url = `${TELEGRAM_API}/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });

  const data = (await res.json()) as { ok?: boolean; description?: string };
  if (!data?.ok) {
    const errMsg = typeof data?.description === "string" ? data.description : "Telegram API error";
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
