import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { parseExcelBuffer } from './rate-importer';
import { bahtText } from './thai';

let _sql: NeonQueryFunction<false, false> | null = null;
let _initPromise: Promise<void> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _sql = neon(url);
  }
  return _sql;
}

export async function ensureDb(): Promise<NeonQueryFunction<false, false>> {
  const sql = getSql();
  if (!_initPromise) {
    _initPromise = initAndSeed(sql).catch((err) => {
      _initPromise = null;
      throw err;
    });
  }
  await _initPromise;
  return sql;
}

async function initAndSeed(sql: NeonQueryFunction<false, false>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      position TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '2 ถ.อธิบดี ตำบลหมากแข้ง อำเภอเมือง จังหวัดอุดรธานี',
      role TEXT NOT NULL DEFAULT 'user',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS court_orders (
      id SERIAL PRIMARY KEY,
      order_text TEXT NOT NULL,
      order_no TEXT NOT NULL DEFAULT '',
      order_date TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by INTEGER NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS summon_rates (
      id SERIAL PRIMARY KEY,
      rate_type TEXT NOT NULL CHECK (rate_type IN ('paid', 'free')),
      district TEXT NOT NULL,
      subdistrict TEXT NOT NULL,
      exception_note TEXT NOT NULL DEFAULT '',
      rate_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_rates_type_dist ON summon_rates (rate_type, district, subdistrict)`;

  await sql`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      report_type TEXT NOT NULL CHECK (report_type IN ('free', 'paid')),
      round_label TEXT NOT NULL DEFAULT '',
      doc_no TEXT NOT NULL DEFAULT '',
      doc_date TEXT NOT NULL DEFAULT '',
      order_id INTEGER NULL,
      order_text TEXT NOT NULL,
      period_start TEXT NOT NULL DEFAULT '',
      period_end TEXT NOT NULL DEFAULT '',
      item_count INTEGER NOT NULL DEFAULT 0,
      total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      amount_text TEXT NOT NULL DEFAULT '',
      reporter_user_id INTEGER NULL,
      reporter_name TEXT NOT NULL DEFAULT '',
      reporter_position TEXT NOT NULL DEFAULT '',
      reporter_address TEXT NOT NULL DEFAULT '',
      officer_name TEXT NOT NULL DEFAULT '',
      officer_position TEXT NOT NULL DEFAULT '',
      director_name TEXT NOT NULL DEFAULT '',
      director_acting TEXT NOT NULL DEFAULT '',
      payer_name TEXT NOT NULL DEFAULT '',
      payer_position TEXT NOT NULL DEFAULT '',
      receipt_date TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_by INTEGER NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS report_items (
      id SERIAL PRIMARY KEY,
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      seq INTEGER NOT NULL DEFAULT 1,
      case_prefix TEXT NOT NULL DEFAULT 'คดีดำ',
      case_no TEXT NOT NULL DEFAULT '',
      issue_date TEXT NOT NULL DEFAULT '',
      serve_date TEXT NOT NULL DEFAULT '',
      summon_type TEXT NOT NULL DEFAULT '',
      recipient_role TEXT NOT NULL DEFAULT '',
      house_no TEXT NOT NULL DEFAULT '',
      moo TEXT NOT NULL DEFAULT '',
      subdistrict TEXT NOT NULL DEFAULT '',
      district TEXT NOT NULL DEFAULT '',
      province TEXT NOT NULL DEFAULT 'จ.อุดรธานี',
      base_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
      claim_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
      calc_rule TEXT NOT NULL DEFAULT 'full'
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_items_report ON report_items (report_id, seq)`;

  // Seed users
  const [{ cnt: userCnt }] = await sql`SELECT COUNT(*)::int AS cnt FROM users`;
  if (userCnt === 0) {
    const adminHash = await bcrypt.hash('admin1234', 10);
    const staffHash = await bcrypt.hash('staff1234', 10);
    await sql`
      INSERT INTO users (username, password_hash, full_name, position, address, role)
      VALUES
        ('admin', ${adminHash}, 'นายเอกวิทย์ ลาดล้าย', 'นักวิชาการคอมพิวเตอร์ปฏิบัติการ', '2 ถ.อธิบดี ตำบลหมากแข้ง อำเภอเมือง จังหวัดอุดรธานี', 'admin'),
        ('staff', ${staffHash}, 'เจ้าหน้าที่นำส่งหมาย (ตัวอย่าง)', 'เจ้าพนักงานศาลยุติธรรมปฏิบัติการ', '2 ถ.อธิบดี ตำบลหมากแข้ง อำเภอเมือง จังหวัดอุดรธานี', 'user')
      ON CONFLICT (username) DO NOTHING
    `;
  }

  // Seed court order
  const [{ cnt: orderCnt }] = await sql`SELECT COUNT(*)::int AS cnt FROM court_orders`;
  if (orderCnt === 0) {
    await sql`
      INSERT INTO court_orders (order_text, order_no, order_date, note, is_active, created_by)
      VALUES (
        'คำสั่งศาลจังหวัดอุดรธานี ที่ 28/2569 ลงวันที่  23 มีนาคม 2569',
        '28/2569',
        '23 มีนาคม 2569',
        'คำสั่งแต่งตั้งเจ้าพนักงานศาลในการส่งคำคู่ความหรือเอกสาร (ค่าเริ่มต้นตามแบบฟอร์ม)',
        TRUE,
        1
      )
    `;
  }

  // Seed settings
  const defaults: [string, string][] = [
    ['director_name', 'นางสาวเนตรดาว  เฝ้าทรัพย์'],
    ['director_acting', 'รักษาราชการแทน'],
    ['officer_name', 'นายณัฐพงศ์  กุบแก้ว'],
    ['officer_position', 'เจ้าพนักงานศาลยุติธรรมชำนาญการพิเศษ'],
    ['payer_name', 'นางราตรี  ศรีจันทร์'],
    ['payer_position', 'นักวิชาการเงินและบัญชีชำนาญการพิเศษ'],
    ['paid_header', 'อัตราค่านำส่งคำคู่ความและเอกสารทางคดีของศาลจังหวัดอุดรธานี เริ่มใช้ตั้งแต่วันที่ 1 ตุลาคม 2567 เป็นต้นไป'],
    ['paid_notes', 'หมายเหตุ กรณีจำเลยหลายคนในคดีเดียวกัน\n1. มีผู้รับคำคู่ความหรือเอกสารหลายคนและระบุที่อยู่เดียวกัน ให้นำส่งหมายเดียวไม่ต้องวางเงินนำส่งเพิ่ม\n2. มีผู้รับคำคู่ความหรือเอกสารหลายคนระบุภูมิลำเนาอยู่หมู่เดียวกัน และไม่ใช่เลขที่บ้านเดียวกัน ให้วางเงินนำส่งเพิ่มรายละ 200 บาท (ยกเว้นตำบลหมากแข้งวางแยกหมาย)\n3. มีผู้รับคำคู่ความหรือเอกสารหลายคน มีภูมิลำเนาอยู่ตำบลเดียวกันแต่อยู่คนละหมู่ ให้วางเงินนำส่งแยกหมาย'],
    ['free_header_1', 'บัญชีแนบท้ายประกาศศาลจังหวัดอุดรธานี'],
    ['free_header_2', 'เรื่อง กำหนดอัตราค่าพาหนะและค่าป่วยการในการส่งคำคู่ความและเอกสารทางคดี ฉบับลงวันที่ 20 กันยายน 2567'],
    ['free_header_3', 'อัตราค่านำส่งคำคู่ความและหรือเอกสารโดยเจ้าพนักงานศาล (หมายศาล) เริ่มใช้ตั้งแต่วันที่ 12 มกราคม 2569 เป็นต้นไป'],
    ['free_notes', 'หมายเหตุ การเบิกจ่ายค่าตอบแทนในการส่งคำคู่ความหรือเอกสารโดยเจ้าพนักงานศาล ให้เป็นไปตามระเบียบคณะกรรมการบริหารศาลยุติธรรม ว่าด้วยค่าตอบแทนในการส่งคำคู่ความหรือเอกสารโดยเจ้าพนักงานศาล พ.ศ. 2562 ฉบับแก้ไข วันที่ 26 ธันวาคม 2568'],
  ];
  for (const [k, v] of defaults) {
    await sql`INSERT INTO settings (key, value) VALUES (${k}, ${v}) ON CONFLICT (key) DO NOTHING`;
  }

  // Seed summon_rates from templates/rates_seed.xlsx
  const [{ cnt: rateCnt }] = await sql`SELECT COUNT(*)::int AS cnt FROM summon_rates`;
  if (rateCnt === 0) {
    const seedPath = path.join(process.cwd(), 'templates', 'rates_seed.xlsx');
    if (fs.existsSync(seedPath)) {
      const buf = fs.readFileSync(seedPath);
      const parsed = await parseExcelBuffer(buf);
      for (const rateType of ['paid', 'free'] as const) {
        const list = parsed[rateType];
        if (list.length === 0) continue;
        // Batch insert using unnest for speed on Neon serverless
        const districts = list.map((r) => r.district);
        const subs = list.map((r) => r.subdistrict);
        const notes = list.map((r) => r.exception_note);
        const amounts = list.map((r) => r.rate_amount);
        const sorts = list.map((r) => r.sort_order);
        await sql`
          INSERT INTO summon_rates (rate_type, district, subdistrict, exception_note, rate_amount, sort_order)
          SELECT ${rateType}, * FROM UNNEST(${districts}::text[], ${subs}::text[], ${notes}::text[], ${amounts}::numeric[], ${sorts}::int[])
        `;
      }
    }
  }

  // Seed 2 example reports matching original files
  const [{ cnt: repCnt }] = await sql`SELECT COUNT(*)::int AS cnt FROM reports`;
  if (repCnt === 0) {
    const orderText = 'คำสั่งศาลจังหวัดอุดรธานี ที่ 28/2569 ลงวันที่  23 มีนาคม 2569';
    const [freeRep] = await sql`
      INSERT INTO reports (
        report_type, round_label, order_id, order_text, item_count, total_amount, amount_text,
        reporter_user_id, reporter_name, reporter_position, reporter_address,
        officer_name, officer_position, director_name, director_acting,
        payer_name, payer_position, note, created_by
      ) VALUES (
        'free', 'รอบ 19 พ.ศ. 2569', 1, ${orderText}, 5, 4050, ${bahtText(4050)},
        1, 'นายเอกวิทย์ ลาดล้าย', 'นักวิชาการคอมพิวเตอร์ปฏิบัติการ', '2 ถ.อธิบดี ตำบลหมากแข้ง อำเภอเมือง จังหวัดอุดรธานี',
        'นายณัฐพงศ์  กุบแก้ว', 'เจ้าพนักงานศาลยุติธรรมชำนาญการพิเศษ', 'นางสาวเนตรดาว  เฝ้าทรัพย์', 'รักษาราชการแทน',
        'นางราตรี  ศรีจันทร์', 'นักวิชาการเงินและบัญชีชำนาญการพิเศษ', 'ข้อมูลตัวอย่างจากไฟล์ต้นฉบับ', 1
      ) RETURNING id
    `;

    const sampleItems = [
      [1, 'คดีดำ', 'ต2980/2569', '2569-11-09', '2569-11-15', 'หมายนัดและสำเนาคำร้อง', 'ผู้คัดค้าน', '80', '6', 'ห้วยสามพาด', 'ประจักษ์ศิลปาคม', 'จ.อุดรธานี', 800, 800, 'full'],
      [2, 'คดีดำ', 'ผบ ข10/2568', '2569-11-02', '2569-11-15', 'หมายนัด', 'โจทก์', '94', '9', 'ห้วยสามพาด', 'ประจักษ์ศิลปาคม', 'จ.อุดรธานี', 800, 800, 'full'],
      [3, 'คดีดำ', 'พ1141/2566', '2569-11-06', '2569-11-15', 'หมายเรียก', 'จำเลย', '97', '11', 'คอนสาย', 'กู่แก้ว', 'จ.อุดรธานี', 850, 850, 'full'],
      [4, 'คดีดำ', 'ย3518/2564', '2569-11-13', '2569-11-15', 'หมายนัด', 'โจทก์', '131', '12', 'ห้วยสามพาด', 'ประจักษ์ศิลปาคม', 'จ.อุดรธานี', 800, 800, 'full'],
      [5, 'คดีดำ', 'อ638/2568', '2569-11-03', '2569-11-15', 'หมายนัด', 'โจทก์', '86', '5', 'ห้วยสามพาด', 'ประจักษ์ศิลปาคม', 'จ.อุดรธานี', 800, 800, 'full'],
    ] as const;

    for (const it of sampleItems) {
      await sql`
        INSERT INTO report_items (
          report_id, seq, case_prefix, case_no, issue_date, serve_date,
          summon_type, recipient_role, house_no, moo, subdistrict, district, province,
          base_rate, claim_rate, calc_rule
        ) VALUES (
          ${freeRep.id}, ${it[0]}, ${it[1]}, ${it[2]}, ${it[3]}, ${it[4]},
          ${it[5]}, ${it[6]}, ${it[7]}, ${it[8]}, ${it[9]}, ${it[10]}, ${it[11]},
          ${it[12]}, ${it[13]}, ${it[14]}
        )
      `;
    }

    await sql`
      INSERT INTO reports (
        report_type, round_label, order_id, order_text, period_start, period_end,
        item_count, total_amount, amount_text,
        reporter_user_id, reporter_name, reporter_position, reporter_address,
        officer_name, officer_position, director_name, director_acting,
        payer_name, payer_position, note, created_by
      ) VALUES (
        'paid', 'รอบ 2-13 พ.ย. 2569', 1, ${orderText}, '2 พฤศจิกายน 2569', '13 พฤศจิกายน 2569',
        8, 7050, ${bahtText(7050)},
        1, 'นายเอกวิทย์ ลาดล้าย', 'นักวิชาการคอมพิวเตอร์ปฏิบัติการ', '2 ถ.อธิบดี ตำบลหมากแข้ง อำเภอเมือง จังหวัดอุดรธานี',
        'นายณัฐพงศ์ กุบแก้ว', 'เจ้าพนักงานศาลยุติธรรมชำนาญการพิเศษ', 'นางสาวเนตรดาว  เฝ้าทรัพย์', 'รักษาราชการแทน',
        'นางราตรี  ศรีจันทร์', 'นักวิชาการเงินและบัญชีชำนาญการพิเศษ', 'ข้อมูลตัวอย่างจากไฟล์ต้นฉบับ', 1
      )
    `;
  }
}

export async function getSettingsMap(): Promise<Record<string, string>> {
  const sql = await ensureDb();
  const rows = await sql`SELECT key, value FROM settings`;
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[String(r.key)] = String(r.value);
  }
  return map;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const sql = await ensureDb();
  await sql`
    INSERT INTO settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

export async function getLatestOrder(): Promise<{ id: number; order_text: string } | null> {
  const sql = await ensureDb();
  const rows = await sql`SELECT id, order_text FROM court_orders WHERE is_active = TRUE ORDER BY id DESC LIMIT 1`;
  if (rows.length > 0) return { id: Number(rows[0].id), order_text: String(rows[0].order_text) };
  const all = await sql`SELECT id, order_text FROM court_orders ORDER BY id DESC LIMIT 1`;
  return all.length > 0 ? { id: Number(all[0].id), order_text: String(all[0].order_text) } : null;
}
