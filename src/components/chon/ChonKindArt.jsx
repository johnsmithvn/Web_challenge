/**
 * Hình minh hoạ theo loại chốn (thay ảnh bìa) — nét sáng như mockup "Chốn" 2A.
 * Màu nét chính = currentColor (đặt bằng class .chon-kind--<kind>), nét phụ (khói, sao) = class `hi`
 * (--chon-art-hi). Thuần trang trí: aria-hidden.
 */
const ART = {
  food: (
    <>
      <path className="hi" d="M80 40c-7-8 7-11 0-20M100 36c-7-8 7-11 0-20M120 40c-7-8 7-11 0-20" />
      <path d="M174 24 112 68M184 32l-62 42" />
      <path d="M38 74h124" strokeWidth="4" />
      <path d="M42 74c3 28 26 44 58 44s55-16 58-44" strokeWidth="4" />
      <path d="M86 120h28" strokeWidth="4" />
      <path className="hi" d="M56 67c8-6 16 5 24 0s16 5 24 0 16 5 24 0 12 4 16 1" />
    </>
  ),
  cafe: (
    <>
      <path d="M62 58h68v26c0 17-14 30-31 30h-6c-17 0-31-13-31-30z" />
      <path d="M130 66h7a11 11 0 0 1 0 22h-9" />
      <path d="M50 124h100" />
      <path className="hi" d="M84 46c-5-7 5-10 0-17M98 46c-5-7 5-10 0-17M112 46c-5-7 5-10 0-17" />
    </>
  ),
  outing: (
    <>
      <path d="M46 112 100 38l54 74z" />
      <path d="M100 38v74M88 112l12-22 12 22" />
      <path d="M30 112h140" />
      <circle className="hi" cx="154" cy="36" r="9" />
      <path className="hi" d="M42 30h.01M66 20h.01M172 72h.01" strokeWidth="4" />
    </>
  ),
  travel: (
    <>
      <path d="M24 114 70 54l26 32 22-28 58 56z" />
      <path className="hi" d="M60 67 70 54l10 13" />
      <path className="hi" d="M40 126c30-10 60 6 120-4" strokeDasharray="3 7" />
      <circle className="hi" cx="150" cy="38" r="9" />
    </>
  ),
  stay: (
    <>
      <path d="M36 112V52" />
      <path d="M36 92h128v20" />
      <path d="M164 92V80a14 14 0 0 0-14-14H88v26" />
      <circle cx="62" cy="76" r="9" />
      <path className="hi" d="M128 34c0 10-8 18-18 18 6-4 9-10 8-18 6 0 10 0 10 0z" />
    </>
  ),
  other: (
    <>
      <path d="M100 118c-14-12-38-34-38-58a38 38 0 0 1 76 0c0 24-24 46-38 58z" />
      <circle cx="100" cy="60" r="13" />
      <path className="hi" d="M60 126h80" strokeDasharray="3 7" />
    </>
  ),
};

export default function ChonKindArt({ kind, size = 128 }) {
  return (
    <svg
      className={`chon-art chon-kind--${ART[kind] ? kind : 'other'}`}
      viewBox="0 0 200 140"
      width={size}
      height={Math.round(size * 0.7)}
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ART[kind] || ART.other}
    </svg>
  );
}
