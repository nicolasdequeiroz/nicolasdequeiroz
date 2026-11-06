// Sobre: ao passar o mouse sobre "Origin" ou "Base" na ficha, fotos do lugar
// (Itaporanga, Curitiba) surgem atrás do cursor, o mesmo rastro de imagens da
// página Trabalhos (React Bits "Image Trail", MIT), com o GSAP que o site já usa.
// As fotos de cada lugar ficam em `data-trail` (caminhos separados por "|") no
// item da ficha; sem `data-trail`, nada acontece. Só ponteiro fino com hover e
// sem "reduzir movimento".
(function () {
  const places = Array.from(document.querySelectorAll(".ab-place[data-trail]"));
  if (!places.length || typeof window.gsap === "undefined") return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const THRESHOLD = 80; // px de movimento do mouse entre uma imagem e a próxima
  const lerp = (a, b, n) => (1 - n) * a + n * b;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  const layer = document.createElement("div");
  layer.className = "ab-trail";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);

  class Trail {
    constructor(urls) {
      this.items = urls.map((url) => {
        const el = document.createElement("div");
        el.className = "ab-trail-img";
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
      if (this.held && this.held !== it && !this.held.moving) this.fade(this.held);
      this.held = it;
      it.moving = true;
      gsap.killTweensOf(it.el);
      gsap
        .timeline({
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

  const trails = new Map(); // item da ficha → Trail (criado no primeiro hover)
  let current = null;

  const trailFor = (place) => {
    if (!trails.has(place)) {
      const urls = (place.dataset.trail || "").split("|").filter(Boolean);
      trails.set(place, urls.length ? new Trail(urls) : null);
    }
    return trails.get(place);
  };

  places.forEach((place) => {
    place.addEventListener("pointerenter", (e) => {
      const t = trailFor(place);
      if (!t) return;
      if (current && current !== t) current.stop();
      current = t;
      t.start(e);
    });
    place.addEventListener("pointermove", (e) => current && current.move(e));
    place.addEventListener("pointerleave", () => {
      const t = trails.get(place);
      if (t) t.stop();
      if (current === t) current = null;
    });
  });

  window.addEventListener("scroll", () => current && current.stop(), { passive: true });
  window.addEventListener("resize", () => current && current.measure());
})();
