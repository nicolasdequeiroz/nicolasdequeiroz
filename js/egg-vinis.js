// Easter egg: coleção de discos.
//
// Uma marquee vertical infinita, no terço do meio da tela: as capas sobem
// devagar sozinhas, e rolar, arrastar (mouse ou dedo) ou usar as setas empurra
// a coleção com inércia. Ao soltar, a capa mais próxima assenta no centro e o
// vinil desliza para fora dela, girando. Os terços de fora mostram a ficha do
// disco do centro (artista, título, ano, gênero, selo, edição, condição, nota).
//
// Sem bibliotecas de movimento: um laço de requestAnimationFrame com posição
// e velocidade (inércia), e cada capa recebe a sua transformação a cada quadro.

const AUTO_SPEED = 34; // px/s na deriva automática
const FRICTION = 2.6; // quanto maior, mais rápido a inércia morre
const SNAP_BELOW = 70; // px/s: abaixo disso a coleção assenta na capa mais próxima
const REST_BEFORE_DRIFT = 3.6; // s parado antes de voltar a derivar

const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad = (n) => String(n).padStart(2, "0");

// Selinho redondo com texto girando: DESTAQUE nos favoritos, outro no primeiro disco.
let sealId = 0;
function sealText(kind) {
  const t = window.nqI18n?.t ?? ((en) => en);
  // Dois espaços fixos de cada lado da estrela: as letras não encostam no separador.
  const word = kind === "first" ? t("FIRST RECORD", "PRIMEIRO DISCO") : t("FAVORITE", "DESTAQUE");
  return `${word}\u00a0\u00a0✦\u00a0\u00a0`.repeat(2);
}
function sealHTML(kind) {
  const id = `seal-${sealId++}`;
  return `<span class="vm-seal vm-seal--${kind}" aria-hidden="true"><svg viewBox="0 0 100 100"><defs><path id="${id}" d="M50 50m-37 0a37 37 0 1 1 74 0a37 37 0 1 1 -74 0"/></defs><circle cx="50" cy="50" r="50"/><text><textPath href="#${id}" textLength="230" lengthAdjust="spacing" data-seal="${kind}">${sealText(kind)}</textPath></text></svg><i></i></span>`;
}

function coverHTML(disco, base, eager) {
  if (disco.capa) {
    return `<img src="${base}${esc(disco.capa)}" alt="" ${eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async" draggable="false">`;
  }
  // Sem capa baixada: capa tipográfica.
  return `<span class="vm-generated"><span>${esc(disco.album)}</span><small>${esc(disco.artista)}</small></span>`;
}

