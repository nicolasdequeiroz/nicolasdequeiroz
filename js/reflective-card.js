// Reflective Card — cartão de metal escovado que inclina em direção ao cursor, com
// reflexo de estúdio, bisel polido, faixa de luz e brilho que segue o mouse (WebGL2).
// Port em JS puro do componente <ReflectiveCard /> do React Bits (MIT, reactbits.dev):
// o shader da placa, a mola de inclinação e a entrada são os do original. Este port
// não inclui o reflexo de vídeo/câmera (só o "estúdio suave") nem os ícones do
// hugeicons; o conteúdo do cartão é o HTML que a página já tem dentro do elemento.
//
// createReflectiveCard(root, opções) → { update(opções), destroy() }
// Estrutura esperada: <div class="reflective-card"> ...conteúdo... </div>

const THEMES = {
  dark: {
    "--rc-base": "#1d1c22",
    "--rc-shadow": "0 22px 44px -20px rgba(0, 0, 0, 0.8), 0 6px 16px -8px rgba(0, 0, 0, 0.5)",
    "--rc-ink": "#f4f4f5",
    "--rc-muted": "rgba(244, 244, 245, 0.6)",
    "--rc-tile": "linear-gradient(180deg, #3a3644 0%, #27242f 100%)",
    "--rc-tile-edge": "rgba(255, 255, 255, 0.07)",
    "--rc-tile-highlight": "rgba(255, 255, 255, 0.12)",
    "--rc-tile-shadow": "0 4px 10px -4px rgba(0, 0, 0, 0.7)",
    "--rc-rim": "rgba(255, 255, 255, 0.07)",
    "--rc-rim-highlight": "rgba(255, 255, 255, 0.1)"
  },
  light: {
    "--rc-base": "#e7e7ea",
    "--rc-shadow": "0 22px 44px -22px rgba(24, 24, 27, 0.3), 0 6px 16px -10px rgba(24, 24, 27, 0.16)",
    "--rc-ink": "#18181b",
    "--rc-muted": "rgba(24, 24, 27, 0.6)",
    "--rc-tile": "linear-gradient(180deg, #ffffff 0%, #f6f6f8 100%)",
    "--rc-tile-edge": "rgba(24, 24, 27, 0.08)",
    "--rc-tile-highlight": "rgba(255, 255, 255, 1)",
    "--rc-tile-shadow": "0 4px 10px -5px rgba(24, 24, 27, 0.25)",
    "--rc-rim": "rgba(24, 24, 27, 0.08)",
    "--rc-rim-highlight": "rgba(255, 255, 255, 0.8)"
  }
};

const VIEW_DISTANCE = 900;
const OVERSCAN = 1.2;
const INTRO_MS = 1400;

const VERTEX = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const PLATE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uEnv;
uniform vec2 uEnvSize;
uniform vec2 uSize;
uniform float uRadius;
uniform float uScale;
uniform mat3 uRotate;
uniform float uCapture;
uniform float uBlur;
uniform float uRough;
uniform float uMetal;
uniform vec3 uTint;
uniform float uGray;
uniform float uWarp;
uniform float uWarpScale;
uniform float uShine;
uniform float uBevel;
uniform float uGlare;
uniform vec2 uPointer;
uniform float uTheme;

const float VIEW = ${VIEW_DISTANCE.toFixed(1)};
const float OVERSCAN = ${OVERSCAN.toFixed(2)};
const float CONTENT = 46.0;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.103, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy) * 2.0 - 1.0;
}

vec3 gradientNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  vec2 ga = hash2(i);
  vec2 gb = hash2(i + vec2(1.0, 0.0));
  vec2 gc = hash2(i + vec2(0.0, 1.0));
  vec2 gd = hash2(i + vec2(1.0, 1.0));
  float va = dot(ga, f);
  float vb = dot(gb, f - vec2(1.0, 0.0));
  float vc = dot(gc, f - vec2(0.0, 1.0));
  float vd = dot(gd, f - vec2(1.0, 1.0));
  float k = va - vb - vc + vd;
  float value = va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * k;
  vec2 slope = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd) + du * (u.yx * k + vec2(vb, vc) - va);
  return vec3(value, slope);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float erf(float x) {
  float x2 = x * x;
  return sign(x) * sqrt(1.0 - exp(-x2 * (1.2732395 + 0.147 * x2) / (1.0 + 0.147 * x2)));
}

