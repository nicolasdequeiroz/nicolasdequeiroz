import fs from "fs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

// Idiomas: o HTML sai em inglês (padrão) e leva o português em data-pt /
// data-pt-<atributo> (js/i18n.js faz a troca). works.json guarda o português;
// data/works.en.json guarda a tradução por slug, no mesmo formato (blocks e
// credits alinhados por posição). Sem tradução, o texto em português fica nos dois.
const UI = {
  services: ["Services", "Serviços"],
  industry: ["Industry", "Setor"],
  location: ["Location", "Local"],
  year: ["Year", "Ano"],
  visit: ["Visit site ↗", "Visitar site ↗"],
  credits: ["Credits", "Créditos"],
  next: ["Next project", "Próximo projeto"],
};

// Texto: conteúdo em inglês + data-pt com o português.
function tx(en, pt) {
  const text = en ?? pt;
  const attr = pt != null && pt !== text ? ` data-pt="${escapeHtml(pt)}"` : "";
  return { text: escapeHtml(text), attr };
}

// Atributo traduzível (alt, aria-label…).
function at(name, en, pt) {
  const value = en ?? pt ?? "";
  const alt = pt != null && pt !== value ? ` data-pt-${name}="${escapeHtml(pt)}"` : "";
  return ` ${name}="${escapeHtml(value)}"${alt}`;
}

function ui(key) {
  const [en, pt] = UI[key];
  return tx(en, pt);
}

function renderHero(hero, enHero, assetPrefix) {
  // view-transition-name "work-media" casa com o card central do carrossel.
  const vt = ' style="view-transition-name: work-media"';
  const alt = at("alt", enHero?.alt, hero.alt);
  if (hero.type === "video") {
    return `<div class="work-hero"><video class="work-media"${vt} src="${assetPrefix}${hero.src}" autoplay muted loop playsinline${at("aria-label", enHero?.alt, hero.alt)}></video></div>`;
  }
  const img = `<img class="work-media"${vt} src="${assetPrefix}${hero.src}"${alt} fetchpriority="high" decoding="async">`;
  if (!hero.mobile) return `<div class="work-hero">${img}</div>`;
  // Capa vertical no celular. Mesmo breakpoint do carrossel (MOBILE_MEDIA),
  // para o card central e o hero mostrarem a mesma imagem no morph.
  return `<div class="work-hero"><picture><source media="${MOBILE_MEDIA}" srcset="${assetPrefix}${hero.mobile}">${img}</picture></div>`;
}

const MOBILE_MEDIA = "(max-width: 767.98px)";

// Intro editorial (referência Locomotive): título display, meta em colunas
// rotuladas e tagline + descrição em grid assimétrico.
function renderIntro(work, en) {
  const label = (key) => {
    const l = ui(key);
    return `<span class="work-block-label"${l.attr}>${l.text}</span>`;
  };

  const services = work.services
    .map((s, i) => {
      const t = tx(en.services?.[i], s);
      return `<span${t.attr}>${t.text}</span>`;
    })
    .join("<br>");

  const industry = work.industry ? tx(en.industry, work.industry) : null;
  const location = work.location ? tx(en.location, work.location) : null;

  const metaItems = [
    { label: label("services"), value: services },
    industry ? { label: label("industry"), value: `<span${industry.attr}>${industry.text}</span>` } : null,
    location ? { label: label("location"), value: `<span${location.attr}>${location.text}</span>` } : null,
    { label: label("year"), value: `©${work.year}` },
  ].filter(Boolean);

  const meta = metaItems
    .map((item) => `<div class="work-meta-item">${item.label}<p>${item.value}</p></div>`)
    .join("\n      ");

  const tag = work.tagline ? tx(en.tagline, work.tagline) : null;
  const tagline = tag ? `<p class="work-tagline"${tag.attr}>${tag.text}</p>` : "";
  const desc = tx(en.description, work.description);
  const visit = ui("visit");
  const website = work.website
    ? `\n        <a class="work-website" href="${escapeHtml(work.website)}" target="_blank" rel="noopener"${visit.attr}>${visit.text}</a>`
    : "";

  return `<section class="work-intro">
    <h1 class="work-title">${escapeHtml(work.title)}</h1>
    <div class="work-intro-meta">
      ${meta}
    </div>
    <div class="work-intro-body${tagline ? "" : " work-intro-body--no-tagline"}">
      ${tagline}
      <div class="work-intro-text">
        <p class="work-description"${desc.attr}>${desc.text}</p>${website}
      </div>
    </div>
  </section>`;
}

