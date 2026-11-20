import ExcelJS from 'exceljs';
import { cleanDistrict, cleanSubdistrict } from './thai';

export interface ParsedRateRow {
  district: string;
  subdistrict: string;
  exception_note: string;
  rate_amount: number;
  sort_order: number;
}

export interface ParsedExcelResult {
  paid: ParsedRateRow[];
  free: ParsedRateRow[];
  meta: Record<string, string>;
}

function parseRateNum(v: string): number | null {
  const cleaned = v.replace(/[,บาท\s]/g, '').trim();
  if (!cleaned || isNaN(Number(cleaned))) return null;
  return Math.round(Number(cleaned) * 100) / 100;
}

function cellToString(val: ExcelJS.CellValue): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if ('richText' in val && Array.isArray(val.richText)) {
      return val.richText.map((r) => r.text).join('');
    }
    if ('result' in val && val.result !== undefined) {
      return String(val.result);
    }
    if ('text' in val && typeof val.text === 'string') {
      return val.text;
    }
    return '';
  }
  return String(val);
}

function detectFourBlock(rows: string[][]): boolean {
  for (const row of rows.slice(0, 8)) {
    let feeHeaders = 0;
    for (const col of [2, 5, 8, 11]) {
      if ((row[col] || '').includes('ค่าหมาย')) feeHeaders++;
    }
    if (feeHeaders >= 2) return true;
  }
  return false;
}

function parseFourBlockRows(rows: string[][]): { items: ParsedRateRow[]; headers: string[]; notes: string[] } {
  const headers: string[] = [];
  const notes: string[] = [];
  let inNotes = false;
  let seenDistrictHeader = false;
  const curDistrict = ['', '', '', ''];
  const lastSub = ['', '', '', ''];
  const blockItems: Omit<ParsedRateRow, 'sort_order'>[][] = [[], [], [], []];

  for (const row of rows) {
    const joined = row.map((c) => c.trim()).filter(Boolean).join(' ');
    if (!joined) continue;

    if (!seenDistrictHeader && !joined.includes('ค่าหมาย') && !joined.includes('อำเภอ')) {
      headers.push((row[0] || joined).trim());
      continue;
    }
    seenDistrictHeader = true;

    if (joined.includes('หมายเหตุ') || inNotes) {
      inNotes = true;
      notes.push(joined.replace(/\s+/g, ' '));
      continue;
    }

    for (let b = 0; b < 4; b++) {
      const c0 = (row[b * 3] || '').trim();
      const c1 = (row[b * 3 + 1] || '').trim();
      const c2 = (row[b * 3 + 2] || '').trim();
      if (!c0 && !c1 && !c2) continue;

      if (c0.startsWith('อำเภอ') || c2.includes('ค่าหมาย')) {
        const dist = cleanDistrict(c0);
        if (dist) {
          curDistrict[b] = dist;
          lastSub[b] = '';
        }
        continue;
      }

      const rate = parseRateNum(c2);
      if (rate === null || !curDistrict[b]) continue;

      if (!c0 && c1 && lastSub[b]) {
        blockItems[b].push({
          district: curDistrict[b],
          subdistrict: lastSub[b],
          exception_note: c1,
          rate_amount: rate,
        });
      } else if (c1) {
        const sub = cleanSubdistrict(c1);
        lastSub[b] = sub;
        blockItems[b].push({
          district: curDistrict[b],
          subdistrict: sub,
          exception_note: '',
          rate_amount: rate,
        });
      }
    }
  }

  let sort = 1;
  const items: ParsedRateRow[] = [];
  const seenKey = new Set<string>();
  for (const list of blockItems) {
    for (const it of list) {
      const k = `${it.district}|${it.subdistrict}|${it.exception_note}|${it.rate_amount}`;
      if (seenKey.has(k)) continue;
      seenKey.add(k);
      items.push({ ...it, sort_order: sort++ });
    }
  }
  return { items, headers, notes };
}

function parseTabularRows(rows: string[][]): { items: ParsedRateRow[]; headers: string[]; notes: string[] } {
  const items: ParsedRateRow[] = [];
  let sort = 1;
  let colDist = 0, colSub = 1, colNote = -1, colRate = 2;
  let headerFound = false;

  for (const row of rows) {
    const cells = row.map((c) => c.trim());
    if (!cells.some(Boolean)) continue;

    if (!headerFound) {
      cells.forEach((c, i) => {
        if (c.includes('อำเภอ')) { colDist = i; headerFound = true; }
        else if (c.includes('ตำบล')) colSub = i;
        else if (c.includes('หมายเหตุ') || c.includes('ยกเว้น')) colNote = i;
        else if (c.includes('ค่าหมาย') || c.includes('อัตรา') || c.includes('ราคา')) colRate = i;
      });
      if (headerFound) continue;
    }

    const dist = cleanDistrict(cells[colDist] || '');
    const sub = cleanSubdistrict(cells[colSub] || '');
    const note = colNote >= 0 ? (cells[colNote] || '') : '';
    const rate = parseRateNum(cells[colRate] || '');
    if (dist && sub && rate !== null) {
      items.push({ district: dist, subdistrict: sub, exception_note: note, rate_amount: rate, sort_order: sort++ });
    }
  }
  return { items, headers: [], notes: [] };
}

