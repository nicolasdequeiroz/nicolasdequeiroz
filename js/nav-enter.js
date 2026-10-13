(function () {
  const nav = document.getElementById("site-nav");
  if (!nav || !document.body.classList.contains("work-page")) return;

  let done = false;
  let safety = 0;

  function reveal() {
    if (done) return;
    done = true;
    clearTimeout(safety);
    nav.classList.remove("nav--enter-pending");
    nav.classList.add("nav--entering", "nav--glass-in");

    // O botão flutuante "back to home" entra junto com a nav/blur (move-in).
    const back = document.querySelector(".back-home");
    if (back) back.classList.add("back-home--in");

    peekSheet();
  }

  // A folha branca sobe junto com a nav: um "scroll automático" que revela o
  // título e a ficha do projeto por cima do hero. Só na chegada (página no topo),
  // e qualquer gesto da pessoa cancela.
  function peekSheet() {
    if (window.scrollY > 4 || location.hash) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const meta = document.querySelector(".work-intro-meta");
    if (!meta) return;

    const PEEK_PAD = 40; // respiro abaixo da ficha
    const target = Math.max(
      0,
      Math.round(meta.getBoundingClientRect().bottom + window.scrollY + PEEK_PAD - window.innerHeight)
    );
    if (target < 40) return;

    const DURATION = 1100;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // easeInOutCubic
    const html = document.documentElement;
    const prevBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto"; // o site tem scroll-behavior: smooth

    let raf = 0;
    const stop = () => {
      cancelAnimationFrame(raf);
      html.style.scrollBehavior = prevBehavior;
      ["wheel", "touchstart", "keydown", "pointerdown"].forEach((t) => window.removeEventListener(t, stop));
    };
    ["wheel", "touchstart", "keydown", "pointerdown"].forEach((t) =>
      window.addEventListener(t, stop, { passive: true, once: true })
    );

    const start = performance.now() + 150; // começa logo depois da nav
    function frame(now) {
      const t = Math.min(1, Math.max(0, (now - start) / DURATION));
      window.scrollTo(0, target * ease(t));
      if (t < 1) raf = requestAnimationFrame(frame);
      else stop();
    }
    raf = requestAnimationFrame(frame);
  }

  function afterPaint() {
    requestAnimationFrame(() => requestAnimationFrame(reveal));
  }

  // Rede de segurança: a nav nunca pode ficar presa escondida.
  safety = setTimeout(reveal, 1600);

  if ("onpagereveal" in window) {
    // Chromium: quando há View Transition (clique no card), espera o morph
    // terminar para revelar a nav e fazer o blur entrar por fade — natural e
    // determinístico, sem depender do carregamento total da imagem.
    window.addEventListener(
      "pagereveal",
      (event) => {
        if (event.viewTransition) event.viewTransition.finished.finally(afterPaint);
        else afterPaint();
      },
      { once: true }
    );
  } else {
    // Sem View Transitions (Safari/Firefox): revela assim que a página aparece.
    window.addEventListener("pageshow", afterPaint, { once: true });
    if (document.readyState !== "loading") afterPaint();
  }
})();
