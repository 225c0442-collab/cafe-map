# TDL Weather

東京ディズニーリゾートの天気予報・ショー運営状況表示アプリ。

## 機能

- 東京ディズニーランド / 東京ディズニーシーの天気予報（Open-Meteo API）
- 時間帯別の天気・気温・降水確率・風速グラフ
- テーマパークの運営状況へのリンク
- テーマ切替（昼/夜）
- 複数地点の天気比較（任意の場所を追加可能）
- ローカルストレージ保存（地点・テーマ設定を保持）

## 技術スタック

- HTML / CSS / JS（フレームワーク不使用）
- 天気: Open-Meteo API（無料・APIキー不要）
- アイコン: 絵文字

## デプロイ

```sh
scp index.html style.css main.js p225C0442@class.tama.net:~/public_html/cafe-map/tdl-weather/
```

## ライセンス

MIT