// Proporções padronizadas das mídias (ver referências Locomotive/Ravi/Namma):
// 16:9 → telas de UI/web · 4:3 → fotografia/branding · 4:5 → duplas retrato.
const RATIO_CLASS = {
  "16:9": "work-r-169",
  "4:3": "work-r-43",
  "7:5": "work-r-75",
  "4:5": "work-r-45",
};

function ratioClass(ratio, fallback) {
  return RATIO_CLASS[ratio ?? fallback] ?? "";
}

function renderLabel(label, enLabel) {
  if (!label) return "";
  const t = tx(enLabel, label);
  return `<span class="work-block-label"${t.attr}>${t.text}</span>`;
}

function renderCaption(caption, enCaption) {
  if (!caption) return "";
  const t = tx(enCaption, caption);
  return `<figcaption${t.attr}>${t.text}</figcaption>`;
}

function renderMediaEl(item, enItem, assetPrefix, fallbackRatio) {
  const cls = ratioClass(item.ratio, fallbackRatio);
  const classAttr = cls ? ` class="${cls}"` : "";
  const isVideo = item.type === "video" || /\.(mp4|webm)$/i.test(item.src);
  if (isVideo) {
    const poster = item.poster ? ` poster="${assetPrefix}${item.poster}"` : "";
    return `<video${classAttr} src="${assetPrefix}${item.src}" autoplay muted loop playsinline preload="metadata"${poster}${at("aria-label", enItem?.alt, item.alt || "")}></video>`;
  }
  return `<img${classAttr} src="${assetPrefix}${item.src}"${at("alt", enItem?.alt, item.alt || "")} loading="lazy" decoding="async">`;
}

function renderBlocks(blocks, enBlocks = [], assetPrefix) {
  if (!blocks?.length) return "";

  const html = blocks
    .map((block, i) => {
      const e = enBlocks[i] ?? {};
      switch (block.type) {
        case "image":
        case "video":
          return `<figure class="work-block work-block--media">${renderMediaEl(block, e, assetPrefix, "16:9")}${renderCaption(block.caption, e.caption)}</figure>`;
        case "pair":
          return `<div class="work-block work-block--pair">${block.items
            .map(
              (item, j) =>
                `<figure>${renderMediaEl(item, e.items?.[j], assetPrefix, "4:5")}${renderCaption(item.caption, e.items?.[j]?.caption)}</figure>`
            )
            .join("")}</div>`;
        case "statement":
        case "text": {
          const t = tx(e.text, block.text);
          return `<div class="work-block work-block--${block.type}">${renderLabel(block.label, e.label)}<p${t.attr}>${t.text}</p></div>`;
        }
        case "capture":
          return `<figure class="work-block work-block--capture"><img src="${assetPrefix}${block.src}"${at("alt", e.alt, block.alt || "")} loading="lazy" decoding="async">${renderCaption(block.caption, e.caption)}</figure>`;
        default:
          return "";
      }
    })
    .join("\n    ");

  return `<div class="work-blocks">\n    ${html}\n  </div>`;
}

