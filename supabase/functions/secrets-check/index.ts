// Says whether the edge function secrets are set and look right, without ever revealing them.
// Only callable with the cron secret (from the database vault), so it's for Claude/Jack's checks only.
// If a lesson video is attached, it also asks Bunny whether a signed player link works and an unsigned
// one is refused (that's the lock working).
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const given = req.headers.get('x-cron-secret') ?? '';
  if (given.length < 32) return json({ error: 'Not allowed' }, 401);
  const { data: ok } = await admin.rpc('cron_secret_matches', { p_secret: given });
  if (ok !== true) return json({ error: 'Not allowed' }, 401);

  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const library = (Deno.env.get('BUNNY_LIBRARY_ID') ?? '').trim();
  const token = (Deno.env.get('BUNNY_TOKEN_KEY') ?? '').trim();
  const report: Record<string, unknown> = {
    resend: { set: !!resendKey, startsWithRe: resendKey.startsWith('re_'), hasSpaces: /\s/.test(resendKey) },
    bunnyLibraryId: { set: !!library, isNumber: /^\d+$/.test(library), hadSpaces: library !== (Deno.env.get('BUNNY_LIBRARY_ID') ?? '') },
    bunnyTokenKey: { set: !!token, length: token.length, hadSpaces: token !== (Deno.env.get('BUNNY_TOKEN_KEY') ?? '') },
  };

  const { data: video } = await admin.from('lesson_videos').select('lesson_id, video_id').limit(1).maybeSingle();
  if (video && library && token) {
    const expires = Math.floor(Date.now() / 1000) + 600;
    const sig = await sha256Hex(token + video.video_id + expires);
    const base = `https://iframe.mediadelivery.net/embed/${library}/${video.video_id}`;
    const signed = await fetch(`${base}?token=${sig}&expires=${expires}`, { headers: { Referer: 'https://jackofalltrades.life/' } });
    const unsigned = await fetch(base, { headers: { Referer: 'https://jackofalltrades.life/' } });
    await signed.body?.cancel();
    await unsigned.body?.cancel();
    report.bunnyPlayback = { lesson: video.lesson_id, signedLink: signed.status, unsignedLink: unsigned.status };
  }
  return json(report);
});
