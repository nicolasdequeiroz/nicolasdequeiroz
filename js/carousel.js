// Carrossel 3D da home.
//
// O GSAP é a única fonte de movimento: a rotação do carrossel e a pose da cena
// são tweens/sets do GSAP (nada de transition CSS em cima, que brigaria com
// ele). Draggable + InertiaPlugin cuidam do arrasto (mouse, toque e caneta,
// com inércia e encaixe no card mais próximo); quickTo cuida do parallax do
// mouse; matchMedia separa celular, desktop e "reduzir movimento".

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
    autoplayDelay: 5, // s
    resumeAfter: 6, // s sem interação até o autoplay voltar
    introSpinDuration: 2.5, // s
    stepDuration: 1, // s
    wheelStep: 40, // px acumulados para girar um card
    wheelCooldown: 450, // ms: trava após um passo (inércia do trackpad)
    wheelIdle: 140, // ms sem eventos = gesto terminou
    dragRotateFactor: { desktop: 0.5, mobile: 0.26 }, // graus por px arrastado (celular: mais calmo)
    touchTiltFactor: { desktop: 0.3, mobile: 0.14 },
    touchTiltRange: { min: -40, max: 30 },
    throwResistance: { desktop: 1000, mobile: 2600 }, // maior = a inércia do arremesso morre mais rápido
    mouseTilt: { rotateX: -8, rotateY: 12, translateX: 30, translateY: 20 },
    mobileQuery: "(max-width: 767.98px)",
    pointerFineQuery: "(hover: hover) and (pointer: fine) and (min-width: 768px)",
    worksUrl: "/data/works.json",
  };

  const carousel = document.getElementById("carousel-target");
  const wrapper = document.getElementById("mouse-wrapper");
  const scene = document.getElementById("scene");
  if (!carousel || !wrapper) return;

  const hasGsap = typeof window.gsap !== "undefined";
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobileQuery = window.matchMedia(CONFIG.mobileQuery);
  const reduceMotion = () => reduceQuery.matches;
  const isMobile = () => mobileQuery.matches;

  let currentIndex = 0;
  let itemCount = 0;

  const t = (en, pt) => (window.nqI18n ? window.nqI18n.t(en, pt) : en);
  const dotLabel = (i) => `${t("Go to project", "Ir para o projeto")} ${i + 1} ${t("of", "de")} ${itemCount}`;
  let theta = 0;
  let dots = [];
  let cards = [];
  let liveRegion = null;
  let parallaxEnabled = true;
  let parallaxWarmup = false;
  let lastParallaxX = null;
  let lastParallaxY = null;
  let lastDragEnd = 0;
  let introRunning = false;
  let userTouchedIntro = false;

  const PARALLAX_WARMUP_MIN_PX = 16;
  const PARALLAX_RESUME_DELAY_MS = 700;
  const CLICK_AFTER_DRAG_MS = 120;

  const baseTilt = () => (isMobile() ? CONFIG.baseTilt.mobile : CONFIG.baseTilt.desktop);
  const mod = (n) => ((n % itemCount) + itemCount) % itemCount;
  const activeIndex = () => mod(currentIndex);

  // --- Movimento (GSAP, com fallback instantâneo se a CDN falhar) ---------

  function setRotation(deg) {
    if (hasGsap) gsap.set(carousel, { rotationY: deg });
    else carousel.style.transform = `rotateY(${deg}deg)`;
  }

  function tweenRotation(deg, duration, ease) {
    if (!hasGsap || reduceMotion()) {
      if (hasGsap) gsap.killTweensOf(carousel);
      setRotation(deg);
      return;
    }
    gsap.to(carousel, { rotationY: deg, duration, ease, overwrite: true });
  }

  const getRotation = () =>
    hasGsap ? Number(gsap.getProperty(carousel, "rotationY")) : -currentIndex * theta;

  function setSceneTilt(rx) {
    if (!scene) return;
    if (hasGsap) gsap.set(scene, { rotationX: rx });
    else scene.style.transform = `rotateX(${rx}deg)`;
  }

  // --- Dados e DOM --------------------------------------------------------

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
      link.draggable = false; // sem "fantasma" de link ao arrastar com o mouse

      const img = document.createElement("img");
      img.src = work.thumb;
      img.alt = work.title;
      img.draggable = false;

      // Capa vertical no celular (mesmo breakpoint do hero da página de work,
      // para o morph card → hero partir e chegar na mesma imagem).
      if (work.hero?.mobile) {
        const picture = document.createElement("picture");
        const source = document.createElement("source");
        source.media = CONFIG.mobileQuery;
        source.srcset = work.hero.mobile;
        picture.append(source, img);
        link.appendChild(picture);
      } else {
        link.appendChild(img);
      }
      card.appendChild(link);
      carousel.appendChild(card);
      return card;
    });
  }

  function buildDots() {
    const nav = document.createElement("nav");
    nav.className = "carousel-dots";
    nav.id = "carousel-dots";
    nav.setAttribute("aria-label", t("Select project", "Selecionar projeto"));

    dots = Array.from({ length: itemCount }, (_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "carousel-dot";
      dot.setAttribute("aria-label", dotLabel(i));
      dot.addEventListener("click", () => {
        goTo(i, { announce: true });
        pauseThenResume();
      });
      nav.appendChild(dot);
      return dot;
    });

    const footer = document.querySelector("footer");
    (footer || wrapper.closest("main") || document.body).appendChild(nav);
  }

  // Anuncia o projeto ativo para leitores de tela — só em trocas feitas pela
  // pessoa (teclado, dots, arrasto), nunca no autoplay.
  function buildLiveRegion() {
    liveRegion = document.createElement("p");
    liveRegion.className = "visually-hidden";
    liveRegion.setAttribute("aria-live", "polite");
    wrapper.appendChild(liveRegion);
  }

  function announce() {
    if (!liveRegion) return;
    const img = cards[activeIndex()]?.querySelector("img");
    liveRegion.textContent = `${t("Project", "Projeto")} ${activeIndex() + 1} ${t("of", "de")} ${itemCount}: ${img?.alt ?? ""}`;
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

  // Só o card central: recebe o view-transition-name (precisa ser único), entra
  // na ordem do Tab e fica visível para leitores de tela. Os outros continuam
  // clicáveis (giram até o centro), mas saem do teclado — eles podem estar de
  // costas no 3D.
  function updateActiveCard() {
    const active = activeIndex();
    cards.forEach((card, i) => {
      const isActive = i === active;
      card.classList.toggle("is-active", isActive);
      const link = card.querySelector("a");
      if (link) link.tabIndex = isActive ? 0 : -1;
      if (isActive) card.removeAttribute("aria-hidden");
      else card.setAttribute("aria-hidden", "true");
      const img = card.querySelector("img");
      if (img) img.style.viewTransitionName = isActive ? "work-media" : "";
    });
  }

  function applyRadius() {
    const radius = isMobile() ? CONFIG.radius.mobile : CONFIG.radius.desktop;
    cards.forEach((card, i) => {
      card.style.transform = `rotateY(${theta * i}deg) translateZ(${radius}px)`;
    });
  }

  // --- Navegação ----------------------------------------------------------

  function syncState() {
    syncDots();
    updateActiveCard();
  }

  function rotateTo(index, { duration = CONFIG.stepDuration, ease = "expo.out", announce: say = false } = {}) {
    currentIndex = index;
    tweenRotation(-currentIndex * theta, duration, ease);
    syncState();
    if (say) announce();
  }

  const step = (direction, opts) => rotateTo(currentIndex + direction, opts);

  // Pelo caminho mais curto até o card alvo.
  function goTo(targetMod, opts) {
    let diff = targetMod - activeIndex();
    if (diff > itemCount / 2) diff -= itemCount;
    if (diff < -itemCount / 2) diff += itemCount;
    rotateTo(currentIndex + diff, opts);
  }

  // --- Autoplay -----------------------------------------------------------
  // gsap.delayedCall usa o ticker do GSAP, que para sozinho com a aba em
  // segundo plano — nada de "pular" vários cards ao voltar para a aba.

  let autoplayCall = null;
  let resumeCall = null;
  let hovering = false;
  let focusInside = false;
  const isHeld = () => hovering || focusInside;

  function stopAutoplay() {
    autoplayCall?.kill();
    autoplayCall = null;
  }

  function startAutoplay() {
    stopAutoplay();
    if (!hasGsap || reduceMotion() || isHeld()) return;
    const tick = () => {
      step(1);
      autoplayCall = gsap.delayedCall(CONFIG.autoplayDelay, tick);
    };
    autoplayCall = gsap.delayedCall(CONFIG.autoplayDelay, tick);
  }

  function pauseThenResume() {
    if (introRunning) userTouchedIntro = true;
    stopAutoplay();
    resumeCall?.kill();
    resumeCall = null;
    if (!hasGsap || reduceMotion() || isHeld()) return;
    resumeCall = gsap.delayedCall(CONFIG.resumeAfter, startAutoplay);
  }

  // Mouse sobre um card ou foco de teclado no carrossel/dots seguram a roda.
  function bindHold() {
    const dotsNav = document.getElementById("carousel-dots");
    const hold = () => {
      stopAutoplay();
      resumeCall?.kill();
      resumeCall = null;
    };
    const release = () => {
      if (!isHeld()) pauseThenResume();
    };

    // Só os cards: o wrapper ocupa a tela toda e pararia o autoplay sempre.
    carousel.addEventListener("mouseenter", () => {
      hovering = true;
      hold();
    });
    carousel.addEventListener("mouseleave", () => {
      hovering = false;
      release();
    });
    [wrapper, dotsNav].forEach((el) => {
      if (!el) return;
      el.addEventListener("focusin", (e) => {
        // Só foco de teclado: um clique no dot também foca e travaria o giro.
        if (!e.target.matches(":focus-visible")) return;
        focusInside = true;
        hold();
      });
      el.addEventListener("focusout", (e) => {
        if (wrapper.contains(e.relatedTarget) || dotsNav?.contains(e.relatedTarget)) return;
        focusInside = false;
        release();
      });
    });
  }

  // --- Entrada: teclado, roda/trackpad, arrasto, clique -------------------

  // Setas giram quando o foco está no carrossel ou nos dots. Se o foco estava
  // num card, ele acompanha o novo card central.
  function bindKeyboard() {
    const dotsNav = document.getElementById("carousel-dots");
    const onKey = (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      pauseThenResume();
      step(e.key === "ArrowRight" ? 1 : -1, { announce: true });
      if (wrapper.contains(document.activeElement)) {
        cards[activeIndex()]?.querySelector("a")?.focus({ preventScroll: true });
      }
    };
    wrapper.addEventListener("keydown", onKey);
    dotsNav?.addEventListener("keydown", onKey);
  }

  // Um passo por gesto. O trackpad continua mandando eventos por inércia
  // depois que o dedo sai; travamos após cada passo e só destravamos quando o
  // gesto termina (pausa nos eventos) ou um gesto novo começa (delta cresce).
  function bindWheel() {
    let acc = 0;
    let locked = false;
    let lockedAt = 0;
    let lastAbs = 0;
    let idleTimer = null;

    wrapper.addEventListener(
      "wheel",
      (e) => {
        // Horizontal fica com o navegador (gesto de voltar/avançar).
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        e.preventDefault();
        pauseThenResume();

        const abs = Math.abs(e.deltaY);
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          locked = false;
          acc = 0;
          lastAbs = 0;
        }, CONFIG.wheelIdle);

        if (locked) {
          const cooled = performance.now() - lockedAt > CONFIG.wheelCooldown;
          const newGesture = abs > lastAbs * 1.5 + 4;
          lastAbs = abs;
          if (!(cooled && newGesture)) return;
          locked = false;
          acc = 0;
        }
        lastAbs = abs;

        acc += e.deltaY;
        if (Math.abs(acc) >= CONFIG.wheelStep) {
          step(Math.sign(acc));
          acc = 0;
          locked = true;
          lockedAt = performance.now();
        }
      },
      { passive: false }
    );
  }

  // Arrasto com Draggable: um proxy invisível recebe o "x" do gesto e nós o
  // convertemos em rotação. O InertiaPlugin continua o giro depois de soltar
  // e o snap encaixa no card mais próximo. Toque também inclina a cena (Y).
  function bindDrag() {
    if (!hasGsap || typeof window.Draggable === "undefined") return;
    gsap.registerPlugin(Draggable);
    const hasInertia = typeof window.InertiaPlugin !== "undefined";
    if (hasInertia) gsap.registerPlugin(InertiaPlugin);

    const proxy = document.createElement("div");
    let startRot = 0;
    let startY = 0;
    let touchTilt = false;

    const pick = (o) => (isMobile() ? o.mobile : o.desktop);
    const factor = () => pick(CONFIG.dragRotateFactor);
    const rotFromX = (x) => startRot + x * factor();
    const snapRot = (rot) => Math.round(rot / theta) * theta;

    function settleTo(rot) {
      currentIndex = Math.round(-rot / theta);
      syncState();
      announce();
    }

    Draggable.create(proxy, {
      type: "x",
      trigger: wrapper,
      dragClickables: true, // os cards são links; o arrasto começa neles também
      minimumMovement: 6,
      allowContextMenu: true,
      inertia: hasInertia && !reduceMotion(),
      maxDuration: 1.2,
      throwResistance: pick(CONFIG.throwResistance),
      snap: {
        x: (endX) => (snapRot(rotFromX(endX)) - startRot) / factor(),
      },
      onPress(e) {
        // Um clique simples não pode congelar um giro em andamento: o tween
        // só é interrompido quando o arrasto de fato começa (onDragStart).
        startY = this.pointerY;
        touchTilt = e.pointerType === "touch" || e.type === "touchstart";
        gsap.set(proxy, { x: 0 });
        this.update();
      },
      onDragStart() {
        gsap.killTweensOf(carousel);
        pauseThenResume();
        // O gesto já andou minimumMovement px; a rotação parte de onde está.
        startRot = getRotation() - this.x * factor();
      },
      onDrag() {
        const rot = rotFromX(this.x);
        setRotation(rot);
        currentIndex = Math.round(-rot / theta);
        syncDots();
        if (touchTilt && scene) {
          const { min, max } = CONFIG.touchTiltRange;
          const tilt = baseTilt() + (startY - this.pointerY) * pick(CONFIG.touchTiltFactor);
          setSceneTilt(Math.max(min, Math.min(max, tilt)));
        }
      },
      onThrowUpdate() {
        setRotation(rotFromX(this.x));
        currentIndex = Math.round(-getRotation() / theta);
        syncDots();
      },
      onThrowComplete() {
        settleTo(getRotation());
      },
      onDragEnd() {
        lastDragEnd = performance.now();
        if (touchTilt && scene && !reduceMotion()) {
          gsap.to(scene, { rotationX: baseTilt(), duration: 0.6, ease: "power3.out" });
        }
        // Sem inércia, o snap não roda sozinho: encaixa aqui.
        if (!this.tween) {
          const target = snapRot(getRotation());
          tweenRotation(target, 0.6, "power3.out");
          settleTo(target);
        }
      },
    });
  }

  // Só o card central navega; clicar num lateral gira para centralizá-lo.
  // Um clique logo depois de um arrasto é descartado.
  function bindClick() {
    carousel.addEventListener(
      "click",
      (e) => {
        if (performance.now() - lastDragEnd < CLICK_AFTER_DRAG_MS) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        const card = e.target.closest(".carousel-item");
        if (!card) return;

        const index = cards.indexOf(card);
        if (index === -1) return;

        if (index !== activeIndex()) {
          e.preventDefault();
          goTo(index, { announce: true });
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

  // Parallax do mouse com gsap.quickTo: cada propriedade da cena persegue a
  // pose do cursor com o mesmo ease, sem saltos — inclusive no primeiro
  // movimento depois de voltar de uma work page.
  function bindPointerParallax() {
    if (!hasGsap || !scene) return;

    const mm = gsap.matchMedia();
    mm.add(
      { fine: CONFIG.pointerFineQuery, reduce: "(prefers-reduced-motion: reduce)" },
      (ctx) => {
        const { fine, reduce } = ctx.conditions;
        if (!fine || reduce) return;

        const { rotateX, rotateY, translateX, translateY } = CONFIG.mouseTilt;
        const opts = { duration: 0.9, ease: "power3.out" };
        const toRX = gsap.quickTo(scene, "rotationX", opts);
        const toRY = gsap.quickTo(scene, "rotationY", opts);
        const toX = gsap.quickTo(scene, "x", opts);
        const toY = gsap.quickTo(scene, "y", opts);

        // Mede o wrapper só quando ele muda de tamanho, não a cada movimento.
        let rect = wrapper.getBoundingClientRect();
        const ro = new ResizeObserver(() => {
          rect = wrapper.getBoundingClientRect();
        });
        ro.observe(wrapper);

        const onMove = (e) => {
          if (!parallaxEnabled) {
            lastParallaxX = e.clientX;
            lastParallaxY = e.clientY;
            return;
          }

          // Após voltar de uma work page, ignora o mouse "parado" em cima do
          // carrossel — só reage depois de um movimento real. A primeira
          // amostra apenas registra a posição (nada de aplicar pose de cara).
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

          const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
          const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
          toRX(baseTilt() + y * rotateX);
          toRY(x * rotateY);
          toX(x * translateX);
          toY(y * translateY);
        };

        const onLeave = () => {
          lastParallaxX = null;
          lastParallaxY = null;
          toRX(baseTilt());
          toRY(0);
          toX(0);
          toY(0);
        };

        wrapper.addEventListener("mousemove", onMove);
        wrapper.addEventListener("mouseleave", onLeave);
        return () => {
          ro.disconnect();
          wrapper.removeEventListener("mousemove", onMove);
          wrapper.removeEventListener("mouseleave", onLeave);
        };
      }
    );
  }

  // --- Volta de uma página de work e intro --------------------------------

  // Voltando de uma página de work: centraliza, sem animar, o card do projeto
  // que estávamos visualizando e o marca com view-transition-name, para o hero
  // fazer o morph de volta exatamente para ele. Retorna true se aplicou.
  function setupReturnState(works) {
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

    currentIndex = idx;
    setRotation(-currentIndex * theta);
    syncState();
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

  // Um giro completo de entrada. Se a pessoa mexer no carrossel durante o
  // giro, o autoplay espera a pausa normal em vez de começar no fim da intro.
  function playIntro() {
    if (!hasGsap || reduceMotion()) {
      syncState();
      return;
    }
    introRunning = true;
    currentIndex = itemCount; // uma volta inteira; o card ativo é o mesmo
    syncState();
    gsap.fromTo(
      carousel,
      { rotationY: 0 },
      {
        rotationY: -360,
        duration: CONFIG.introSpinDuration,
        ease: "power3.out",
        onComplete() {
          introRunning = false;
          if (!userTouchedIntro) startAutoplay();
        },
      }
    );
  }

  // --- Init ---------------------------------------------------------------

  let works;
  try {
    works = await loadWorks();
  } catch (err) {
    console.error("Carrossel: não foi possível carregar os projetos.", err);
    return;
  }

  if (works.length === 0) return;

  buildCards(works);
  itemCount = cards.length;
  if (itemCount === 0) return;
  theta = 360 / itemCount;

  wrapper.setAttribute("role", "group");
  const applyWrapperLabels = () => {
    wrapper.setAttribute("aria-roledescription", t("carousel", "carrossel"));
    wrapper.setAttribute("aria-label", t("Featured projects. Use the arrow keys to switch.", "Projetos em destaque. Use as setas para trocar."));
  };
  applyWrapperLabels();

  buildDots();
  buildLiveRegion();

  // Troca de idioma: rótulos de acessibilidade criados aqui acompanham.
  window.addEventListener("nq:langchange", () => {
    applyWrapperLabels();
    document.getElementById("carousel-dots")?.setAttribute("aria-label", t("Select project", "Selecionar projeto"));
    dots.forEach((dot, i) => dot.setAttribute("aria-label", dotLabel(i)));
  });
  applyRadius();
  setSceneTilt(baseTilt());
  setRotation(0);
  syncState();

  mobileQuery.addEventListener("change", () => {
    applyRadius();
    setSceneTilt(baseTilt());
  });

  bindWheel();
  bindDrag();
  bindClick();
  bindKeyboard();
  bindPointerParallax();
  bindHold();

  const returning = setupReturnState(works);
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
