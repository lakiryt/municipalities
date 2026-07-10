function Canonical() {
  return <link rel="canonical" href={`${window.location.origin}${window.location.pathname}`} />
}

export default Canonical
