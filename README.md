# 地図情報

[国土数値情報](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html)

## 簡略化
```
mapshaper N03-20260101.geojson -snap -clean -simplify weighted 1% -filter-fields N03_007 -rename-fields code=N03_007 -o output.topojson
```