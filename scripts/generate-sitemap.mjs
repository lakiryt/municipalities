import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const SITE_URL = process.env.SITE_URL?.replace(/\/+$/, '')
if (!SITE_URL) {
  console.error('Error: SITE_URL environment variable is not set.')
  console.error('Set it to your site\'s canonical origin, e.g.:')
  console.error('  SITE_URL=https://example.com node scripts/generate-sitemap.mjs')
  process.exit(1)
}

const today = new Date().toISOString().slice(0, 10)

const prefectures = JSON.parse(
  readFileSync(resolve(root, 'src/assets/prefectures.json'), 'utf-8')
)

// Every 地方公共団体 has a detail page (/m/:code).
const municipalities = JSON.parse(
  readFileSync(resolve(root, 'src/assets/dantai_codes.json'), 'utf-8')
)

// Prefectures that have at least one 村 (several have none — no empty pages in the sitemap).
const codesPath = JSON.parse(readFileSync(resolve(root, 'src/assets/meta.json'), 'utf-8')).datasets.codes.editions[0].path
const official = new Set(municipalities)
const prefsWithVillages = new Set(
  readFileSync(resolve(root, 'public', codesPath), 'utf-8').trim().split(/\r?\n/).slice(1)
    .map(line => line.split(','))
    .filter(([code, name]) => official.has(code) && name.endsWith('村'))
    .map(([code]) => code.slice(0, 2))
)

const urls = [
  { path: '/',                                  priority: '1.0', changefreq: 'monthly' },
  { path: '/search',                            priority: '0.8', changefreq: 'monthly' },
  { path: '/rankings/all/population',           priority: '0.8', changefreq: 'monthly' },
  { path: '/rankings/all/households',           priority: '0.7', changefreq: 'monthly' },
  { path: '/rankings/all/density',              priority: '0.8', changefreq: 'monthly' },
  { path: '/rankings/all/cities',               priority: '0.8', changefreq: 'monthly' },
  { path: '/rankings/all/area',                 priority: '0.8', changefreq: 'monthly' },
  { path: '/rankings/all/city-area',            priority: '0.8', changefreq: 'monthly' },
  { path: '/rankings/all/population-change',    priority: '0.9', changefreq: 'monthly' },
  { path: '/rankings/all/population-decline',   priority: '0.8', changefreq: 'monthly' },
  { path: '/rankings/all/towns',                priority: '0.7', changefreq: 'monthly' },
  { path: '/rankings/all/villages',             priority: '0.7', changefreq: 'monthly' },
  { path: '/rankings/all/designated-cities',    priority: '0.8', changefreq: 'monthly' },
  { path: '/rankings/all/core-cities',          priority: '0.8', changefreq: 'monthly' },
  { path: '/rankings/all/elderly-ratio',        priority: '0.7', changefreq: 'monthly' },
  { path: '/rankings/all/rent',                  priority: '0.7', changefreq: 'monthly' },
  { path: '/rankings/all/rent-labor-days',       priority: '0.7', changefreq: 'monthly' },
  { path: '/rankings/all/pension-rent',          priority: '0.7', changefreq: 'monthly' },
  { path: '/rankings/all/love-competition-women', priority: '0.7', changefreq: 'monthly' },
  { path: '/rankings/all/love-competition-men',   priority: '0.7', changefreq: 'monthly' },
  { path: '/rankings/all/newcomers',             priority: '0.7', changefreq: 'monthly' },
  { path: '/rankings/all/from-abroad',           priority: '0.7', changefreq: 'monthly' },
  { path: '/rankings/all/births',                priority: '0.7', changefreq: 'monthly' },
  { path: '/rankings/all/population-over-500k', priority: '0.7', changefreq: 'monthly' },
  { path: '/list/all/population',               priority: '0.7', changefreq: 'monthly' },
  { path: '/explore',                           priority: '0.5', changefreq: 'monthly' },
  { path: '/data',                              priority: '0.3', changefreq: 'monthly' },
  { path: '/formulas',                          priority: '0.4', changefreq: 'yearly'  },
  ...prefectures.flatMap(p => [
    { path: `/rankings/${p.romanized}`,           priority: '0.8', changefreq: 'monthly' },
    { path: `/rankings/${p.romanized}/density`,   priority: '0.7', changefreq: 'monthly' },
    { path: `/rankings/${p.romanized}/cities`,    priority: '0.7', changefreq: 'monthly' },
    { path: `/rankings/${p.romanized}/area`,      priority: '0.7', changefreq: 'monthly' },
    { path: `/rankings/${p.romanized}/city-area`, priority: '0.7', changefreq: 'monthly' },
    { path: `/rankings/${p.romanized}/population-change`,  priority: '0.7', changefreq: 'monthly' },
    { path: `/rankings/${p.romanized}/population-decline`, priority: '0.7', changefreq: 'monthly' },
    { path: `/rankings/${p.romanized}/towns`,     priority: '0.6', changefreq: 'monthly' },
    { path: `/rankings/${p.romanized}/population`,    priority: '0.7', changefreq: 'monthly' },
    { path: `/rankings/${p.romanized}/households`,    priority: '0.6', changefreq: 'monthly' },
    { path: `/rankings/${p.romanized}/elderly-ratio`, priority: '0.6', changefreq: 'monthly' },
    { path: `/rankings/${p.romanized}/rent`,          priority: '0.6', changefreq: 'monthly' },
    { path: `/rankings/${p.romanized}/pension-rent`,     priority: '0.6', changefreq: 'monthly' },
    { path: `/rankings/${p.romanized}/love-competition-women`, priority: '0.6', changefreq: 'monthly' },
    { path: `/rankings/${p.romanized}/love-competition-men`,   priority: '0.6', changefreq: 'monthly' },
    { path: `/rankings/${p.romanized}/newcomers`,        priority: '0.6', changefreq: 'monthly' },
    { path: `/rankings/${p.romanized}/from-abroad`,      priority: '0.6', changefreq: 'monthly' },
    { path: `/rankings/${p.romanized}/births`,           priority: '0.6', changefreq: 'monthly' },
  ]),
  ...prefectures.filter(p => prefsWithVillages.has(p.code.slice(0, 2))).map(p =>
    ({ path: `/rankings/${p.romanized}/villages`, priority: '0.6', changefreq: 'monthly' })),
  ...municipalities.map(code => ({ path: `/m/${code}`, priority: '0.6', changefreq: 'monthly' })),
]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${SITE_URL}${u.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`

writeFileSync(resolve(root, 'public/sitemap.xml'), xml)
console.log(`Sitemap: ${urls.length} URLs → public/sitemap.xml`)

const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`

writeFileSync(resolve(root, 'public/robots.txt'), robotsTxt)
console.log('Robots: public/robots.txt')
