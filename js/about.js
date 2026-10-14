// Página sobre: hora de Curitiba ao lado do "Agenda aberta", no contato.
(function () {
  const clock = document.querySelector("[data-clock]");
  if (!clock) return;
  const t = (en, pt) => (window.nqI18n ? window.nqI18n.t(en, pt) : en);
  const fmt = (pt) =>
    new Intl.DateTimeFormat(pt ? "pt-BR" : "en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
  const tick = () => {
    const pt = window.nqI18n?.lang === "pt";
    clock.textContent = `${fmt(pt).format(new Date())} ${t("in Curitiba", "em Curitiba")}`;
  };
  tick();
  setInterval(tick, 20000);
  window.addEventListener("nq:langchange", tick);
})();

// Coordenadas da foto: ao passar o mouse, os dígitos "decodificam" um a um
// até o valor real (o mesmo gesto do logo da nav).
(function () {
  const figure = document.querySelector("[data-photo-place]");
  const coords = figure?.querySelector("[data-coords]");
  if (!figure || !coords) return;
  figure.addEventListener("click", () => figure.classList.toggle("is-tapped"));
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let timer = null;

  function decode() {
    clearInterval(timer);
    const final = coords.dataset.coords;
    let frame = 0;
    const digits = [...final].map((ch, i) => (/\d/.test(ch) ? i : -1)).filter((i) => i >= 0);
    timer = setInterval(() => {
      frame += 1;
      const settled = Math.floor(frame / 2);
      coords.textContent = [...final]
        .map((ch, i) => {
          const order = digits.indexOf(i);
          if (order === -1 || order < settled) return ch;
          return String(Math.floor(Math.random() * 10));
        })
        .join("");
      if (settled >= digits.length) {
        clearInterval(timer);
        coords.textContent = final;
      }
    }, 45);
  }

  figure.addEventListener("mouseenter", decode);
})();
// Cartões dos easter eggs: as capas vêm dos próprios dados, para a prévia
// acompanhar a coleção de verdade.
(function () {
  const covers = document.querySelector("[data-egg-covers]");
  if (!covers) return;

  fetch("../data/vinis.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((data) => {
      // Três capas sorteadas a cada carregamento da página.
      const comCapa = (data.discos ?? []).filter((d) => d.capa);
      for (let i = comCapa.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [comCapa[i], comCapa[j]] = [comCapa[j], comCapa[i]];
      }
      comCapa.length = Math.min(3, comCapa.length);
      covers.innerHTML = comCapa.length
        ? comCapa.map((d) => `<img src="../${d.capa}" alt="" loading="lazy" decoding="async">`).join("")
        : "<span></span><span></span><span></span>";
    })
    .catch(() => {
      covers.innerHTML = "<span></span><span></span><span></span>";
    });
})();

// Números da experiência: contam de 0 até o valor quando entram na tela,
// um depois do outro. O sufixo ("+") fica fixo; sem JS ou com "reduzir
// movimento", o valor final já está no HTML.
(function () {
  const stats = document.querySelector(".ab-stats");
  if (!stats) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const items = Array.from(stats.querySelectorAll("dt")).map((el) => {
    const match = el.textContent.trim().match(/^(\d+)(\D*)$/);
    return match ? { el, target: Number(match[1]), suffix: match[2] } : null;
  }).filter(Boolean);
  if (!items.length) return;

  const DURATION = 1600; // ms
  const STAGGER = 120; // ms entre um número e o próximo
  const ease = (t) => 1 - Math.pow(1 - t, 4); // easeOutQuart: chega devagar

  // Largura fixa pelo valor final, para o texto abaixo não mexer durante a contagem.
  items.forEach(({ el, suffix }) => {
    el.style.fontVariantNumeric = "tabular-nums";
    el.textContent = `0${suffix}`;
  });

  function run({ el, target, suffix }, delay) {
    const start = performance.now() + delay;
    function frame(now) {
      const t = Math.min(1, Math.max(0, (now - start) / DURATION));
      el.textContent = `${Math.round(target * ease(t))}${suffix}`;
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      items.forEach((item, i) => run(item, i * STAGGER));
    },
    { threshold: 0.5 }
  );
  io.observe(stats);
})();