float band(float x, float halfWidth, float sigma) {
  float s = 1.4142136 * max(sigma, 0.0001);
  return 0.5 * (erf((x + halfWidth) / s) - erf((x - halfWidth) / s));
}

float strip(vec2 q, vec2 center, vec2 dir, float halfWidth, vec2 sigma) {
  vec2 normal = vec2(-dir.y, dir.x);
  return band(dot(q - center, normal), halfWidth, length(sigma * normal));
}

const vec2 SWEEP = vec2(0.5, 0.86);
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

float softbox(vec2 q, vec2 sigma) {
  float key = strip(q, vec2(-0.1, -0.16), normalize(SWEEP), 0.022, sigma + 0.018);
  float top = band(q.y + 0.6, 0.12, sigma.y + 0.05);
  float side = band(q.x - 0.46, 0.05, sigma.x + 0.05);
  return key + top * 0.8 + side * 0.35;
}

float room(vec2 q, vec2 sigma) {
  float fall = smoothstep(-0.55, 0.5, q.y);
  float flag = strip(q, vec2(0.24, -0.02), normalize(SWEEP), 0.09, sigma + 0.08);
  return mix(0.85, 0.12, fall) * (1.0 - 0.6 * flag);
}

vec4 sampleEnv(vec2 uv) {
  vec2 st = uv * uEnvSize - 0.5;
  vec2 i = floor(st);
  vec2 f = st - i;
  vec2 f2 = f * f;
  vec2 f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
  vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0;
  vec2 g0 = w0 + w1;
  vec2 g1 = w2 + w3;
  vec2 c0 = (i + 0.5 + w1 / g0 - 1.0) / uEnvSize;
  vec2 c1 = (i + 0.5 + w3 / g1 + 1.0) / uEnvSize;
  vec4 a = texture(uEnv, c0) * g0.x + texture(uEnv, vec2(c1.x, c0.y)) * g1.x;
  vec4 b = texture(uEnv, vec2(c0.x, c1.y)) * g0.x + texture(uEnv, c1) * g1.x;
  return a * g0.y + b * g1.y;
}

vec3 toLinear(vec3 c) {
  return pow(max(c, 0.0), vec3(2.2));
}

