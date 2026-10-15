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
- **Tema**: claro por padrão, escuro pelo seletor na nav (`js/theme.js`, salvo em `localStorage`
  como `nq:theme`). Cores sempre pelos tokens de `:root` em `css/nav.css` (`--bg`, `--bg-home`,
  `--fg`, `--line`…) — nunca `#fff`/`#111` direto, senão quebra o modo escuro. Home em whitesmoke.
- **Capa mobile**: cada case tem `hero.mobile` (vertical 9:16) em `works.json`, usada no hero e no
  card do carrossel abaixo de 768px. Deixe o assunto no centro ~80% da largura (o celular corta as
  laterais). O preview de link usa `assets/works/<slug>/og.jpg` (1200×630).
- **Movimento**: o carrossel é animado só pelo GSAP 3.13 (Draggable + InertiaPlugin para arrasto,
  `quickTo` no parallax, `delayedCall` no autoplay) — não ponha `transition` CSS em `.carousel-3d`
  nem `.scene-container`. Nas páginas de work, `js/reveal.js` faz a entrada dos blocos na rolagem
  (seletores no topo do arquivo); bloco novo no build precisa entrar nessa lista.
- **Página sobre**: `sobre/index.html` é estática, estilo em `css/about.css`. Mistura o layout dos
  cases (container 1280px/32px, rótulos `.ab-label` iguais ao `.work-block-label`, ficha de 4 colunas
  sob o título, frase centrada, contato escuro de ponta a ponta como o "Próximo projeto") com o
  tratamento de texto de rodolpho.works (frase de identidade com o ano, história em duas colunas,
  números grandes com uma linha de contexto). Números sem valor ficam com `data-pending` (sublinhado
  vermelho) — não publicar assim.
  O contato termina no "verso": o nome gigante em itálico, preso (sticky) embaixo, e a folha branca
  (`<main data-nav-sheet>`) sobe por cima dele — tudo em CSS (`.ab-contact`). `data-nav-dark`
  em qualquer bloco escuro faz a nav escurecer sobre ele (`js/nav-theme.js`). O site tem
  `scroll-behavior: smooth`: em testes, role com `behavior: 'instant'`.
  A nav é repetida em `index.html`, `templates/work.html`, `sobre/index.html` e `trabalhos/index.html` — mudou uma, mude todas.
- **Lanyard (sobre)**: no lugar da foto, o crachá do React Bits (MIT) portado para JS puro em `js/lanyard.js`
  (three.js 0.170 via jsDelivr, módulo ES; física Verlet, arrastar e clique para virar). `js/about-lanyard.js`
  dimensiona a camada (largura da tela, do topo da página até abaixo da foto) para o cartão cair na área da
  foto e gera a frente (foto em P&B) e a fita (nome repetido) em canvas. A `<img>` fica como reserva de
  espaço e plano B sem WebGL (`.is-lanyard` a oculta). A camada não captura cliques; o crachá é pego por
  raycast. Sem a "paradinha da Eslovênia" (rótulo e coordenadas foram removidos).
- **Easter eggs (sobre)**: "coleciono vinil" (hoje uma marquee vertical em `js/egg-vinis.js`, sem GSAP no movimento; campos de `data/vinis.json`: artista, album, ano, genero, selo, edicao[], estrelas, condicao, capa) e "geografia, bandeiras e mapas" abrem dialogs
  (`js/easter-eggs.js` carrega `js/egg-vinis.js` / `js/egg-globo.js` sob demanda). Dados em
  `data/vinis.json` e `data/viagens.json` (`"exemplo": true` mostra o aviso de lista de exemplo —
  tire quando os dados forem reais). Capas: `node scripts/vinis-capas.mjs` (iTunes Search API).
  Globo: cobe 2.0.1 via jsDelivr (API `update()`, sem `onRender`).
- **Cache busting**: o build põe `?v=<hash>` em todo CSS/JS local (work/, `index.html`,
  `sobre/index.html`, `404.html`). Mexeu em CSS ou JS → rode `npm run build` antes do commit.
- **Idioma (EN padrão + PT)**: o HTML sai em inglês e carrega o português ao lado (`data-pt="…"` no
  conteúdo, `data-pt-<atributo>="…"` em alt/aria-label/content). `js/i18n.js` faz a troca pelo botão
  EN/PT da nav (`data-lang-toggle`, salvo em `localStorage` como `nq:lang`) e dispara `nq:langchange`.
  Texto montado em JS usa `window.nqI18n.t("English", "Português")`; HTML criado depois (dialogs dos
  easter eggs) chama `nqI18n.translate(escopo)`. Cases: `data/works.json` guarda o português e
  `data/works.en.json` a tradução por slug (blocks/credits alinhados por posição) — case novo precisa
  das duas. Texto novo em qualquer página = inglês no HTML + `data-pt`. A nav (com o botão de idioma)
  é repetida em `index.html`, `templates/work.html`, `sobre/index.html` e `trabalhos/index.html` e `feed/index.html`. `sitemap.xml` é gerado pelo
  build; `robots.txt` é estático. Previews de link e SEO ficam em inglês (padrão).

- **Página trabalhos**: `trabalhos/index.html` é estática, com a lista de cases gerada pelo build entre
  `<!-- works:start -->` e `<!-- works:end -->` (ordem de `works.json`; tags = `services`; miniatura = `thumb`).
  Estilo em `css/trabalhos.css`, prévia que segue o cursor em `js/trabalhos.js` (GSAP `quickTo`, só mouse;
  no toque, miniatura em cada linha). O link "work" da nav aponta para ela em todas as páginas.
  O contato (verso escuro com o nome gigante) é o mesmo da Sobre: `css/contact.css` + `js/contact.js`
  (relógio de Curitiba), carregados pelas duas páginas; mudou um, mudou o outro.

- **Página feed**: `feed/index.html` é uma tela de 100svh só com o mural Drift Wall (React Bits, portado
  para JS puro em `js/feed.js`, estilo em `css/feed.css`). O build injeta em `#feed-data` todas as imagens
  estáticas dos cases (capa, hero e blocos); o JS sorteia ~10 por coluna a cada visita e cada quadro leva ao
  case. Cores pelos tokens (a névoa das bordas e dos quadros em repouso usa `--bg`).
  Os quadros usam miniaturas de 640px em `assets/feed/` (`npm run feed-thumbs`, precisa de ffmpeg e cwebp;
  rode ao adicionar imagens a um case — sem miniatura, o build usa o original). A faixa de cada coluna
  tem cópias de sobra para cobrir a tela inclinada: não reduza `span` em `build()` de `js/feed.js`.

- **Página contato**: `contato/index.html` é uma tela de 100svh só com um Reflective Card (React Bits, MIT)
  com os links de contato (WhatsApp, Instagram, LinkedIn — novo link entra no HTML do cartão). Port em JS puro
  em `js/reflective-card.js` (WebGL2; sem o reflexo de vídeo/câmera), montagem e tema em `js/contato.js`
  (grafite no tema claro, prata no escuro), estilo em `css/contato.css`. O link "contact" da nav aponta para
  ela em todas as páginas; a seção de contato da Sobre continua existindo.

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
