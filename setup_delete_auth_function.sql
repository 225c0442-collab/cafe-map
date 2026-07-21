-- Supabase SQLエディタで実行してください
-- auth.users削除用の関数を作成（SECURITY DEFINERで昇格権限）

CREATE OR REPLACE FUNCTION public.delete_auth_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'auth'
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- anonロールに実行権限を付与（クライアントからのRPC呼び出しを許可）
GRANT EXECUTE ON FUNCTION public.delete_auth_user TO anon;
GRANT EXECUTE ON FUNCTION public.delete_auth_user TO authenticated;
