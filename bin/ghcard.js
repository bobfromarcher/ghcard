#!/usr/bin/env node
'use strict';
/*
 * ghcard — generate self-contained SVG stat cards + a profile README from
 * any GitHub account. No third-party image services. Zero dependencies. Zero AI.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const C = (c) => (s) => (useColor ? `\x1b[${c}m${s}\x1b[0m` : String(s));
const bold = C('1'), dim = C('2'), red = C('31'), green = C('32'), cyan = C('36');

// ---------- pure helpers (unit-tested) ----------
function formatNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'm';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function aggregate(user, repos) {
  const own = repos.filter((r) => !r.fork);
  let stars = 0, forks = 0, watchers = 0;
  const langCount = {};
  for (const r of own) {
    stars += r.stargazers_count || 0;
    forks += r.forks_count || 0;
    watchers += r.watchers_count || 0;
    if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1;
  }
  const langTotal = Object.values(langCount).reduce((a, b) => a + b, 0) || 1;
  const languages = Object.entries(langCount)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, pct: Math.round((count / langTotal) * 1000) / 10 }));
  const topRepos = [...own]
    .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
    .slice(0, 6)
    .map((r) => ({
      name: r.name, description: r.description || '', stars: r.stargazers_count || 0,
      forks: r.forks_count || 0, language: r.language || '', url: r.html_url,
    }));
  return {
    login: user.login,
    name: user.name || user.login,
    bio: user.bio || '',
    followers: user.followers || 0,
    following: user.following || 0,
    publicRepos: user.public_repos || own.length,
    totalStars: stars,
    totalForks: forks,
    totalWatchers: watchers,
    languages,
    topRepos,
    avatar: user.avatar_url || '',
    url: user.html_url || `https://github.com/${user.login}`,
  };
}

// ---------- themes ----------
const THEMES = {
  dark: { bg: '#0d1117', card: '#161b22', border: '#30363d', text: '#e6edf3', muted: '#7d8590', accent: '#58a6ff', accent2: '#3fb950' },
  light: { bg: '#ffffff', card: '#f6f8fa', border: '#d0d7de', text: '#1f2328', muted: '#636c76', accent: '#0969da', accent2: '#1a7f37' },
  dracula: { bg: '#282a36', card: '#21222c', border: '#44475a', text: '#f8f8f2', muted: '#6272a4', accent: '#bd93f9', accent2: '#50fa7b' },
};

const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Go: '#00ADD8',
  Rust: '#dea584', Java: '#b07219', 'C++': '#f34b7d', C: '#555555', Ruby: '#701516',
  Shell: '#89e051', HTML: '#e34c26', CSS: '#563d7c', PHP: '#4F5D95', Swift: '#F05138',
  Kotlin: '#A97BFF', Dart: '#00B4AB', Vue: '#41b883', 'C#': '#178600',
};
const langColor = (l) => LANG_COLORS[l] || '#8b949e';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------- SVG renderers ----------
function statsCard(a, themeName) {
  const t = THEMES[themeName] || THEMES.dark;
  const rows = [
    ['Total Stars', formatNum(a.totalStars), '★'],
    ['Total Forks', formatNum(a.totalForks), '⑂'],
    ['Followers', formatNum(a.followers), '◉'],
    ['Public Repos', formatNum(a.publicRepos), '▤'],
  ];
  const W = 460, H = 200;
  const lines = rows.map((r, i) => {
    const y = 78 + i * 30;
    const delay = (i * 0.15).toFixed(2);
    return `
    <g style="animation: fade 0.6s ease ${delay}s both;">
      <text x="35" y="${y}" fill="${t.accent2}" font-size="16">${r[2]}</text>
      <text x="62" y="${y}" fill="${t.text}" font-size="15">${esc(r[0])}</text>
      <text x="${W - 35}" y="${y}" fill="${t.accent}" font-size="16" font-weight="700" text-anchor="end">${r[1]}</text>
    </g>`;
  }).join('');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(a.name)} GitHub stats">
  <style>
    @keyframes fade { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: translateX(0); } }
    text { font-family: 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; }
  </style>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="12" fill="${t.card}" stroke="${t.border}"/>
  <text x="35" y="42" fill="${t.accent}" font-size="20" font-weight="700">${esc(a.name)}'s GitHub</text>
  <line x1="35" y1="54" x2="${W - 35}" y2="54" stroke="${t.border}"/>
  ${lines}
</svg>`;
}

function langCard(a, themeName) {
  const t = THEMES[themeName] || THEMES.dark;
  const top = a.languages.slice(0, 6);
  const W = 360, H = 70 + top.length * 32;
  const bars = top.map((l, i) => {
    const y = 70 + i * 32;
    const barW = Math.max(6, Math.round((l.pct / (top[0].pct || 1)) * 200));
    const delay = (i * 0.1).toFixed(2);
    return `
    <g>
      <text x="25" y="${y - 6}" fill="${t.text}" font-size="13">${esc(l.name)}</text>
      <text x="${W - 25}" y="${y - 6}" fill="${t.muted}" font-size="12" text-anchor="end">${l.pct}%</text>
      <rect x="25" y="${y}" width="${W - 50}" height="8" rx="4" fill="${t.border}"/>
      <rect x="25" y="${y}" width="${barW}" height="8" rx="4" fill="${langColor(l.name)}">
        <animate attributeName="width" from="0" to="${barW}" dur="0.8s" begin="${delay}s" fill="freeze"/>
      </rect>
    </g>`;
  }).join('');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Top languages">
  <style>text { font-family: 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; }</style>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="12" fill="${t.card}" stroke="${t.border}"/>
  <text x="25" y="36" fill="${t.accent}" font-size="17" font-weight="700">Most Used Languages</text>
  ${bars}
</svg>`;
}

// ---------- README renderer ----------
function readme(a, opts) {
  const L = [];
  L.push(`<h1 align="center">Hi, I'm ${esc(a.name)} 👋</h1>`, '');
  if (a.bio) L.push(`<p align="center">${esc(a.bio)}</p>`, '');
  L.push('<p align="center">');
  L.push(`  <img src="${opts.statsPath}" alt="GitHub stats" height="200" />`);
  L.push(`  <img src="${opts.langPath}" alt="Top languages" height="200" />`);
  L.push('</p>', '');
  if (a.topRepos.length) {
    L.push('## 🚀 Featured Projects', '');
    L.push('<table>');
    for (let i = 0; i < a.topRepos.length; i += 2) {
      L.push('  <tr>');
      for (const r of a.topRepos.slice(i, i + 2)) {
        L.push('    <td valign="top" width="50%">');
        L.push(`      <h3><a href="${r.url}">${esc(r.name)}</a></h3>`);
        if (r.description) L.push(`      <p>${esc(r.description)}</p>`);
        const meta = [r.language && `\`${esc(r.language)}\``, `★ ${r.stars}`, `⑂ ${r.forks}`].filter(Boolean).join(' · ');
        L.push(`      <p>${meta}</p>`);
        L.push('    </td>');
      }
      L.push('  </tr>');
    }
    L.push('</table>', '');
  }
  L.push('## 📊 By the numbers', '');
  L.push(`- ⭐ **${formatNum(a.totalStars)}** total stars earned`);
  L.push(`- 📦 **${formatNum(a.publicRepos)}** public repositories`);
  L.push(`- 👥 **${formatNum(a.followers)}** followers`);
  L.push('');
  L.push(`<p align="center"><sub>Generated by <a href="https://github.com/bobfromarcher/ghcard">ghcard</a> — no third-party services, just SVG.</sub></p>`);
  return L.join('\n') + '\n';
}

// ---------- network ----------
function fetchJSON(url, token) {
  return new Promise((resolve, reject) => {
    const headers = { 'User-Agent': 'ghcard', Accept: 'application/vnd.github+json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`GitHub API ${res.statusCode}: ${body.slice(0, 120)}`));
        try { resolve({ data: JSON.parse(body), headers: res.headers }); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function fetchAll(username, token) {
  const { data: user } = await fetchJSON(`https://api.github.com/users/${encodeURIComponent(username)}`, token);
  const repos = [];
  for (let page = 1; page <= 10; page++) {
    const { data } = await fetchJSON(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&page=${page}&sort=updated`, token);
    if (!Array.isArray(data) || !data.length) break;
    repos.push(...data);
    if (data.length < 100) break;
  }
  return { user, repos };
}

// ---------- CLI ----------
const HELP = `
ghcard — self-contained GitHub profile cards + README. No third-party services.

Usage:
  ghcard <username> [options]

Options:
  --out <dir>       Output directory (default: ./ghcard-out)
  --theme <name>    dark | light | dracula (default: dark)
  --readme          Also write a full profile README.md
  --json            Print aggregated JSON instead of writing files
  --token <tok>     GitHub token (or set GITHUB_TOKEN) for higher rate limits
  -h, --help        Show help
  -v, --version     Show version

Examples:
  ghcard octocat
  ghcard bobfromarcher --readme --theme dracula
  ghcard torvalds --json
`;

function parseArgs(argv) {
  const o = { username: null, out: 'ghcard-out', theme: 'dark', readme: false, json: false, token: process.env.GITHUB_TOKEN || null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = argv[++i];
    else if (a === '--theme') o.theme = argv[++i];
    else if (a === '--readme') o.readme = true;
    else if (a === '--json') o.json = true;
    else if (a === '--token') o.token = argv[++i];
    else if (a === '-h' || a === '--help') o.help = true;
    else if (a === '-v' || a === '--version') o.version = true;
    else if (!a.startsWith('-')) o.username = a;
  }
  return o;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) { process.stdout.write(HELP); return; }
  if (o.version) { process.stdout.write(require('../package.json').version + '\n'); return; }
  if (!o.username) { process.stderr.write(red('ghcard: provide a GitHub username\n')); process.exit(1); }
  if (!THEMES[o.theme]) { process.stderr.write(red(`ghcard: unknown theme "${o.theme}" (dark|light|dracula)\n`)); process.exit(1); }

  process.stdout.write(`${dim('fetching @' + o.username + ' …')}\n`);
  let agg;
  try {
    const { user, repos } = await fetchAll(o.username, o.token);
    agg = aggregate(user, repos);
  } catch (e) {
    process.stderr.write(red('ghcard: ' + e.message) + '\n');
    if (/403/.test(e.message)) process.stderr.write(dim('  (rate limited — pass --token or set GITHUB_TOKEN)\n'));
    process.exit(1);
  }

  if (o.json) { process.stdout.write(JSON.stringify(agg, null, 2) + '\n'); return; }

  fs.mkdirSync(o.out, { recursive: true });
  const statsFile = path.join(o.out, 'stats.svg');
  const langFile = path.join(o.out, 'languages.svg');
  fs.writeFileSync(statsFile, statsCard(agg, o.theme));
  fs.writeFileSync(langFile, langCard(agg, o.theme));
  process.stdout.write(`\n  ${bold(cyan('● ghcard'))} ${dim('@' + agg.login + ' · ' + o.theme)}\n`);
  process.stdout.write(`  ${green('✓')} ${path.relative(process.cwd(), statsFile)}  ${dim('(stats card)')}\n`);
  process.stdout.write(`  ${green('✓')} ${path.relative(process.cwd(), langFile)}  ${dim('(language card)')}\n`);

  if (o.readme) {
    const file = path.join(o.out, 'README.md');
    fs.writeFileSync(file, readme(agg, { statsPath: 'stats.svg', langPath: 'languages.svg' }));
    process.stdout.write(`  ${green('✓')} ${path.relative(process.cwd(), file)}  ${dim('(profile readme)')}\n`);
  }
  process.stdout.write(`\n  ${dim('★ ' + formatNum(agg.totalStars) + ' stars · ' + formatNum(agg.publicRepos) + ' repos · ' + formatNum(agg.followers) + ' followers')}\n\n`);
}

if (require.main === module) main();

module.exports = { formatNum, aggregate, statsCard, langCard, readme, parseArgs, THEMES };
