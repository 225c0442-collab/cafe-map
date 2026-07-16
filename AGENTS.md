# cafe-map

## 概要
渋谷のカフェをマップ表示するアプリ。Supabase バックエンド、Leaflet 地図、認証・コメント・いいね機能付き。

## 関連アプリ
- **新宿ラーメンマップ**: `shinjuku-ramen-map/`（cafe-map のサブディレクトリ）
- **TDL天気予報**: `tdl-weather/`

## 技術スタック
- フロントエンド: 素の HTML / CSS / JS（フレームワーク不使用）
- 地図: Leaflet (OpenStreetMap タイル)
- バックエンド: Supabase (PostgreSQL + Auth)
- ファイル構成: index.html（構造）/ style.css（スタイル）/ script.js（ロジック）

## Supabase プロジェクト
- URL: https://nwlfxjtunbqjkwpiaury.supabase.co
- anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53bGZ4anR1bmJxamt3cGlhdXJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTMxOTMsImV4cCI6MjA5OTU4OTE5M30.1ew82vNMtwqqm97-neRxW21hHTW4LH2NmbNZ230rppU

## テーブル（cafe-map）
- cafes: id (PK), name, address, lat, lng, comment, hours, wifi, power, parking, tags, like_count, created_at, updated_at
- comments: id (PK), cafe_id (FK), nickname, text, created_at
- profiles: id (FK→auth.users), username (unique)
- action_log: id (PK), username, action, cafe_name, created_at
- likes: id (PK), user_id, cafe_id, created_at (unique(user_id, cafe_id))

## テーブル（ramen-map）
- ramen_shops: id (PK), name, address, lat, lng, comment, hours, wifi, power, parking, tags, like_count, created_at, updated_at
- ramen_comments: id (PK), shop_id (FK), nickname, text, created_at
- ramen_likes: id (PK), user_id, shop_id, created_at (unique(user_id, shop_id))
- ramen_action_log: id (PK), username, action, shop_name, created_at

## RLS
全テーブルに認証ユーザー向け RLS ポリシーあり。anon/authenticated ロールに GRANT 済み。

## デプロイ
### サーバー
- cafe-map: http://class.tama.net/~p225C0442/cafe-map/
- ramen-map: http://class.tama.net/~p225C0442/cafe-map/shinjuku-ramen-map/
- tdl-weather: http://class.tama.net/~p225C0442/cafe-map/tdl-weather/

### cafe-map 手順
1. git push origin master
2. scp: `scp index.html style.css script.js AGENTS.md p225C0442@class.tama.net:~/public_html/cafe-map/`
3. 確認: http://class.tama.net/~p225C0442/cafe-map/

### ramen-map 手順
1. scp: `scp shinjuku-ramen-map/index.html shinjuku-ramen-map/style.css shinjuku-ramen-map/script.js p225C0442@class.tama.net:~/public_html/cafe-map/shinjuku-ramen-map/`
2. パーミッション: `ssh p225C0442@class.tama.net "chmod 755 ~/public_html/cafe-map/shinjuku-ramen-map && chmod 644 ~/public_html/cafe-map/shinjuku-ramen-map/*"`
3. 確認: http://class.tama.net/~p225C0442/cafe-map/shinjuku-ramen-map/

## コード規約
- インデント: 2スペース
- 変数宣言: var
- セミコロン: あり
- テンプレート: 文字列連結（+）
- 非同期: async/await と .then() の混在
- CSS: クラスセレクタ、ケバブケース

## ラーメンマップ実在店舗検証結果
| ID | DB店名 | 実在 | 備考 |
|----|--------|------|------|
| 12 | テスト店 | ❌ | データなし、削除予定 |
| 13 | 麺屋 太陽 | ❌ | 新宿に存在せず、削除予定 |
| 14 | らーめん 桜花 | ⚠️ | 実在したが閉店、タグ sho-yu→shoyu 修正済み |
| 15 | 麺処 楓 | ❌ | 新宿に存在せず、削除予定 |
| 16 | 塩専門 銀波 | ❌ | ラーメン店ではない、削除予定 |
| 17 | つけ麺 匠家 | ❌ | 新宿に存在せず、削除予定 |
| 18 | 油そば 昇龍 | ❌ | 中華料理店、ラーメン専門でない、削除予定 |
| 19 | 豚骨拉麺 魁 | ❌ | 実在確認できず、削除予定 |
| 20 | 喜多方ラーメン 蔵 | ✅ | 正: 新宿3-36-18 三協ビル2F、タグ修正済み、住所修正予定 |
| 21 | 味噌ラーメン 北の蔵 | ✅ | 正: 「木桶仕込味噌らーめん 味噌蔵」大久保1-7-20、修正予定 |
| 22 | 潮らーめん 渚 | ❌ | 実在確認できず、削除予定 |

## 現在のステータス
### 完了 ✅
- ラーメンマップUIをカフェマップに統一（header/style/script）
- SCPデプロイ + パーミッション修正
- タグ sho-yu→shoyu 修正（fix_tags.html 実行済み）
- script.js changelog 更新（データ修正・風雲児追加のエントリ追加）

### 未完了（要ブラウザ実行）
- `fix_ramen_data.html` をブラウザで開く → 以下を自動実行:
  - 非実在店舗8件を削除（ID 12,13,15,16,17,18,19,22）
  - 喜多方ラーメン 蔵の住所修正 (id=20)
  - 味噌ラーメン 北の蔵→木桶仕込味噌らーめん 味噌蔵に修正 (id=21)
  - 風雲児の追加

### 関連ファイル
- `shinjuku-ramen-map/fix_ramen_data.html`: 一括修正ツール（要ブラウザ実行）
- `shinjuku-ramen-map/fix_tags.html`: タグ修正用（実行済み）
