(function () {
  const nav = document.getElementById("site-nav");
  const toggle = document.getElementById("nav-toggle");
  const overlay = document.getElementById("nav-overlay");

  if (!nav || !toggle || !overlay) return;

  const pills  = Array.from(overlay.querySelectorAll(".nav-pill-link"));
  const labels = Array.from(overlay.querySelectorAll(".nav-pill-label"));

  const isDesktop = () => window.innerWidth >= 900;
  const hasGsap   = () => typeof gsap !== "undefined";

  let isOpen = false;

  const t = (en, pt) => (window.nqI18n ? window.nqI18n.t(en, pt) : en);
  const toggleLabel = () => (isOpen ? t("Close menu", "Fechar menu") : t("Open menu", "Abrir menu"));
  window.addEventListener("nq:langchange", () => toggle.setAttribute("aria-label", toggleLabel()));

  // Inicializa o estado oculto dos pills via GSAP (roda uma vez)
  function initPills() {
    if (!hasGsap()) return;
    gsap.set(pills,  { scale: 0, transformOrigin: "50% 50%" });
    gsap.set(labels, { y: 20, autoAlpha: 0 });
  }

  // Abre o overlay com stagger dos pills
  function openMenu() {
    isOpen = true;
    toggle.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", toggleLabel());
    overlay.style.display = "flex";
    overlay.setAttribute("aria-hidden", "false");

    // Propaga o tema dark/light para o overlay (para o sibling CSS funcionar
    // com o tema vigente no momento em que o menu abre).
    overlay.classList.toggle("nav--on-dark", nav.classList.contains("nav--on-dark"));

    if (!hasGsap()) return;

    gsap.killTweensOf([...pills, ...labels]);
    gsap.set(pills,  { scale: 0 });
    gsap.set(labels, { y: 20, autoAlpha: 0 });

    pills.forEach((pill, i) => {
      const rot   = isDesktop() ? parseFloat(pill.dataset.rotation || 0) : 0;
      const delay = i * 0.1 + gsap.utils.random(-0.02, 0.02);

      gsap.timeline({ delay })
        .to(pill, {
          scale: 1,
          rotation: rot,
          duration: 0.5,
          ease: "back.out(1.5)",
        })
        .to(labels[i], {
          y: 0,
          autoAlpha: 1,
          duration: 0.4,
          ease: "power3.out",
        }, "-=0.38");
    });
  }

  // Fecha o overlay
  function closeMenu(onComplete) {
    if (!isOpen) return;
    isOpen = false;
    toggle.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", toggleLabel());

    if (!hasGsap()) {
      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden", "true");
      onComplete?.();
      return;
    }

    gsap.killTweensOf([...pills, ...labels]);
    gsap.to(labels, { y: 20, autoAlpha: 0, duration: 0.15, ease: "power3.in" });
    gsap.to(pills,  {
      scale: 0,
      rotation: 0,
      duration: 0.22,
      ease: "power3.in",
      onComplete: () => {
        overlay.style.display = "none";
        overlay.setAttribute("aria-hidden", "true");
        overlay.classList.remove("nav--on-dark");
        onComplete?.();
      },
    });
  }

  // Eventos do toggle
  toggle.addEventListener("click", () => {
    if (isOpen) closeMenu();
    else openMenu();
  });

  // Clique fora dos pills fecha o menu
  overlay.addEventListener("click", (e) => {
    if (!e.target.closest(".nav-pill-link")) closeMenu();
  });

  // Escape fecha o menu
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) {
      closeMenu();
      toggle.focus();
    }
  });

  // Links âncora (#...) fecham o menu antes de rolar
  pills.forEach((pill) => {
    if (pill.getAttribute("href")?.startsWith("#")) {
      pill.addEventListener("click", () => closeMenu());
    }
  });

  // Atualiza rotação ao redimensionar
  window.addEventListener("resize", () => {
    if (!isOpen || !hasGsap()) return;
    pills.forEach((pill) => {
      gsap.set(pill, { rotation: isDesktop() ? parseFloat(pill.dataset.rotation || 0) : 0 });
    });
  });

  // Inicializa pills — GSAP pode não ter carregado ainda se o CDN for lento,
  // então tentamos imediatamente e, se não disponível, aguardamos o load.
  if (hasGsap()) {
    initPills();
  } else {
    window.addEventListener("load", initPills, { once: true });
  }
})();

// ─── DECRYPTED TEXT no logo da nav ────────────────────────────────────────────
// Reveal sequencial (esquerda → direita). Mouse enter (ou page load na home)
// dispara uma vez; o mouse leave NÃO interrompe — a animação sempre termina.
// A largura do bubble é travada antes do scramble para evitar resize.
(function () {
  const CHARS         = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const FRAME_MS      = 18;   // ms por frame (mais rápido)
  const SCRAMBLES_PER = 2;    // frames de scramble por char antes de travar

  const logoText = document.querySelector(".bubble-logo .site-nav-logo");
  if (!logoText) return;

  const bubble   = logoText.closest(".bubble-logo");
  const original = logoText.textContent;
  let timer    = null;
  let revealed = 0;
  let subFrame = 0;

  function render(revealedCount) {
    return Array.from(original).map((ch, i) => {
      if (ch === " ") return " ";
      if (i < revealedCount) return ch;
      return CHARS[Math.floor(Math.random() * CHARS.length)];
    }).join("");
  }

  function start() {
    if (timer !== null) return; // já rodando, ignora

    // Trava largura do span para evitar que o bubble redimensione
    logoText.style.width    = logoText.offsetWidth + "px";
    logoText.style.overflow = "hidden";

    revealed = 0;
    subFrame = 0;
    tick();
  }

  function tick() {
    logoText.textContent = render(revealed);
    subFrame++;

    if (subFrame >= SCRAMBLES_PER) {
      subFrame = 0;
      revealed++;
    }

    if (revealed > original.length) {
      logoText.textContent  = original;
      logoText.style.width    = "";
      logoText.style.overflow = "";
      timer = null;
      return;
    }

    timer = setTimeout(tick, FRAME_MS);
  }

  // Mouse enter dispara, mas mouse leave não interrompe
  bubble.addEventListener("mouseenter", start);

  // Page load na home: dispara automaticamente após o carrossel assentar
  if (!document.body.classList.contains("work-page")) {
    setTimeout(start, 800);
  }
})();
