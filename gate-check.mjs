// Local replica of the token-radar-01 gate's 7 rows, from RULES.txt.
// Usage: node gate-check.mjs <output-dir> <snapshot.json>
// Exit 0 when every row passes, 1 otherwise. Prints one line per row.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-board.ts';

const out = process.argv[2];
const snapFile = process.argv[3];
if (!out || !snapFile) {
  process.stderr.write('usage: node gate-check.mjs <output-dir> <snapshot.json>\n');
  process.exit(2);
}
const snapshot = JSON.parse(readFileSync(snapFile, 'utf8'));
const snapSlugs = new Set(snapshot.protocols.map((p) => p.slug));
const watchlist = snapshot.watchlist;

let failures = 0;
const row = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(16)} ${detail}`);
  if (!ok) failures++;
};

// 1. dashboard_files
{
  const dir = join(out, 'dashboard');
  const files = readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile());
  const total = files.reduce((s, f) => s + statSync(join(dir, f)).size, 0);
  const hasHtml = files.includes('index.html');
  const hasCss = files.some((f) => f.endsWith('.css'));
  const hasJs = files.some((f) => f.endsWith('.js'));
  let net = null;
  for (const f of files) {
    const text = readFileSync(join(dir, f), 'utf8');
    if (/https?:\/\//.test(text)) { net = f; break; }
  }
  row('dashboard_files', hasHtml && hasCss && hasJs && files.length <= 400 && total <= 4_194_304 && !net,
    `${files.length} files, ${total} bytes, html=${hasHtml} css=${hasCss} js=${hasJs}${net ? `, network URL in ${net}` : ''}`);
}

// 2. board_file + 3. sorted_by_value + 4. coverage + 5. farm_steps
const boardRaw = readFileSync(join(out, 'board.json'));
const board = JSON.parse(boardRaw.toString('utf8'));
const rows = Array.isArray(board) ? board : board.rows;
{
  let ok = rows.length >= 100 && rows.length <= 4000 && boardRaw.length <= 8_388_608;
  let bad = null;
  const seenSlugs = new Set();
  const values = new Set();
  for (const r of rows) {
    values.add(r.implied_value_usd);
    if (!snapSlugs.has(r.slug)) { ok = false; bad = `slug ${r.slug} not in snapshot`; break; }
    if (typeof r.name !== 'string' || !r.name) { ok = false; bad = `row ${r.slug} has no name`; break; }
    if (!Number.isSafeInteger(r.rank) || r.rank <= 0) { ok = false; bad = `row ${r.slug} bad rank`; break; }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) { ok = false; bad = `row ${r.slug} bad implied_value_usd`; break; }
    if (seenSlugs.has(r.slug)) { ok = false; bad = `duplicate slug ${r.slug}`; break; }
    seenSlugs.add(r.slug);
    if (!Array.isArray(r.farm_steps)) { ok = false; bad = `row ${r.slug} has no farm_steps`; break; }
  }
  if (values.size < 2) { ok = false; bad = 'all implied values identical'; }
  row('board_file', ok, `${rows.length} rows, ${boardRaw.length} bytes${bad ? ` — ${bad}` : ''}`);

  // sorted_by_value
  let sorted = true;
  let sortedBad = null;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].rank !== i + 1) { sorted = false; sortedBad = `rank at index ${i} is ${rows[i].rank}, expected ${i + 1}`; break; }
    if (i > 0 && rows[i].implied_value_usd > rows[i - 1].implied_value_usd) { sorted = false; sortedBad = `implied rises at rank ${rows[i].rank}`; break; }
  }
  if (values.size < 2) { sorted = false; sortedBad = 'all implied values identical'; }
  row('sorted_by_value', sorted, sortedBad ?? 'ranks 1..N, implied non-increasing');

  // coverage
  const missing = watchlist.filter((s) => !seenSlugs.has(s));
  row('coverage', missing.length === 0, `watchlist ${watchlist.length}, missing ${missing.length}${missing.length ? `: ${missing.slice(0, 5).join(', ')}` : ''}`);

  // farm_steps
  let farmOk = true;
  let farmBad = null;
  for (const r of rows) {
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) { farmOk = false; farmBad = `${r.slug}: ${r.farm_steps.length} steps`; break; }
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) { farmOk = false; farmBad = `${r.slug}: step ${t.length} chars`; break; }
    }
    if (!farmOk) break;
  }
  row('farm_steps', farmOk, farmBad ?? `${rows.length} rows, 3-12 steps each, 20-600 chars`);
}

// 6. screenshots
{
  const dir = join(out, 'screenshots');
  const files = readdirSync(dir).filter((f) => !f.startsWith('.') && statSync(join(dir, f)).isFile());
  let ok = files.length >= 3 && files.length <= 4;
  let detail = `${files.length} images`;
  for (const f of files) {
    const buf = readFileSync(join(dir, f));
    if (buf.length > 524_288) { ok = false; detail += `, ${f} is ${buf.length} bytes`; break; }
    // PNG header: width/height at bytes 16/20 (big-endian). JPEG: parse SOF markers.
    let w = 0, h = 0;
    if (buf[0] === 0x89 && buf[1] === 0x50) { w = buf.readUInt32BE(16); h = buf.readUInt32BE(20); }
    else if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i < buf.length - 1) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          h = buf.readUInt16BE(i + 5); w = buf.readUInt16BE(i + 7); break;
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    } else { ok = false; detail += `, ${f} is not PNG/JPEG`; break; }
    if (!w || !h) { ok = false; detail += `, ${f} has no readable dimensions`; break; }
    const long = Math.max(w, h), short = Math.min(w, h);
    if (long > 1440 || short < 800) { ok = false; detail += `, ${f} is ${w}x${h}`; break; }
    detail += `, ${f} ${w}x${h} ${buf.length}B`;
  }
  row('screenshots', ok, detail);
}

// 7. dossier_matches
{
  // buildDossier returns bytes (a Buffer/Uint8Array): compare bytes, not a string to a Buffer.
  const expected = Buffer.from(buildDossier(out, { text_max_bytes: 65_536, screenshots: { max: 4, max_bytes: 524_288 }, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));
  const actual = readFileSync(join(out, 'dossier.json'));
  const ok = actual.equals(expected) && actual.length <= 1_572_864;
  row('dossier_matches', ok, `dossier ${actual.length} bytes, byte-identical to buildDossier output: ${actual.equals(expected)}`);
}

console.log(failures === 0 ? 'GATE: all 7 rows pass' : `GATE: ${failures} row(s) FAIL`);
process.exit(failures === 0 ? 0 : 1);
