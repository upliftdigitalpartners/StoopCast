// Supabase Edge Function: moderate-post
// Triggered by a Postgres webhook on INSERT into public.posts.
// Calls Sightengine to check the photo(s) for nudity, weapons, drugs, and
// offensive content. If any model crosses the threshold, the post is soft-
// deleted (status='gone') and the offending photos are removed from storage.
//
// Env vars (set under Project Settings → Edge Functions → Secrets):
//   SIGHTENGINE_USER    your API user
//   SIGHTENGINE_SECRET  your API secret
//   MODERATION_THRESHOLD optional, default 0.55
//
// Deploy:
//   supabase functions deploy moderate-post --no-verify-jwt
//   supabase secrets set SIGHTENGINE_USER=... SIGHTENGINE_SECRET=...
// Then add a Database Webhook: posts INSERT → moderate-post.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: {
    id: string;
    poster_id: string;
    photo_url: string;
    photos: string[] | null;
    title: string;
  };
  old_record: unknown;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SIGHTENGINE_USER = Deno.env.get("SIGHTENGINE_USER");
const SIGHTENGINE_SECRET = Deno.env.get("SIGHTENGINE_SECRET");
const THRESHOLD = parseFloat(Deno.env.get("MODERATION_THRESHOLD") ?? "0.55");

// Sightengine model bundle: nudity, weapons, alcohol, drugs, offensive symbols.
const MODELS = "nudity-2.1,weapon,alcohol,recreational_drug,offensive";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

Deno.serve(async (req) => {
  if (!SIGHTENGINE_USER || !SIGHTENGINE_SECRET) {
    return json({ skipped: "missing SIGHTENGINE_USER/SECRET secrets" }, 200);
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  if (payload.type !== "INSERT" || payload.table !== "posts") {
    return json({ skipped: "not a posts insert" }, 200);
  }

  const post = payload.record;
  const photoUrls = [post.photo_url, ...(post.photos ?? [])].filter(Boolean);

  const flagged: { url: string; reasons: string[] }[] = [];
  for (const url of photoUrls) {
    try {
      const reasons = await checkSightengine(url);
      if (reasons.length > 0) flagged.push({ url, reasons });
    } catch (e) {
      // Don't fail-closed on Sightengine errors — log and let it through.
      console.error("sightengine error", url, e);
    }
  }

  if (flagged.length === 0) {
    return json({ ok: true, photos_checked: photoUrls.length });
  }

  // Soft-delete: status='gone' so the post falls out of nearby_posts.
  await supabase.from("posts").update({ status: "gone" }).eq("id", post.id);

  // Best-effort: also delete the storage objects.
  const paths = flagged.map((f) => extractStoragePath(f.url)).filter((p): p is string => !!p);
  if (paths.length > 0) {
    await supabase.storage.from("stoop-photos").remove(paths);
  }

  // Record a system "report" for the audit trail (uses the poster as both
  // sides since we don't have a system user; non-fatal if it conflicts).
  await supabase.from("reports").insert({
    post_id: post.id,
    reporter_id: post.poster_id,
    reason: `auto-moderation: ${flagged.flatMap((f) => f.reasons).join(", ")}`.slice(0, 200),
  });

  return json({ moderated: true, flagged });
});

async function checkSightengine(imageUrl: string): Promise<string[]> {
  const params = new URLSearchParams({
    url: imageUrl,
    models: MODELS,
    api_user: SIGHTENGINE_USER!,
    api_secret: SIGHTENGINE_SECRET!,
  });
  const r = await fetch(`https://api.sightengine.com/1.0/check.json?${params}`);
  if (!r.ok) throw new Error(`sightengine ${r.status}`);
  const data = await r.json();

  const reasons: string[] = [];
  // nudity-2.1: top-level `nudity.sexual_activity`, `nudity.sexual_display`,
  // `nudity.erotica` are the strict signals.
  const n = data.nudity ?? {};
  if (Math.max(n.sexual_activity ?? 0, n.sexual_display ?? 0, n.erotica ?? 0) >= THRESHOLD) {
    reasons.push("nudity");
  }
  if ((data.weapon?.classes?.firearm ?? data.weapon ?? 0) >= THRESHOLD) reasons.push("weapon");
  if ((data.alcohol ?? 0) >= THRESHOLD) reasons.push("alcohol");
  if ((data.recreational_drug?.prob ?? data.recreational_drug ?? 0) >= THRESHOLD) reasons.push("drugs");
  const off = data.offensive ?? {};
  if (Math.max(off.nazi ?? 0, off.confederate ?? 0, off.supremacist ?? 0, off.middle_finger ?? 0) >= THRESHOLD) {
    reasons.push("offensive");
  }
  return reasons;
}

function extractStoragePath(publicUrl: string): string | null {
  // Public URL shape: <SUPABASE_URL>/storage/v1/object/public/stoop-photos/<userId>/<file>
  const marker = "/storage/v1/object/public/stoop-photos/";
  const i = publicUrl.indexOf(marker);
  if (i < 0) return null;
  return publicUrl.slice(i + marker.length);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
