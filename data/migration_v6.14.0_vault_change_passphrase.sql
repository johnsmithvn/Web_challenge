-- Migration v6.14.0: Cấp quyền UPDATE cho vault_config để hỗ trợ tính năng đổi mật khẩu Vault (Change Passphrase)
-- Ngày: 2026-08-31
-- Tác vụ: Cho phép user cập nhật bản ghi vault_config của chính mình khi re-wrap khóa DEK.

-- 1. Tạo RLS Policy cho phép user cập nhật dòng cấu hình của chính mình
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vault_config' AND policyname = 'vault_config_update_own'
  ) THEN
    CREATE POLICY "vault_config_update_own" ON public.vault_config
      FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 2. Cấp quyền UPDATE trên bảng vault_config cho authenticated users
GRANT UPDATE ON TABLE public.vault_config TO authenticated;
