document.addEventListener("DOMContentLoaded", () => {
  const nav = document.getElementById("site-nav");
  if (!nav) return;

  const DARK_THRESHOLD = 0.42;
  const isWorkPage = document.body.classList.contains("work-page");
  const isHomePage = !isWorkPage && document.getElementById("carousel-target");
  // Superfícies escuras fora dos cases (ex.: o contato da página sobre).
  const darkBlocks = Array.from(document.querySelectorAll("[data-nav-dark]"));
  // Folha que passa por cima dos blocos escuros (ex.: o verso sticky do sobre).
  const sheet = document.querySelector("[data-nav-sheet]");

  let heroIsDark = false;
  let ticking = false;

  function setTheme(onDark) {
    nav.classList.toggle("nav--on-dark", onDark);
    nav.classList.toggle("nav--on-light", !onDark);
  }

  function luminanceFromImage(img) {
    if (!img.complete || !img.naturalWidth) return null;

    const canvas = document.createElement("canvas");
    const w = 48;
    const h = 24;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    const srcH = Math.max(1, img.naturalHeight * 0.12);
    try {
      ctx.drawImage(img, 0, 0, img.naturalWidth, srcH, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      }
      return sum / (data.length / 4) / 255;
    } catch {
      return null;
    }
  }

  function sampleHero() {
    const media = document.querySelector(".work-media");
    if (!media) return;

    if (media.tagName === "IMG") {
      const apply = () => {
        const lum = luminanceFromImage(media);
        if (lum !== null) heroIsDark = lum < DARK_THRESHOLD;
        updateTheme();
      };
      if (media.complete) apply();
      else media.addEventListener("load", apply, { once: true });
    } else {
      heroIsDark = true;
      updateTheme();
    }
  }

  const spans = (el, y) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top < y && r.bottom > y;
  };

  // O hero é sticky durante a página inteira, então o retângulo dele sempre
  // cobre a nav. O que decide o tema é a superfície que está POR CIMA na altura
  // da nav: o next case (escuro), o corpo branco ou, se nenhum, o hero.
  function surfaceUnderNav() {
    const navRect = nav.getBoundingClientRect();
    const y = navRect.top + navRect.height * 0.5;
    if (spans(document.querySelector(".work-next"), y)) return "dark";
    if (spans(document.querySelector(".work-body"), y)) return "light";
    if (spans(document.querySelector(".work-hero"), y)) return "hero";
    return "light";
  }

  function updateTheme() {
    if (isHomePage) {
      setTheme(false);
      return;
    }
    if (!isWorkPage) {
      const navRect = nav.getBoundingClientRect();
      const y = navRect.top + navRect.height * 0.5;
      if (sheet && spans(sheet, y)) return setTheme(false);
      setTheme(darkBlocks.some((el) => spans(el, y)));
      return;
    }
    const surface = surfaceUnderNav();
    setTheme(surface === "dark" || (surface === "hero" && heroIsDark));
  }

  function onScrollOrResize() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateTheme();
      ticking = false;
    });
  }

  if (isHomePage) {
    setTheme(false);
  } else if (isWorkPage) {
    sampleHero();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
  } else {
    updateTheme();
    if (darkBlocks.length) {
      window.addEventListener("scroll", onScrollOrResize, { passive: true });
      window.addEventListener("resize", onScrollOrResize);
    }
  }

  window.addEventListener("pagereveal", () => {
    if (isWorkPage) sampleHero();
    else updateTheme();
  });
});
