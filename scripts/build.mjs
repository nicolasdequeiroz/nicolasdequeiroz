import fs from "fs";
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

function renderHero(hero, assetPrefix) {
  // view-transition-name "work-media" casa com o card central do carrossel.
  const vt = ' style="view-transition-name: work-media"';
  if (hero.type === "video") {
    return `<div class="work-hero"><video class="work-media"${vt} src="${assetPrefix}${hero.src}" autoplay muted loop playsinline aria-label="${escapeHtml(hero.alt)}"></video></div>`;
  }
  return `<div class="work-hero"><img class="work-media"${vt} src="${assetPrefix}${hero.src}" alt="${escapeHtml(hero.alt)}" fetchpriority="high" decoding="async"></div>`;
}

// Intro editorial (referência Locomotive): título display, meta em colunas
// rotuladas e tagline + descrição em grid assimétrico.
function renderIntro(work) {
  const metaItems = [
    { label: "Serviços", value: work.services.map((s) => escapeHtml(s)).join("<br>") },
    work.industry ? { label: "Setor", value: escapeHtml(work.industry) } : null,
    work.location ? { label: "Local", value: escapeHtml(work.location) } : null,
    { label: "Ano", value: `©${work.year}` },
  ].filter(Boolean);

  const meta = metaItems
    .map(
      (item) =>
        `<div class="work-meta-item"><span class="work-block-label">${item.label}</span><p>${item.value}</p></div>`
    )
    .join("\n      ");

  const tagline = work.tagline
    ? `<p class="work-tagline">${escapeHtml(work.tagline)}</p>`
    : "";
  const website = work.website
    ? `\n        <a class="work-website" href="${escapeHtml(work.website)}" target="_blank" rel="noopener">Visitar site ↗</a>`
    : "";

  return `<section class="work-intro">
    <h1 class="work-title">${escapeHtml(work.title)}</h1>
    <div class="work-intro-meta">
      ${meta}
    </div>
    <div class="work-intro-body${tagline ? "" : " work-intro-body--no-tagline"}">
      ${tagline}
      <div class="work-intro-text">
        <p class="work-description">${escapeHtml(work.description)}</p>${website}
      </div>
    </div>
  </section>`;
}

// Proporções padronizadas das mídias (ver referências Locomotive/Ravi/Namma):
// 16:9 → telas de UI/web · 4:3 → fotografia/branding · 4:5 → duplas retrato.
const RATIO_CLASS = {
  "16:9": "work-r-169",
  "4:3": "work-r-43",
  "4:5": "work-r-45",
};

function ratioClass(ratio, fallback) {
  return RATIO_CLASS[ratio ?? fallback] ?? "";
}

function renderLabel(label) {
  return label
    ? `<span class="work-block-label">${escapeHtml(label)}</span>`
    : "";
}

function renderCaption(caption) {
  return caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : "";
}

function renderMediaEl(item, assetPrefix, fallbackRatio) {
  const cls = ratioClass(item.ratio, fallbackRatio);
  const classAttr = cls ? ` class="${cls}"` : "";
  const isVideo = item.type === "video" || /\.(mp4|webm)$/i.test(item.src);
  if (isVideo) {
    const poster = item.poster ? ` poster="${assetPrefix}${item.poster}"` : "";
    return `<video${classAttr} src="${assetPrefix}${item.src}" autoplay muted loop playsinline preload="metadata"${poster} aria-label="${escapeHtml(item.alt || "")}"></video>`;
  }
  return `<img${classAttr} src="${assetPrefix}${item.src}" alt="${escapeHtml(item.alt || "")}" loading="lazy" decoding="async">`;
}

