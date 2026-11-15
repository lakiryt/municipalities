// サイト名。「自治体データ」を主役に、シリーズ名「霊智堂Atlas」は控えめに添える。
export const BRAND_NAME = '自治体データ'
export const BRAND_SERIES = '霊智堂Atlas'
export const BRAND_FULL = `${BRAND_SERIES} ${BRAND_NAME}`

/** ページタイトル: 「<ページ名> — 霊智堂Atlas 自治体データ」（「自治体データ」だけでは一般名詞なので、シリーズ名ごと添える） */
export function pageTitle(...parts: string[]): string {
  return [...parts, BRAND_FULL].join(' — ')
}
