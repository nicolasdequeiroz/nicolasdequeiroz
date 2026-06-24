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
