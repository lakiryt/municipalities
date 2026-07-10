import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const SITE_URL = process.env.SITE_URL
if (!SITE_URL) {
  console.error('Error: SITE_URL environment variable is not set.')
  console.error('Set it to your site\'s canonical origin, e.g.:')
  console.error('  SITE_URL=https://example.com node scripts/generate-sitemap.mjs')
  process.exit(1)
}

const today = new Date().toISOString().slice(0, 10)

const prefectures = JSON.parse(
  readFileSync(resolve(root, 'src/assets/code_todofuken_20240101.json'), 'utf-8')
)

const urls = [
  { path: '/',                                  priority: '1.0', changefreq: 'monthly' },
  { path: '/search',                            priority: '0.8', changefreq: 'monthly' },
  { path: '/rankings/all/density',              priority: '0.8', changefreq: 'monthly' },
  { path: '/rankings/all/cities',               priority: '0.8', changefreq: 'monthly' },
  { path: '/rankings/all/area',                 priority: '0.8', changefreq: 'monthly' },
  { path: '/rankings/all/city-area',            priority: '0.8', changefreq: 'monthly' },
  { path: '/rankings/all/elderly-ratio',        priority: '0.7', changefreq: 'monthly' },
  { path: '/rankings/all/population-over-500k', priority: '0.7', changefreq: 'monthly' },
  { path: '/list/all/population',               priority: '0.7', changefreq: 'monthly' },
  { path: '/explore',                           priority: '0.5', changefreq: 'monthly' },
  { path: '/formulas',                          priority: '0.4', changefreq: 'yearly'  },
  ...prefectures.flatMap(p => [
    { path: `/rankings/${p.romanized}/density`,   priority: '0.7', changefreq: 'monthly' },
    { path: `/rankings/${p.romanized}/cities`,    priority: '0.7', changefreq: 'monthly' },
    { path: `/rankings/${p.romanized}/area`,      priority: '0.7', changefreq: 'monthly' },
    { path: `/rankings/${p.romanized}/city-area`, priority: '0.7', changefreq: 'monthly' },
  ]),
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
