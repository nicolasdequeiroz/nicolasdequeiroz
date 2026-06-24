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

function renderIntro(work) {
  const services = work.services.join(" · ");
  return `<section class="work-intro">
    <h1 class="work-title">${escapeHtml(work.title)}</h1>
    <p class="work-meta">${work.year} · ${escapeHtml(services)}</p>
    <p class="work-description">${escapeHtml(work.description)}</p>
  </section>`;
}

function renderBlocks(blocks, assetPrefix) {
  if (!blocks?.length) return "";

  const html = blocks
    .map((block) => {
      switch (block.type) {
        case "image":
          return `<figure class="work-block work-block--image"><img src="${assetPrefix}${block.src}" alt="${escapeHtml(block.alt || "")}"></figure>`;
        case "video":
          return `<figure class="work-block work-block--video"><video src="${assetPrefix}${block.src}" controls playsinline${block.poster ? ` poster="${assetPrefix}${block.poster}"` : ""}></video></figure>`;
        case "text":
          return `<div class="work-block work-block--text"><p>${escapeHtml(block.text)}</p></div>`;
        default:
          return "";
      }
    })
    .join("\n    ");

  return `<div class="work-blocks">\n    ${html}\n  </div>`;
}

function renderPrevNext(prev, next) {
  const prevLink = prev
    ? `<a href="../${prev.slug}/" class="work-project-link work-project-link--prev">← ${escapeHtml(prev.title)}</a>`
    : "<span></span>";
  const nextLink = next
    ? `<a href="../${next.slug}/" class="work-project-link work-project-link--next">${escapeHtml(next.title)} →</a>`
    : "<span></span>";

  return `<nav class="work-project-nav" aria-label="Outros projetos">${prevLink}${nextLink}</nav>`;
}

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
    const prev = data.works[index - 1] ?? null;
    const next = data.works[index + 1] ?? null;
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
      prevNext: renderPrevNext(prev, next),
      year,
    });

    const outDir = path.join(root, "work", work.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), html);
  });
}

function main() {
  const dataPath = path.join(root, "data/works.json");
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

  validateWorks(data);
  buildWorkPages(data);

  console.log(`✓ ${data.works.length} páginas geradas em work/`);
}

main();
