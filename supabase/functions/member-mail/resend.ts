// Helpers for the member-mail function: the cron check and a small Resend API client.
// pg_cron calls member-mail through pg_net with an x-cron-secret header. The secret was generated inside
// the database and lives only in the vault (cron_secret); public.cron_secret_matches checks it, and only
// the service role can call that. Anyone without it gets a 401.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2';

export async function fromCron(req: Request, admin: SupabaseClient): Promise<boolean> {
  const given = req.headers.get('x-cron-secret') ?? '';
  if (given.length < 32) return false;
  const { data, error } = await admin.rpc('cron_secret_matches', { p_secret: given });
  if (error) console.error('cron check failed', error);
  return data === true;
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** A small Resend API client: retries once on 429, and reports errors as thrown Errors. */
export async function resend(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<unknown> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) throw new Error('RESEND_API_KEY is not set');
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  if (init.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`https://api.resend.com${path}`, { ...init, headers });
    if (res.status === 429 && attempt === 0) {
      await sleep(1500);
      continue;
    }
    const text = await res.text();
    let body: { message?: string } | null = null;
    try { body = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    if (!res.ok) {
      const err = new Error(`Resend ${init.method ?? 'GET'} ${path} → ${res.status}: ${body?.message ?? text}`);
      (err as Error & { status?: number }).status = res.status;
      throw err;
    }
    return body;
  }
  throw new Error('unreachable');
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
