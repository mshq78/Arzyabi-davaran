type Cell = string | number | boolean | Date | null | undefined;

const cellToString = (c: Cell): string => {
  if (c === null || c === undefined) return '';
  if (typeof c === 'number') return Number.isFinite(c) ? String(Math.round(c) === c ? c.toFixed(0) : c) : '';
  return String(c).trim();
};

/** Minimal CSV parser (comma / semicolon / tab, quoted fields, BOM). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] || '';
  const delim = [',', ';', '\t'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Arabic ي / ك (common in exported sheets) -> Persian ی / ک */
export const normalizePersianLetters = (s: string) => s.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/ۀ/g, 'ه');

/**
 * Reads the first sheet of an .xlsx / .csv file into row objects keyed by the header row
 * (same shape the participants import expects).
 */
export async function readTable(file: File): Promise<Record<string, string>[]> {
  const name = file.name.toLowerCase();
  let data: Cell[][];
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    data = parseCsv(await file.text());
  } else if (name.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser');
    data = (await readSheet(file)) as Cell[][];
  } else {
    throw new Error('unsupported_file');
  }

  const rows = data.filter((r) => r.some((c) => cellToString(c) !== ''));
  if (rows.length < 2) return [];
  const headers = rows[0].map((c) => normalizePersianLetters(cellToString(c)));
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = normalizePersianLetters(cellToString(r[i]));
    });
    return obj;
  });
}
