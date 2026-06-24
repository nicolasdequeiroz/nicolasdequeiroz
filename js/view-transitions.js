// Coreografia das View Transitions cross-document (home <-> páginas de work).
//
// - Marca a transição com um "type" conforme a direção (nq-to-work / nq-to-home),
//   permitindo coreografias distintas no CSS.
// - Ao SAIR de uma página de work rumo à home, guarda o slug do projeto para que
//   a home consiga recolocar o card certo no centro do carrossel e fazer o hero
//   voltar (morph) exatamente para ele.
(function () {
  const RETURN_KEY = "nq:returnSlug";

  function kindOf(pathname) {
    return /\/work\/[^/]+\/?$/.test(pathname) ? "work" : "home";
  }

  function slugOf(pathname) {
    const m = pathname.match(/\/work\/([^/]+)\/?/);
    return m ? m[1] : null;
  }

  function pathnameFrom(url) {
    try {
      return new URL(url, location.href).pathname;
    } catch {
      return null;
    }
  }

  function addType(vt, type) {
    if (vt && vt.types && typeof vt.types.add === "function") vt.types.add(type);
  }

  // Estando numa página de work, registra o slug imediatamente. Assim, qualquer
  // navegação de volta para a home (logo, links da nav, botão "back to home")
  // recoloca o card certo — sem depender de o pageswap popular e.activation.
  if (kindOf(location.pathname) === "work") {
    try {
      sessionStorage.setItem(RETURN_KEY, slugOf(location.pathname) || "");
    } catch {}
  }

  // Página que está SAINDO.
  window.addEventListener("pageswap", (e) => {
    const from = kindOf(location.pathname);
    const toPath = e.activation && e.activation.entry && pathnameFrom(e.activation.entry.url);
    const to = toPath ? kindOf(toPath) : null;

    if (from === "work" && to === "home") {
      try {
        sessionStorage.setItem(RETURN_KEY, slugOf(location.pathname) || "");
      } catch {}
      addType(e.viewTransition, "nq-to-home");
    } else if (from === "home" && to === "work") {
      addType(e.viewTransition, "nq-to-work");
    }
  });

  // Página que está CHEGANDO.
  window.addEventListener("pagereveal", (e) => {
    if (!e.viewTransition) return;
    const to = kindOf(location.pathname);
    const fromPath = pathnameFrom(document.referrer);
    const from = fromPath ? kindOf(fromPath) : null;

    if (from === "work" && to === "home") addType(e.viewTransition, "nq-to-home");
    else if (from === "home" && to === "work") addType(e.viewTransition, "nq-to-work");
  });
})();
