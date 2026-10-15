// Contato (páginas Sobre e Trabalhos): hora de Curitiba ao lado do "Agenda aberta".
(function () {
  const clock = document.querySelector("[data-clock]");
  if (!clock) return;
  const t = (en, pt) => (window.nqI18n ? window.nqI18n.t(en, pt) : en);
  const fmt = (pt) =>
    new Intl.DateTimeFormat(pt ? "pt-BR" : "en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
  const tick = () => {
    const pt = window.nqI18n?.lang === "pt";
    clock.textContent = `${fmt(pt).format(new Date())} ${t("in Curitiba", "em Curitiba")}`;
  };
  tick();
  setInterval(tick, 20000);
  window.addEventListener("nq:langchange", tick);
})();
