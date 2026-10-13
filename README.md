# nicolasdequeiroz.com

Portfólio estático de **Nícolas de Queiróz** — Branding & Web Design.

- **Produção:** https://www.nicolasdequeiroz.com
- **Repositório:** `nicolasdequeiroz/nicolasdequeiroz`
- **Deploy:** GitHub Pages (branch `main`, raiz do repo)
- **Domínio:** `CNAME` → `www.nicolasdequeiroz.com`

> Este README é a referência principal para IAs e devs que alteram o projeto. Leia antes de editar qualquer arquivo.

---

## Regras para IAs

### Faça

1. **Trate `data/works.json` como única fonte de verdade** para projetos do portfólio.
2. **Rode `npm run build`** sempre que alterar `data/works.json`, `templates/work.html` ou `scripts/build.mjs`.
3. **Edite arquivos gerados apenas via build** — nunca altere `work/*/index.html` à mão.
4. **Mantenha escopo mínimo** — não refatore CSS/JS não relacionados à tarefa.
5. **Preserve URLs** — projetos ficam em `/work/{slug}/` (com barra final).
6. **Use `assets/`** para imagens, vídeos e ícones. Caminhos no JSON são relativos à raiz (`assets/foo.webp`).
7. **Teste localmente** com `python3 -m http.server` na raiz do repo (ex.: porta 8321).

### Não faça

1. **Não recrie o fake CMS** (`#cms-list` no HTML) — foi removido; o carrossel lê JSON.
2. **Não edite `css/generated.css` nem `css/main.css`** — são saída de ferramenta (Tailwind/utilitários). Prefira `css/work.css`, `css/carousel.css`, `css/nav.css`, `css/cursor.css`, `css/transitions.css`.
3. **Não coloque `padding-top` no `body` de páginas de work** — quebra nav `fixed` (ver seção Nav abaixo).
4. **Não invente seções** (`about`, `feed`, `contact`) sem pedido explícito — os links existem na nav mas as âncoras ainda não foram implementadas.
5. **Não use a pasta `nicolas-de-queiroz/`** — é legado/obsoleta; o site vive na raiz do repo.
6. **Não adicione setas prev/next no carrossel 3D** — decisão de design do autor.
7. **Não aplique `view-transition-name` em mais de um card** — o nome `work-media` deve existir só no card central do carrossel e no hero da página de destino (ver seção Transição de página).
8. **Não faça commit/push** salvo se o usuário pedir.

---

## Estrutura do repositório

```
/
├── index.html              # Home — carrossel 3D
├── 404.html
├── CNAME
├── .nojekyll               # GitHub Pages: não processar com Jekyll
├── data/
│   └── works.json          # ★ Fonte de dados dos projetos
├── templates/
│   └── work.html           # Template HTML das páginas de projeto
├── scripts/
│   └── build.mjs           # Gera work/{slug}/index.html
├── work/
│   └── {slug}/index.html   # ⚠ Gerado — não editar manualmente
├── assets/                 # Mídia estática
├── css/
│   ├── generated.css       # ⚠ Não editar
│   ├── main.css            # ⚠ Não editar
│   ├── nav.css
│   ├── carousel.css
│   ├── cursor.css
│   ├── work.css
│   └── transitions.css   # View Transitions API (morph card → hero)
├── js/
│   ├── carousel.js         # Carrossel 3D (fetch em works.json)
│   ├── nav.js              # Toggle menu mobile
│   └── cursor.js           # Cursor customizado (desktop)
└── .github/workflows/
    └── build.yml           # Rebuild automático das páginas de work
```

---

## Fluxo de dados

```
data/works.json
    ├── js/carousel.js      → fetch /data/works.json → carrossel na home
    └── scripts/build.mjs   → templates/work.html    → work/{slug}/index.html
```

---

## Como adicionar ou editar um projeto

### 1. Edite `data/works.json`

Adicione ou altere um objeto em `works[]`:

```json
{
  "slug": "meu-projeto",
  "title": "Meu Projeto",
  "description": "Descrição curta para SEO e intro da página.",
  "year": 2026,
  "services": ["Branding", "Web Design"],
  "thumb": "assets/thumb.webp",
  "hero": {
    "type": "image",
    "src": "assets/hero.webp",
    "alt": "Meu Projeto"
  },
  "blocks": [
    { "type": "image", "src": "assets/detalhe.webp", "alt": "Detalhe" },
    { "type": "text", "text": "Parágrafo opcional." },
    { "type": "video", "src": "assets/demo.mp4", "poster": "assets/poster.webp" }
  ]
}
```

| Campo | Obrigatório | Uso |
|-------|-------------|-----|
| `slug` | sim | URL: `/work/{slug}/` — kebab-case, único |
| `title` | sim | Carrossel, `<title>`, `<h1>` |
| `description` | sim | Meta description, intro |
| `year` | sim | Meta da intro |
| `services` | sim | Array de strings — exibido na intro |
| `thumb` | sim | Imagem do card no carrossel |
| `hero` | sim | `type`: `"image"` ou `"video"`; `src`, `alt` |
| `blocks` | não | Conteúdo extra abaixo do hero |

A **ordem** em `works[]` define: ordem do carrossel, dots e navegação prev/next entre projetos.

### 2. Adicione assets em `assets/`

### 3. Rode o build

```bash
npm run build
```

Saída esperada: `✓ N páginas geradas em work/`

### 4. Commit (se solicitado)

Inclua `data/works.json`, `assets/` novos e `work/` gerado.

---

## Build e CI

| Comando | Ação |
|---------|------|
| `npm run build` | Gera `work/{slug}/index.html` a partir do template + JSON |

