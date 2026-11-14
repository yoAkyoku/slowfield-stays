// usage: node build-video.mjs <shotsdir> <out.mp4> [title]
// Each page: hold at top, ease-scroll to the bottom, hold; fixed chrome captured in its
// scrolled state is pinned on top while the page moves; short fades between pages.
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
import ff from 'ffmpeg-static';
const [dir, out, title] = process.argv.slice(2);
const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const W = 1920, VH = 1080, FPS = 30, SPEED = +(process.env.SPEED || 650), HOLD = 1.3, FADE = 0.35;
const ffpath = s => path.resolve(s).split(path.sep).join('/').replace(/^([A-Za-z]):/, '$1\\:');
const font = ffpath('C:\\Windows\\Fonts\\msjhbd.ttc');
const segDir = path.resolve(dir, 'seg'); fs.mkdirSync(segDir, { recursive: true });
const run = args => execFileSync(ff, ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const enc = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(FPS)];
const segs = [];
if (title) {
  const tf = path.join(segDir, 'title.txt'); fs.writeFileSync(tf, title);
  const f = path.join(segDir, '000.mp4');
  run(['-f', 'lavfi', '-i', `color=c=0x1f3a2e:s=${W}x${VH}:d=3:r=${FPS}`, '-vf',
    `drawtext=fontfile='${font}':textfile='${ffpath(tf)}':fontcolor=0xf3efe6:fontsize=72:x=(w-tw)/2:y=(h-th)/2,fade=t=in:d=0.5,fade=t=out:st=2.5:d=0.5`, ...enc, f]);
  segs.push(f);
}
const only = process.env.ONLY ? new Set(process.env.ONLY.split(',').map(Number)) : null;
m.forEach((it, i) => {
  const f = path.join(segDir, `${String(i + 1).padStart(3, '0')}.mp4`);
  segs.push(f);
  if (only && !only.has(it.index) && fs.existsSync(f)) return;
  const H = Math.max(it.height, VH);
  const dist = H - VH;
  const D = dist > 0 ? Math.max(dist / SPEED, 1.2) : 0;
  const T = HOLD * 2 + D;
  const lf = path.join(segDir, `${i}.txt`);
  fs.writeFileSync(lf, `${it.label}   ${decodeURI(it.url)}`);
  const pr = `clip((t-${HOLD})/${D || 1},0,1)`;
  const y = dist > 0 ? `${dist}*(${pr}*${pr}*(3-2*${pr}))` : '0';
  const inputs = ['-loop', '1', '-framerate', String(FPS), '-t', T.toFixed(2), '-i', path.resolve(it.file)];
  let g = `[0:v]scale=${W}:-2,pad=${W}:'max(ih,${VH})':0:0:color=0xf4f4f1,crop=${W}:${VH}:0:'${y}'[base]`;
  let last = 'base';
  const ov = (it.overlays || []).filter(o => o.w > 0 && o.h > 0);
  if (dist > 0 && it.scrolled && ov.length) {
    inputs.push('-loop', '1', '-framerate', String(FPS), '-t', T.toFixed(2), '-i', path.resolve(it.scrolled));
    g += `;[1:v]split=${ov.length}${ov.map((_, k) => `[s${k}]`).join('')}`;
    // pin chrome once the page has actually moved (~40px), as the browser would
    const start = (HOLD + Math.min(0.35, D * 0.1)).toFixed(2);
    ov.forEach((o, k) => {
      g += `;[s${k}]crop=${o.w}:${o.h}:${o.x}:${o.y}[c${k}];[${last}][c${k}]overlay=${o.x}:${o.y}:enable='gte(t,${start})'[o${k}]`;
      last = `o${k}`;
    });
  }
  g += `;[${last}]drawtext=fontfile='${font}':textfile='${ffpath(lf)}':fontcolor=white:fontsize=26:box=1:boxcolor=0x000000@0.55:boxborderw=14:x=w-tw-46:y=h-th-40,` +
    `fade=t=in:d=${FADE},fade=t=out:st=${(T - FADE).toFixed(2)}:d=${FADE}[v]`;
  run([...inputs, '-filter_complex', g, '-map', '[v]', ...enc, f]);
  process.stdout.write(`${i + 1}/${m.length} `);
});
const lst = path.join(segDir, 'list.txt');
fs.writeFileSync(lst, segs.map(s => `file '${s.split(path.sep).join('/')}'`).join('\n'));
run(['-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', out]);
console.log('\nwrote', out);
