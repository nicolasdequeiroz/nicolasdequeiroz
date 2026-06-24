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

  // Pequeno "assentar" 3D ao pousar o card de volta no carrossel, para deixar
  // claro que o hero voltou para o espaço tridimensional.
  function playReturnSettle() {
    if (prefersReducedMotion || !scene) return;

    parallaxEnabled = false;
    parallaxWarmup = false;

    scene.style.transition = "none";
    scene.style.transform = `rotateX(${baseTilt() - 7}deg) rotateY(10deg)`;
    void scene.offsetWidth;
    scene.style.transition = "transform 1.4s cubic-bezier(0.2, 0.8, 0.2, 1)";
    resetSceneTilt();

    const onSettleEnd = (e) => {
      if (e.propertyName !== "transform") return;
      scene.removeEventListener("transitionend", onSettleEnd);
      // Espera o settle terminar + um respiro antes de aceitar parallax do mouse.
      setTimeout(() => {
        parallaxEnabled = true;
        parallaxWarmup = true;
      }, PARALLAX_RESUME_DELAY_MS);
    };
    scene.addEventListener("transitionend", onSettleEnd);
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

  function bindPointerParallax() {
    if (
      prefersReducedMotion ||
      !scene ||
      !window.matchMedia(CONFIG.pointerFineQuery).matches
    ) {
      return;
    }

    const { rotateX, rotateY, translateX, translateY } = CONFIG.mouseTilt;
    wrapper.addEventListener("mousemove", (e) => {
      if (!parallaxEnabled) {
        lastParallaxX = e.clientX;
        lastParallaxY = e.clientY;
        return;
      }

      // Após voltar de uma work page, ignora o mouse "parado" em cima do
      // carrossel — só aplica parallax depois de um movimento real.
      if (parallaxWarmup) {
        if (lastParallaxX !== null) {
          const dx = e.clientX - lastParallaxX;
          const dy = e.clientY - lastParallaxY;
          if (Math.hypot(dx, dy) < PARALLAX_WARMUP_MIN_PX) return;
        }
        parallaxWarmup = false;
        scene.style.transition = "transform 0.8s ease-out";
      } else {
        scene.style.transition = "";
      }

      lastParallaxX = e.clientX;
      lastParallaxY = e.clientY;

      const rect = wrapper.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      scene.style.transform =
        `rotateX(${y * rotateX}deg) rotateY(${x * rotateY}deg) ` +
        `translateX(${x * translateX}px) translateY(${y * translateY}px)`;
    });
    wrapper.addEventListener("mouseleave", () => {
      lastParallaxX = null;
      lastParallaxY = null;
      resetSceneTilt();
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
      if (e && e.viewTransition) e.viewTransition.finished.finally(playReturnSettle);
      else playReturnSettle();
    };
    if (!("onpagereveal" in window)) setTimeout(playReturnSettle, 200);
    pauseThenResume();
  } else {
    setTimeout(playIntro, 100);
  }
});
