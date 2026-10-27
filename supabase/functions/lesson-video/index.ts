// Hands a signed-in member a short-lived Bunny Stream player link for one lesson, if their plan
// includes it. The lesson's Bunny video id and the plan it needs live in public.lesson_videos, which
// members can't read, so a video can't be found or played without passing this check.
//
// Bunny library settings: turn on "Embed view token authentication" (so a bare embed link won't
// play), and list the site's domains under Allowed domains.
// Secrets (Supabase → Edge Functions → Secrets): BUNNY_LIBRARY_ID, BUNNY_TOKEN_KEY (the library's
// token authentication key, under Security; not the library API key).
// Token, from Bunny's docs: SHA256_HEX(token_key + video_id + expires), expires in unix seconds.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const TIER_RANK: Record<string, number> = { open: 0, deck: 1, ace: 2, royal: 3 };
const PLAN_NAME: Record<string, string> = { open: 'Open Hand', deck: 'the Full Deck', ace: 'Ace', royal: 'Royal Flush' };
/** Long enough to pause and come back to a lesson; short enough that a copied link soon stops working. */
const LINK_SECONDS = 3 * 60 * 60;

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const libraryId = Deno.env.get('BUNNY_LIBRARY_ID');
  const tokenKey = Deno.env.get('BUNNY_TOKEN_KEY');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    const user = auth?.user;
    if (authError || !user) return json({ error: 'Sign in to watch lessons.' }, 401);

    const { lessonId } = (await req.json().catch(() => ({}))) as { lessonId?: unknown };
    if (typeof lessonId !== 'string' || !/^[a-z0-9-]{1,80}$/.test(lessonId)) return json({ error: 'Unknown lesson.' }, 400);

    const [{ data: profile }, { data: video, error: videoError }] = await Promise.all([
      admin.from('profiles').select('tier, is_admin').eq('id', user.id).single(),
      admin.from('lesson_videos').select('video_id, min_tier').eq('lesson_id', lessonId).maybeSingle(),
    ]);
    if (!profile) return json({ error: 'Member not found.' }, 404);
    if (videoError) throw videoError;
    // Not uploaded yet: the lesson page says so instead of showing an error.
    if (!video) return json({ status: 'none' });

    const allowed = profile.is_admin || TIER_RANK[profile.tier] >= TIER_RANK[video.min_tier];
    if (!allowed) return json({ status: 'locked', error: `This lesson is part of ${PLAN_NAME[video.min_tier]}.` }, 403);

    if (!libraryId || !tokenKey) {
      console.error('Bunny secrets missing: set BUNNY_LIBRARY_ID and BUNNY_TOKEN_KEY');
      return json({ error: "Lesson videos aren't switched on yet." }, 503);
    }

    const expires = Math.floor(Date.now() / 1000) + LINK_SECONDS;
    const signature = await sha256Hex(tokenKey + video.video_id + expires);
    const params = new URLSearchParams({ token: signature, expires: String(expires), autoplay: 'false', preload: 'true', responsive: 'true' });
    const url = `https://iframe.mediadelivery.net/embed/${encodeURIComponent(libraryId)}/${video.video_id}?${params}`;
    return json({
      status: 'ready',
      url,
      expiresAt: expires * 1000,
      // Jack sees which Bunny video is attached, so he can check or replace it from the lesson page.
      ...(profile.is_admin ? { videoId: video.video_id } : {}),
    });
  } catch (err) {
    console.error('lesson-video failed', err);
    return json({ error: "The video didn't load. Refresh to try again." }, 500);
  }
});
