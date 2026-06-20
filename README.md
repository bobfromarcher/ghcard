# ghcard

[![npm](https://img.shields.io/npm/v/@bobfromarcher/ghcard?color=cb3837&logo=npm)](https://www.npmjs.com/package/@bobfromarcher/ghcard)
[![CI](https://github.com/bobfromarcher/ghcard/actions/workflows/ci.yml/badge.svg)](https://github.com/bobfromarcher/ghcard/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@bobfromarcher/ghcard?color=blue)](LICENSE)
[![zero deps](https://img.shields.io/badge/dependencies-0-success)](package.json)

> Most GitHub profile READMEs pull their stat cards from third-party image services that rate-limit, break, or leak your traffic. **ghcard** generates the SVG **yourself**, locally — themed stat cards, a top-languages chart, and a full profile `README.md` — from any GitHub account. **Zero dependencies. Zero AI. Zero third-party services.**

```bash
ghcard bobfromarcher --readme --theme dracula
```

```
  ● ghcard @bobfromarcher · dracula
  ✓ ghcard-out/stats.svg       (stats card)
  ✓ ghcard-out/languages.svg   (language card)
  ✓ ghcard-out/README.md       (profile readme)

  ★ 1.2k stars · 21 repos · 340 followers
```

The cards are plain `.svg` files. Commit them to your profile repo and reference
them in your README — they render on GitHub with no external requests at all.

## Install

```bash
npm install -g @bobfromarcher/ghcard
# or once:
npx @bobfromarcher/ghcard octocat
```

## Usage

```bash
ghcard <username> [options]
```

| Option | Description |
| --- | --- |
| `--out <dir>` | Output directory (default `./ghcard-out`) |
| `--theme <name>` | `dark` · `light` · `dracula` (default `dark`) |
| `--readme` | Also generate a full profile `README.md` |
| `--json` | Print aggregated JSON instead of writing files |
| `--token <tok>` | GitHub token (or `GITHUB_TOKEN`) for higher rate limits |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

### Examples

```bash
ghcard torvalds                          # stat + language cards (dark)
ghcard bobfromarcher --readme            # + a ready-to-commit profile README
ghcard octocat --theme light --out docs  # light theme into ./docs
ghcard octocat --json | jq '.totalStars'
```

## What it generates

- **`stats.svg`** — name, total stars, forks, followers, public repos, with a
  subtle staggered fade-in animation.
- **`languages.svg`** — your most-used languages as animated bars, colored with
  GitHub's own language palette.
- **`README.md`** (with `--readme`) — a centered header, both cards embedded, a
  **Featured Projects** grid of your top-starred repos, and a by-the-numbers
  summary.

Three built-in themes (`dark`, `light`, `dracula`), and every value is fetched
straight from the public GitHub REST API — forks are excluded from your star and
language totals so the numbers reflect *your* work.

## Rate limits

Unauthenticated GitHub API calls are limited to 60/hour. For heavy use, pass a
token (any classic token with no scopes works for public data):

```bash
GITHUB_TOKEN=ghp_xxx ghcard yourname --readme
```

## Development

```bash
git clone https://github.com/bobfromarcher/ghcard
cd ghcard
node test/test.js
```

CI runs the suite on Node 18/20/22 across Linux, macOS and Windows.

## License

MIT © bobfromarcher