// Depoimento, créditos e link do site ao vivo — todos opcionais.
function renderOutro(work, en) {
  const parts = [];

  if (work.testimonial?.quote) {
    const q = tx(en.testimonial?.quote, work.testimonial.quote);
    const cite = [work.testimonial.name, work.testimonial.role]
      .filter(Boolean)
      .map((v) => escapeHtml(v))
      .join(" · ");
    parts.push(`<blockquote class="work-testimonial">
      <p>“<span${q.attr}>${q.text}</span>”</p>
      ${cite ? `<cite>${cite}</cite>` : ""}
    </blockquote>`);
  }

  if (work.credits?.length) {
    const rows = work.credits
      .map((c, i) => {
        const role = tx(en.credits?.[i]?.role, c.role);
        return `<div class="work-credit"><dt${role.attr}>${role.text}</dt><dd>${escapeHtml(c.name)}</dd></div>`;
      })
      .join("\n        ");
    const label = ui("credits");
    parts.push(`<div class="work-credits">
      <span class="work-block-label"${label.attr}>${label.text}</span>
      <dl>
        ${rows}
      </dl>
    </div>`);
  }

  if (work.website) {
    const visit = ui("visit");
    parts.push(
      `<a class="work-visit" href="${escapeHtml(work.website)}" target="_blank" rel="noopener"${visit.attr}>${visit.text}</a>`
    );
  }

  if (!parts.length) return "";
  return `<section class="work-outro">\n    ${parts.join("\n    ")}\n  </section>`;
}

// Next case fullscreen (referência Locomotive): hero do próximo projeto em
// fundo preto, com overlay escuro e o título por cima.
function renderNextCase(next, assetPrefix) {
  if (!next) return "";
  const label = ui("next");
  return `<a href="../${next.slug}/" class="work-next" aria-label="${label.text}: ${escapeHtml(next.title)}" data-pt-aria-label="${escapeHtml(UI.next[1])}: ${escapeHtml(next.title)}">
    <img class="work-next-media" src="${assetPrefix}${next.hero.src}" alt="" loading="lazy" decoding="async">
    <span class="work-next-content">
      <span class="work-block-label"${label.attr}>${label.text}</span>
      <span class="work-next-title">${escapeHtml(next.title)}</span>
    </span>
  </a>`;
}

const BLOCK_TYPES = new Set(["image", "video", "pair", "statement", "text", "capture"]);

function validateWorks(data) {
  const slugs = new Set();
  for (const work of data.works) {
    if (!work.slug || !work.title || !work.thumb || !work.hero?.src) {
      throw new Error(`Work inválido: ${work.slug || work.title || "sem slug"}`);
    }
    if (slugs.has(work.slug)) {
      throw new Error(`Slug duplicado: ${work.slug}`);
    }
    slugs.add(work.slug);

    for (const block of work.blocks ?? []) {
      if (!BLOCK_TYPES.has(block.type)) {
        throw new Error(`Bloco desconhecido "${block.type}" em ${work.slug}`);
      }
      if (block.type === "pair" && block.items?.length !== 2) {
        throw new Error(`Bloco "pair" em ${work.slug} precisa de exatamente 2 items`);
      }
      if (block.ratio && !RATIO_CLASS[block.ratio]) {
        throw new Error(`Ratio "${block.ratio}" inválido em ${work.slug} (use 16:9, 4:3, 7:5 ou 4:5)`);
      }
    }
  }
}

function buildWorkPages(data, enOverlay) {
  const template = fs.readFileSync(
    path.join(root, "templates/work.html"),
    "utf8"
  );
  const assetPrefix = "../../";
  const year = new Date().getFullYear();

  data.works.forEach((work, index) => {
    // Cíclico: o último case aponta de volta para o primeiro.
    const nextWork = data.works[(index + 1) % data.works.length];
    const next = nextWork.slug === work.slug ? null : nextWork;
    const canonical = `${data.site.url}/work/${work.slug}/`;
    // Preview de link: JPG 1200×630 do case (og.jpg) — webp e GIF não aparecem
    // em vários apps. Sem ele, cai no hero.
    const ogFile = `assets/works/${work.slug}/og.jpg`;
    const ogImage = `${data.site.url}/${fs.existsSync(path.join(root, ogFile)) ? ogFile : work.hero.src}`;

    const en = enOverlay[work.slug] ?? {};
    const desc = summarize(en.description ?? work.description);
    const descPt = summarize(work.description);
    const html = renderTemplate(template, {
      title: escapeHtml(work.title),
      description: escapeHtml(desc),
      descriptionPt: desc === descPt ? "" : ` data-pt-content="${escapeHtml(descPt)}"`,
      canonical,
      ogImage,
      hero: renderHero(work.hero, en.hero, assetPrefix),
      intro: renderIntro(work, en),
      blocks: renderBlocks(work.blocks, en.blocks, assetPrefix),
      outro: renderOutro(work, en),
      nextCase: renderNextCase(next, assetPrefix),
      year,
    });

    const outDir = path.join(root, "work", work.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), versionAssets(html));
  });
}