export async function parseExcelBuffer(buf: Buffer | ArrayBuffer, forceType?: 'paid' | 'free' | null): Promise<ParsedExcelResult> {
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buf as any);

  const result: ParsedExcelResult = { paid: [], free: [], meta: {} };

  wb.worksheets.forEach((ws, idx) => {
    const title = ws.name.trim();
    let type: 'paid' | 'free';
    if (forceType) {
      type = forceType;
    } else if (title.includes('ฟรี') || title.includes('หมายศาล')) {
      type = 'free';
    } else if (title.includes('เงิน')) {
      type = 'paid';
    } else {
      type = idx === 0 ? 'paid' : 'free';
    }

    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const arr: string[] = [];
      const maxCol = Math.max(row.cellCount, 12);
      for (let c = 1; c <= maxCol; c++) {
        arr.push(cellToString(row.getCell(c).value));
      }
      rows.push(arr);
    });

    if (rows.length === 0) return;
    const parsed = detectFourBlock(rows) ? parseFourBlockRows(rows) : parseTabularRows(rows);
    result[type].push(...parsed.items);

    if (parsed.headers.length > 0) {
      if (type === 'paid') {
        result.meta.paid_header = parsed.headers[0] || '';
      } else {
        result.meta.free_header_1 = parsed.headers[0] || '';
        result.meta.free_header_2 = parsed.headers[1] || '';
        result.meta.free_header_3 = parsed.headers[2] || '';
      }
    }
    if (parsed.notes.length > 0) {
      result.meta[`${type}_notes`] = parsed.notes.join('\n');
    }
  });

  return result;
}

export async function parsePdfBuffer(buf: Uint8Array): Promise<ParsedRateRow[]> {
  const { extractText } = await import('unpdf');
  const { text } = await extractText(buf, { mergePages: true });
  const lines = String(text || '').split(/\r?\n/);

  const items: ParsedRateRow[] = [];
  let curDistrict = '';
  let lastSub = '';
  let sort = 1;

  for (const raw of lines) {
    const line = raw.trim().replace(/\s+/g, ' ');
    if (!line) continue;

    const tabMatch = line.match(/^(?:\d+\s+)?(?:อำเภอ|อ\.)\s*([^\s]+)\s+(?:ตำบล|ต\.)\s*([^\s]+)(?:\s+\(([^)]+)\))?\s+([\d,]+(?:\.\d+)?)\s*(?:บาท)?$/);
    if (tabMatch) {
      items.push({
        district: cleanDistrict(tabMatch[1]),
        subdistrict: cleanSubdistrict(tabMatch[2]),
        exception_note: (tabMatch[3] || '').trim(),
        rate_amount: Number(tabMatch[4].replace(/,/g, '')),
        sort_order: sort++,
      });
      continue;
    }

    const distMatch = line.match(/อำเภอ([^\s\d]+)/);
    if (distMatch && !line.includes('ตำบล')) {
      curDistrict = cleanDistrict(distMatch[1]);
      lastSub = '';
      continue;
    }

    const subMatches = [...line.matchAll(/(?:(\d+)\s+)?ตำบล([^\s\d]+)\s+([\d,]+(?:\.\d+)?)/g)];
    if (subMatches.length > 0 && curDistrict) {
      for (const m of subMatches) {
        lastSub = cleanSubdistrict(m[2]);
        items.push({
          district: curDistrict,
          subdistrict: lastSub,
          exception_note: '',
          rate_amount: Number(m[3].replace(/,/g, '')),
          sort_order: sort++,
        });
      }
      continue;
    }

    const excMatch = line.match(/(ยกเว้น[^\d]*\d*)\s+([\d,]+(?:\.\d+)?)/);
    if (curDistrict && lastSub && excMatch) {
      items.push({
        district: curDistrict,
        subdistrict: lastSub,
        exception_note: excMatch[1].trim(),
        rate_amount: Number(excMatch[2].replace(/,/g, '')),
        sort_order: sort++,
      });
    }
  }

  return items;
}
