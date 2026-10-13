// Capturado em escopo de módulo porque o pagereveal dispara depois do
// DOMContentLoaded; a init define o callback quando estamos voltando de uma
// página de work, para tocar o "settle" 3D assim que o morph termina.
let __nqOnReveal = null;
if ("onpagereveal" in window) {
  window.addEventListener(
    "pagereveal",
    (e) => {
      if (__nqOnReveal) __nqOnReveal(e);
    },
    { once: true }
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  const CONFIG = {
    radius: { mobile: 240, desktop: 750 },
    baseTilt: { mobile: -10, desktop: 0 },
    autoplayDelay: 5000,
    resumeAfter: 6000,
    introSpinDuration: 2500,
    wheelStep: 40,
    swipeThreshold: 50,
    clickGuardThreshold: 10,
    dragRotateFactor: 0.5,
    touchTiltFactor: 0.3,
    touchTiltRange: { min: -40, max: 30 },
    mouseTilt: { rotateX: -8, rotateY: 12, translateX: 30, translateY: 20 },
    mobileQuery: "(max-width: 767.98px)",
    pointerFineQuery: "(hover: hover) and (pointer: fine) and (min-width: 768px)",
    worksUrl: "/data/works.json",
  };

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const carousel = document.getElementById("carousel-target");
  const wrapper = document.getElementById("mouse-wrapper");
  const scene = document.getElementById("scene");
  if (!carousel || !wrapper) return;

  const mobileQuery = window.matchMedia(CONFIG.mobileQuery);

  let currentIndex = 0;
  let itemCount = 0;
  let theta = 0;
  let autoplayTimer = null;
  let resumeTimer = null;
  let dots = [];
  let cards = [];
  let suppressClick = false;
  let parallaxEnabled = true;
  let parallaxWarmup = false;
  let lastParallaxX = null;
  let lastParallaxY = null;

  const PARALLAX_WARMUP_MIN_PX = 16;
  const PARALLAX_RESUME_DELAY_MS = 700;

  const isMobile = () => mobileQuery.matches;
  const baseTilt = () =>
    isMobile() ? CONFIG.baseTilt.mobile : CONFIG.baseTilt.desktop;
  const activeIndex = () => ((currentIndex % itemCount) + itemCount) % itemCount;

  async function loadWorks() {
    // Preferimos os dados embutidos (inline) no HTML: assim o carrossel monta de
    // forma síncrona, ANTES do snapshot da View Transition na volta — condição
    // necessária para o hero conseguir fazer o morph de volta para o card.
    const inline = document.getElementById("works-data");
    if (inline && inline.textContent.trim()) {
      try {
        return JSON.parse(inline.textContent).works ?? [];
      } catch (err) {
        console.warn("Carrossel: works-data inline inválido, usando fetch.", err);
      }
    }
    const res = await fetch(CONFIG.worksUrl);
    if (!res.ok) throw new Error(`Falha ao carregar ${CONFIG.worksUrl}`);
    const data = await res.json();
    return data.works ?? [];
  }

  function buildCards(works) {
    if (carousel.children.length > 0) return;

    cards = works.map((work) => {
      const card = document.createElement("div");
      card.className = "carousel-item";

      const link = document.createElement("a");
      link.className = "carousel-link-wrapper";
      link.href = `work/${work.slug}/`;

      const img = document.createElement("img");
      img.src = work.thumb;
      img.alt = work.title;

      link.appendChild(img);
      card.appendChild(link);
      carousel.appendChild(card);
      return card;
    });
  }

  function buildDots() {
    const nav = document.createElement("nav");
    nav.className = "carousel-dots";
    nav.id = "carousel-dots";
    nav.setAttribute("aria-label", "Selecionar projeto");

    dots = Array.from({ length: itemCount }, (_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "carousel-dot";
      dot.setAttribute("aria-label", `Ir para o projeto ${i + 1} de ${itemCount}`);
      dot.addEventListener("click", () => {
        goTo(i);
        pauseThenResume();
      });
      nav.appendChild(dot);
      return dot;
    });

    const footer = document.querySelector("footer");
    (footer || wrapper.closest("main") || document.body).appendChild(nav);
  }

  function syncDots() {
    const active = activeIndex();
    dots.forEach((dot, i) => {
      const isActive = i === active;
      dot.classList.toggle("is-active", isActive);
      if (isActive) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
  }

  // Apenas o card central recebe o view-transition-name (precisa ser único)
  // e a classe que o marca como clicável/navegável.
  function updateActiveCard() {
    const active = activeIndex();
    cards.forEach((card, i) => {
      const isActive = i === active;
      card.classList.toggle("is-active", isActive);
      const img = card.querySelector("img");
      if (img) img.style.viewTransitionName = isActive ? "work-media" : "";
    });
  }

  function applyRadius() {
    const radius = isMobile() ? CONFIG.radius.mobile : CONFIG.radius.desktop;
    carousel.querySelectorAll(".carousel-item").forEach((card, i) => {
      card.style.transform = `rotateY(${theta * i}deg) translateZ(${radius}px)`;
    });
  }

  function resetSceneTilt() {
    if (scene) scene.style.transform = `rotateX(${baseTilt()}deg)`;
  }

  function rotateCarousel() {
    carousel.style.transform = `rotateY(${currentIndex * -theta}deg)`;
    syncDots();
    updateActiveCard();
  }

  function step(direction) {
    currentIndex += direction;
    rotateCarousel();
  }

  function goTo(targetMod) {
    let diff = targetMod - activeIndex();
    if (diff > itemCount / 2) diff -= itemCount;
    if (diff < -itemCount / 2) diff += itemCount;
    currentIndex += diff;
    rotateCarousel();
  }

  function startAutoplay() {
    if (prefersReducedMotion) return;
    stopAutoplay();
    autoplayTimer = setInterval(() => step(1), CONFIG.autoplayDelay);
  }

  function stopAutoplay() {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
  }

  function pauseThenResume() {
    stopAutoplay();
    clearTimeout(resumeTimer);
    if (prefersReducedMotion) return;
    resumeTimer = setTimeout(startAutoplay, CONFIG.resumeAfter);
  }

  // Voltando de uma página de work: centraliza, sem animar, o card do projeto
  // que estávamos visualizando e o marca com view-transition-name, para o hero
  // fazer o morph de volta exatamente para ele. Retorna true se aplicou.
  function setupReturnState() {
    let slug = null;
    try {
      slug = sessionStorage.getItem("nq:returnSlug");
      sessionStorage.removeItem("nq:returnSlug");
    } catch {}
    if (!slug) return false;

    const fromWork = /\/work\//.test(document.referrer || "");
    if (!fromWork) return false;

    const idx = works.findIndex((w) => w.slug === slug);
    if (idx < 0) return false;

    const prevCarousel = carousel.style.transition;
    const prevScene = scene ? scene.style.transition : "";
    carousel.style.transition = "none";
    if (scene) scene.style.transition = "none";

    currentIndex = idx;
    rotateCarousel(); // posiciona o container e marca o card ativo como work-media

    void carousel.offsetWidth; // commita antes de reabilitar as transições
    carousel.style.transition = prevCarousel;
    if (scene) scene.style.transition = prevScene;
    return true;
  }

  // Ao pousar o card de volta no carrossel a cena fica exatamente onde o morph
  // a deixou — qualquer movimento aqui lê como um "pulo" no fim do load. Só
  // reativamos o parallax do mouse, com warmup, depois de um respiro.
  function resumeParallaxAfterReturn() {
    parallaxEnabled = false;
    parallaxWarmup = false;
    setTimeout(() => {
      parallaxEnabled = true;
      parallaxWarmup = true;
    }, PARALLAX_RESUME_DELAY_MS);
  }

  function playIntro() {
    if (prefersReducedMotion) {
      rotateCarousel();
      return;
    }
    carousel.style.transition = `transform ${CONFIG.introSpinDuration}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
    carousel.style.transform = "rotateY(-360deg)";
    currentIndex = itemCount;
    syncDots();

    setTimeout(() => {
      carousel.style.transition = "transform 1s cubic-bezier(0.19, 1, 0.22, 1)";
      startAutoplay();
    }, CONFIG.introSpinDuration + 100);
  }

  function bindWheel() {
    let acc = 0;
    wrapper.addEventListener(
      "wheel",
      (e) => {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        e.preventDefault();
        pauseThenResume();
        acc += e.deltaY;
        if (acc > CONFIG.wheelStep) {
          step(1);
          acc = 0;
        } else if (acc < -CONFIG.wheelStep) {
          step(-1);
          acc = 0;
        }
      },
      { passive: false }
    );
  }

  function bindTouch() {
    let startX = 0;
    let startY = 0;
    let dragging = false;

    wrapper.addEventListener(
      "touchstart",
      (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        dragging = true;
        pauseThenResume();
        carousel.style.transition = "none";
        if (scene) scene.style.transition = "none";
      },
      { passive: true }
    );

    wrapper.addEventListener(
      "touchmove",
      (e) => {
        if (!dragging) return;
        const dx = startX - e.touches[0].clientX;
        const dy = startY - e.touches[0].clientY;

        const angle = currentIndex * -theta - dx * CONFIG.dragRotateFactor;
        const tilt = Math.max(
          CONFIG.touchTiltRange.min,
          Math.min(CONFIG.touchTiltRange.max, baseTilt() + dy * CONFIG.touchTiltFactor)
        );

        carousel.style.transform = `rotateY(${angle}deg)`;
        if (scene) scene.style.transform = `rotateX(${tilt}deg)`;
      },
      { passive: true }
    );

    wrapper.addEventListener("touchend", (e) => {
      dragging = false;
      carousel.style.transition = "transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)";
      if (scene)
        scene.style.transition = "transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)";

      const dx = startX - e.changedTouches[0].clientX;
      suppressClick = Math.abs(dx) > CONFIG.clickGuardThreshold;

      if (dx > CONFIG.swipeThreshold) step(1);
      else if (dx < -CONFIG.swipeThreshold) step(-1);
      else rotateCarousel();

      resetSceneTilt();
    });
  }

  // Só o card central navega; clicar num lateral gira para centralizá-lo.
  function bindClick() {
    carousel.addEventListener(
      "click",
      (e) => {
        if (suppressClick) {
          e.preventDefault();
          e.stopPropagation();
          suppressClick = false;
          return;
        }

        const card = e.target.closest(".carousel-item");
        if (!card) return;

        const index = cards.indexOf(card);
        if (index === -1) return;

        if (index !== activeIndex()) {
          e.preventDefault();
          goTo(index);
          pauseThenResume();
          return;
        }

        // Card central: esconde nav antes da View Transition cross-document
        const nav = document.getElementById("site-nav");
        if (nav) nav.classList.add("is-navigating");
      },
      true
    );
  }

  // Parallax do mouse com lerp contínuo em rAF: a cena sempre desliza da pose
  // atual em direção à pose do cursor. Sem saltos — inclusive no primeiro
  // movimento depois de voltar de uma work page (a pose parte do descanso).
  function bindPointerParallax() {
    if (
      prefersReducedMotion ||
      !scene ||
      !window.matchMedia(CONFIG.pointerFineQuery).matches
    ) {
      return;
    }

    const { rotateX, rotateY, translateX, translateY } = CONFIG.mouseTilt;
    const EASE = 0.09; // fator de aproximação por frame (~60fps)
    const SETTLE_EPS = 0.05;

    const basePose = () => ({ rx: baseTilt(), ry: 0, tx: 0, ty: 0 });

    let pose = basePose(); // pose renderizada no momento
    let target = basePose(); // pose alvo (derivada do cursor)
    let rafId = null;

    function apply() {
      scene.style.transform =
        `rotateX(${pose.rx.toFixed(3)}deg) rotateY(${pose.ry.toFixed(3)}deg) ` +
        `translateX(${pose.tx.toFixed(2)}px) translateY(${pose.ty.toFixed(2)}px)`;
    }

    function frame() {
      const dist =
        Math.abs(target.rx - pose.rx) +
        Math.abs(target.ry - pose.ry) +
        Math.abs(target.tx - pose.tx) +
        Math.abs(target.ty - pose.ty);

      if (dist < SETTLE_EPS) {
        pose = { ...target };
        apply();
        scene.style.transition = ""; // devolve a transição padrão do CSS
        rafId = null;
        return;
      }

      pose.rx += (target.rx - pose.rx) * EASE;
      pose.ry += (target.ry - pose.ry) * EASE;
      pose.tx += (target.tx - pose.tx) * EASE;
      pose.ty += (target.ty - pose.ty) * EASE;
      apply();
      rafId = requestAnimationFrame(frame);
    }

    function setTarget(next) {
      target = next;
      if (rafId === null) {
        // O rAF assume a suavização; a transição CSS atrapalharia o lerp.
        scene.style.transition = "none";
        rafId = requestAnimationFrame(frame);
      }
    }

    wrapper.addEventListener("mousemove", (e) => {
      if (!parallaxEnabled) {
        lastParallaxX = e.clientX;
        lastParallaxY = e.clientY;
        return;
      }

      // Após voltar de uma work page, ignora o mouse "parado" em cima do
      // carrossel — só reage depois de um movimento real. A primeira amostra
      // apenas registra a posição (nada de aplicar pose de cara).
      if (parallaxWarmup) {
        if (lastParallaxX === null) {
          lastParallaxX = e.clientX;
          lastParallaxY = e.clientY;
          return;
        }
        const dx = e.clientX - lastParallaxX;
        const dy = e.clientY - lastParallaxY;
        if (Math.hypot(dx, dy) < PARALLAX_WARMUP_MIN_PX) return;
        parallaxWarmup = false;
      }

      lastParallaxX = e.clientX;
      lastParallaxY = e.clientY;

      const rect = wrapper.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      setTarget({
        rx: y * rotateX,
        ry: x * rotateY,
        tx: x * translateX,
        ty: y * translateY,
      });
    });

    wrapper.addEventListener("mouseleave", () => {
      lastParallaxX = null;
      lastParallaxY = null;
      setTarget(basePose());
    });
  }

  let works;
  try {
    works = await loadWorks();
  } catch (err) {
    console.error("Carrossel: não foi possível carregar os projetos.", err);
    return;
  }

  if (works.length === 0) return;

  buildCards(works);
  itemCount = carousel.querySelectorAll(".carousel-item").length;
  if (itemCount === 0) return;
  theta = 360 / itemCount;

  wrapper.setAttribute("role", "group");
  wrapper.setAttribute("aria-roledescription", "carrossel");
  wrapper.setAttribute("aria-label", "Projetos em destaque");

  buildDots();
  applyRadius();
  resetSceneTilt();
  syncDots();
  updateActiveCard();

  mobileQuery.addEventListener("change", () => {
    applyRadius();
    resetSceneTilt();
  });
  window.addEventListener("resize", applyRadius);

  bindWheel();
  bindTouch();
  bindClick();
  bindPointerParallax();

  const returning = setupReturnState();
  if (returning) {
    // Sem giro de intro: o card já está no lugar para receber o morph do hero.
    parallaxEnabled = false;
    __nqOnReveal = (e) => {
      if (e && e.viewTransition) e.viewTransition.finished.finally(resumeParallaxAfterReturn);
      else resumeParallaxAfterReturn();
    };
    if (!("onpagereveal" in window)) setTimeout(resumeParallaxAfterReturn, 200);
    pauseThenResume();
  } else {
    setTimeout(playIntro, 100);
  }
});