void main() {
  vec2 p = vec2(vUv.x - 0.5, 0.5 - vUv.y) * uSize;
  vec2 halfSize = uSize * 0.5;
  float r = min(uRadius, min(halfSize.x, halfSize.y));
  vec2 corner = abs(p) - halfSize + r;
  vec2 side = vec2(p.x >= 0.0 ? 1.0 : -1.0, p.y >= 0.0 ? 1.0 : -1.0);
  float d;
  vec2 outward;
  if (corner.x > 0.0 && corner.y > 0.0) {
    d = length(corner) - r;
    outward = normalize(corner) * side;
  } else if (corner.x > corner.y) {
    d = corner.x - r;
    outward = vec2(side.x, 0.0);
  } else {
    d = corner.y - r;
    outward = vec2(0.0, side.y);
  }
  float coverage = clamp(0.5 - d * uScale, 0.0, 1.0);

  float chamferWidth = min(uBevel, max(r, 1.0));
  float chamfer = chamferWidth > 0.01 ? 1.0 - smoothstep(0.0, chamferWidth, -d) : 0.0;
  vec2 slope = outward * chamfer;

  vec2 wp = p / (220.0 * uWarpScale);
  vec3 w1 = gradientNoise(wp);
  vec3 w2 = gradientNoise(wp * 2.07 + 13.7);
  vec2 ripple = (w1.yz + w2.yz * 0.5) * uWarp;
  slope += ripple * 0.008;

  float grain = valueNoise(vec2(p.x * 0.008, p.y * 0.55)) * 0.45 + valueNoise(vec2(p.x * 0.019 + 3.7, p.y * 0.23)) * 0.35 + valueNoise(vec2(p.x * 0.004 + 9.2, p.y * 0.09)) * 0.2;
  float brush = uRough * uRough;
  slope.y += (grain - 0.5) * brush * 0.004;

  vec3 normal = uRotate * normalize(vec3(slope, 1.0));
  vec3 position = uRotate * vec3(p, 0.0);
  vec3 view = normalize(position - vec3(0.0, 0.0, VIEW));
  vec3 bounce = reflect(view, normal);
  vec2 q = bounce.xy / max(bounce.z, 0.2);

  vec2 footprint = fwidth(q);
  vec2 sigma = sqrt(vec2(uBlur / VIEW) * vec2(uBlur / VIEW) + footprint * footprint * 0.5);
  sigma += vec2(0.004, 0.05) * uRough;

  vec2 shift = clamp((q - p / VIEW) * CONTENT + ripple * 10.0, -uSize, uSize);
  vec2 cp = (p + shift) / (uSize * OVERSCAN);
  vec4 reflected = uCapture > 0.0 ? sampleEnv(vec2(0.5 + cp.x, 0.5 - cp.y)) : vec4(0.0, 0.0, 0.0, 1.0);
  vec3 captured = toLinear(reflected.rgb) * (0.5 / max(pow(reflected.a, 2.2), 0.02));
  captured = mix(vec3(dot(captured, LUMA)), captured, 1.0 - uGray);
  captured = pow(max(captured * 1.2, 0.0), vec3(mix(2.0, 1.5, uTheme)));

  vec3 scene = mix(vec3(room(q, sigma)), captured, uCapture * (1.0 - chamfer) * mix(1.0, 0.6, uTheme));
  scene *= 1.0 + (grain - 0.5) * brush * 0.3;

  vec2 toPointer = (uPointer - p) / (120.0 + uBlur * 4.0);
  vec2 spread = toPointer * vec2(1.0, 1.0 / (1.0 + 2.5 * uRough));
  float reach = dot(spread, spread);
  float glint = max(1.0 + 3.0 * dot(slope, toPointer), 0.0);
  float glare = (exp(-reach * 1.6) + exp(-reach * 0.35) * 0.15) * glint * uGlare * (1.0 + 0.8 * (grain - 0.5) * brush);
  float highlight = (softbox(q, sigma) * uShine + glare) * mix(0.4, 1.0, uMetal);

  vec3 dark = vec3(0.005, 0.005, 0.006) + uTint * (scene * 0.05 * uMetal + highlight * 0.36);
  vec3 light = uTint * (vec3(0.83, 0.83, 0.85) * (1.0 - 0.45 * uMetal * (1.0 - clamp(scene, 0.0, 1.0))) + highlight * 0.35);
  vec3 color = mix(dark, light, uTheme);
  color = min(color, 0.7) + 0.3 * (1.0 - exp(-max(color - 0.7, 0.0) / 0.3));
  color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));

  color += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  color = clamp(color, 0.0, 1.0);
  fragColor = vec4(color * coverage, coverage);
}`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseColor = (value) => {
  const text = String(value || "").trim();
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const full = hex[1].length === 3 ? hex[1].replace(/./g, (digit) => digit + digit) : hex[1];
    return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16) / 255);
  }
  return [1, 1, 1];
};

const compile = (gl, type, source) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const link = (gl, fragmentSource) => {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = vertex && fragment ? gl.createProgram() : null;
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, "aPosition");
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let index = 0; index < count; index++) {
    const info = gl.getActiveUniform(program, index);
    if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name);
  }
  return { program, uniforms };
};

const createRenderer = (canvas) => {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "default"
  });
  if (!gl) return null;
  const plate = link(gl, PLATE);
  if (!plate) return null;

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);

  // Sem vídeo/câmera não há reflexo capturado: a textura de ambiente é só um pixel preto.
  const env = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, env);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

  const rotation = new Float32Array(9);

  const renderPlate = ({ width, height, rotateX, rotateY, glare, pointerX, pointerY, settings }) => {
    const cx = Math.cos(rotateX);
    const sx = Math.sin(rotateX);
    const cy = Math.cos(rotateY);
    const sy = Math.sin(rotateY);
    rotation.set([cy, sx * sy, -cx * sy, 0, cx, sx, sy, -sx * cy, cx * cy]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(plate.program);
    const u = plate.uniforms;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, env);
    gl.uniform1i(u.uEnv, 0);
    gl.uniform2f(u.uEnvSize, 1, 1);
    gl.uniform2f(u.uSize, width, height);
    gl.uniform1f(u.uRadius, settings.radius);
    gl.uniform1f(u.uScale, canvas.width / Math.max(1, width));
    gl.uniformMatrix3fv(u.uRotate, false, rotation);
    gl.uniform1f(u.uCapture, 0);
    gl.uniform1f(u.uBlur, settings.blurStrength);
    gl.uniform1f(u.uRough, settings.roughness);
    gl.uniform1f(u.uMetal, settings.metalness);
    gl.uniform3fv(u.uTint, settings.tint);
    gl.uniform1f(u.uGray, settings.grayscale);
    gl.uniform1f(u.uWarp, settings.warp);
    gl.uniform1f(u.uWarpScale, settings.warpScale);
    gl.uniform1f(u.uShine, settings.shine);
    gl.uniform1f(u.uBevel, settings.bevel);
    gl.uniform1f(u.uGlare, glare);
    gl.uniform2f(u.uPointer, pointerX, pointerY);
    gl.uniform1f(u.uTheme, settings.theme);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const dispose = () => {
    if (gl.isContextLost()) return;
    gl.deleteTexture(env);
    gl.deleteBuffer(buffer);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(plate.program);
  };

  return { renderPlate, dispose };
};

const DEFAULTS = {
  theme: "dark",
  tint: "#ffffff",
  metalness: 1,
  roughness: 0.3,
  blurStrength: 6,
  grayscale: 1,
  warp: 0.6,
  warpScale: 1,
  shine: 1,
  bevel: 3,
  glare: 0.5,
  enableTilt: true,
  tiltStrength: 12,
  intro: true,
  radius: 24
};

export function createReflectiveCard(root, options = {}) {
  let opts = { ...DEFAULTS, ...options };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Monta a estrutura do componente em volta do conteúdo que já está no elemento.
  const body = document.createElement("div");
  body.className = "reflective-card__body";
  const canvas = document.createElement("canvas");
  canvas.className = "reflective-card__canvas";
  canvas.setAttribute("aria-hidden", "true");
  const content = document.createElement("div");
  content.className = "reflective-card__content";
  while (root.firstChild) content.appendChild(root.firstChild);
  const rim = document.createElement("span");
  rim.className = "reflective-card__rim";
  body.append(canvas, content, rim);
  root.appendChild(body);
  root.classList.add("reflective-card");

  const renderer = createRenderer(canvas);
  if (!renderer) {
    // Sem WebGL2: um cartão simples, sem reflexo.
    root.classList.add("reflective-card--flat");
  }

  const settings = () => ({
    tint: parseColor(opts.tint).map((c) => Math.pow(c, 2.2)),
    metalness: clamp(opts.metalness, 0, 1),
    roughness: clamp(opts.roughness, 0, 1),
    blurStrength: clamp(opts.blurStrength, 0, 40),
    grayscale: clamp(opts.grayscale, 0, 1),
    warp: clamp(opts.warp, 0, 2),
    warpScale: clamp(opts.warpScale, 0.2, 4),
    shine: clamp(opts.shine, 0, 3),
    bevel: clamp(opts.bevel, 0, 16),
    glare: clamp(opts.glare, 0, 1),
    radius: Math.max(0, opts.radius),
    theme: opts.theme === "light" ? 1 : 0
  });

  const applyTheme = () => {
    const palette = THEMES[opts.theme === "light" ? "light" : "dark"];
    for (const [k, v] of Object.entries(palette)) root.style.setProperty(k, v);
    const corner = Math.max(0, opts.radius);
    root.style.setProperty("--rc-radius", `${corner}px`);
    root.style.setProperty("--rc-pad", `${Math.round(clamp(corner * 0.8, 16, 22))}px`);
    root.style.setProperty("--rc-tile-radius", `${Math.round(clamp(corner * 0.5, 8, 14))}px`);
  };
  applyTheme();

  const x = { p: 0, v: 0, target: 0 };
  const y = { p: 0, v: 0, target: 0 };
  const light = { p: 0, target: 0 };
  const pointer = { x: 0, y: 0 };
  const size = { width: body.offsetWidth, height: body.offsetHeight, scale: 1 };
  let presence = 1;
  let presenceStart = 0;
  let slowUntil = 0;
  let touchId = null;
  let raf = 0;
  let last = 0;
  let visible = true;
  let pageVisible = document.visibilityState !== "hidden";
  let lost = false;

  if (opts.intro && !reduced) {
    root.style.setProperty("--rc-presence", "0");
    root.style.setProperty("--rc-lift", "14px");
  }

  const write = () => {
    const angle = opts.enableTilt && !reduced ? clamp(opts.tiltStrength, 0, 30) : 0;
    const style = root.style;
    style.setProperty("--rc-rotate-x", `${(y.p * angle).toFixed(3)}deg`);
    style.setProperty("--rc-rotate-y", `${(-x.p * angle).toFixed(3)}deg`);
    const eased = 1 - Math.pow(1 - presence, 3);
    style.setProperty("--rc-presence", eased.toFixed(4));
    style.setProperty("--rc-lift", `${((1 - eased) * 14).toFixed(2)}px`);
  };

  const resize = () => {
    size.width = body.offsetWidth;
    size.height = body.offsetHeight;
    size.scale = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(size.width * size.scale));
    const h = Math.max(1, Math.round(size.height * size.scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  };

  const frame = (now) => {
    raf = 0;
    if (lost) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    const slow = now < slowUntil;
    const stiffness = slow ? 24 : 120;
    const damping = slow ? 9 : 16;
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      for (const axis of [x, y]) {
        axis.v += (stiffness * (axis.target - axis.p) - damping * axis.v) * h;
        axis.p += axis.v * h;
      }
    }
    const tau = light.target > light.p ? 0.18 : slow ? 0.9 : 0.45;
    light.p += (light.target - light.p) * (1 - Math.exp(-dt / tau));
    if (presence < 1) presence = clamp((now - presenceStart) / 650, 0, 1);

    const moving =
      Math.abs(x.target - x.p) > 0.0005 ||
      Math.abs(y.target - y.p) > 0.0005 ||
      Math.abs(x.v) > 0.0005 ||
      Math.abs(y.v) > 0.0005 ||
      Math.abs(light.target - light.p) > 0.002 ||
      presence < 1;
    if (!moving) {
      x.p = x.target;
      y.p = y.target;
      x.v = 0;
      y.v = 0;
      light.p = light.target;
    }
    write();

    if (renderer) {
      const s = settings();
      const angle = (opts.enableTilt && !reduced ? clamp(opts.tiltStrength, 0, 30) : 0) * (Math.PI / 180);
      renderer.renderPlate({
        width: size.width,
        height: size.height,
        rotateX: y.p * angle,
        rotateY: -x.p * angle,
        glare: s.glare * light.p,
        pointerX: pointer.x,
        pointerY: pointer.y,
        settings: s
      });
    }
    if (moving && visible && pageVisible) raf = requestAnimationFrame(frame);
  };

  const wake = () => {
    if (raf || lost || !visible || !pageVisible) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const aim = (nx, ny, on = true) => {
    x.target = clamp(nx, -1, 1);
    y.target = clamp(ny, -1, 1);
    light.target = on ? 1 : 0;
    slowUntil = 0;
    wake();
  };
  const aimAt = (event) => {
    const rect = root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    pointer.x = nx * size.width * 0.5;
    pointer.y = ny * size.height * 0.5;
    aim(nx, ny);
  };
  const release = () => aim(0, 0, false);

  const onEnter = (e) => e.pointerType === "mouse" && aimAt(e);
  const onMove = (e) => (e.pointerType === "mouse" || e.pointerId === touchId) && aimAt(e);
  const onLeave = (e) => e.pointerType === "mouse" && release();
  const onDown = (e) => {
    if (e.pointerType === "mouse") return;
    touchId = e.pointerId;
    aimAt(e);
  };
  const onUp = (e) => {
    if (e.pointerId !== touchId) return;
    touchId = null;
    release();
  };
  root.addEventListener("pointerenter", onEnter);
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerleave", onLeave);
  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointerup", onUp);
  root.addEventListener("pointercancel", onUp);

  const onLost = (e) => {
    e.preventDefault();
    lost = true;
    cancelAnimationFrame(raf);
    raf = 0;
  };
  canvas.addEventListener("webglcontextlost", onLost);

  const resizeObserver = new ResizeObserver(() => {
    resize();
    wake();
  });
  resizeObserver.observe(body);
  resize();

  const intersection = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    wake();
  });
  intersection.observe(root);
  const onVisibility = () => {
    pageVisible = document.visibilityState !== "hidden";
    wake();
  };
  document.addEventListener("visibilitychange", onVisibility);

  if (opts.intro && !reduced) {
    x.p = 0.62;
    y.p = -0.55;
    light.p = 1;
    pointer.x = 0.62 * size.width * 0.5;
    pointer.y = -0.55 * size.height * 0.5;
    presence = 0;
    presenceStart = performance.now();
    slowUntil = performance.now() + INTRO_MS;
  }
  write();
  wake();

  return {
    update(next) {
      opts = { ...opts, ...next };
      applyTheme();
      wake();
    },
    destroy() {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener("pointerenter", onEnter);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("webglcontextlost", onLost);
      renderer && renderer.dispose();
    }
  };
}
