// Idioma do site: inglês é o padrão; português (pt-BR) pelo botão da nav.
//
// O HTML já vem em inglês e carrega a versão em português ao lado:
//   data-pt="texto"          → troca o conteúdo (aceita HTML)
//   data-pt-<atributo>="…"   → troca o atributo (alt, aria-label, content, title…)
// Textos montados por JS usam i18n.t("English", "Português") e escutam o evento
// "nq:langchange". A escolha fica em localStorage ("nq:lang").
(function () {
  const KEY = "nq:lang";
  const root = document.documentElement;
  const LANGS = { en: "en", pt: "pt-BR" };

  const readStored = () => {
    try {
      return localStorage.getItem(KEY) === "pt" ? "pt" : "en";
    } catch {
      return "en";
    }
  };

  let lang = readStored();

  const i18n = {
    get lang() {
      return lang;
    },
    t(en, pt) {
      return lang === "pt" && pt != null ? pt : en;
    },
    set(next) {
      if (next !== "en" && next !== "pt") return;
      lang = next;
      try {
        localStorage.setItem(KEY, next);
      } catch {}
      apply();
    },
  };
  window.nqI18n = i18n;

  function swap(el, name, ptValue) {
    // Guarda o original (inglês) na primeira troca.
    const store = (el.__en ??= {});
    if (!(name in store)) store[name] = name === "html" ? el.innerHTML : el.getAttribute(name);
    const value = lang === "pt" ? ptValue : store[name];
    if (value == null) return;
    if (name === "html") {
      if (el.innerHTML !== value) el.innerHTML = value;
    } else {
      el.setAttribute(name, value);
    }
  }

  function translate(scope) {
    scope.querySelectorAll("[data-pt]").forEach((el) => swap(el, "html", el.dataset.pt));
    scope.querySelectorAll("*").forEach((el) => {
      for (const attr of el.attributes) {
        if (attr.name.startsWith("data-pt-")) swap(el, attr.name.slice(8), attr.value);
      }
    });
  }

  function apply() {
    root.lang = LANGS[lang];
    root.dataset.lang = lang;
    translate(document);
    const meta = document.querySelector('meta[property="og:locale"]');
    if (meta) meta.setAttribute("content", lang === "pt" ? "pt_BR" : "en_US");
    document.querySelectorAll("[data-lang-toggle]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(lang === "pt"));
      btn.setAttribute("aria-label", lang === "pt" ? "Switch to English" : "Mudar para português");
    });
    window.dispatchEvent(new CustomEvent("nq:langchange", { detail: { lang } }));
  }

  // Conteúdo criado depois (diálogos dos easter eggs): traduz o escopo novo.
  i18n.translate = translate;

  function init() {
    apply();
    document.addEventListener("click", (e) => {
      if (!e.target.closest("[data-lang-toggle]")) return;
      i18n.set(lang === "pt" ? "en" : "pt");
    });
  }

  // Páginas restauradas do cache e outras abas acompanham a escolha.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted && readStored() !== lang) {
      lang = readStored();
      apply();
    }
  });
  window.addEventListener("storage", (e) => {
    if (e.key === KEY && readStored() !== lang) {
      lang = readStored();
      apply();
    }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
