// sitemap.xml and robots.txt for SITE_URL. The ranking pages come from the
// app's own catalog (src/rankings/catalog.ts), so a new ranking is listed
// without touching this file.
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { root, withAppModules } from './lib/app-modules.mjs'

const SITE_URL = process.env.SITE_URL?.replace(/\/+$/, '')
if (!SITE_URL) {
  console.error('Error: SITE_URL environment variable is not set.')
  console.error('Set it to your site\'s canonical origin, e.g.:')
  console.error('  SITE_URL=https://example.com node scripts/generate-sitemap.mjs')
  process.exit(1)
}

const urls = await withAppModules(async load => {
  const { RANKINGS, rankingPath } = await load('/src/rankings/catalog.ts')
  const { prefectures, officialCodes, fetchMunicipalityCodes } = await load('/src/data/datasets.ts')
  const { kindOf } = await load('/src/data/municipalities.ts')

  // The kinds of municipality each prefecture has (a ranking that `needsKind`
  // is listed only where there is one — several prefectures have no 村).
  const kinds = new Map()
  for (const c of await fetchMunicipalityCodes()) {
    if (!officialCodes.has(c.code)) continue
    const pref = c.code.slice(0, 2)
    if (!kinds.has(pref)) kinds.set(pref, new Set())
    kinds.get(pref).add(kindOf(c))
  }
  const page = (path, priority) => ({ path, priority })

  return [
    page('/', '1.0'),
    page('/search', '0.8'),
    ...RANKINGS.map(e => page(rankingPath(e, 'all', false), '0.8')),
    page('/list/all/population', '0.7'),
    page('/explore', '0.5'),
    page('/data', '0.3'),
    page('/formulas', '0.4'),
    ...prefectures.flatMap(p => [
      page(`/rankings/${p.romanized}`, '0.8'),
      ...RANKINGS
        .filter(e => e.perPref && (!e.needsKind || kinds.get(p.code.slice(0, 2))?.has(e.needsKind)))
        .map(e => page(rankingPath(e, p.romanized, false), '0.6')),
    ]),
    // Every 地方公共団体 has a detail page.
    ...[...officialCodes].map(code => page(`/m/${code}`, '0.6')),
  ]
})

const today = new Date().toISOString().slice(0, 10)
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${SITE_URL}${u.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`
writeFileSync(resolve(root, 'public/sitemap.xml'), xml)
console.log(`Sitemap: ${urls.length} URLs → public/sitemap.xml`)

writeFileSync(resolve(root, 'public/robots.txt'), `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`)
console.log('Robots: public/robots.txt')
