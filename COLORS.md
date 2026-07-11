# 地図の配色

## なぜ単色の light→dark ランプが基本か

順序のある連続データ（人口・面積など）は、明度が単調に変化する配色でないと
「どちらが大きいか」がグレースケールや色弱の人にとって読み取れなくなる。

- Borland, D. & Taylor, R.M. II (2007). ["Rainbow Color Map (Still) Considered
  Harmful."](https://ieeexplore.ieee.org/document/4118486/) *IEEE Computer
  Graphics and Applications*, 27(2), 14–17.
  虹色(jet系)配色は明度が単調に変化しないため、データにない偽の境界線
  （バンディング）が見えたり、2点のどちらが高い値か凡例なしに判断できなく
  なると指摘。
- Rogowitz, B.E. & Treinish, L.A. (1996). ["How Not to Lie with
  Visualization."](https://pubs.aip.org/aip/cip/article/10/3/268/136498/)
  *Computers in Physics*, 10(3), 268–273. 配色はデータの統計的構造に沿わせる
  べきという、上記より前の基礎的な指摘（IBM）。

## ColorBrewer

Cynthia Brewer による地図配色の定番ツール [ColorBrewer
2.0](https://colorbrewer2.org/)（論文: Harrower & Brewer, "ColorBrewer.org:
An Online Tool for Selecting Colour Schemes for Maps," *The Cartographic
Journal*, 2003）。配色を3種に分類：

- **Sequential**（単色 light→dark）— 順序のある連続データ向け。今回の人口・
  面積はこれ。
- **Diverging**（2色 + 中間のグレー）— ゼロや平均など意味のある基準点があ
  るデータ向け（例: 前年比増減率）。今回は未実装。
- **Qualitative**（最大コントラスト、順序なし）— カテゴリ向け。

「赤 = 高い」という単色ランプ自体は何も問題ない（ColorBrewer の Reds も同じ
構造）。問題になるのは赤と緑を同じスケールに同居させる（色弱の定番の混同）
ことと、明度の単調性を保証しないまま複数色相を混ぜること。

## Viridis / Magma（採用）

単色よりも視覚的に面白く、かつ「どちらが高いか」を壊さない配色として、
matplotlib の標準配色ファミリーを採用。

- van der Walt, S. & Smith, N. (2015). ["A Better Default Colormap for
  Matplotlib."](https://www.youtube.com/watch?v=xAoljeRJ3lU) SciPy 2015.
  `viscm` というツールで CAM02-UCS（知覚的に均一な色空間）上に設計されて
  おり、紫→青→緑→黄（Viridis）のように複数の色相を通っても明度は端から端
  まで単調に増加する。色弱の人でも順序が読み取れるよう検証済み。2.0 以降
  matplotlib の既定配色。CC0。
- 実データの出典: [BIDS/colormap
  (GitHub)](https://github.com/BIDS/colormap/blob/master/colormaps.py) —
  matplotlib 本体の `_cm_listed.py` と同一の256点テーブルから抽出。

[src/lib/topoMap.ts](src/lib/topoMap.ts) の `COLOR_SCHEMES` に Viridis /
Magma（17点抽出）と、単色の「青」（比較用のシンプルな既定）を用意している。
