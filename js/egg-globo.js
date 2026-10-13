// Easter egg: globo dos países visitados.
//
// Globo de pontos em WebGL (cobe, ~13 kB) com um marcador por país, arcos
// saindo de casa (Curitiba) e rótulos com bandeira presos aos marcadores por
// CSS Anchor Positioning. Gira sozinho devagar, dá para arrastar, e clicar num
// país da lista leva o globo até ele.

import createGlobe from "https://cdn.jsdelivr.net/npm/cobe@2.0.1/dist/index.esm.js";

const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isDark = () => document.documentElement.dataset.theme === "dark";
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Bandeira a partir do código ISO (letras → "regional indicators").
const flag = (iso) => String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));

// Distância em km pelo círculo máximo.
function km([lat1, lon1], [lat2, lon2]) {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(a)));
}

// Ângulos do cobe que deixam [lat, lon] de frente para a câmera.
const focusOf = ([lat, lon]) => ({
  phi: Math.PI - ((lon * Math.PI) / 180 - Math.PI / 2),
  theta: Math.max(-0.7, Math.min(0.7, (lat * Math.PI) / 180)),
});

const ACCENT = [0.18, 0.75, 0.44]; // mesmo verde do "agenda aberta"

export async function init(dialog) {
  const base = dialog.dataset.base || "";
  const res = await fetch(`${base}data/viagens.json`, { cache: "no-cache" });
  const data = await res.json();
  const casa = data.casa;
  const paises = data.paises ?? [];
  const continentes = new Set(paises.map((p) => p.continente)).size;
  const longe = paises.reduce((m, p) => Math.max(m, km(casa.local, p.local)), 0);
  const id = (p) => p.iso.toLowerCase();

  dialog.innerHTML = `
    <div class="egg-inner egg-globo">
      <header class="egg-head">
        <div>
          <h2 class="egg-title" id="egg-globo-title" data-pt="Por onde passei">Where I have been</h2>
          <p class="egg-sub" data-pt="Arraste o globo ou escolha um país">Drag the globe or pick a country</p>
        </div>
        <div class="egg-actions">
          <button type="button" class="egg-close" data-egg-close aria-label="Close globe" data-pt-aria-label="Fechar globo">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
      </header>

      <div class="globe-layout">
        <div class="globe-wrap">
          <canvas class="globe-canvas" aria-label="Globe with ${paises.length} countries marked" data-pt-aria-label="Globo com ${paises.length} países marcados" role="img"></canvas>
          ${paises
            .map(
              (p) => `<span class="globe-label" style="position-anchor:--cobe-${id(p)};opacity:var(--cobe-visible-${id(p)},0)" aria-hidden="true">${flag(p.iso)} <span data-pt="${esc(p.nome)}">${esc(p.en ?? p.nome)}</span></span>`
            )
            .join("")}
        </div>

        <aside class="globe-panel">
          <dl class="globe-stats">
            <div><dt data-pt="Países">Countries</dt><dd>${paises.length}</dd></div>
            <div><dt data-pt="Continentes">Continents</dt><dd>${continentes}</dd></div>
            <div><dt data-pt="Mais longe de casa">Farthest from home</dt><dd data-pt="${longe.toLocaleString("pt-BR")} km">${longe.toLocaleString("en-US")} km</dd></div>
          </dl>
          <ul class="globe-list">
            ${paises
              .map(
                (p, i) => `<li><button type="button" class="globe-country" data-i="${i}">
                  <span class="globe-flag" aria-hidden="true">${flag(p.iso)}</span>
                  <span class="globe-name" data-pt="${esc(p.nome)}">${esc(p.en ?? p.nome)}</span>
                  <span class="globe-km" data-pt="${p.iso === casa.iso ? "casa" : `${km(casa.local, p.local).toLocaleString("pt-BR")} km`}">${p.iso === casa.iso ? "home" : `${km(casa.local, p.local).toLocaleString("en-US")} km`}</span>
                </button></li>`
              )
              .join("")}
          </ul>
        </aside>
      </div>

      ${data.exemplo ? `<p class="egg-sample" data-pt="Países de exemplo — a lista de verdade entra aqui.">Sample countries — the real list goes here.</p>` : ""}
    </div>`;

  window.nqI18n?.translate(dialog);

  const canvas = dialog.querySelector(".globe-canvas");
  const wrap = dialog.querySelector(".globe-wrap");
  const buttons = Array.from(dialog.querySelectorAll(".globe-country"));

  // Estado da câmera: começa olhando para casa.
  const view = { ...focusOf(casa.local), theta: 0.3 };
  let globe = null;
  let raf = 0;
  let dragging = false;
  let focusTween = null;
  let lastX = 0;
  let lastY = 0;
  let size = 0;

  const markers = [
    // Casa: um ponto maior na cor do texto.
    { location: casa.local, size: 0.09, color: isDark() ? [1, 1, 1] : [0.07, 0.07, 0.07] },
    ...paises.map((p) => ({ location: p.local, size: 0.055, id: id(p) })),
  ];
  const arcs = paises
    .filter((p) => p.iso !== casa.iso)
    .map((p) => ({ from: casa.local, to: p.local, id: `casa-${id(p)}` }));

  function build() {
    globe?.destroy();
    const dark = isDark();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = wrap.clientWidth;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    markers[0].color = dark ? [1, 1, 1] : [0.07, 0.07, 0.07];
    globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: size * dpr,
      height: size * dpr,
      phi: view.phi,
      theta: view.theta,
      dark: dark ? 1 : 0,
      diffuse: dark ? 1.4 : 1.1,
      mapSamples: 18000,
      mapBrightness: dark ? 5 : 8,
      mapBaseBrightness: dark ? 0 : 0.04,
      baseColor: dark ? [0.22, 0.22, 0.22] : [1, 1, 1],
      markerColor: ACCENT,
      glowColor: dark ? [0.12, 0.12, 0.12] : [0.94, 0.94, 0.94],
      arcColor: ACCENT,
      arcWidth: 0.6,
      arcHeight: 0.25,
      markerElevation: 0.01,
      markers,
      arcs,
    });
  }

  function loop() {
    if (!dragging && !focusTween && !reduce()) view.phi += 0.0022;
    globe?.update({ phi: view.phi, theta: view.theta });
    raf = requestAnimationFrame(loop);
  }

  function focus(i) {
    const target = focusOf(paises[i].local);
    // Vai pelo caminho mais curto (phi é circular).
    const twoPi = Math.PI * 2;
    let dphi = (target.phi - view.phi) % twoPi;
    if (dphi > Math.PI) dphi -= twoPi;
    if (dphi < -Math.PI) dphi += twoPi;
    buttons.forEach((b, j) => b.classList.toggle("is-active", j === i));
    focusTween?.kill();
    if (reduce()) {
      view.phi += dphi;
      view.theta = target.theta;
      return;
    }
    focusTween = gsap.to(view, {
      phi: view.phi + dphi,
      theta: target.theta,
      duration: 1.3,
      ease: "power3.inOut",
      onComplete: () => (focusTween = null),
    });
  }

  // Arrasto do globo (pointer events: mouse, toque e caneta).
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    focusTween?.kill();
    focusTween = null;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("is-grabbing");
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    view.phi += (e.clientX - lastX) / 180;
    view.theta = Math.max(-0.8, Math.min(0.8, view.theta + (e.clientY - lastY) / 300));
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const endDrag = () => {
    dragging = false;
    canvas.classList.remove("is-grabbing");
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  buttons.forEach((b, i) => {
    b.addEventListener("click", () => focus(i));
    b.addEventListener("pointerenter", () => {
      if (!dragging) focus(i);
    });
  });

  // Tema trocado com o globo aberto: recria com as cores certas.
  const themeObserver = new MutationObserver(() => {
    if (dialog.open) build();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  const ro = new ResizeObserver(() => {
    if (dialog.open && Math.abs(wrap.clientWidth - size) > 2) build();
  });
  ro.observe(wrap);

  return {
    onOpen() {
      build();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
      if (!reduce()) {
        gsap.fromTo(canvas, { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.1, ease: "power3.out", delay: 0.3 });
        gsap.fromTo(
          dialog.querySelectorAll(".globe-stats > div, .globe-list li"),
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, stagger: 0.04, ease: "power3.out", delay: 0.45 }
        );
      }
    },
    onClose() {
      cancelAnimationFrame(raf);
      // Libera o contexto WebGL quando o globo some.
      setTimeout(() => {
        if (!dialog.open) {
          globe?.destroy();
          globe = null;
        }
      }, 700);
    },
  };
}
