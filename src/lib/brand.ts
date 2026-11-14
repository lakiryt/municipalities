// サイト名。「まちくらべ」を主役に、シリーズ名「霊智堂Atlas」は控えめに添える。
export const BRAND_NAME = 'まちくらべ'
export const BRAND_SERIES = '霊智堂Atlas'
export const BRAND_FULL = `${BRAND_SERIES} ${BRAND_NAME}`

/** ページタイトル: 「<ページ名> — まちくらべ」 */
export function pageTitle(...parts: string[]): string {
  return [...parts, BRAND_NAME].join(' — ')
}
