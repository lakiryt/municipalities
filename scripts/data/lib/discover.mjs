// Helpers for scraping publisher pages during discovery.
import { getPage } from './fetch.mjs'
import { decodeText } from './text.mjs'

export const pageHtml = async (url, opts) => decodeText(await getPage(url, opts))

/** Tag-stripped, whitespace-collapsed text. */
export const stripTags = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')

/** Every <a href> in the page as { url (absolute), text, index }. */
export function links(html, baseUrl) {
  return [...html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m => ({
    url: new URL(m[1].replace(/&amp;/g, '&'), baseUrl).href,
    text: stripTags(m[2]).trim(),
    index: m.index,
  }))
}