export async function init(dialog) {
  const base = dialog.dataset.base || "";
  const res = await fetch(`${base}data/vinis.json`, { cache: "no-cache" });
  const data = await res.json();
  const discos = data.discos ?? [];
  const total = discos.length;

  dialog.innerHTML = `
    <div class="egg-inner egg-vinis">
      <header class="egg-head">
        <h2 class="visually-hidden" id="egg-vinis-title" data-pt="Coleção">Collection</h2>
        <button type="button" class="egg-close" data-egg-close aria-label="Close record collection" data-pt-aria-label="Fechar coleção de discos">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      </header>

      <div class="vm" tabindex="0" role="group" aria-roledescription="carousel" aria-label="Records. Use the up and down arrow keys to browse." data-pt-aria-label="Discos. Use as setas para cima e para baixo para navegar.">
        <div class="vm-stage">
          <span class="vdisc" aria-hidden="true"><span class="vdisc-rotor"><span class="vdisc-label"></span></span><i class="vdisc-sheen"></i></span>
          ${discos
            .map(
              (d, i) => `
            <button type="button" class="vm-item" data-i="${i}" tabindex="-1" aria-label="${esc(d.album)} — ${esc(d.artista)}">
              ${coverHTML(d, base, i < 4)}${d.primeiro ? sealHTML("first") : d.favorito ? sealHTML("fav") : ""}
            </button>`
            )
            .join("")}
        </div>
      </div>

      <div class="vi">
        <section class="vi-col vi-left" aria-live="off">
          <p class="vi-artist" data-swap></p>
          <h3 class="vi-album" data-swap></h3>
          <p class="vi-meta" data-swap><span data-year></span><i></i><span data-genre></span></p>
          <p class="vi-tag" data-first data-swap hidden><i aria-hidden="true"></i><span data-pt="Primeiro disco">First record</span></p>
        </section>
        <section class="vi-col vi-right">
          <p class="vi-count" data-swap><b data-n>01</b><span>/ ${pad(total)}</span></p>
          <div class="vi-fact" data-swap>
            <p class="vi-fact-label" data-pt="Curiosidade">Fun fact</p>
            <p class="vi-fact-text" data-fact></p>
          </div>
          <div class="vi-rate" data-swap>
            <span class="vi-fact-label" data-pt="Nota">Rating</span>
            <span class="vi-dots" data-rating></span>
          </div>
        </section>
        <button type="button" class="egg-button vi-shuffle" data-shuffle data-pt="Me surpreenda">Surprise me</button>
      </div>
      <p class="visually-hidden" aria-live="polite" data-live></p>
    </div>`;

  window.nqI18n?.translate(dialog);

  const vm = dialog.querySelector(".vm");
  const stage = dialog.querySelector(".vm-stage");
  const items = Array.from(dialog.querySelectorAll(".vm-item"));
  const vdisc = dialog.querySelector(".vdisc");
  const vdiscLabel = dialog.querySelector(".vdisc-label");
  const live = dialog.querySelector("[data-live]");
  const el = {
    artist: dialog.querySelector(".vi-artist"),
    album: dialog.querySelector(".vi-album"),
    year: dialog.querySelector("[data-year]"),
    genre: dialog.querySelector("[data-genre]"),
    n: dialog.querySelector("[data-n]"),
    fact: dialog.querySelector("[data-fact]"),
    rating: dialog.querySelector("[data-rating]"),
  };
  const swaps = Array.from(dialog.querySelectorAll("[data-swap]"));
  const firstTag = dialog.querySelector("[data-first]");

  // Medidas (refeitas ao redimensionar).
  let W = 300;
  let step = 330;
  let H = 800;
  let L = total * step;
  function measure() {
    W = items[0].offsetWidth || 300;
    step = W * 1.09;
    H = vm.clientHeight || 800;
    L = total * step;
  }

  // Estado do movimento.
  let pos = 0; // px: o disco i está no centro quando pos = i * step
  let vel = 0; // px/s
  let target = null; // alvo do assentamento (px) ou null
  let rate = 7; // velocidade do assentamento
  let mode = "rest"; // interact | settle | rest | drift
  let idle = 0;
  let drift = 0; // 0..1, aceleração suave da deriva
  let dragging = false;
  let running = false;
  let raf = 0;
  let last = 0;
  let active = -1;
  let wasRest = false;

  const wrap = (v) => ((((v + L / 2) % L) + L) % L) - L / 2;
  const nearest = () => Math.round(pos / step) * step;

  // A curiosidade segue o idioma da página.
  const factOf = (d) => window.nqI18n?.t(d.curiosidade_en || d.curiosidade || "", d.curiosidade || "") ?? d.curiosidade ?? "";
  window.addEventListener("nq:langchange", () => {
    if (active >= 0) el.fact.textContent = factOf(discos[active]);
    dialog.querySelectorAll("textPath[data-seal]").forEach((tp) => (tp.textContent = sealText(tp.dataset.seal)));
  });

  // Texto e ficha do disco do centro.
  function fillInfo(i) {
    const d = discos[i];
    el.artist.textContent = d.artista;
    el.album.textContent = d.album;
    el.year.textContent = d.ano;
    el.genre.textContent = (d.genero || "").replace(/(^|\/ )(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
    el.genre.previousElementSibling.hidden = !d.genero;
    el.n.textContent = pad(i + 1);
    firstTag.hidden = !d.primeiro;
    el.fact.textContent = factOf(d);
    el.rating.innerHTML = Array.from({ length: 5 }, (_, k) => `<span class="${k < (d.estrelas || 0) ? "on" : ""}"></span>`).join("");
    el.rating.setAttribute("aria-label", `${d.estrelas || 0}/5`);
  }

  // O vinil mora dentro da capa do disco do centro: sai e volta com ela, atrás da imagem.
  function attachDisc(i) {
    const d = discos[i];
    vdisc.style.setProperty("--disc", d.vinil || "#121212");
    vdisc.style.setProperty("--groove", d.vinil ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.045)");
    vdiscLabel.style.backgroundImage = d.capa ? `url("${base}${d.capa}")` : "none";
    if (vdisc.parentElement !== items[i]) items[i].insertBefore(vdisc, items[i].firstChild);
  }

  // A ficha sai desfocando e sobe; só troca o texto quando o disco do centro
  // se firma (evita piscar durante a rolagem rápida) e entra devagar.
  let infoTimer = 0;
  function setActive(i) {
    if (i === active) return;
    const first = active < 0;
    active = i;
    items.forEach((it, k) => it.classList.toggle("is-current", k === i));
    clearTimeout(infoTimer);
    if (first || typeof gsap === "undefined" || reduce()) {
      fillInfo(i);
      return;
    }
    gsap.to(swaps, { opacity: 0, y: -10, filter: "blur(6px)", duration: 0.24, stagger: 0.02, ease: "power2.in", overwrite: true });
    infoTimer = setTimeout(() => {
      fillInfo(active);
      gsap.fromTo(
        swaps,
        { opacity: 0, y: 14, filter: "blur(6px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.8, stagger: 0.06, ease: "power3.out", overwrite: true, clearProps: "filter" }
      );
    }, 150);
  }

  function render() {
    const half = H / 2;
    let best = 0;
    let bestAbs = Infinity;
    for (let i = 0; i < total; i++) {
      const off = wrap(i * step - pos);
      const a = Math.abs(off);
      if (a < bestAbs) {
        bestAbs = a;
        best = i;
      }
      const it = items[i];
      if (a > half + W) {
        if (it.style.visibility !== "hidden") it.style.visibility = "hidden";
        continue;
      }
      if (it.style.visibility === "hidden") it.style.visibility = "";
      const t = Math.min(1, a / (half * 0.95));
      const s = 1 - 0.2 * t;
      const tilt = clamp((-off / half) * 26, -26, 26);
      it.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0) perspective(1400px) rotateX(${tilt.toFixed(2)}deg) scale(${s.toFixed(3)})`;
      it.style.opacity = (1 - 0.74 * Math.min(1, a / (half * 0.9))).toFixed(3);
    }
    setActive(best);

    // O vinil só sai da capa quando a coleção está parada.
    const rest = mode === "rest" && bestAbs < 1.5;
    if (rest !== wasRest) {
      wasRest = rest;
      if (rest) {
        attachDisc(best);
        void vdisc.offsetWidth; // parte do estado recolhido para a transição rodar
        vdisc.classList.add("is-out");
      } else vdisc.classList.remove("is-out");
      if (rest) {
        const d = discos[best];
        live.textContent = `${window.nqI18n?.t("Record", "Disco") ?? "Record"} ${best + 1} ${window.nqI18n?.t("of", "de") ?? "of"} ${total}: ${d.album}, ${d.artista}, ${d.ano}.`;
      }
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;

    if (!dragging) {
      if (mode === "interact") {
        pos += vel * dt;
        vel *= Math.exp(-dt * FRICTION);
        if (Math.abs(vel) < SNAP_BELOW) {
          vel = 0;
          mode = "settle";
          target = target ?? nearest();
        }
      } else if (mode === "settle") {
        target = target ?? nearest();
        pos += (target - pos) * (1 - Math.exp(-dt * rate));
        if (Math.abs(target - pos) < 0.3) {
          pos = target;
          target = null;
          rate = 7;
          mode = "rest";
          idle = 0;
        }
      } else if (mode === "rest") {
        idle += dt;
        if (idle > REST_BEFORE_DRIFT && !reduce()) {
          mode = "drift";
          drift = 0;
        }
      } else if (mode === "drift") {
        drift = Math.min(1, drift + dt / 1.6);
        pos += AUTO_SPEED * drift * dt;
      }
    }

    render();
    if (running) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function interact() {
    mode = "interact";
    target = null;
    drift = 0;
  }

  // Vai até o disco i pelo caminho mais curto (a coleção dá a volta).
  function goTo(i, speed = 7) {
    const index = ((i % total) + total) % total;
    target = pos + wrap(index * step - pos);
    rate = speed;
    mode = "settle";
    drift = 0;
  }
  const stepBy = (n) => goTo(Math.round((target ?? pos) / step) + n);

  // --- Entrada ------------------------------------------------------------

  // Roda e trackpad: empurram a coleção (a inércia faz o resto).
  vm.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : 1;
      const delta = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * unit;
      interact();
      vel = clamp(vel + delta * 5.5, -4200, 4200);
    },
    { passive: false }
  );

  // Arrasto com mouse ou dedo; ao soltar, a velocidade vira inércia.
  let downY = 0;
  let lastY = 0;
  let lastT = 0;
  let moved = 0;
  vm.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    dragging = true;
    moved = 0;
    downY = lastY = e.clientY;
    lastT = e.timeStamp;
    interact();
    vel = 0;
    vm.setPointerCapture(e.pointerId);
    vm.classList.add("is-grabbing");
  });
  vm.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dy = e.clientY - lastY;
    const dtMs = Math.max(1, e.timeStamp - lastT);
    pos -= dy;
    vel = clamp(vel * 0.6 + (-dy / dtMs) * 1000 * 0.4, -4200, 4200);
    moved = Math.max(moved, Math.abs(e.clientY - downY));
    lastY = e.clientY;
    lastT = e.timeStamp;
  });
  const release = (e) => {
    if (!dragging) return;
    dragging = false;
    vm.classList.remove("is-grabbing");
    if (e.timeStamp - lastT > 90) vel = 0; // parou antes de soltar: sem arremesso
  };
  vm.addEventListener("pointerup", release);
  vm.addEventListener("pointercancel", release);

  // Clique numa capa: leva ela ao centro; na do centro, pausa a deriva.
  stage.addEventListener("click", (e) => {
    const item = e.target.closest(".vm-item");
    if (!item || moved > 6) return;
    const i = Number(item.dataset.i);
    if (i === active) {
      if (mode === "drift") {
        mode = "settle";
        target = nearest();
      }
      idle = 0;
    } else goTo(i);
  });

  vm.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") stepBy(1);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") stepBy(-1);
    else if (e.key === "Home") goTo(0);
    else if (e.key === "End") goTo(total - 1);
    else return;
    e.preventDefault();
  });

  dialog.querySelector("[data-shuffle]").addEventListener("click", () => {
    if (total < 2) return;
    let i = active;
    while (i === active) i = Math.floor(Math.random() * total);
    goTo(i, 3.2);
  });

  window.addEventListener("resize", () => {
    if (!dialog.open) return;
    const i = active < 0 ? 0 : active;
    measure();
    pos = i * step;
    target = null;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (dialog.open) start();
  });

  return {
    onOpen() {
      measure();
      active = -1;
      wasRest = false;
      mode = "rest";
      idle = 0;
      vel = 0;
      target = null;
      pos = Math.round(pos / step) * step || 0;
      render();
      start();
      if (typeof gsap !== "undefined" && !reduce()) {
        gsap.from(stage, { opacity: 0, y: 70, duration: 1, ease: "power3.out", delay: 0.35, clearProps: "opacity,transform" });
      }
      vm.focus({ preventScroll: true });
    },
    onClose() {
      stop();
    },
  };
}
