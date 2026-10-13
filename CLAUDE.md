# CLAUDE.md

As regras do projeto (estrutura, build, o que não editar) estão no README — siga-as:

@README.md

Abaixo, só o que é específico do Claude: decisões de design já tomadas e como usar as skills
instaladas em `.claude/skills/`.

## Decisões de design já tomadas

Não mude estes pontos sem pedido explícito, mesmo que uma skill ou o inspetor os aponte como problema:

- **Nav em vidro**: as pills da nav (logo, toggle, pills do menu, back-home) têm `backdrop-filter`
  e sombra de propósito. O inspetor do `design-taste-frontend` marca `button-fx` e `glass` — ignore.
- **Home = carrossel 3D**: sem headline grande, sem vídeo, sem redesenhar o primeiro screen. Os
  avisos `focal-point`, `still-page` e `no-footage` do inspetor na home são aceitos.
- **Stack**: HTML/CSS/JS puro + `scripts/build.mjs`. Não introduza framework, bundler ou Tailwind
  novo; tokens novos viram custom properties em `:root` nos CSS editáveis.
- **Fontes atuais**: DM Sans (texto) e Instrument Serif (logo/display), via Google Fonts.

## Rodar o site

- Dev server: configuração `site` em `.claude/launch.json` (`python3 -m http.server 8321`).
  Use `preview_start` com `name: "site"`, nunca Bash.
- `playwright-cli` não abre `file://` — sempre use `http://localhost:8321/`.

## Skills: uma por etapa

Três skills disparam com pedidos parecidos ("redesenha a página"), então quando o usuário não
nomear a skill, siga este pipeline e diga qual etapa está rodando:

1. **Direção** — `awesome-design-md`: escolher um sistema de referência em `designs/<marca>.md`.
2. **Referência visual** — `image-to-code`: imagens por seção (do usuário, de sites citados ou
   mockup renderizado) antes de escrever código no projeto.
3. **Construção** — `design-taste-frontend`: implementar com as regras dela e rodar o inspetor
   (`node .claude/skills/design-taste-frontend/scripts/inspect.mjs <url ou arquivo>`); saída em
   `.taste-skill/`.
4. **Revisão** — `web-design-guidelines`: acessibilidade e UX nos arquivos alterados.
5. **Comportamento** — `playwright-cli`: arrastar o carrossel, abrir/fechar o menu, transição
   card → página de work, em 1440, 768 e 390px.

Tarefas pequenas (ajustar um componente, espaçamento) pulam as etapas 1–2. Revisão pura usa só a 4
(e a 5 se envolver interação). Feche cada etapa com evidência (screenshot ou relatório) antes da
próxima.

## Ambiente desta máquina

- O inspetor do taste-skill usa `CHROME_PATH` (definido em `.claude/settings.local.json`, aponta
  para o Chrome do Puppeteer). Se o Puppeteer for atualizado, o caminho muda.
- `playwright-cli` está instalado globalmente no Node 24 (nvm) e usa o Chromium do Playwright
  (`.playwright/cli.config.json`).
