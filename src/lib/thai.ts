export const THAI_MONTHS = [
  '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

export const THAI_MONTHS_SHORT = [
  '', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

function intToThai(num: number): string {
  num = Math.floor(num);
  if (num === 0) return '';
  const digits = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const pos = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
  const s = String(num);
  if (s.length > 6) {
    const m = parseInt(s.slice(0, s.length - 6), 10);
    const r = parseInt(s.slice(s.length - 6), 10);
    return intToThai(m) + 'ล้าน' + intToThai(r);
  }
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const d = parseInt(s[i], 10);
    const p = s.length - i - 1;
    if (d === 0) continue;
    if (p === 0 && d === 1 && s.length > 1) out += 'เอ็ด';
    else if (p === 1 && d === 2) out += 'ยี่สิบ';
    else if (p === 1 && d === 1) out += 'สิบ';
    else out += digits[d] + pos[p];
  }
  return out;
}

export function bahtText(amount: number): string {
  const n = Math.round((Number(amount) || 0) * 100) / 100;
  if (n === 0) return 'ศูนย์บาทถ้วน';
  const neg = n < 0 ? 'ลบ' : '';
  const [bStr, sStr] = Math.abs(n).toFixed(2).split('.');
  const baht = parseInt(bStr, 10);
  const satang = parseInt(sStr, 10);
  let out = neg;
  if (baht > 0) out += intToThai(baht) + 'บาท';
  out += satang === 0 ? 'ถ้วน' : intToThai(satang) + 'สตางค์';
  return out;
}

export function formatMoney(amount: number): string {
  const n = Number(amount) || 0;
  const isInt = Math.abs(n - Math.round(n)) < 0.005;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: isInt ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function formatMoney2(amount: number): string {
  return (Number(amount) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatThaiDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const s = dateStr.trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return s;
  let y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (y < 2400) y += 543;
  const mName = THAI_MONTHS[mo] || '';
  return mName ? `${d} ${mName} ${y}` : s;
}

export function formatThaiDateShort(dateStr?: string | null): string {
  if (!dateStr) return '';
  const s = dateStr.trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return s;
  let y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (y < 2400) y += 543;
  const mShort = THAI_MONTHS_SHORT[mo] || '';
  return mShort ? `${d} ${mShort} ${String(y).slice(-2)}` : s;
}

export function cleanDistrict(s: string): string {
  return s.trim().replace(/\s+/g, ' ').replace(/^(อำเภอ|อ\.)\s*/, '');
}

export function cleanSubdistrict(s: string): string {
  return s.trim().replace(/\s+/g, ' ').replace(/^(ตำบล|ต\.)\s*/, '');
}

export function normPart(s?: string | null): string {
  return String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface FreeSummonItemInput {
  case_prefix?: string;
  case_no?: string;
  issue_date?: string;
  serve_date?: string;
  summon_type?: string;
  recipient_role?: string;
  house_no?: string;
  moo?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  base_rate?: number;
}

export interface EvaluatedFreeSummonItem extends FreeSummonItemInput {
  base_rate: number;
  claim_rate: number;
  calc_rule: 'full' | 'half' | 'duplicate';
}

export function evaluateFreeSummonItems(items: FreeSummonItemInput[]): {
  items: EvaluatedFreeSummonItem[];
  has_duplicates: boolean;
  duplicate_indices: number[];
  total_amount: number;
} {
  const exactMap = new Map<string, number[]>();
  const mooMap = new Map<string, { idx: number; house: string }[]>();

  items.forEach((it, idx) => {
    const dist = normPart(cleanDistrict(it.district || ''));
    const sub = normPart(cleanSubdistrict(it.subdistrict || ''));
    const moo = normPart(it.moo);
    const house = normPart(it.house_no);

    if (dist && sub) {
      if (house) {
        const ek = `${dist}|${sub}|${moo}|${house}`;
        const arr = exactMap.get(ek) || [];
        arr.push(idx);
        exactMap.set(ek, arr);
      }
      if (moo && moo !== '-') {
        const mk = `${dist}|${sub}|${moo}`;
        const arr = mooMap.get(mk) || [];
        arr.push({ idx, house });
        mooMap.set(mk, arr);
      }
    }
  });

  const dupSet = new Set<number>();
  exactMap.forEach((list) => {
    if (list.length > 1) list.forEach((i) => dupSet.add(i));
  });

  const halfSet = new Set<number>();
  mooMap.forEach((list) => {
    if (list.length > 1) {
      const houses = new Set(list.map((x) => x.house));
      if (houses.size > 1) list.forEach((x) => halfSet.add(x.idx));
    }
  });

  let total = 0;
  const evaluated: EvaluatedFreeSummonItem[] = items.map((it, idx) => {
    const base = Math.round((Number(it.base_rate) || 0) * 100) / 100;
    let calc_rule: 'full' | 'half' | 'duplicate' = 'full';
    let claim_rate = base;
    if (dupSet.has(idx)) {
      calc_rule = 'duplicate';
      claim_rate = 0;
    } else if (halfSet.has(idx)) {
      calc_rule = 'half';
      claim_rate = Math.round((base / 2) * 100) / 100;
    }
    total += claim_rate;
    return { ...it, base_rate: base, claim_rate, calc_rule };
  });

  return {
    items: evaluated,
    has_duplicates: dupSet.size > 0,
    duplicate_indices: Array.from(dupSet),
    total_amount: Math.round(total * 100) / 100,
  };
}
