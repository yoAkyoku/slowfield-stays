// usage: node compare.mjs <beforeDir> <afterDir>
// SSIM per page (full-page JPEGs). Flags pages whose height changed or SSIM < 0.995.
import fs from 'fs'; import { spawnSync } from 'child_process'; import ff from 'ffmpeg-static';
const [a, b] = process.argv.slice(2);
const ma = JSON.parse(fs.readFileSync(a + '/manifest.json', 'utf8'));
const mb = new Map(JSON.parse(fs.readFileSync(b + '/manifest.json', 'utf8')).map(e => [e.index, e]));
let bad = 0;
for (const e of ma) {
  const o = mb.get(e.index); if (!o) { console.log('MISSING', e.url); bad++; continue; }
  if (Math.abs(o.height - e.height) > 2) { console.log(`HEIGHT ${e.url} ${e.height} -> ${o.height}`); bad++; continue; }
  const r = spawnSync(ff, ['-v', 'info', '-i', e.file, '-i', o.file, '-lavfi', '[0:v]scale=960:-2[x];[1:v]scale=960:-2[y];[x][y]ssim', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /All:([\d.]+)/.exec(r.stderr || ''); const s = m ? +m[1] : 0;
  if (s < 0.995) { console.log(`DIFF ${e.url} ssim=${s}`); bad++; }
}
console.log(`${ma.length} pages, ${bad} flagged`);
