// Entrada dos blocos das páginas de work: cada título, texto ou imagem sobe
// ~24px enquanto aparece, em meio segundo, quando entra na tela. Blocos que
// entram juntos (ex.: as duas imagens de um par) saem com um leve escalonamento.
//
// O estado escondido só existe com a classe .js-reveal no <html>, que este
// script põe — sem JS, ou com "reduzir movimento", tudo aparece normalmente.
(function () {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const SELECTOR = [
    ".work-title",
    ".work-intro-meta",
    ".work-tagline",
    ".work-intro-text",
    ".work-block--media",
    ".work-block--text",
    ".work-block--statement",
    ".work-block--capture",
    ".work-block--palette",
    ".work-block--pair figure",
    ".work-block--gallery figure",
    ".work-block--slide",
    ".work-testimonial",
    ".work-credits",
    ".work-visit",
    ".work-next-content",
    ".reveal",
  ].join(",");

  const STAGGER_MS = 90;
  const MAX_STAGGER_MS = 360;

  const targets = Array.from(document.querySelectorAll(SELECTOR));
  if (!targets.length) return;

  document.documentElement.classList.add("js-reveal");
  targets.forEach((el) => el.setAttribute("data-reveal", ""));

  // O navegador pode entregar blocos que entram juntos em callbacks
  // separados; o escalonamento conta os revelados numa janela curta de tempo.
  const BATCH_WINDOW_MS = 120;
  let batchStart = 0;
  let batchCount = 0;

  const observer = new IntersectionObserver(
    (entries) => {
      // Ordena pela posição na tela para o escalonamento seguir a leitura.
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => {
          const ra = a.boundingClientRect;
          const rb = b.boundingClientRect;
          return ra.top - rb.top || ra.left - rb.left;
        });
      if (!visible.length) return;

      const now = performance.now();
      if (now - batchStart > BATCH_WINDOW_MS) {
        batchStart = now;
        batchCount = 0;
      }

      visible.forEach((entry) => {
        const el = entry.target;
        const delay = Math.min(batchCount * STAGGER_MS, MAX_STAGGER_MS);
        el.style.setProperty("--reveal-delay", `${delay}ms`);
        el.classList.add("is-revealed");
        observer.unobserve(el);
        batchCount += 1;
      });
    },
    // Dispara um pouco antes do fim da tela, para não revelar "no rodapé".
    { rootMargin: "0px 0px -8% 0px", threshold: 0.01 }
  );

  targets.forEach((el) => observer.observe(el));
})();
