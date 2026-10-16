// Sobre: o crachá (lanyard) no lugar da foto. A camada do WebGL nasce na borda
// do topo da página (para a fita descer de lá) e é dimensionada para o cartão
// cair exatamente na área onde a foto estava. O resultado é recalculado quando
// a janela muda de tamanho. Sem WebGL, a foto continua aparecendo.
import { createLanyard } from "./lanyard.js";

const figure = document.querySelector("[data-lanyard]");
const layer = figure && figure.querySelector(".ab-lanyard");
const photo = figure && figure.querySelector("img");
if (figure && layer && photo) init();

async function init() {
  // Foto em preto e branco (como era no site), gerada num canvas para virar a frente do cartão.
  const gray = await grayscale(photo.currentSrc || photo.src);
  const strap = await strapImage();
  if (!gray) return;

  let lanyard = null;
  const fit = () => {
    const f = figure.getBoundingClientRect();
    if (!f.width || !f.height) return null;
    const docTop = f.top + window.scrollY;
    const ratio = 1.6 / 2.25; // proporção do cartão (retrato)
    const vw = document.documentElement.clientWidth;
    let cardW = Math.min(f.width * 0.97, f.height * 0.97 * ratio);
    // A camada tem a largura da tela (o crachá pode ser arrastado e jogado sem ser cortado) e
    // o ponto de onde a fita pende fica no centro da foto.
    const centerX = f.left + f.width / 2;
    const layerW = vw;
    cardW = Math.min(cardW, layerW * 0.72);
    const cardH = cardW / ratio;
    // De cima da página até bem abaixo da foto: o crachá puxado para baixo não pode bater na
    // borda da camada (seria cortado). A camada não captura cliques, então cobrir o texto não atrapalha.
    const layerH = docTop + f.height + Math.max(420, window.innerHeight * 0.7);
    const cardTop = docTop + (f.height - cardH) / 2;
    const frac = cardTop / layerH;
    layer.style.width = `${layerW}px`;
    layer.style.height = `${layerH}px`;
    layer.style.left = `${-f.left}px`;
    layer.style.top = `${-docTop}px`;
    return {
      anchor: clamp(centerX / layerW, 0, 1),
      size: clamp(cardH / layerH, 0.15, 0.9),
      strapLength: clamp((frac - 0.12) / 0.3, 0, 1),
    };
  };

  const first = fit();
  if (!first) return;
  lanyard = createLanyard(layer, {
    ...first,
    frontImage: gray,
    backImage: new URL("../assets/site/card-back.webp", import.meta.url).href, // verso do crachá
    imageFit: "cover",
    imageFocus: [0.45, 0.5], // na frente, o rosto; no verso, o centro
    cardColor: "#f2f2f2",
    cornerRadius: 0.3,
    finish: "glossy",
    metal: "silver",
    strapImage: strap,
    strapColor: "#111111",
    strapWidth: 0.7,
    breeze: 0.4,
    onReady: () => figure.classList.add("is-lanyard"),
  });
  if (!lanyard) return; // sem WebGL: fica a foto

  let timer = null;
  const refit = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const next = fit();
      if (next) lanyard.update(next);
    }, 120);
  };
  window.addEventListener("resize", refit);
  new ResizeObserver(refit).observe(figure);
  // A página cresce quando fontes e imagens carregam: reconfere o topo da foto.
  window.addEventListener("load", refit);
  document.fonts && document.fonts.ready.then(refit);
}

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function grayscale(src) {
  const img = await loadImage(src);
  if (!img) return null;
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = y;
  }
  ctx.putImageData(data, 0, 0);
  return c.toDataURL("image/jpeg", 0.92);
}

// Fita com o nome, repetido, em branco sobre o preto.
async function strapImage() {
  try {
    if (document.fonts) await document.fonts.load('600 46px "DM Sans"');
  } catch (e) {}
  const w = 1400;
  const h = 140;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#f2f2f2";
  ctx.font = '600 44px "DM Sans", sans-serif';
  ctx.textBaseline = "middle";
  ctx.letterSpacing = "6px";
  const text = "NÍCOLAS DE QUEIRÓZ   ·   BRANDING & WEB DESIGN   ·";
  const tw = ctx.measureText(text).width;
  const n = Math.max(1, Math.round(w / tw));
  const step = w / n; // um número inteiro de repetições: a emenda fica invisível
  const off = (step - tw) / 2;
  for (let i = 0; i < n; i++) ctx.fillText(text, i * step + off, h / 2 + 2);
  return c.toDataURL("image/png");
}
