// Página Feed: mural "Drift Wall" do React Bits (MIT, reactbits.dev), em JS
// puro. Colunas de quadros derivam em perspectiva (alternando o sentido), o
// mouse inclina o mural, e o quadro sob o ponteiro vem para a frente e leva
// ao case. As imagens vêm de #feed-data (geradas no build a partir de todos
// os cases) e são sorteadas a cada visita.
(function () {
  const wall = document.getElementById("drift-wall");
  const plane = wall && wall.querySelector(".drift-wall__plane");
  const dataEl = document.getElementById("feed-data");
  if (!wall || !plane || !dataEl) return;

  let all = [];
  try { all = JSON.parse(dataEl.textContent) || []; } catch (e) {}
  if (!all.length) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = window.matchMedia("(max-width: 767.98px)").matches;

  // Props do componente (valores do exemplo do React Bits, ajustados à tela).
  const P = small
    ? { columns: 4, tileW: 150, tileH: 150, gap: 12, tilt: 14, turn: -10, perspective: 1000, depth: 100, speed: 34, parallax: 0 }
    : { columns: 7, tileW: 260, tileH: 176, gap: 18, tilt: 16, turn: -14, perspective: 1200, depth: 120, speed: 42, parallax: 0.6 };
  const roll = 0, variance = 0.45, direction = "up";
  wall.style.setProperty("--dw-perspective", P.perspective + "px");

  // Embaralha uma vez por visita (a ordem se mantém ao redimensionar).
  const shuffled = all.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const unit = P.tileH + P.gap;
  const colFactor = (i) => 1 + variance * (((i * 0.6180339887 + 0.35) % 1) * 2 - 1);
  const dirSign = direction === "up" ? 1 : -1;
  let cols = [], base = [], meta = [], tracks = [], offsets = [], vel = [];
  let hoveredCol = -1;
  let activeId = null;

  // Monta as colunas. Anti-"área em branco": a faixa de cada coluna precisa
  // cobrir a altura visível com sobra de DUAS cópias — o plano é inclinado,
  // ampliado (1,18×) e em perspectiva, então enxerga mais de 2× a altura da
  // tela em coordenadas do plano. Tamanho do loop = (cópias − 2) × altura da cópia.
  function build() {
    plane.textContent = "";
    activeId = null;
    hoveredCol = -1;
    const items = shuffled.slice(0, P.columns * 10);
    cols = Array.from({ length: P.columns }, () => []);
    items.forEach((it, i) => cols[i % P.columns].push(it));
    base = cols.map((_, c) => P.speed * colFactor(c) * dirSign * (c % 2 === 0 ? 1 : -1));
    const span = Math.max(2400, window.innerHeight * 2.6);
    meta = cols.map((col) => {
      const copyHeight = Math.max(unit, col.length * unit);
      return { copyHeight, copies: Math.ceil(span / copyHeight) + 2 };
    });
    tracks = [];
    cols.forEach((col, c) => {
      const colEl = document.createElement("div");
      colEl.className = "drift-wall__col";
      const track = document.createElement("div");
      track.className = "drift-wall__track";
      for (let k = 0; k < meta[c].copies; k++) {
        col.forEach((it, i) => {
          const a = document.createElement("a");
          a.className = "drift-wall__tile";
          a.href = it.href;
          a.dataset.tileId = `${c}-${k}-${i}`;
          a.dataset.col = String(c);
          a.dataset.full = it.full || it.image;
          a.dataset.title = it.title;
          a.setAttribute("aria-label", it.title);
          if (k > 0) a.tabIndex = -1; // só a primeira cópia entra na ordem do teclado
          const inner = document.createElement("span");
          inner.className = "drift-wall__inner";
          const img = document.createElement("img");
          // Carregamento imediato (as miniaturas são leves): com loading="lazy" os
          // quadros que entram pela borda chegavam vazios. O fade-in evita o "pisca".
          img.alt = "";
          img.decoding = "async";
          img.draggable = false;
          img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true });
          img.addEventListener("error", () => a.classList.add("is-broken"), { once: true });
          img.src = it.image;
          if (img.complete && img.naturalWidth) img.classList.add("is-loaded");
          const veil = document.createElement("span");
          veil.className = "drift-wall__overlay";
          veil.setAttribute("aria-hidden", "true");
          inner.append(img, veil);
          a.appendChild(inner);
          track.appendChild(a);
        });
      }
      colEl.appendChild(track);
      plane.appendChild(colEl);
      tracks.push(track);
    });
    offsets = meta.map((m, c) => m.copyHeight * ((c * 0.37) % 1));
    vel = cols.map(() => 0);
  }
  build();

  const pointer = { x: 0, y: 0 };
  const damped = { x: 0, y: 0 };
  let last = null;
  let paused = false;
  let boost = 0; // multiplicador extra de velocidade, vindo do scroll

  const setPlane = (px, py) => {
    plane.style.transform =
      `translate(-50%, -50%) scale(1.18) rotateX(${P.tilt + py}deg) rotateY(${P.turn + px}deg) ` +
      `rotateZ(${roll}deg) translateZ(${-P.depth}px)`;
  };

  const activate = (tile) => {
    const id = tile ? tile.dataset.tileId : null;
    if (id === activeId) return;
    const prev = plane.querySelector(".is-active");
    if (prev) prev.classList.remove("is-active");
    activeId = id;
    hoveredCol = tile ? Number(tile.dataset.col) : -1;
    if (tile) tile.classList.add("is-active");
    wall.toggleAttribute("data-hovering", !!tile); // o cursor da página lê isto
  };

  const tick = (ts) => {
    if (paused) {
      last = null;
      requestAnimationFrame(tick);
      return;
    }
    if (last === null) last = ts;
    const dt = Math.min(0.05, Math.max(0, ts - last) / 1000); // salto longo (aba oculta) não vira pulo
    last = ts;

    const maxTilt = P.parallax * 8;
    const damp = 1 - Math.exp(-dt / 0.12);
    damped.x += (pointer.x * maxTilt - damped.x) * damp;
    damped.y += (-pointer.y * maxTilt - damped.y) * damp;
    setPlane(damped.x, damped.y);

    // O impulso do scroll decai sozinho (~0,9 s para cair pela metade em 3×) e a
    // velocidade das colunas volta ao ritmo normal.
    boost *= Math.exp(-dt / 0.9);
    if (boost < 0.01) boost = 0;

    for (let c = 0; c < tracks.length; c++) {
      if (!reduced) {
        const target = hoveredCol === c ? 0 : base[c] * (1 + boost);
        const ease = 1 - Math.exp(-dt / (target === 0 ? 0.16 : 0.28));
        vel[c] += (target - vel[c]) * ease;
        offsets[c] = (((offsets[c] + vel[c] * dt) % meta[c].copyHeight) + meta[c].copyHeight) % meta[c].copyHeight;
      }
      tracks[c].style.transform = `translate3d(0, ${-offsets[c]}px, 0)`;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  wall.addEventListener("pointermove", (e) => {
    const r = wall.getBoundingClientRect();
    if (P.parallax > 0 && !reduced) {
      pointer.x = (e.clientX - r.left) / r.width - 0.5;
      pointer.y = (e.clientY - r.top) / r.height - 0.5;
    }
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const tile = hit && hit.closest ? hit.closest("[data-tile-id]") : null;
    if (tile) activate(tile);
  });
  // Scroll (roda ou trackpad) sobre o mural acelera as colunas; quanto mais forte
  // ou contínuo o gesto, maior a velocidade (até ~9× a base). O mural não rola.
  const BOOST_MAX = 8;
  const push = (amount) => {
    if (reduced || paused) return;
    boost = Math.min(BOOST_MAX, boost + amount);
  };
  wall.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      push(Math.min(Math.abs(px), 120) / 90);
    },
    { passive: false }
  );
  // Toque: arrastar o dedo na vertical também acelera.
  let touchY = null;
  wall.addEventListener("touchstart", (e) => (touchY = e.touches[0].clientY), { passive: true });
  wall.addEventListener(
    "touchmove",
    (e) => {
      const y = e.touches[0].clientY;
      if (touchY !== null) push(Math.min(Math.abs(y - touchY), 80) / 40);
      touchY = y;
    },
    { passive: true }
  );
  wall.addEventListener("touchend", () => (touchY = null), { passive: true });

  wall.addEventListener("pointerleave", () => {
    pointer.x = pointer.y = 0;
    activate(null);
  });
  wall.addEventListener("focusin", (e) => {
    const tile = e.target.closest && e.target.closest("[data-tile-id]");
    if (tile) activate(tile);
  });
  wall.addEventListener("focusout", () => activate(null));

  // Reconstrói ao mudar o tamanho da janela (a altura define quantas cópias).
  let resizeTimer = null;
  let lastW = window.innerWidth;
  let lastH = window.innerHeight;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (Math.abs(window.innerWidth - lastW) < 40 && Math.abs(window.innerHeight - lastH) < 80) return;
      lastW = window.innerWidth;
      lastH = window.innerHeight;
      build();
    }, 200);
  });

  // Ao voltar para a aba ou a janela, zera o estado de hover e o relógio da animação.
  const reset = () => {
    last = null;
    pointer.x = pointer.y = 0;
    activate(null);
  };
  document.addEventListener("visibilitychange", reset);
  window.addEventListener("blur", reset);
  window.addEventListener("pageshow", reset); // volta pelo botão "voltar" (bfcache)

  // Lightbox: clicar num quadro abre a imagem inteira (original, não a miniatura)
  // com o atalho para o case. Esc, o X ou um clique fora fecham. Ctrl/⌘/Shift +
  // clique e o botão do meio continuam abrindo o case direto.
  const lb = document.getElementById("feed-lightbox");
  const lbImg = lb && lb.querySelector(".feed-lb-img");
  const lbTitle = lb && lb.querySelector(".feed-lb-title");
  const lbCase = lb && lb.querySelector(".feed-lb-case");
  let opener = null;
  if (lb && lbImg) {
    wall.addEventListener("click", (e) => {
      // O quadro erguido pelo hover não é o que o clique "enxerga" (o hit-test usa a posição
      // original, sem o recuo de perspectiva): vale o quadro ativo.
      const tile = plane.querySelector(".is-active") || (e.target.closest && e.target.closest("[data-tile-id]"));
      if (!tile || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      opener = tile;
      lbImg.src = tile.dataset.full;
      lbImg.alt = tile.dataset.title || "";
      lbTitle.textContent = tile.dataset.title || "";
      lbCase.href = tile.getAttribute("href");
      paused = true;
      activate(null);
      lb.showModal();
    });
    lb.querySelector(".feed-lb-close").addEventListener("click", () => lb.close());
    // Clique no fundo (fora da figura e do botão) fecha.
    lb.addEventListener("click", (e) => {
      if (e.target === lb) lb.close();
    });
    lb.addEventListener("close", () => {
      paused = false;
      last = null;
      lbImg.removeAttribute("src");
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
      opener = null;
    });
    lbCase.addEventListener("click", () => {
      const nav = document.getElementById("site-nav");
      if (nav) nav.classList.add("is-navigating");
    });
  }
})();
