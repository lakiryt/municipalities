# 地図情報

[国土数値情報](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html)

## データの更新

すべての前提データ（地図を含む）は `npm run data` で一次ソースから取得・生成する。
使い方・管理 UI・設計は [DATA_PIPELINE.md](DATA_PIPELINE.md)、データの意味と注意点は
[DATA.md](DATA.md) を参照。

地図の簡略化（以前ここに書いていた mapshaper のコマンド）は `npm run data -- update map` に
組み込まれている。
