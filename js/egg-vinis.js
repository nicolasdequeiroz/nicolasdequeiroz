// Easter egg: caixote de discos.
//
// Os discos ficam em pé num caixote 3D (CSS 3D + GSAP). Rolar, arrastar ou
// usar as setas "folheia" o caixote: os discos já vistos tombam para a frente,
// o atual fica de pé e os próximos mostram só a borda de cima. Clicar no disco
// da frente (ou Enter) tira ele do caixote: a capa vai para o centro, o vinil
// desliza para fora da capa e começa a girar devagar até 33⅓ rpm.

const VISIBLE_BEHIND = 9; // quantos discos atrás do atual aparecem
const VISIBLE_FRONT = 4; // quantos já folheados (tombados) aparecem
const RPM_SECONDS = 1.8; // uma volta a 33⅓ rpm

const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Inclinação levemente diferente por disco, estável entre visitas.
function jitter(seed) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((h % 1000) / 1000) * 2.4 - 1.2;
}

function coverHTML(disco, base) {
  if (disco.capa) {
    return `<img src="${base}${esc(disco.capa)}" alt="" loading="lazy" decoding="async" draggable="false">`;
  }
  // Sem capa baixada: capa tipográfica na cor do disco.
  return `<span class="sleeve-generated" style="--disc:${esc(disco.cor || "#1a1a1a")}"><span>${esc(disco.album)}</span><small>${esc(disco.artista)}</small></span>`;
}

