import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ensureDb } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!username || !password) {
      return NextResponse.json({ ok: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' }, { status: 400 });
    }

    const sql = await ensureDb();
    const rows = await sql`SELECT id, username, password_hash, full_name, role FROM users WHERE username = ${username} AND is_active = TRUE LIMIT 1`;
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกระงับ' }, { status: 401 });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, String(user.password_hash));
    if (!match) {
      return NextResponse.json({ ok: false, message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    await setSessionCookie(Number(user.id));
    return NextResponse.json({ ok: true, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
