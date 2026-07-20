# cafe-map

渋谷のカフェをマップ表示する Web アプリ。Leaflet + Supabase 製。

## 関連アプリ

- [新宿ラーメンマップ](shinjuku-ramen-map/) — cafe-map をベースにしたラーメン店マップ
- [TDL天気予報](tdl-weather/) — 東京ディズニーランドの天気予報
- [ポータル](Portal/) — 全アプリの一覧ページ

## 技術スタック

- フロントエンド: 素の HTML / CSS / JS（フレームワーク不使用）
- 地図: Leaflet (OpenStreetMap タイル)
- バックエンド: Supabase (PostgreSQL + Auth + RLS)
- 天気: Open-Meteo API（無料・APIキー不要）

## 機能

- カフェの CRUD（地図クリックで位置指定）
- 認証（メール + パスワード）
- コメント・いいね
- 営業時間表示（営業中/時間外の自動判定）
- ダークモード
- おすすめボトムシート（ランダム抽選）
- 写真アップロード（base64）
- いいね一覧
- 操作ログ / 更新ログ
- 管理パネル（ユーザー管理・問い合わせ対応）
- 天気予報ウィジェット（10分ごと自動更新）
- ヘッダーオーバーフローメニュー（スマホ対応）

## デプロイ

```sh
# cafe-map
scp index.html style.css script.js AGENTS.md p225C0442@class.tama.net:~/public_html/cafe-map/

# ramen-map
scp shinjuku-ramen-map/index.html shinjuku-ramen-map/style.css shinjuku-ramen-map/script.js p225C0442@class.tama.net:~/public_html/cafe-map/shinjuku-ramen-map/
```

## ライセンス

MIT
