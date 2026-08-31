-- Migration v6.15.0: Bổ sung cột lưu khóa dự phòng (Emergency Recovery Key) cho vault_config
-- Ngày: 2026-08-31
-- Tác vụ: Cho phép lưu DEK đã được bọc bằng Recovery Key dự phòng để khôi phục khi quên mật khẩu Vault.

ALTER TABLE public.vault_config
  ADD COLUMN IF NOT EXISTS recovery_wrapped_key TEXT,
  ADD COLUMN IF NOT EXISTS recovery_wrapped_key_nonce TEXT;
