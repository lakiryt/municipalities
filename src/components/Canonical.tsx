// 旧ドメインやプレビューデプロイで開かれても、canonical は常に本番ドメイン（SITE_URL）を指すようにする
const SITE_ORIGIN = __SITE_URL__ || window.location.origin

function Canonical() {
  return <link rel="canonical" href={`${SITE_ORIGIN}${window.location.pathname}`} />
}

export default Canonical