**GitHub Action** (`.github/workflows/build.yml`):
- Dispara em push para `main` quando mudam `data/**`, `templates/**` ou `scripts/**`
- Roda `npm run build` e commita `work/` com `[skip ci]`

Se alterar só CSS/JS da home ou carrossel, build **não** é necessário. Se alterar conteúdo de projetos, **é**.

---

## Desenvolvimento local

```bash
# Na raiz do repo
python3 -m http.server 8321 --bind 127.0.0.1
# Abrir http://127.0.0.1:8321/
```

Após mudar `works.json` ou template, rode `npm run build` antes de testar páginas de work.

---

## Componentes principais

### Carrossel 3D (`js/carousel.js`)

- Carrega `/data/works.json` via `fetch`
- Monta cards dinamicamente em `#carousel-target`
- Autoplay com retomada após inatividade; respeita `prefers-reduced-motion`
- Indicador de posição (dots) — sem setas prev/next
- **Clique:** só o card **central** navega; clicar num card lateral gira o carrossel até centralizá-lo (`bindClick` + `goTo`)
- Config centralizada no objeto `CONFIG` no topo do arquivo

### Transição de página (`css/transitions.css` + View Transitions API)

Transição nativa **cross-document**: o card central do carrossel faz morph suave até o hero da página `/work/{slug}/`.

| Onde | O quê |
|------|--------|
| `js/carousel.js` → `updateActiveCard()` | Aplica `view-transition-name: work-media` **apenas** no `<img>` do card central; remove dos demais |
| `scripts/build.mjs` → `renderHero()` | Hero gerado com `style="view-transition-name: work-media"` |
| `css/transitions.css` | `@view-transition { navigation: auto; }`, curva do morph e cross-fade; desligado em `prefers-reduced-motion` |
| `index.html` + `templates/work.html` | Linkam `transitions.css` |

**Regra crítica:** `view-transition-name` precisa ser **único** entre elementos renderizados. Por isso só o card de frente (não os laterais em `rotateY`) recebe o nome — evita snapshot distorcido e conflito de nomes.

**Comportamento esperado:**
- Card central + clique → navega; browser anima card → hero
- Card lateral + clique → `preventDefault`; carrossel roda até centralizar (sem navegar)
- Voltar no browser → morph reverso automático
- Browser sem suporte (ex.: Firefox) → navegação normal, sem quebrar

**Para alterar a transição:** edite `css/transitions.css` e/ou a lógica em `updateActiveCard()`. Se mudar o hero, altere `renderHero()` em `scripts/build.mjs` e rode `npm run build`.

### Páginas de work (geradas)

Cada página inclui:
- Hero (imagem ou vídeo full-bleed)
- Intro (título, ano, serviços, descrição)
- Blocos opcionais
- Nav prev/next entre projetos
- Meta tags SEO (`canonical`, Open Graph, Twitter)
- `<noscript>` com fallback

Estilos em `css/work.css`. Hero full-bleed (`100svh`); nav fixa sobrepõe a imagem (sem `padding-top` em `.work-main`).

### Nav (`css/nav.css` + `js/nav.js`)

- Header fixo: `body > nav { top: 0; left: 0; right: 0; }`
- **Nunca** use `padding-top` no `body` para compensar nav — use `padding-top` em `.work-main`
- Menu mobile: escondido abaixo de **844px**; hamburger visível no mesmo breakpoint (`md:` do Tailwind exportado)
- Breakpoint `md:` neste projeto = `max-width: 844px` (mobile-first invertido do export Webflow/Tailwind)

### Cursor customizado (`js/cursor.js`)

- Apenas desktop com ponteiro fino
- Desativado em mobile / `pointer: coarse`

---

## CSS — armadilhas conhecidas

1. **`css/generated.css` / `css/main.css`** — classes utilitárias (`w-[100%]`, `md:flex`, etc.). O prefixo `md:` aplica em **telas menores que 844px**, não desktop.
2. **Evite `!important` no carousel** — cards são criados limpos via JS; conflitos com utilitários não devem ser resolvidos com `!important`.
3. **Nav sobre o hero (páginas de work)** — o hero começa em `top: 0` e a nav sobrepõe a imagem. O blur (`.site-nav-glass`) nasce com `opacity: 0` e entra por fade via `.nav--glass-in` (adicionado por `js/nav-enter.js` depois que a View Transition termina), para não "piscar" sobre a imagem durante o morph.

---

## SEO e domínio

- URL canônica base: `https://www.nicolasdequeiroz.com`
- Home: meta tags em `index.html`
- Works: geradas pelo build (`canonical`, `og:*`, `twitter:*`)
- `CNAME` na raiz aponta o domínio customizado no GitHub Pages

---

## Tarefas comuns — checklist para IAs

| Tarefa | Arquivos | Build? |
|--------|----------|--------|
| Novo projeto | `data/works.json`, `assets/` | sim |
| Editar texto de projeto | `data/works.json` | sim |
| Mudar layout da página de work | `templates/work.html`, `css/work.css` | sim |
| Mudar carrossel | `js/carousel.js`, `css/carousel.css` | não |
| Mudar transição card → hero | `css/transitions.css`, `js/carousel.js`, `scripts/build.mjs` | sim (se `renderHero` mudou) |
| Mudar nav global | `index.html`, `templates/work.html`, `css/nav.css` | sim (se template mudou) |
| Novo asset global (favicon) | `assets/`, `index.html` | depende |

---

## Pendências conhecidas (não resolver sem pedido)

- Links da nav `#about`, `#feed`, `#contact` não têm seções na home
- `README.profile.md` é o readme do perfil GitHub (separado deste doc de projeto)

---

## Perfil GitHub

O readme exibido no perfil GitHub está em `README.profile.md`, não neste arquivo.