// Meta description: buscadores e previews cortam por volta de 155 caracteres,
// então encurtamos na última palavra inteira.
function summarize(text, max = 155) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  // Prefere terminar numa frase inteira, se houver uma longa o bastante.
  const sentenceEnd = cut.lastIndexOf(". ");
  if (sentenceEnd >= 60) return cut.slice(0, sentenceEnd + 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,.;:—–-]+$/, "")}…`;
}

// sitemap.xml com a home e todas as páginas de work (sem lastmod: mudaria a
// cada build e sujaria o diff).
function writeSitemap(data) {
  const urls = [`${data.site.url}/`, `${data.site.url}/sobre/`, ...data.works.map((w) => `${data.site.url}/work/${w.slug}/`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>
`;
  fs.writeFileSync(path.join(root, "sitemap.xml"), xml);
  return urls.length;
}

// Cache busting: cada CSS/JS local (e imagem de assets/site/, como a foto da sobre) referenciado no HTML ganha ?v=<hash do
// conteúdo>. O GitHub Pages guarda arquivos em cache por 10 min; sem isso, um
// deploy pode juntar o CSS novo com o JS velho no navegador do visitante.
const assetHashes = new Map();

function assetHash(rel) {
  if (!assetHashes.has(rel)) {
    const file = path.join(root, rel);
    const hash = fs.existsSync(file)
      ? crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 8)
      : null;
    assetHashes.set(rel, hash);
  }
  return assetHashes.get(rel);
}

function versionAssets(html) {
  return html.replace(
    /((?:href|src|data-module)=")((?:\.\.\/)*|\/)?((?:css|js)\/[\w.-]+\.(?:css|js)|assets\/site\/[\w.-]+\.(?:webp|png|jpg))(?:\?v=[a-f0-9]+)?(")/g,
    (match, attr, prefix = "", rel, quote) => {
      const hash = assetHash(rel);
      return hash ? `${attr}${prefix}${rel}?v=${hash}${quote}` : match;
    }
  );
}

// Páginas estáticas (não saem do template) recebem o versionamento no lugar.
const STATIC_PAGES = ["index.html", "sobre/index.html", "404.html"];

function versionStaticPages() {
  let count = 0;
  for (const rel of STATIC_PAGES) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, "utf8");
    const next = versionAssets(html);
    if (next !== html) fs.writeFileSync(file, next);
    count += 1;
  }
  return count;
}

// Mantém os dados embutidos (inline) no index.html sincronizados com works.json.
// O carrossel lê esse JSON de forma síncrona, o que é necessário para o morph
// do hero de volta ao card funcionar na View Transition de retorno.
function injectHomeData(data) {
  const indexPath = path.join(root, "index.html");
  if (!fs.existsSync(indexPath)) return false;

  const json = JSON.stringify({ site: data.site, works: data.works });
  const re = /(<script type="application\/json" id="works-data">)[\s\S]*?(<\/script>)/;
  let html = fs.readFileSync(indexPath, "utf8");
  if (!re.test(html)) return false;

  html = html.replace(re, `$1${json}$2`);
  fs.writeFileSync(indexPath, html);
  return true;
}

function main() {
  const dataPath = path.join(root, "data/works.json");
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

  const enPath = path.join(root, "data/works.en.json");
  const enOverlay = fs.existsSync(enPath) ? JSON.parse(fs.readFileSync(enPath, "utf8")) : {};

  validateWorks(data);
  buildWorkPages(data, enOverlay);
  const injected = injectHomeData(data);
  const sitemapCount = writeSitemap(data);
  const versioned = versionStaticPages();

  console.log(`✓ ${data.works.length} páginas geradas em work/`);
  console.log(injected ? "✓ works-data inline sincronizado no index.html" : "⚠ index.html sem bloco works-data");
  console.log(`✓ sitemap.xml com ${sitemapCount} URLs`);
  console.log(`✓ CSS/JS versionados (?v=hash) em ${versioned} páginas estáticas + work/`);
}

main();
