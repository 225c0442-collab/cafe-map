-- Supabase SQL Editor で実行してください
-- ===== 新宿ラーメンマップ用テーブル =====

-- ラーメン店テーブル
CREATE TABLE IF NOT EXISTS ramen_shops (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  comment TEXT,
  hours TEXT,
  wifi BOOLEAN,
  power BOOLEAN,
  parking BOOLEAN,
  tags TEXT[],
  like_count BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- コメントテーブル
CREATE TABLE IF NOT EXISTS ramen_comments (
  id BIGSERIAL PRIMARY KEY,
  shop_id BIGINT REFERENCES ramen_shops(id) ON DELETE CASCADE,
  nickname TEXT,
  text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- いいねテーブル
CREATE TABLE IF NOT EXISTS ramen_likes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id BIGINT REFERENCES ramen_shops(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, shop_id)
);

-- 操作ログテーブル
CREATE TABLE IF NOT EXISTS ramen_action_log (
  id BIGSERIAL PRIMARY KEY,
  username TEXT,
  action TEXT,
  shop_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 有効化
ALTER TABLE ramen_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE ramen_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ramen_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ramen_action_log ENABLE ROW LEVEL SECURITY;

-- RLS ポリシー（cafes と同じ構成）
CREATE POLICY "ramen_shops_select" ON ramen_shops FOR SELECT USING (true);
CREATE POLICY "ramen_shops_insert" ON ramen_shops FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "ramen_shops_update" ON ramen_shops FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "ramen_shops_delete" ON ramen_shops FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "ramen_comments_select" ON ramen_comments FOR SELECT USING (true);
CREATE POLICY "ramen_comments_insert" ON ramen_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "ramen_comments_delete" ON ramen_comments FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "ramen_likes_select" ON ramen_likes FOR SELECT USING (true);
CREATE POLICY "ramen_likes_insert" ON ramen_likes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "ramen_likes_delete" ON ramen_likes FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "ramen_action_log_select" ON ramen_action_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ramen_action_log_insert" ON ramen_action_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- anon/authenticated ロールに権限付与
GRANT ALL ON ramen_shops TO anon, authenticated;
GRANT ALL ON ramen_comments TO anon, authenticated;
GRANT ALL ON ramen_likes TO anon, authenticated;
GRANT ALL ON ramen_action_log TO anon, authenticated;
GRANT USAGE ON SEQUENCE ramen_shops_id_seq TO anon, authenticated;
GRANT USAGE ON SEQUENCE ramen_comments_id_seq TO anon, authenticated;
GRANT USAGE ON SEQUENCE ramen_likes_id_seq TO anon, authenticated;
GRANT USAGE ON SEQUENCE ramen_action_log_id_seq TO anon, authenticated;

-- 特殊レコードの追加
INSERT INTO ramen_shops (id, name, comment) VALUES
  (53, '__counter__', '{"vc":0}'),
  (54, '__bans__', '{"banned":[]}'),
  (55, '__admins__', '{"admins":["f583f324-613d-447f-aab2-2e72eeb91de1"]}'),
  (56, '__inquiries__', '{"inquiries":[]}'),
  (57, '__photos__', '{"photos":{}}'),
  (58, '__apps__', '{"apps":[]}')
ON CONFLICT (id) DO NOTHING;
