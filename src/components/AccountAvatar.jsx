import { useState } from 'react';
import { avatarHue, avatarLetter, faviconCandidates, itemUrl } from '../utils/vaultLogic';

/**
 * AccountAvatar — ô nhận diện 36px của một item trong vault. 3 tầng, tự rơi
 * xuống tầng sau khi tầng trước hỏng:
 *   1. favicon lấy TRỰC TIẾP từ domain của dịch vụ (apple-touch-icon → favicon.ico)
 *   2. plate màu + chữ cái đầu (màu hash từ tiêu đề nên cùng dịch vụ luôn cùng màu)
 *
 * ⚠️ KHÔNG dùng dịch vụ favicon của bên thứ ba (google.com/s2/favicons,
 *    icons.duckduckgo.com, Clearbit, logo.dev): đây là vault, gửi danh sách
 *    domain mình có tài khoản cho MỘT bên là tự khai mình dùng dịch vụ nào.
 *    Xem `faviconCandidates()` trong vaultLogic.js.
 *
 * ⚠️ Rơi về chữ cái là **trạng thái bình thường, không phải lỗi** — rất nhiều
 *    site không có `/apple-touch-icon.png`, và console sẽ có dòng 404. Vì thế
 *    plate màu giữ NGUYÊN ở cả 3 tầng: tầng rơi xuống phải trông có chủ ý.
 *
 * Trạng thái ảnh hỏng khoá theo CHÍNH URL ảnh (không theo index), nên đổi item
 * hay đổi website không cần effect reset — URL mới thì đơn giản là chưa có
 * trong `failed`.
 */
export default function AccountAvatar({ item, useFavicon = false }) {
  const [failed, setFailed] = useState({});

  const url = useFavicon ? itemUrl(item) : null;
  const src = faviconCandidates(url).find((c) => !failed[c]);
  const hue = avatarHue(item?.title || '');

  return (
    <span
      className={`acc-avatar${src ? ' acc-avatar--img' : ''}`}
      style={{ '--h': hue }}
      aria-hidden="true"
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed((f) => ({ ...f, [src]: true }))}
        />
      ) : avatarLetter(item?.title)}
    </span>
  );
}
