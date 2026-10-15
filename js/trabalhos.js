// Página Trabalhos: enquanto o mouse passa por uma linha da lista, o rastro
// de imagens do case (várias fotos dele) vai surgindo atrás do cursor.
// Port em JS puro do "Image Trail" (variante 1) do React Bits (MIT,
// reactbits.dev), com o GSAP que o site já usa. Só ponteiro fino com hover:
// no toque, cada linha mostra a miniatura da capa. Com "reduzir movimento"
// ligado, o rastro não roda.
(function () {
  const list = document.querySelector(".tr-list");
  const layer = document.querySelector(".tr-trail");
  if (!list || !layer || typeof window.gsap === "undefined") return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const THRESHOLD = 80; // px de movimento do mouse entre uma imagem e a próxima
  const lerp = (a, b, n) => (1 - n) * a + n * b;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  class Trail {
    constructor(urls) {
      this.items = urls.map((url) => {
        const el = document.createElement("div");
        el.className = "tr-trail-img";
        const img = document.createElement("img");
        img.alt = "";
        img.decoding = "async";
        img.src = url;
        el.appendChild(img);
        layer.appendChild(el);
        gsap.set(el, { opacity: 0, scale: 1, x: 0, y: 0 });
        return { el, w: 0, h: 0 };
      });
      this.pos = 0;
      this.z = 1;
      this.held = null;
      this.mouse = { x: 0, y: 0 };
      this.last = { x: 0, y: 0 };
      this.cache = { x: 0, y: 0 };
      this.raf = null;
      this.running = false;
    }

    // As caixas têm tamanho fixo por CSS; medimos uma vez por início.
    measure() {
      this.items.forEach((it) => {
        const r = it.el.getBoundingClientRect();
        it.w = r.width;
        it.h = r.height;
      });
    }

    start(e) {
      this.mouse = { x: e.clientX, y: e.clientY };
      this.last = { ...this.mouse };
      this.cache = { ...this.mouse };
      if (this.running) return;
      this.running = true;
      this.measure();
      this.next(); // já entra com uma imagem sob o cursor
      const tick = () => {
        if (!this.running) return;
        this.cache.x = lerp(this.cache.x, this.mouse.x, 0.1);
        this.cache.y = lerp(this.cache.y, this.mouse.y, 0.1);
        if (dist(this.mouse, this.last) > THRESHOLD) {
          this.next();
          this.last = { ...this.mouse };
        }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }

    move(e) {
      this.mouse = { x: e.clientX, y: e.clientY };
    }

    // Para de gerar imagens novas; as que estão no ar terminam a animação e a
    // que estava parada sob o cursor sai.
    stop() {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      if (this.held) this.fade(this.held);
      this.held = null;
    }

    fade(it) {
      gsap.to(it.el, { duration: 0.4, ease: "power3", opacity: 0, scale: 0.2, overwrite: true });
    }

    next() {
      this.z += 1;
      this.pos = this.pos < this.items.length - 1 ? this.pos + 1 : 0;
      const it = this.items[this.pos];
      // A imagem que ficou parada sob o cursor cede lugar à nova.
      if (this.held && this.held !== it && !this.held.moving) this.fade(this.held);
      this.held = it;
      it.moving = true;
      gsap.killTweensOf(it.el);
      gsap
        .timeline({
          // Depois de chegar ao cursor, a última imagem fica na tela enquanto o
          // mouse estiver parado sobre a linha; só sai quando vem a próxima.
          onComplete: () => {
            it.moving = false;
            if (!(this.running && this.held === it)) this.fade(it);
          },
        })
        .fromTo(
          it.el,
          {
            opacity: 1,
            scale: 1,
            zIndex: this.z,
            x: this.cache.x - it.w / 2,
            y: this.cache.y - it.h / 2,
          },
          { duration: 0.4, ease: "power1", x: this.mouse.x - it.w / 2, y: this.mouse.y - it.h / 2 },
          0
        );
    }
  }

  const trails = new Map(); // link → Trail (criado no primeiro hover)
  let current = null;

  const trailFor = (link) => {
    if (!trails.has(link)) {
      const urls = (link.dataset.trail || "").split("|").filter(Boolean);
      trails.set(link, urls.length ? new Trail(urls) : null);
    }
    return trails.get(link);
  };

  list.querySelectorAll(".tr-link").forEach((link) => {
    // Pré-carrega as imagens do case assim que o mouse chega perto.
    link.addEventListener("pointerenter", (e) => {
      const t = trailFor(link);
      if (!t) return;
      if (current && current !== t) current.stop();
      current = t;
      t.start(e);
    });
    link.addEventListener("pointermove", (e) => current && current.move(e));
    link.addEventListener("pointerleave", () => {
      const t = trails.get(link);
      if (t) t.stop();
      if (current === t) current = null;
    });
  });

  window.addEventListener("scroll", () => current && current.stop(), { passive: true });
  window.addEventListener("resize", () => current && current.measure());
})();
