import crypto from 'crypto';
import { cookies } from 'next/headers';
import { ensureDb } from './db';

const COOKIE_NAME = 'udtc_summon_session';

export interface SessionUser {
  id: number;
  username: string;
  full_name: string;
  position: string;
  address: string;
  role: 'admin' | 'user';
}

function secret(): string {
  return process.env.AUTH_SECRET || 'dev-udtc-summon-report-secret-change-in-prod';
}

function sign(payloadB64: string): string {
  return crypto.createHmac('sha256', secret()).update(payloadB64).digest('base64url');
}

export function createSessionToken(userId: number): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + 7 * 86400 * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.uid || !data.exp || Date.now() > data.exp) return null;
    return Number(data.uid);
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: number): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.VERCEL === '1',
    path: '/',
    maxAge: 7 * 86400,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const uid = verifySessionToken(token);
  if (!uid) return null;

  const sql = await ensureDb();
  const rows = await sql`
    SELECT id, username, full_name, position, address, role
    FROM users
    WHERE id = ${uid} AND is_active = TRUE
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: Number(r.id),
    username: String(r.username),
    full_name: String(r.full_name),
    position: String(r.position || ''),
    address: String(r.address || ''),
    role: r.role === 'admin' ? 'admin' : 'user',
  };
}
