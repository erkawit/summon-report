import { NextResponse } from 'next/server';
import { ensureDb, setSetting } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { parseExcelBuffer, parsePdfBuffer } from '@/lib/rate-importer';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'เฉพาะผู้ดูแลระบบเท่านั้น' }, { status: 403 });
  }

  try {
    const fd = await req.formData();
    const file = fd.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, message: 'กรุณาเลือกไฟล์ Excel (.xlsx) หรือ PDF (.pdf)' }, { status: 422 });
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const mode = fd.get('mode') === 'append' ? 'append' : 'replace';
    const targetRaw = String(fd.get('target_type') || 'auto');
    const targetType = targetRaw === 'paid' || targetRaw === 'free' ? targetRaw : 'auto';

    const arrayBuf = await file.arrayBuffer();
    const sql = await ensureDb();
    const imported = { paid: 0, free: 0 };

    if (ext === 'xlsx') {
      const parsed = await parseExcelBuffer(Buffer.from(arrayBuf), targetType === 'auto' ? null : targetType);
      for (const t of ['paid', 'free'] as const) {
        const list = parsed[t];
        if (list.length === 0) continue;
        if (mode === 'replace') {
          await sql`DELETE FROM summon_rates WHERE rate_type = ${t}`;
        }
        const districts = list.map((r) => r.district);
        const subs = list.map((r) => r.subdistrict);
        const notes = list.map((r) => r.exception_note);
        const amounts = list.map((r) => r.rate_amount);
        const sorts = list.map((r) => r.sort_order);
        await sql`
          INSERT INTO summon_rates (rate_type, district, subdistrict, exception_note, rate_amount, sort_order)
          SELECT ${t}, * FROM UNNEST(${districts}::text[], ${subs}::text[], ${notes}::text[], ${amounts}::numeric[], ${sorts}::int[])
        `;
        imported[t] = list.length;
      }
      for (const [k, v] of Object.entries(parsed.meta)) {
        if (v) await setSetting(k, v);
      }
    } else if (ext === 'pdf') {
      const pdfType: 'paid' | 'free' = targetType === 'free' ? 'free' : 'paid';
      const list = await parsePdfBuffer(new Uint8Array(arrayBuf));
      if (list.length === 0) {
        return NextResponse.json({ ok: false, message: 'ไม่พบตารางอัตราค่านำหมายในไฟล์ PDF (รองรับ PDF แบบข้อความที่มีคอลัมน์อำเภอ ตำบล ค่าหมาย)' }, { status: 422 });
      }
      if (mode === 'replace') {
        await sql`DELETE FROM summon_rates WHERE rate_type = ${pdfType}`;
      }
      const districts = list.map((r) => r.district);
      const subs = list.map((r) => r.subdistrict);
      const notes = list.map((r) => r.exception_note);
      const amounts = list.map((r) => r.rate_amount);
      const sorts = list.map((r) => r.sort_order);
      await sql`
        INSERT INTO summon_rates (rate_type, district, subdistrict, exception_note, rate_amount, sort_order)
        SELECT ${pdfType}, * FROM UNNEST(${districts}::text[], ${subs}::text[], ${notes}::text[], ${amounts}::numeric[], ${sorts}::int[])
      `;
      imported[pdfType] = list.length;
    } else {
      return NextResponse.json({ ok: false, message: 'รองรับเฉพาะไฟล์ .xlsx หรือ .pdf เท่านั้น' }, { status: 422 });
    }

    if (imported.paid + imported.free === 0) {
      return NextResponse.json({ ok: false, message: 'ไม่พบข้อมูลอัตราค่านำหมายในไฟล์ที่นำเข้า' }, { status: 422 });
    }
    return NextResponse.json({
      ok: true,
      message: `นำเข้าข้อมูลสำเร็จ: หมายเงิน ${imported.paid} รายการ, หมายฟรี ${imported.free} รายการ`,
      imported,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'นำเข้าข้อมูลไม่สำเร็จ';
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
