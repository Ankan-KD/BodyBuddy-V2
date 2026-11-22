// Shared CSV reader.
//
// Every CSV the app reads goes through here — the Master Food Database
// (src/lib/masterFoods.ts) and the admin catalogue import
// (src/app/admin/catalog/page.tsx) — so they all behave the same way and
// there is exactly one place to fix if a file ever parses oddly.
//
// Handles what real-world CSVs from Excel / Google Sheets / Python throw at
// you: quoted fields, "" escaped quotes, commas and line breaks inside
// quotes, CRLF or LF endings, a UTF-8 BOM at the start of the file (Excel's
// "CSV UTF-8" adds one, and it would otherwise turn the first header into
// "\ufeffproduct_id" so every row silently fails to match), and blank lines.
//
// No dependencies, so it runs identically in the browser and on the server.

/** Parses CSV text into rows of raw cell strings (header row included). */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"' && field === "") {
      inQuotes = true; // a quote only opens a quoted field at the start of a field
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++; // CRLF counts once
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  // Last line without a trailing newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export interface ParsedCsv {
  /** Header names, trimmed and lower-cased. */
  headers: string[];
  /** One object per data row, keyed by header. Blank lines are skipped. */
  rows: Record<string, string>[];
}

/**
 * Parses CSV text whose first row is a header. Header names are trimmed and
 * lower-cased so "Product_ID " and "product_id" are the same column. Cell
 * values are returned as-is (callers trim/convert what they need).
 */
export function parseCsvObjects(text: string): ParsedCsv {
  const all = parseCsv(text);
  if (all.length === 0) return { headers: [], rows: [] };

  const headers = all[0].map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let r = 1; r < all.length; r++) {
    const cells = all[r];
    if (cells.every((c) => c.trim() === "")) continue; // blank line

    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      if (headers[c]) obj[headers[c]] = cells[c] ?? "";
    }
    rows.push(obj);
  }

  return { headers, rows };
}
