// Supabase Edge Function: notify-nearby
// Triggered by a Postgres webhook on INSERT into public.posts.
// Finds users with push tokens within RADIUS_M of the new post and sends Expo push notifications.
//
// Deploy:
//   supabase functions deploy notify-nearby --no-verify-jwt
// Then in the Supabase dashboard create a Database Webhook:
//   Table: posts, Events: INSERT, Type: Supabase Edge Functions, Function: notify-nearby

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: {
    id: string;
    poster_id: string;
    title: string;
    description: string | null;
    photo_url: string;
    location: unknown;
    created_at: string;
    expires_at: string;
  };
  old_record: unknown;
};

const RADIUS_M = 1500;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

Deno.serve(async (req) => {
  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  if (payload.type !== "INSERT" || payload.table !== "posts") {
    return new Response("ignored", { status: 200 });
  }

  const post = payload.record;

  // Pull post coords back out (location is stored as geography wkb).
  // Easier to round-trip via the nearby_posts RPC over a tiny radius.
  const { data: postRows, error: postErr } = await supabase.rpc("nearby_posts", {
    lat: 0, lng: 0, radius_m: 999_999_999,
  });
  if (postErr) {
    return new Response(`rpc error: ${postErr.message}`, { status: 500 });
  }
  const enriched = (postRows as any[]).find((r) => r.id === post.id);
  if (!enriched) return new Response("post not found in feed", { status: 200 });

  const { lat, lng } = enriched;

  // Find candidate recipients: users with push tokens, excluding the poster.
  const { data: nearby, error: nearbyErr } = await supabase.rpc("recipients_near", {
    lat, lng, radius_m: RADIUS_M, exclude_user: post.poster_id,
  });

  if (nearbyErr) {
    // RPC may not exist yet; fall back to "broadcast to all push tokens except poster".
    const { data: all } = await supabase
      .from("push_tokens")
      .select("token, user_id")
      .neq("user_id", post.poster_id);
    return await pushAll((all ?? []).map((r: any) => r.token), post);
  }

  const tokens = (nearby as any[]).map((r) => r.token).filter(Boolean);
  return await pushAll(tokens, post);
});

async function pushAll(tokens: string[], post: WebhookPayload["record"]): Promise<Response> {
  if (tokens.length === 0) return new Response("no recipients", { status: 200 });

  const messages = tokens.map((to) => ({
    to,
    sound: "default",
    title: `📦 ${post.title}`,
    body: "Free on a stoop near you — 15-minute window.",
    data: { postId: post.id },
    channelId: "stoop-alerts",
    priority: "high" as const,
  }));

  // Expo allows up to 100 per request.
  const chunks: typeof messages[] = [];
  for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i + 100));

  const results: unknown[] = [];
  for (const chunk of chunks) {
    const r = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(chunk),
    });
    results.push(await r.json().catch(() => null));
  }

  return new Response(JSON.stringify({ sent: tokens.length, results }), {
    headers: { "content-type": "application/json" },
  });
}
