---
name: awesome-design-md
description: Library of 84 DESIGN.md design systems inspired by well-known brands (Apple, Framer, Linear, Stripe, Vercel, Notion, Ferrari, Nike…) — colour tokens, type scale, spacing, components and do/don't rules. Use when the user asks to build, restyle or redesign a page or component "in the style of" / "like" / "inspired by" a brand or site, asks for a design-system reference or design-token starting point, wants to compare visual directions between brands, or asks to apply a DESIGN.md to the project.
---

# awesome-design-md

A local copy of [VoltAgent/awesome-design-md](https://github.com/voltagent/awesome-design-md):
one `DESIGN.md` per brand in `designs/<brand>.md` (Google Stitch DESIGN.md format: YAML front matter
with tokens, then prose on layout, components and rules). They are *inspired interpretations* of
public sites, not official brand assets.

## How to use

1. **Pick the file.** If the user names a brand, open `designs/<brand>.md` (see the index below; the
   file name is the slug). If they describe a mood instead ("dark and technical", "warm editorial"),
   shortlist 2–3 brands from the index, read only their front matter + first section, and propose
   them to the user before going further.
2. **Read the whole chosen file** before writing any code. The front matter holds the tokens
   (colours, typography, spacing, radii); the prose holds the rules that make it look right
   (what never gets a shadow, where the accent colour is allowed, how headlines are set).
3. **Map tokens onto this project's stack.** This site is plain HTML/CSS with a build step
   (`scripts/build.mjs`, `templates/`, `css/`). Express tokens as CSS custom properties on `:root`
   and reuse the existing files; don't introduce a framework.
4. **Adapt, don't clone.** Take the system (scale, rhythm, colour logic, component rules), not the
   brand: never copy logos, product names, trademarked fonts that aren't licensed for the site, or
   brand copy. Swap proprietary fonts for the nearest free equivalent (Google Fonts) and say so.
5. **Respect what the user already decided.** The nav's glass pills and the 3D carousel on the home
   page are deliberate choices; apply a DESIGN.md around them unless the user asks to change them.
6. **Only on request**, copy a chosen file to the project root as `DESIGN.md` so it becomes the
   site's standing design system.

The files suggest running `npx @google/design.md lint DESIGN.md`; that downloads a package, so ask
the user before running it.

## Index (`designs/<slug>.md`)

**AI & developer tools** — claude, cohere, composio, cursor, elevenlabs, expo, hashicorp, lovable,
minimax, mintlify, mistral.ai, ollama, opencode.ai, posthog, raycast, replicate, resend, runwayml,
sanity, sentry, supabase, together.ai, vercel, voltagent, warp, x.ai, clickhouse, mongodb

**Product & productivity SaaS** — airtable, cal, clay, figma, framer, intercom, jobright, linear.app,
miro, notion, slack, superhuman, webflow, zapier

**Finance & crypto** — 1win, binance, coinbase, kraken, mastercard, mercury, nerdwallet, revolut,
stripe, wise

**Automotive & luxury** — bmw, bmw-m, bugatti, ferrari, lamborghini, renault, tesla

**Consumer, commerce & lifestyle** — airbnb, apple, dji, meta, nike, oura, pinterest, playstation,
shopify, spotify, starbucks, uber

**Media & editorial** — aljazeera, theverge, wired, mydealz

**Enterprise & telecom** — hp, ibm, nvidia, oracle, sap, spacex, vodafone

**Retro** — dell-1996, nintendo-2001

Quick picks for a designer portfolio: framer (dark artboard), apple (photography-first gallery),
linear.app (near-black precision), elevenlabs / oura / claude (warm editorial), figma (black-and-white
with bold colour blocks), bugatti / ferrari (austere luxury).
