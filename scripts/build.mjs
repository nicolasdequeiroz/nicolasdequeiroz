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
  if (hero.type === "video" && hero.mobile) {
    // Vídeo no desktop; abaixo de 768px, a capa vertical — imagem, ou vídeo vertical
    // (hero.mobileVideo, com hero.mobile de poster). A imagem é a mesma do card do carrossel.
    const poster = hero.poster ? ` poster="${assetPrefix}${hero.poster}"` : "";
    const mobile = hero.mobileVideo
      ? `<video class="work-media work-hero-mobile"${vt} src="${assetPrefix}${hero.mobileVideo}" autoplay muted loop playsinline poster="${assetPrefix}${hero.mobile}"${at("aria-label", enHero?.alt, hero.alt)}></video>`
      : `<img class="work-media work-hero-mobile"${vt} src="${assetPrefix}${hero.mobile}"${alt} decoding="async">`;
    return `<div class="work-hero"><video class="work-media work-hero-video"${vt} src="${assetPrefix}${hero.src}" autoplay muted loop playsinline${poster}${at("aria-label", enHero?.alt, hero.alt)}></video>${mobile}</div>`;
  }
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
  "1:1": "work-r-11",
  "4:5": "work-r-45",
  "9:16": "work-r-916", // vídeo vertical: estreito e centralizado
  auto: "work-r-auto", // proporção do próprio arquivo (faixas de logotipos, recortes)
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
    // `mobile`: versão vertical (9:16) servida abaixo de 768px via <source media>.
    if (item.mobile) {
      return `<video class="work-r-vswap" autoplay muted loop playsinline preload="metadata"${poster}${at("aria-label", enItem?.alt, item.alt || "")}><source media="(max-width: 767px)" src="${assetPrefix}${item.mobile}"><source src="${assetPrefix}${item.src}"></video>`;
    }
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
        case "slide": {
          // Slide de apresentação recriado em código: foto de fundo + logo + título
          // (2ª linha em destaque) + texto, todos traduzíveis.
          const t1 = tx(e.title?.[0], block.title[0]);
          const t2 = tx(e.title?.[1], block.title[1]);
          const body = tx(e.text, block.text);
          const logo = block.logo ? `<img class="slide-logo" src="${assetPrefix}${block.logo}" alt="${escapeHtml(block.logoAlt || "")}">` : "";
          return `<div class="work-block work-block--slide"><div class="slide"><img class="slide-photo" src="${assetPrefix}${block.src}"${at("alt", e.alt, block.alt || "")} loading="lazy" decoding="async"><span class="slide-shade" aria-hidden="true"></span>${logo}<div class="slide-copy"><h3 class="slide-title"><span${t1.attr}>${t1.text}</span> <span class="slide-accent"${t2.attr}>${t2.text}</span></h3><p class="slide-text"${body.attr}>${body.text}</p></div></div></div>`;
        }
        case "gallery":
          return `<div class="work-block work-block--gallery">${block.items
            .map(
              (item, j) =>
                `<figure>${renderMediaEl(item, e.items?.[j], assetPrefix, "4:5")}${renderCaption(item.caption, e.items?.[j]?.caption)}</figure>`
            )
            .join("")}</div>`;
        case "palette": {
          // Marquee: a lista aparece duas vezes (a cópia fica escondida para leitores de
          // tela) e a faixa anda metade da largura em loop, sem emenda.
          const swatches = block.items
            .map((c, j) => {
              const name = tx(e.items?.[j]?.name, c.name);
              return `<li><span class="work-swatch" style="background:${escapeHtml(c.hex)}"></span><span class="work-swatch-name"${name.attr}>${name.text}</span><span class="work-swatch-hex">${escapeHtml(c.hex.toUpperCase())}</span></li>`;
            })
            .join("");
          return `<div class="work-block work-block--palette">${renderLabel(block.label, e.label)}<div class="work-marquee" style="--n:${block.items.length}"><div class="work-marquee-inner"><ul>${swatches}</ul><ul aria-hidden="true">${swatches}</ul></div></div></div>`;
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
    <img class="work-next-media" src="${assetPrefix}${next.hero.type === "video" ? next.thumb : next.hero.src}" alt="" loading="lazy" decoding="async">
    <span class="work-next-content">
      <span class="work-block-label"${label.attr}>${label.text}</span>
      <span class="work-next-title">${escapeHtml(next.title)}</span>
    </span>
  </a>`;
}

const BLOCK_TYPES = new Set(["image", "video", "pair", "gallery", "statement", "text", "capture", "palette", "slide"]);

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
      if (block.type === "pair" && ![2, 3, 6].includes(block.items?.length)) {
        throw new Error(`Bloco "pair" em ${work.slug} precisa de 2, 3 ou 6 items (3 = trio, 6 = grade 3×2)`);
      }
      if (block.ratio && !RATIO_CLASS[block.ratio]) {
        throw new Error(`Ratio "${block.ratio}" inválido em ${work.slug} (use 16:9, 4:3, 7:5, 4:5, 1:1 ou auto)`);
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
    // SEO: título e descrição próprios (work.seo / en.seo) quando existirem; senão,
    // caem no título e no resumo da descrição do case.
    const seoTitle = en.seo?.title ?? work.seo?.title ?? work.title;
    const seoTitlePt = work.seo?.title ?? work.title;
    const desc = summarize(en.seo?.description ?? en.description ?? work.seo?.description ?? work.description);
    const descPt = summarize(work.seo?.description ?? work.description);
    const ogAlt = en.hero?.alt ?? work.hero.alt ?? work.title;
    const ogAltPt = work.hero.alt ?? work.title;
    const jsonLd = JSON.stringify([
      {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: work.title,
        description: desc,
        url: canonical,
        image: ogImage,
        dateCreated: String(work.year),
        genre: (en.services ?? work.services).join(", "),
        creator: { "@type": "Person", name: data.site.name, url: `${data.site.url}/` },
        inLanguage: ["en", "pt-BR"],
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: data.site.name, item: `${data.site.url}/` },
          { "@type": "ListItem", position: 2, name: work.title, item: canonical },
        ],
      },
    ]).replaceAll("<", "\\u003c");
    const html = renderTemplate(template, {
      title: escapeHtml(work.title),
      seoTitle: escapeHtml(seoTitle),
      titlePt: seoTitle === seoTitlePt ? "" : ` data-pt="${escapeHtml(seoTitlePt)} | Nícolas de Queiróz"`,
      titlePtContent: seoTitle === seoTitlePt ? "" : ` data-pt-content="${escapeHtml(seoTitlePt)} | Nícolas de Queiróz"`,
      ogAlt: escapeHtml(ogAlt),
      ogAltPt: ogAlt === ogAltPt ? "" : ` data-pt-content="${escapeHtml(ogAltPt)}"`,
      jsonLd,
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

// Meta description: buscadores e previews cortam por volta de 155–160 caracteres,
// então encurtamos na última palavra inteira.
function summarize(text, max = 160) {
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
  const urls = [`${data.site.url}/`, `${data.site.url}/sobre/`, `${data.site.url}/trabalhos/`, `${data.site.url}/feed/`, `${data.site.url}/contato/`, ...data.works.map((w) => `${data.site.url}/work/${w.slug}/`)];
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

// Imagens de um case para o rastro da página Trabalhos: a capa e as imagens estáticas
// (sem SVG nem vídeo) dos blocos, espalhadas de forma uniforme, até `max`.
function trailImages(work, max = 8) {
  const isStill = (src) => typeof src === "string" && /\.(webp|jpe?g|png)$/i.test(src);
  const all = [work.thumb];
  for (const b of work.blocks ?? []) {
    if (b.type === "image" && b.src) all.push(b.src);
    for (const it of b.items ?? []) if (it.src) all.push(it.src);
  }
  const unique = [...new Set(all.filter(isStill))];
  if (unique.length <= max) return unique;
  return Array.from({ length: max }, (_, i) => unique[Math.round((i * (unique.length - 1)) / (max - 1))]);
}

// Página Trabalhos: a lista de cases (mesma ordem de works.json) é gerada aqui,
// entre os marcadores <!-- works:start --> e <!-- works:end --> de trabalhos/index.html,
// com títulos, tags e miniaturas; o JSON-LD (ItemList) vai junto.
function injectTrabalhos(data, enOverlay) {
  const file = path.join(root, "trabalhos", "index.html");
  if (!fs.existsSync(file)) return false;
  const rows = data.works
    .map((work, i) => {
      const en = enOverlay[work.slug] ?? {};
      const tags = work.services
        .map((svc, j) => {
          const t = tx(en.services?.[j], svc);
          return `<span${t.attr}>${t.text}</span>`;
        })
        .join("");
      const thumb = `../${work.thumb}`;
      // Seleção curada em works.json ("trail"); sem ela, cai na escolha automática.
      const trail = (work.trail ?? trailImages(work)).map((src) => `../${src}`).join("|");
      const n = String(i + 1).padStart(2, "0");
      return `      <li class="tr-row" data-reveal style="--reveal-delay: ${Math.min(i, 6) * 60}ms">
        <a class="tr-link" href="../work/${work.slug}/" data-trail="${trail}">
          <span class="tr-num">${n}</span>
          <span class="tr-title">${escapeHtml(work.title)}</span>
          <span class="tr-tags">${tags}</span>
          <span class="tr-year">${work.year}</span>
          <img class="tr-thumb" src="${thumb}" alt="" loading="lazy" decoding="async">
        </a>
      </li>`;
    })
    .join("\n");
  const list = `<ol class="tr-list">\n${rows}\n    </ol>`;
  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Work — Nícolas de Queiróz",
    url: `${data.site.url}/trabalhos/`,
    inLanguage: ["en", "pt-BR"],
    mainEntity: {
      "@type": "ItemList",
      itemListElement: data.works.map((w, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: w.title,
        url: `${data.site.url}/work/${w.slug}/`,
      })),
    },
  }).replaceAll("<", "\\u003c");
  let html = fs.readFileSync(file, "utf8");
  html = html.replace(/<!-- works:start -->[\s\S]*?<!-- works:end -->/, `<!-- works:start -->\n    ${list}\n    <!-- works:end -->`);
  html = html.replace(/<!-- ld:start -->[\s\S]*?<!-- ld:end -->/, `<!-- ld:start -->${ld}<!-- ld:end -->`);
  fs.writeFileSync(file, html);
  return true;
}

// Página Feed: o mural recebe, (JSON em #feed-data, entre <!-- feed:start --> e <!-- feed:end -->) todas as
// imagens estáticas dos cases (capa, hero e blocos; sem SVG, vídeo, og nem versões mobile).
function injectFeed(data) {
  const file = path.join(root, "feed", "index.html");
  if (!fs.existsSync(file)) return 0;
  const isStill = (src) => typeof src === "string" && /\.(webp|jpe?g|png)$/i.test(src);
  const items = [];
  for (const work of data.works) {
    const srcs = new Set();
    const add = (src) => isStill(src) && fs.existsSync(path.join(root, src)) && srcs.add(src);
    add(work.thumb);
    if (work.hero?.type === "image") add(work.hero.src);
    for (const b of work.blocks ?? []) {
      if (b.feed === false) continue; // bloco fora do mural (ex.: comunicação, galeria de embalagens)
      add(b.src);
      for (const it of b.items ?? []) add(it.src);
    }
    for (const src of srcs) {
      // Miniatura de assets/feed/ (npm run feed-thumbs); sem ela, a imagem original.
      const thumb = `assets/feed/${src.replace(/^assets\/works\//, "").replace(/\//g, "__").replace(/\.\w+$/, ".webp")}`;
      const image = fs.existsSync(path.join(root, thumb)) ? thumb : src;
      items.push({ image: `../${image}`, full: `../${src}`, title: work.title, href: `../work/${work.slug}/` });
    }
  }
  const json = JSON.stringify(items).replaceAll("<", "\\u003c");
  let html = fs.readFileSync(file, "utf8");
  html = html.replace(/<!-- feed:start -->[\s\S]*?<!-- feed:end -->/, `<!-- feed:start --><script type="application/json" id="feed-data">${json}</script><!-- feed:end -->`);
  fs.writeFileSync(file, html);
  return items.length;
}

// Páginas estáticas (não saem do template) recebem o versionamento no lugar.
const STATIC_PAGES = ["index.html", "sobre/index.html", "trabalhos/index.html", "feed/index.html", "contato/index.html", "404.html"];

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
  injectTrabalhos(data, enOverlay);
  const feedCount = injectFeed(data);
  const sitemapCount = writeSitemap(data);
  const versioned = versionStaticPages();

  console.log(`✓ ${data.works.length} páginas geradas em work/`);
  console.log(injected ? "✓ works-data inline sincronizado no index.html" : "⚠ index.html sem bloco works-data");
  console.log(`✓ feed com ${feedCount} imagens`);
  console.log(`✓ sitemap.xml com ${sitemapCount} URLs`);
  console.log(`✓ CSS/JS versionados (?v=hash) em ${versioned} páginas estáticas + work/`);
}

main();
