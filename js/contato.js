// Página Contato: monta o Reflective Card em volta do conteúdo. O cartão
// acompanha o tema do site (grafite no claro, prata no escuro).
import { createReflectiveCard } from "./reflective-card.js";

const root = document.getElementById("contato-card");
if (root) {
  const themeOf = () => (document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  const card = createReflectiveCard(root, { theme: themeOf(), intro: true, tiltStrength: 12, glare: 0.5 });
  new MutationObserver(() => card.update({ theme: themeOf() })).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
}
