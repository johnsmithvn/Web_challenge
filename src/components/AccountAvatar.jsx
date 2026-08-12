import { useState } from 'react';
import { avatarHue, avatarLetter } from '../utils/vaultLogic';

/**
 * AccountAvatar — ô nhận diện 36px của một item trong vault. 2 tầng:
 *   1. logo user tự chọn — data URI PNG 48×48 nằm TRONG encrypted payload
 *   2. plate màu + chữ cái đầu (màu hash từ tiêu đề nên cùng dịch vụ luôn cùng màu)
 *
 * ⚠️ KHÔNG có tầng nào gọi mạng. Bản trước lấy favicon trực tiếp từ origin của
 *    từng dịch vụ, gác sau một nút `Logos`. Đã bỏ hẳn:
 *      - Mỗi lần mở vault là N request tới N domain → chính các domain đó biết IP
 *        này vừa mở một vault có tài khoản của họ. Nút toggle chỉ trì hoãn chuyện
 *        đó, không loại bỏ nó.
 *      - Chỉ đoán được 2 đường `/apple-touch-icon.png` và `/favicon.ico`, nên đa
 *        số site rơi về chữ cái — công gọi mạng mà phần lớn không ra kết quả.
 *      - Item không có field URL (thẻ ngân hàng, giấy tờ) thì không bao giờ có logo.
 *    Logo lưu trong payload xử được cả ba: một lần chọn, mã hoá cùng item, chạy
 *    offline, và item nào cũng đặt được.
 *    ĐỪNG thêm lại favicon aggregator (google.com/s2, DuckDuckGo, Clearbit,
 *    logo.dev): gửi danh sách domain mình có tài khoản cho MỘT bên thứ ba là tự
 *    khai mình dùng ngân hàng nào, sàn nào.
 *
 * ⚠️ Rơi về chữ cái là **trạng thái bình thường, không phải lỗi** — item chưa đặt
 *    logo thì đứng ở tầng 2 mãi. Vì thế plate màu giữ NGUYÊN ở cả 2 tầng: tầng rơi
 *    xuống phải trông có chủ ý.
 *
 * `failed` khoá theo CHÍNH chuỗi ảnh (không theo index), nên đổi item hay đổi logo
 * không cần effect reset — data URI mới thì đơn giản là chưa có trong `failed`.
 */
export default function AccountAvatar({ item }) {
  const [failed, setFailed] = useState({});

  const logo = item?.logo || null;
  const src = logo && !failed[logo] ? logo : null;
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
          onError={() => setFailed((f) => ({ ...f, [src]: true }))}
        />
      ) : avatarLetter(item?.title)}
    </span>
  );
}