export async function init(dialog) {
  const base = dialog.dataset.base || "";
  const res = await fetch(`${base}data/vinis.json`, { cache: "no-cache" });
  const data = await res.json();
  const discos = data.discos ?? [];
  const total = discos.length;

  dialog.innerHTML = `
    <div class="egg-inner egg-vinis">
      <header class="egg-head">
        <div>
          <h2 class="egg-title" id="egg-vinis-title" data-pt="Caixote de discos">Record crate</h2>
          <p class="egg-sub" data-pt="${total} discos · role, arraste ou use as setas">${total} records · scroll, drag or use the arrow keys</p>
        </div>
        <div class="egg-actions">
          <button type="button" class="egg-button" data-shuffle data-pt="Me surpreenda">Surprise me</button>
          <button type="button" class="egg-close" data-egg-close aria-label="Close record crate" data-pt-aria-label="Fechar caixote de discos">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
      </header>

      <div class="crate" tabindex="0" role="group" aria-roledescription="crate" data-pt-aria-roledescription="caixote" aria-label="Records. Use the arrow keys to flip through and Enter to play." data-pt-aria-label="Discos. Use as setas para folhear e Enter para tocar.">
        <div class="crate-stage">
          ${discos
            .map(
              (d, i) => `
            <button type="button" class="sleeve" data-i="${i}" tabindex="-1" aria-label="${esc(d.album)} — ${esc(d.artista)}">
              ${coverHTML(d, base)}
            </button>`
            )
            .join("")}
        </div>
        <div class="crate-box" aria-hidden="true"></div>
      </div>

      <div class="crate-caption" aria-hidden="true">
        <p class="crate-album"></p>
        <p class="crate-meta"></p>
      </div>

      <div class="player" hidden>
        <div class="player-record">
          <div class="disc" aria-hidden="true">
            <div class="disc-rotor">
              <div class="disc-label"></div>
            </div>
            <div class="disc-sheen"></div>
          </div>
          <div class="player-sleeve"></div>
        </div>
        <div class="player-info">
          <p class="player-genre"></p>
          <h3 class="player-album"></h3>
          <p class="player-artist"></p>
          <p class="player-note"></p>
          <button type="button" class="egg-button" data-put-back data-pt="Guardar no caixote">Put back in the crate</button>
        </div>
      </div>

      ${data.exemplo ? `<p class="egg-sample" data-pt="Lista de exemplo — a coleção de verdade entra aqui.">Sample list — the real collection goes here.</p>` : ""}
      <p class="visually-hidden" aria-live="polite" data-live></p>
    </div>`;

  window.nqI18n?.translate(dialog);

  const crate = dialog.querySelector(".crate");
  const stage = dialog.querySelector(".crate-stage");
  const sleeves = Array.from(dialog.querySelectorAll(".sleeve"));
  const captionAlbum = dialog.querySelector(".crate-album");
  const captionMeta = dialog.querySelector(".crate-meta");
  const player = dialog.querySelector(".player");
  const playerSleeve = dialog.querySelector(".player-sleeve");
  const disc = dialog.querySelector(".disc");
  const rotor = dialog.querySelector(".disc-rotor");
  const label = dialog.querySelector(".disc-label");
  const live = dialog.querySelector("[data-live]");

  let current = 0;
  let playing = false;
  let busy = false;
  let spin = null;

  // --- Caixote ----------------------------------------------------------

  function layout(animate = true) {
    sleeves.forEach((sleeve, i) => {
      const d = i - current;
      const seed = discos[i].album;
      let props;
      if (d < 0) {
        // Já folheados: inclinados para a frente, apoiados na borda do caixote,
        // e somem depois de alguns.
        props = { z: -d * 12, yPercent: 4, rotationX: -58, rotation: jitter(seed) * 0.5, opacity: Math.max(0, 1 + d * 0.34) };
      } else if (d === 0) {
        // O da frente sobe um pouco para fora do caixote, como quem puxa o disco.
        props = { z: 0, yPercent: -16, rotationX: -8, rotation: 0, opacity: 1 };
      } else {
        // Atrás: em pé, cada vez mais fundo — só a borda de cima aparece.
        props = { z: -d * 34, yPercent: -d * 1.2, rotationX: -2, rotation: jitter(seed), opacity: d > VISIBLE_BEHIND ? 0 : 1 };
      }
      sleeve.style.zIndex = String(total - Math.abs(d));
      sleeve.classList.toggle("is-current", d === 0);
      if (animate && !reduce()) gsap.to(sleeve, { ...props, duration: 0.6, ease: "power3.out", overwrite: true });
      else gsap.set(sleeve, props);
    });

    const disco = discos[current];
    captionAlbum.textContent = disco.album;
    captionMeta.textContent = `${disco.artista} · ${disco.ano}`;
    if (!reduce()) gsap.fromTo([captionAlbum, captionMeta], { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.04, overwrite: true });
  }

  function announce(prefix = "") {
    const d = discos[current];
    live.textContent = `${prefix}${window.nqI18n?.t("Record", "Disco") ?? "Record"} ${current + 1} ${window.nqI18n?.t("of", "de") ?? "of"} ${total}: ${d.album}, ${d.artista}, ${d.ano}.`;
  }

  function go(index, { quiet = false } = {}) {
    const next = Math.max(0, Math.min(total - 1, index));
    if (next === current) {
      // Fim do caixote: um tranco curto em vez de nada.
      if (!reduce()) gsap.fromTo(sleeves[current], { x: 0 }, { x: index > current ? -10 : 10, duration: 0.08, yoyo: true, repeat: 1 });
      return;
    }
    current = next;
    layout();
    if (!quiet) announce();
  }

  // --- Vitrola: tirar e guardar o disco ---------------------------------

  function fillPlayer(disco) {
    playerSleeve.innerHTML = coverHTML(disco, base);
    label.style.backgroundImage = disco.capa ? `url("${base}${disco.capa}")` : "none";
    label.style.backgroundColor = disco.cor || "#c33";
    disc.style.setProperty("--disc", disco.cor && disco.cor !== "#1a1a1a" ? disco.cor : "#141414");
    dialog.querySelector(".player-genre").textContent = `${disco.genero} · ${disco.ano}`;
    dialog.querySelector(".player-album").textContent = disco.album;
    dialog.querySelector(".player-artist").textContent = disco.artista;
    dialog.querySelector(".player-note").textContent = disco.nota || "";
  }

  function play() {
    if (playing || busy) return;
    busy = true;
    playing = true;
    const disco = discos[current];
    fillPlayer(disco);

    const from = sleeves[current].getBoundingClientRect();
    player.hidden = false;
    crate.setAttribute("aria-hidden", "true");
    const to = playerSleeve.getBoundingClientRect();

    spin?.kill();
    spin = gsap.to(rotor, { rotation: "+=360", duration: RPM_SECONDS, ease: "none", repeat: -1, paused: true });

    if (reduce()) {
      gsap.set(dialog.querySelectorAll(".crate, .crate-caption"), { opacity: 0 });
      gsap.set(disc, { xPercent: 52 });
      busy = false;
      announce("Tocando. ");
      dialog.querySelector("[data-put-back]").focus();
      return;
    }

    const tl = gsap.timeline({ onComplete: () => (busy = false) });
    tl.to(dialog.querySelectorAll(".crate, .crate-caption"), { opacity: 0, y: 30, duration: 0.4, ease: "power2.in" })
      // A capa voa do caixote para o centro (FLIP manual).
      .fromTo(
        playerSleeve,
        {
          x: from.left + from.width / 2 - (to.left + to.width / 2),
          y: from.top + from.height / 2 - (to.top + to.height / 2),
          scale: from.width / to.width,
          rotationX: -10,
        },
        { x: 0, y: 0, scale: 1, rotationX: 0, duration: 0.8, ease: "power4.out" },
        0.1
      )
      // O vinil desliza para fora da capa…
      .fromTo(disc, { xPercent: 0 }, { xPercent: 52, duration: 0.9, ease: "power3.inOut" }, 0.55)
      // …e acelera aos poucos até a rotação certa.
      .add(() => {
        spin.play();
        gsap.fromTo(spin, { timeScale: 0 }, { timeScale: 1, duration: 1.6, ease: "power2.in" });
      }, 1.1)
      .fromTo(dialog.querySelectorAll(".player-info > *"), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: "power3.out" }, 0.9);

    announce("Tocando. ");
    dialog.querySelector("[data-put-back]").focus({ preventScroll: true });
  }

  function putBack() {
    if (!playing || busy) return;
    busy = true;
    const done = () => {
      spin?.kill();
      spin = null;
      player.hidden = true;
      crate.removeAttribute("aria-hidden");
      gsap.set(dialog.querySelectorAll(".crate, .crate-caption"), { clearProps: "opacity,transform" });
      playing = false;
      busy = false;
      crate.focus({ preventScroll: true });
    };
    if (reduce()) return done();

    gsap
      .timeline({ onComplete: done })
      // Desacelera até parar (a agulha saindo), depois o disco volta pra capa.
      .to(spin, { timeScale: 0, duration: 0.7, ease: "power2.out" })
      .to(dialog.querySelectorAll(".player-info > *"), { opacity: 0, y: 10, duration: 0.25, stagger: 0.03 }, 0)
      .to(disc, { xPercent: 0, duration: 0.6, ease: "power3.inOut" }, 0.45)
      .to(playerSleeve, { y: 40, opacity: 0, duration: 0.35, ease: "power2.in" }, 1)
      .to(disc, { opacity: 0, duration: 0.2 }, 1)
      .set([playerSleeve, disc], { clearProps: "opacity,y" })
      .fromTo(dialog.querySelectorAll(".crate, .crate-caption"), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" });
  }

  // Folheia rápido até um disco aleatório e tira ele do caixote.
  function shuffle() {
    if (busy) return;
    const finish = () => {
      let target = current;
      while (total > 1 && target === current) target = Math.floor(Math.random() * total);
      if (reduce()) {
        go(target);
        play();
        return;
      }
      busy = true;
      const steps = Math.abs(target - current);
      const dir = Math.sign(target - current);
      const tl = gsap.timeline({
        onComplete: () => {
          busy = false;
          announce();
          gsap.delayedCall(0.35, play);
        },
      });
      for (let s = 1; s <= steps; s++) tl.call(() => go(current + dir, { quiet: true }), null, s * 0.09);
    };
    if (playing) {
      putBack();
      gsap.delayedCall(1.9, finish);
    } else finish();
  }

  // --- Entrada ----------------------------------------------------------

  sleeves.forEach((sleeve, i) =>
    sleeve.addEventListener("click", () => {
      if (playing || busy) return;
      if (i === current) play();
      else go(i);
    })
  );

  crate.addEventListener("keydown", (e) => {
    if (playing) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") go(current + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") go(current - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(total - 1);
    else if (e.key === "Enter" || e.key === " ") play();
    else return;
    e.preventDefault();
  });

  // Roda/trackpad: um disco por "tique", com uma trava curta para a inércia.
  let wheelLock = 0;
  crate.addEventListener(
    "wheel",
    (e) => {
      if (playing) return;
      e.preventDefault();
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < 4 || performance.now() < wheelLock) return;
      wheelLock = performance.now() + 140;
      go(current + Math.sign(delta));
    },
    { passive: false }
  );

  // Arrasto (mouse/toque): cada 70px folheia um disco.
  if (typeof Draggable !== "undefined") {
    gsap.registerPlugin(Draggable);
    const proxy = document.createElement("div");
    let last = 0;
    Draggable.create(proxy, {
      type: "x,y",
      trigger: crate,
      dragClickables: true,
      minimumMovement: 8,
      onPress() {
        last = 0;
        gsap.set(proxy, { x: 0, y: 0 });
        this.update();
      },
      onDrag() {
        if (playing) return;
        const travel = Math.abs(this.y) > Math.abs(this.x) ? this.y : -this.x;
        const steps = Math.trunc(travel / 70);
        if (steps !== last) {
          go(current + (steps - last));
          last = steps;
        }
      },
    });
  }

  dialog.querySelector("[data-shuffle]").addEventListener("click", shuffle);
  dialog.querySelector("[data-put-back]").addEventListener("click", putBack);

  layout(false);

  return {
    onOpen() {
      // O caixote "assenta" quando abre: os discos caem no lugar em sequência.
      if (!reduce()) {
        gsap.from(sleeves.slice(current, current + VISIBLE_BEHIND + 1), {
          y: -120,
          opacity: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.05,
          delay: 0.35,
        });
      }
      announce();
      crate.focus({ preventScroll: true });
    },
    onClose() {
      spin?.pause();
    },
    // Esc com um disco tocando: primeiro guarda o disco.
    onEscape() {
      if (playing) {
        putBack();
        return true;
      }
      return false;
    },
  };
}
