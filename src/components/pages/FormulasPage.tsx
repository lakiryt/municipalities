import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { derivedExpressions } from '@/data/municipalities'
import Canonical from '@/components/Canonical'

const functions = [
  { sig: 'AND(b…)',    ret: 'b', desc: 'すべて真のとき真' },
  { sig: 'OR(b…)',     ret: 'b', desc: 'いずれか真のとき真' },
  { sig: 'NOT(b)',     ret: 'b', desc: '論理否定' },
  { sig: 'LEQ(n, n)',  ret: 'b', desc: '第1引数 ≤ 第2引数' },
  { sig: 'EQ(a, a)',   ret: 'b', desc: '等しい（型は同じであること）' },
  { sig: 'SUM(n…)',    ret: 'n', desc: '合計' },
  { sig: 'MULT(n…)',   ret: 'n', desc: '積' },
  { sig: 'MIN(n…)',    ret: 'n', desc: '最小値' },
  { sig: 'MAX(n…)',    ret: 'n', desc: '最大値' },
  { sig: 'NEG(n)',     ret: 'n', desc: '符号反転（× −1）' },
  { sig: 'INV(n)',     ret: 'n', desc: '逆数（1 ÷ n）' },
  { sig: 'ROUND(n, d)',  ret: 'n', desc: '小数点以下 d 桁に丸め（d < 0 で整数位）' },
  { sig: 'SUBSTR(s, n)',    ret: 's', desc: 'n ≥ 0: 先頭 n 文字、n < 0: 末尾 |n| 文字' },
  { sig: 'IF(b, a, a)',    ret: 'a', desc: '条件が真なら第2引数、偽なら第3引数（両引数は同じ型）' },
]

const numVars = [
  { name: '#totalpop',  desc: '総人口' },
  { name: '#malepop',   desc: '男性人口' },
  { name: '#femalepop', desc: '女性人口' },
  { name: '#area',      desc: '面積（km²）' },
  { name: '#setai', desc: '世帯数（住民基本台帳のみ）'},
  { name: '#inc_mov_dom', desc: '昨年の転入者数（国内）（住民基本台帳のみ）'},
  { name: '#inc_mov_intl', desc: '昨年の転入者数（国外）（住民基本台帳のみ）'},
  { name: '#inc_born', desc: '昨年の出生者数（住民基本台帳のみ）'},
  { name: '#inc_other', desc: '昨年のその他住民票記載数（住民基本台帳のみ）'},
  { name: '#dec_mov_dom', desc: '昨年の転出者数（国内）（住民基本台帳のみ）'},
  { name: '#dec_mov_intl', desc: '昨年の転出者数（国外）（住民基本台帳のみ）'},
  { name: '#dec_deaths', desc: '昨年の死亡者数（住民基本台帳のみ）'},
  { name: '#dec_other', desc: '昨年のその他住民票消除数（住民基本台帳のみ）'},
]

const strVars = [
  { name: '$code',      desc: '団体コード（6桁）' },
  { name: '$kanji',     desc: '自治体名（漢字）' },
  { name: '$kana',      desc: '自治体名（仮名）' },
  { name: '$prefcode',  desc: '都道府県コード' },
  { name: '$prefkanji', desc: '都道府県名（漢字）' },
  { name: '$prefkana',  desc: '都道府県名（仮名）' },
]

const boolVars = [
  { name: '&seirei',  desc: '政令指定都市' },
  { name: '&chukaku', desc: '中核市' },
  { name: '&tokurei', desc: '施行時特例市' },
  { name: '&coastal', desc: '海に面している' },
]


const typeLabel: Record<string, string> = { n: '数値', b: '真偽値', s: '文字列', a: '任意' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-3">{title}</h2>
      {children}
    </section>
  )
}

function FormulasPage() {
  useEffect(() => { document.title = '式の記述方法 — 日本の自治体データ' }, [])
  return (
    <>
      <Canonical />
      <meta name="description" content="自由探索で使用できる数値・真偽・文字列の変数・関数・演算子の一覧です。" />
      <div className="fixed top-0 inset-x-0 z-20 h-11 flex items-center gap-3 bg-gray-50 border-b border-gray-200 px-4">
        <Link to="/"><img src="/favicon.svg" alt="home" className="h-6 w-6" /></Link>
        <span className="font-semibold text-sm">式の記述方法</span>
      </div>
      <div className="pt-16 pb-12 px-6 max-w-2xl mx-auto">
        <Section title="型">
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(typeLabel).map(([k, v]) => (
                <tr key={k} className="border-b border-gray-100 last:border-0">
                  <td className="py-1.5 pr-6 font-mono text-gray-700 w-8">{k}</td>
                  <td className="py-1.5 text-gray-500">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-gray-400">b… や n… は1つ以上の引数を表します。</p>
        </Section>

        <Section title="関数">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-200">
                <th className="pb-1 pr-6 font-normal">式</th>
                <th className="pb-1 pr-6 font-normal">戻り値</th>
                <th className="pb-1 font-normal">説明</th>
              </tr>
            </thead>
            <tbody>
              {functions.map(f => (
                <tr key={f.sig} className="border-b border-gray-100 last:border-0">
                  <td className="py-1.5 pr-6 font-mono text-gray-700 whitespace-nowrap">{f.sig}</td>
                  <td className="py-1.5 pr-6 font-mono text-gray-500">{f.ret}</td>
                  <td className="py-1.5 text-gray-500">{f.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="数値変数">
          <table className="w-full text-sm">
            <tbody>
              {numVars.map(v => (
                <tr key={v.name} className="border-b border-gray-100 last:border-0">
                  <td className="py-1.5 pr-6 font-mono text-gray-700 whitespace-nowrap">{v.name}</td>
                  <td className="py-1.5 text-gray-500">{v.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="文字列変数">
          <table className="w-full text-sm">
            <tbody>
              {strVars.map(v => (
                <tr key={v.name} className="border-b border-gray-100 last:border-0">
                  <td className="py-1.5 pr-6 font-mono text-gray-700 whitespace-nowrap">{v.name}</td>
                  <td className="py-1.5 text-gray-500">{v.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="真偽値変数">
          <table className="w-full text-sm">
            <tbody>
              {boolVars.map(v => (
                <tr key={v.name} className="border-b border-gray-100 last:border-0">
                  <td className="py-1.5 pr-6 font-mono text-gray-700 whitespace-nowrap">{v.name}</td>
                  <td className="py-1.5 text-gray-500">{v.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="派生変数">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-200">
                <th className="pb-1 pr-6 font-normal">名前</th>
                <th className="pb-1 pr-6 font-normal">式</th>
                <th className="pb-1 font-normal">説明</th>
              </tr>
            </thead>
            <tbody>
              {derivedExpressions.map(d => (
                <tr key={d.name} className="border-b border-gray-100 last:border-0">
                  <td className="py-1.5 pr-6 font-mono text-gray-700 whitespace-nowrap">#{d.name}</td>
                  <td className="py-1.5 pr-6 font-mono text-gray-500 whitespace-nowrap">{d.expr}</td>
                  <td className="py-1.5 text-gray-500">{d.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </>
  )
}

export default FormulasPage