// Prévia do globo no cartão: o mesmo cobe do easter egg, em miniatura. Só é
// baixado quando o cartão chega perto da tela; gira devagar e acelera no hover.
// Se o WebGL falhar, o aramado em SVG continua no lugar.
(function () {
  const canvas = document.querySelector("[data-egg-globe]");
  const art = canvas?.closest(".ab-egg-art--globo");
  const card = canvas?.closest(".ab-egg");
  if (!canvas || !art || !card) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isDark = () => document.documentElement.dataset.theme === "dark";
  let globe = null;
  let raf = 0;
  let visible = false;
  let phi = 0.6; // de frente para as Américas
  let speed = 0;
  let targetSpeed = 0;

  async function start() {
    let createGlobe;
    try {
      ({ default: createGlobe } = await import("https://cdn.jsdelivr.net/npm/cobe@2.0.1/dist/index.esm.js"));
    } catch {
      return;
    }

    function build() {
      globe?.destroy();
      const dark = isDark();
      const size = canvas.clientWidth || 190;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      try {
        globe = createGlobe(canvas, {
          devicePixelRatio: dpr,
          width: size * dpr,
          height: size * dpr,
          phi,
          theta: 0.3,
          dark: dark ? 1 : 0,
          diffuse: dark ? 1.4 : 1.1,
          mapSamples: 12000,
          mapBrightness: dark ? 5 : 8,
          mapBaseBrightness: dark ? 0 : 0.04,
          baseColor: dark ? [0.22, 0.22, 0.22] : [1, 1, 1],
          markerColor: [0.18, 0.75, 0.44],
          glowColor: dark ? [0.12, 0.12, 0.12] : [0.94, 0.94, 0.94],
          markerElevation: 0.01,
          markers: [],
        });
        art.classList.add("is-live");
        redraw();
      } catch {
        globe = null;
      }
    }

    // Parado, o cobe só desenha quando pedimos: a textura do mapa chega depois
    // do primeiro quadro, então repetimos o desenho por ~1 s (e a cada rebuild).
    function redraw(frames = 60) {
      globe?.update({ phi });
      if (frames > 0) requestAnimationFrame(() => redraw(frames - 1));
    }

    // O canvas está display:none até is-live; mede com o SVG de reserva visível.
    art.classList.add("is-live");
    build();
    if (!globe) {
      art.classList.remove("is-live");
      return;
    }

    new MutationObserver(build).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    card.addEventListener("pointerenter", kick(0.02));
    card.addEventListener("pointerleave", kick(0));
    card.addEventListener("focus", kick(0.02));
    card.addEventListener("blur", kick(0));

    // Só gira com o mouse (ou foco) em cima: acelera ao entrar, freia ao sair
    // e o loop para sozinho quando o globo para.
    function loop() {
      speed += (targetSpeed - speed) * 0.07;
      if (targetSpeed === 0 && speed < 0.0002) speed = 0;
      phi += speed;
      globe?.update({ phi });
      raf = visible && speed > 0 ? requestAnimationFrame(loop) : 0;
    }
    function kick(target) {
      return () => {
        targetSpeed = reduce ? 0 : target;
        if (targetSpeed > 0 && visible && !raf) raf = requestAnimationFrame(loop);
      };
    }
    new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !raf && speed > 0) raf = requestAnimationFrame(loop);
      },
      { rootMargin: "100px" }
    ).observe(card);
  }

  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      start();
    },
    { rootMargin: "300px" }
  );
  io.observe(card);
})();

// Título: as letras "decodificam" da esquerda para a direita, o mesmo gesto do
// logo da nav, quando a página abre e a cada troca de idioma. A estrutura (o
// nome em itálico) é preservada: só os nós de texto são animados.
(function () {
  const title = document.querySelector("[data-scramble]");
  if (!title) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const FRAME_MS = 18;
  const SCRAMBLES_PER = 2; // quadros de embaralho por letra antes de travar
  let timer = null;
  let active = null;

  // Cada letra vira uma caixa com a largura que ela tem no texto final, e cada
  // palavra não quebra. Assim as letras embaralhadas mudam de forma, mas nunca
  // de largura: o texto não reflui e nada pula. Ao terminar, volta o texto real.
  function prepare() {
    const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    const originals = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) originals.push(n);

    const pieces = []; // { node (original), wrappers, chars: [{el, ch}] }
    originals.forEach((node) => {
      const text = node.nodeValue;
      const widths = [];
      const range = document.createRange();
      for (let i = 0; i < text.length; i++) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        widths.push(range.getBoundingClientRect().width);
      }

      const frag = document.createDocumentFragment();
      const wrappers = [];
      const chars = [];
      let word = null;
      Array.from(text).forEach((ch, i) => {
        if (/\s/.test(ch)) {
          word = null;
          const space = document.createTextNode(ch);
          frag.appendChild(space);
          wrappers.push(space);
          return;
        }
        if (!word) {
          word = document.createElement("span");
          word.className = "sw";
          frag.appendChild(word);
          wrappers.push(word);
        }
        const el = document.createElement("span");
        el.className = "sc";
        el.style.width = `${widths[i]}px`;
        el.textContent = ch;
        word.appendChild(el);
        chars.push({ el, ch, fixed: /[.,&]/.test(ch) });
      });
      node.parentNode.insertBefore(frag, node);
      node.remove();
      pieces.push({ node, wrappers, chars });
    });
    return pieces;
  }

  function restore(pieces) {
    pieces.forEach(({ node, wrappers }) => {
      wrappers[0].parentNode.insertBefore(node, wrappers[0]);
      wrappers.forEach((w) => w.remove());
    });
  }

  function run() {
    clearTimeout(timer);
    if (active) restore(active);
    active = null;

    const finalLabel = title.textContent.replace(/\s+/g, " ").trim();
    title.setAttribute("aria-label", finalLabel);
    // Trava a altura por garantia.
    title.style.minHeight = `${title.offsetHeight}px`;

    const pieces = prepare();
    active = pieces;
    const all = pieces.flatMap((p) => p.chars);
    if (!all.length) return;

    let revealed = 0;
    let sub = 0;
    function tick() {
      all.forEach((c, i) => {
        c.el.textContent = c.fixed || i < revealed ? c.ch : CHARS[Math.floor(Math.random() * CHARS.length)];
      });
      sub += 1;
      if (sub >= SCRAMBLES_PER) {
        sub = 0;
        revealed += 1;
      }
      if (revealed > all.length) {
        restore(pieces);
        active = null;
        title.style.minHeight = "";
        title.removeAttribute("aria-label");
        return;
      }
      timer = setTimeout(tick, FRAME_MS);
    }
    tick();
  }

  let lastLang = window.nqI18n?.lang;
  setTimeout(run, 250);
  window.addEventListener("nq:langchange", (e) => {
    if (e.detail?.lang === lastLang) return; // o evento inicial do i18n.js não conta
    lastLang = e.detail?.lang;
    run();
  });
})();
