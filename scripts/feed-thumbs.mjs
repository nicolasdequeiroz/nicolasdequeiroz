// Miniaturas do mural da página Feed: cada quadro tem ~260px, então as imagens
// dos cases (até 2400px) viram WebP de 640px em assets/feed/. Imagens pesadas
// decodificando durante a animação causavam quadros em branco. Rode depois de
// adicionar imagens a um case:  npm run feed-thumbs   (precisa de ffmpeg e cwebp).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "data/works.json"), "utf8"));
const out = path.join(root, "assets/feed");
fs.mkdirSync(out, { recursive: true });

export const thumbName = (src) => src.replace(/^assets\/works\//, "").replace(/\//g, "__").replace(/\.\w+$/, ".webp");
const isStill = (s) => typeof s === "string" && /\.(webp|jpe?g|png)$/i.test(s);

const srcs = new Set();
for (const w of data.works) {
  const add = (s) => isStill(s) && fs.existsSync(path.join(root, s)) && srcs.add(s);
  add(w.thumb);
  if (w.hero?.type === "image") add(w.hero.src);
  for (const b of w.blocks ?? []) {
    if (b.feed === false) continue;
    add(b.src);
    for (const it of b.items ?? []) add(it.src);
  }
}

let made = 0;
const skipped = [];
const keep = new Set();
for (const s of srcs) {
  const dest = path.join(out, thumbName(s));
  keep.add(path.basename(dest));
  const from = path.join(root, s);
  if (fs.existsSync(dest) && fs.statSync(dest).mtimeMs >= fs.statSync(from).mtimeMs) continue;
  const png = dest.replace(/\.webp$/, ".tmp.png");
  // webp de origem pode vir com recurso que o dwebp não lê; o ffmpeg decodifica tudo.
  try {
    execFileSync("ffmpeg", ["-v", "quiet", "-y", "-i", from, "-vf", "scale='min(640,iw)':-2:flags=lanczos", "-frames:v", "1", png], { stdio: "ignore" });
    execFileSync("cwebp", ["-q", "78", "-quiet", png, "-o", dest]);
    made++;
  } catch {
    skipped.push(s); // formato que o ffmpeg não lê: o feed usa o original
  } finally {
    if (fs.existsSync(png)) fs.unlinkSync(png);
  }
}
for (const f of fs.readdirSync(out)) if (!keep.has(f)) fs.unlinkSync(path.join(out, f)); // órfãs
console.log(`✓ ${srcs.size - skipped.length} miniaturas em assets/feed/ (${made} novas)`);
if (skipped.length) console.log(`⚠ sem miniatura (usa o original): ${skipped.join(", ")}`);
