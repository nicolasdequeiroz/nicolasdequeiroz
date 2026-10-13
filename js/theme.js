// Seletor claro/escuro. O tema inicial já foi aplicado pelo script inline no
// <head> (antes da pintura, sem flash); aqui cuidamos do botão, da animação
// da troca e de manter todas as páginas/abas no mesmo tema.
(function () {
  const KEY = "nq:theme";
  const root = document.documentElement;
  const button = document.getElementById("theme-toggle");
  const metaTheme = document.querySelector('meta[name="theme-color"]');

  const readStored = () => {
    try {
      return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  };

  const t = (en, pt) => (window.nqI18n ? window.nqI18n.t(en, pt) : en);
  const label = (dark) =>
    dark ? t("Turn on light mode", "Ativar modo claro") : t("Turn on dark mode", "Ativar modo escuro");

  function apply(theme) {
    if (theme === "dark") root.dataset.theme = "dark";
    else delete root.dataset.theme;

    const dark = theme === "dark";
    if (button) {
      button.setAttribute("aria-pressed", String(dark));
      button.setAttribute("aria-label", label(dark));
    }
    if (metaTheme) {
      metaTheme.setAttribute("content", getComputedStyle(root).backgroundColor);
    }
  }

  function save(theme) {
    try {
      localStorage.setItem(KEY, theme);
    } catch {}
  }

  apply(readStored());
  window.addEventListener("nq:langchange", () => {
    button?.setAttribute("aria-label", label(root.dataset.theme === "dark"));
  });

  // Páginas restauradas do cache do navegador (botão voltar) não rodam o
  // script do <head> de novo: reaplicamos o tema salvo ao reaparecerem.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) apply(readStored());
  });
  // Outra aba trocou o tema: acompanha.
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) apply(readStored());
  });

  if (!button) return;

  button.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    save(next);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduce) {
      apply(next);
      return;
    }

    // O novo tema se revela num círculo que nasce no botão e cobre a tela.
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    // Raio com folga (1,5×): o círculo passa dos cantos antes do fim da animação,
    // então nunca sobra um pedaço do tema antigo para "estalar" no final.
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) * 1.5;
    root.style.setProperty("--theme-x", `${x}px`);
    root.style.setProperty("--theme-y", `${y}px`);
    root.style.setProperty("--theme-r", `${r}px`);

    // .theme-switching tira os view-transition-name da página (hero, card,
    // logo) só durante a troca: senão eles viram camadas próprias e a capa
    // "salta" por cima de tudo. A página inteira vira um único quadro.
    root.classList.add("theme-switching");
    const transition = document.startViewTransition(() => apply(next));
    transition.finished.finally(() => {
      root.classList.remove("theme-switching");
      root.style.removeProperty("--theme-x");
      root.style.removeProperty("--theme-y");
      root.style.removeProperty("--theme-r");
    });
  });
})();
