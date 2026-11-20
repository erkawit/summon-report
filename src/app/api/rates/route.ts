import { NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { cleanDistrict, cleanSubdistrict } from '@/lib/thai';

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') === 'free' ? 'free' : 'paid';
  const sql = await ensureDb();
  const rows = await sql`
    SELECT id, rate_type, district, subdistrict, exception_note, rate_amount::float AS rate_amount, sort_order
    FROM summon_rates
    WHERE rate_type = ${type}
    ORDER BY sort_order ASC, id ASC
  `;
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขอัตราค่านำหมายได้' }, { status: 403 });
  }
  const body = await req.json();
  const id = Number(body.id) || 0;
  const rateType = body.rate_type === 'free' ? 'free' : 'paid';
  const district = cleanDistrict(String(body.district || ''));
  const subdistrict = cleanSubdistrict(String(body.subdistrict || ''));
  const exceptionNote = String(body.exception_note || '').trim();
  const rateAmount = Math.round((Number(body.rate_amount) || 0) * 100) / 100;
  let sortOrder = Number(body.sort_order) || 0;

  if (!district || !subdistrict || rateAmount <= 0) {
    return NextResponse.json({ ok: false, message: 'กรุณากรอกอำเภอ ตำบล และอัตราค่านำหมายให้ครบถ้วน' }, { status: 422 });
  }

  const sql = await ensureDb();
  if (id > 0) {
    await sql`
      UPDATE summon_rates
      SET rate_type = ${rateType}, district = ${district}, subdistrict = ${subdistrict},
          exception_note = ${exceptionNote}, rate_amount = ${rateAmount}, sort_order = ${sortOrder}, updated_at = NOW()
      WHERE id = ${id}
    `;
    return NextResponse.json({ ok: true, message: 'บันทึกการแก้ไขอัตราค่านำหมายเรียบร้อยแล้ว', id });
  } else {
    if (sortOrder <= 0) {
      const [{ mx }] = await sql`SELECT COALESCE(MAX(sort_order), 0)::int AS mx FROM summon_rates WHERE rate_type = ${rateType}`;
      sortOrder = mx + 1;
    }
    const [inserted] = await sql`
      INSERT INTO summon_rates (rate_type, district, subdistrict, exception_note, rate_amount, sort_order)
      VALUES (${rateType}, ${district}, ${subdistrict}, ${exceptionNote}, ${rateAmount}, ${sortOrder})
      RETURNING id
    `;
    return NextResponse.json({ ok: true, message: 'เพิ่มอัตราค่านำหมายเรียบร้อยแล้ว', id: inserted.id });
  }
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'เฉพาะผู้ดูแลระบบเท่านั้น' }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id')) || 0;
  const sql = await ensureDb();
  await sql`DELETE FROM summon_rates WHERE id = ${id}`;
  return NextResponse.json({ ok: true, message: 'ลบรายการเรียบร้อยแล้ว' });
}
