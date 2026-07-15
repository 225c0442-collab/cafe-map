# cafe-map

## 概要
渋谷のカフェをマップ表示するアプリ。Supabase バックエンド、Leaflet 地図、認証・コメント・いいね機能付き。

## 技術スタック
- フロントエンド: 素の HTML / CSS / JS（フレームワーク不使用）
- 地図: Leaflet (OpenStreetMap タイル)
- バックエンド: Supabase (PostgreSQL + Auth)
- ファイル構成: index.html（構造）/ style.css（スタイル）/ script.js（ロジック）

## Supabase プロジェクト
- URL: https://nwlfxjtunbqjkwpiaury.supabase.co
- anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53bGZ4anR1bmJxamt3cGlhdXJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTMxOTMsImV4cCI6MjA5OTU4OTE5M30.1ew82vNMtwqqm97-neRxW21hHTW4LH2NmbNZ230rppU

## テーブル
- cafes: id (PK), name, address, lat, lng, comment, hours, wifi, power, parking, tags, like_count, created_at, updated_at
- comments: id (PK), cafe_id (FK), nickname, text, created_at
- profiles: id (FK→auth.users), username (unique)
- action_log: id (PK), username, action, cafe_name, created_at
- likes: id (PK), user_id, cafe_id, created_at (unique(user_id, cafe_id))

## RLS
全テーブルに認証ユーザー向け RLS ポリシーあり。anon/authenticated ロールに GRANT 済み。

## デプロイ
### サーバー
- 公開URL: http://class.tama.net/~p225C0442/cafe-map/
- rsync コマンド（未設定）:
  ```
  rsync -av --delete ./ <user>@class.tama.net:<path>/cafe-map/
  ```

### 手順
1. git push origin master
2. 以下でサーバーに転送:
   ```
   scp index.html style.css script.js AGENTS.md p225C0442@class.tama.net:~/public_html/cafe-map/
   ```
3. http://class.tama.net/~p225C0442/cafe-map/ で確認

## コード規約
- インデント: 2スペース
- 変数宣言: var
- セミコロン: あり
- テンプレート: 文字列連結（+）
- 非同期: async/await と .then() の混在
- CSS: クラスセレクタ、ケバブケース
