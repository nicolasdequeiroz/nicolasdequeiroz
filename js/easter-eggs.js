// Easter eggs da página sobre: botões escondidos no texto abrem um <dialog>
// em tela cheia. O módulo de cada um (discos, globo) só é baixado no primeiro
// clique. A abertura é um círculo que nasce no botão — o mesmo gesto da
// troca de tema — e o fechamento volta para ele.
(function () {
  const triggers = document.querySelectorAll("[data-egg]");
  if (!triggers.length) return;

  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const controllers = new Map(); // id do dialog → Promise<controller>
  let lastTrigger = null;

  function load(trigger, dialog) {
    if (!controllers.has(dialog.id)) {
      const url = new URL(trigger.dataset.module, location.href).href;
      controllers.set(
        dialog.id,
        import(url).then((mod) => mod.init(dialog)).catch((err) => {
          console.error("Easter egg: não foi possível carregar", err);
          controllers.delete(dialog.id);
          return null;
        })
      );
    }
    return controllers.get(dialog.id);
  }

  function circle(trigger) {
    const rect = trigger.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    return { from: `circle(0px at ${x}px ${y}px)`, to: `circle(${r}px at ${x}px ${y}px)` };
  }

  async function open(trigger) {
    const dialog = document.getElementById(trigger.dataset.egg);
    if (!dialog || dialog.open) return;
    lastTrigger = trigger;
    trigger.setAttribute("aria-busy", "true");
    const controller = await load(trigger, dialog);
    trigger.removeAttribute("aria-busy");
    if (!controller) return;

    document.documentElement.classList.add("egg-open");
    dialog.showModal();
    controller.onOpen?.();

    if (typeof gsap !== "undefined" && !reduce()) {
      const { from, to } = circle(trigger);
      gsap.fromTo(dialog, { clipPath: from }, { clipPath: to, duration: 0.8, ease: "power3.inOut", clearProps: "clipPath" });
    }
  }

  async function close(dialog) {
    const controller = await controllers.get(dialog.id);
    controller?.onClose?.();

    const done = () => {
      dialog.close();
      document.documentElement.classList.remove("egg-open");
      lastTrigger?.focus({ preventScroll: true });
    };

    if (typeof gsap !== "undefined" && !reduce() && lastTrigger) {
      const { from, to } = circle(lastTrigger);
      gsap.fromTo(dialog, { clipPath: to }, { clipPath: from, duration: 0.6, ease: "power3.inOut", onComplete: done, clearProps: "clipPath" });
    } else {
      done();
    }
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => open(trigger));
    // Pré-carrega o módulo quando a pessoa sinaliza interesse.
    const warm = () => {
      const dialog = document.getElementById(trigger.dataset.egg);
      if (dialog) load(trigger, dialog);
    };
    trigger.addEventListener("pointerenter", warm, { once: true });
    trigger.addEventListener("focus", warm, { once: true });
  });

  document.querySelectorAll("dialog.egg").forEach((dialog) => {
    // Esc: o módulo pode consumir (ex.: guardar o disco antes de fechar).
    dialog.addEventListener("cancel", async (e) => {
      e.preventDefault();
      const controller = await controllers.get(dialog.id);
      if (controller?.onEscape?.()) return;
      close(dialog);
    });
    dialog.addEventListener("click", (e) => {
      if (e.target.closest("[data-egg-close]")) close(dialog);
    });
  });
})();
