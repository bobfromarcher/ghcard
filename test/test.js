'use strict';
const assert = require('assert');
const { formatNum, aggregate, statsCard, langCard, readme, parseArgs, THEMES } = require('../bin/ghcard.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  \x1b[32m✓\x1b[0m ' + name); }
  catch (e) { console.error('  \x1b[31m✗\x1b[0m ' + name + '\n    ' + e.message); process.exitCode = 1; }
}

const USER = { login: 'dev', name: 'Dev Eloper', bio: 'I build things', followers: 1234, following: 50, public_repos: 3, avatar_url: 'x', html_url: 'https://github.com/dev' };
const REPOS = [
  { name: 'alpha', description: 'first', stargazers_count: 100, forks_count: 10, watchers_count: 100, language: 'JavaScript', fork: false, html_url: 'u1' },
  { name: 'beta', description: 'second', stargazers_count: 50, forks_count: 5, watchers_count: 50, language: 'TypeScript', fork: false, html_url: 'u2' },
  { name: 'gamma', description: '', stargazers_count: 5, forks_count: 1, watchers_count: 5, language: 'JavaScript', fork: false, html_url: 'u3' },
  { name: 'aforked', description: 'not mine', stargazers_count: 9999, forks_count: 1, watchers_count: 1, language: 'Go', fork: true, html_url: 'u4' },
];

test('formatNum abbreviates', () => {
  assert.strictEqual(formatNum(999), '999');
  assert.strictEqual(formatNum(1500), '1.5k');
  assert.strictEqual(formatNum(2000), '2k');
  assert.strictEqual(formatNum(3400000), '3.4m');
});

test('aggregate excludes forks from stars', () => {
  const a = aggregate(USER, REPOS);
  assert.strictEqual(a.totalStars, 155); // 100+50+5, fork excluded
  assert.strictEqual(a.totalForks, 16);
});

test('aggregate computes language breakdown', () => {
  const a = aggregate(USER, REPOS);
  assert.strictEqual(a.languages[0].name, 'JavaScript');
  assert.strictEqual(a.languages[0].count, 2);
  // JS 2/3, TS 1/3
  assert.ok(Math.abs(a.languages[0].pct - 66.7) < 0.2);
});

test('aggregate sorts top repos by stars and excludes fork', () => {
  const a = aggregate(USER, REPOS);
  assert.strictEqual(a.topRepos[0].name, 'alpha');
  assert.ok(!a.topRepos.some((r) => r.name === 'aforked'));
});

test('statsCard returns themed SVG with the numbers', () => {
  const a = aggregate(USER, REPOS);
  const svg = statsCard(a, 'dark');
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes(THEMES.dark.card));
  assert.ok(svg.includes('155')); // total stars
  assert.ok(svg.includes("Dev Eloper's GitHub"));
});

test('langCard renders a bar per language', () => {
  const a = aggregate(USER, REPOS);
  const svg = langCard(a, 'light');
  assert.ok(svg.includes('JavaScript'));
  assert.ok(svg.includes('TypeScript'));
  assert.ok(svg.includes('<animate'));
});

test('readme embeds cards and featured projects', () => {
  const a = aggregate(USER, REPOS);
  const md = readme(a, { statsPath: 'stats.svg', langPath: 'languages.svg' });
  assert.ok(md.includes('Dev Eloper'));
  assert.ok(md.includes('stats.svg'));
  assert.ok(md.includes('Featured Projects'));
  assert.ok(md.includes('alpha'));
});

test('SVG escapes special characters', () => {
  const a = aggregate({ ...USER, name: 'A & B <x>' }, REPOS);
  const svg = statsCard(a, 'dark');
  assert.ok(svg.includes('A &amp; B &lt;x&gt;'));
  assert.ok(!svg.includes('A & B <x>'));
});

test('parseArgs reads username, theme, flags', () => {
  const o = parseArgs(['octocat', '--theme', 'dracula', '--readme']);
  assert.strictEqual(o.username, 'octocat');
  assert.strictEqual(o.theme, 'dracula');
  assert.ok(o.readme);
});

test('all three themes exist', () => {
  for (const t of ['dark', 'light', 'dracula']) assert.ok(THEMES[t]);
});

console.log(`\n  ${passed} passed\n`);