function renderBlocks(blocks, assetPrefix) {
  if (!blocks?.length) return "";

  const html = blocks
    .map((block) => {
      switch (block.type) {
        case "image":
        case "video":
          return `<figure class="work-block work-block--media">${renderMediaEl(block, assetPrefix, "16:9")}${renderCaption(block.caption)}</figure>`;
        case "pair":
          return `<div class="work-block work-block--pair">${block.items
            .map(
              (item) =>
                `<figure>${renderMediaEl(item, assetPrefix, "4:5")}${renderCaption(item.caption)}</figure>`
            )
            .join("")}</div>`;
        case "statement":
          return `<div class="work-block work-block--statement">${renderLabel(block.label)}<p>${escapeHtml(block.text)}</p></div>`;
        case "text":
          return `<div class="work-block work-block--text">${renderLabel(block.label)}<p>${escapeHtml(block.text)}</p></div>`;
        case "capture":
          return `<figure class="work-block work-block--capture"><img src="${assetPrefix}${block.src}" alt="${escapeHtml(block.alt || "")}" loading="lazy" decoding="async">${renderCaption(block.caption)}</figure>`;
        default:
          return "";
      }
    })
    .join("\n    ");

  return `<div class="work-blocks">\n    ${html}\n  </div>`;
}

// Depoimento, créditos e link do site ao vivo — todos opcionais.
function renderOutro(work) {
  const parts = [];

  if (work.testimonial?.quote) {
    const cite = [work.testimonial.name, work.testimonial.role]
      .filter(Boolean)
      .map((v) => escapeHtml(v))
      .join(" · ");
    parts.push(`<blockquote class="work-testimonial">
      <p>“${escapeHtml(work.testimonial.quote)}”</p>
      ${cite ? `<cite>${cite}</cite>` : ""}
    </blockquote>`);
  }

  if (work.credits?.length) {
    const rows = work.credits
      .map(
        (c) =>
          `<div class="work-credit"><dt>${escapeHtml(c.role)}</dt><dd>${escapeHtml(c.name)}</dd></div>`
      )
      .join("\n        ");
    parts.push(`<div class="work-credits">
      <span class="work-block-label">Créditos</span>
      <dl>
        ${rows}
      </dl>
    </div>`);
  }

  if (work.website) {
    parts.push(
      `<a class="work-visit" href="${escapeHtml(work.website)}" target="_blank" rel="noopener">Visitar site ↗</a>`
    );
  }

  if (!parts.length) return "";
  return `<section class="work-outro">\n    ${parts.join("\n    ")}\n  </section>`;
}

// Next case fullscreen (referência Locomotive): hero do próximo projeto em
// fundo preto, com overlay escuro e o título por cima.
function renderNextCase(next, assetPrefix) {
  if (!next) return "";
  return `<a href="../${next.slug}/" class="work-next" aria-label="Próximo projeto: ${escapeHtml(next.title)}">
    <img class="work-next-media" src="${assetPrefix}${next.hero.src}" alt="" loading="lazy" decoding="async">
    <span class="work-next-content">
      <span class="work-block-label">Próximo projeto</span>
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
        throw new Error(`Ratio "${block.ratio}" inválido em ${work.slug} (use 16:9, 4:3 ou 4:5)`);
      }
    }
  }
}

function buildWorkPages(data) {
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
    const ogImage = `${data.site.url}/${work.hero.src}`;

    const html = renderTemplate(template, {
      title: escapeHtml(work.title),
      description: escapeHtml(work.description),
      canonical,
      ogImage,
      hero: renderHero(work.hero, assetPrefix),
      intro: renderIntro(work),
      blocks: renderBlocks(work.blocks, assetPrefix),
      outro: renderOutro(work),
      nextCase: renderNextCase(next, assetPrefix),
      year,
    });

    const outDir = path.join(root, "work", work.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), html);
  });
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

  validateWorks(data);
  buildWorkPages(data);
  const injected = injectHomeData(data);

  console.log(`✓ ${data.works.length} páginas geradas em work/`);
  console.log(injected ? "✓ works-data inline sincronizado no index.html" : "⚠ index.html sem bloco works-data");
}

main();
