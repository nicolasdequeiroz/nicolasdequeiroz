// Baixa as capas dos discos de data/vinis.json (iTunes Search API, sem chave)
// para assets/vinis/<slug>.jpg e grava o caminho no campo "capa".
// Uso: node scripts/vinis-capas.mjs   (só busca o que ainda não tem capa)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "data/vinis.json");
const outDir = path.join(root, "assets/vinis");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

const slugify = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

fs.mkdirSync(outDir, { recursive: true });
let changed = 0;

for (const disco of data.discos) {
  if (disco.capa && fs.existsSync(path.join(root, disco.capa))) continue;
  const term = encodeURIComponent(`${disco.artista} ${disco.album}`);
  // Prefere o álbum com o mesmo título (e do mesmo artista), não remixes/singles.
  const norm = (s) => slugify(s ?? "");
  const album = norm(disco.album);
  const artist = norm(disco.artista).split("-")[0];
  const score = (r) =>
    (norm(r.collectionName) === album ? 4 : norm(r.collectionName).startsWith(album) ? 2 : 0) +
    (norm(r.artistName).includes(artist) ? 2 : 0) -
    (/single|remix|ep\b/i.test(r.collectionName) ? 3 : 0);

  // Loja brasileira primeiro; se o título não bater, tenta a americana.
  let hit = null;
  for (const country of ["br", "us"]) {
    const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=album&limit=15&country=${country}`);
    const results = res.ok ? (await res.json()).results ?? [] : [];
    const best = results.sort((a, b) => score(b) - score(a))[0];
    if (best && score(best) >= 4) {
      hit = best;
      break;
    }
  }
  if (!hit?.artworkUrl100) {
    console.warn(`⚠ sem capa: ${disco.artista} — ${disco.album}`);
    continue;
  }
  const url = hit.artworkUrl100.replace("100x100bb", "600x600bb");
  const file = `assets/vinis/${slugify(`${disco.artista}-${disco.album}`)}.jpg`;
  const img = await fetch(url);
  fs.writeFileSync(path.join(root, file), Buffer.from(await img.arrayBuffer()));
  disco.capa = file;
  changed += 1;
  console.log(`✓ ${disco.album} ← ${hit.collectionName}`);
}

if (changed) fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`${changed} capa(s) nova(s).`);
