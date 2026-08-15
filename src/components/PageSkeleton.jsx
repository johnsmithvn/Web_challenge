import SkeletonList from './SkeletonList';

/**
 * PageSkeleton — khung chờ cho page lazy-load (Suspense fallback ở App.jsx).
 * Dùng chung `SkeletonList` với các màn list để hai trạng thái chờ nối tiếp nhau
 * không đổi kiểu giữa chừng: chờ tải code rồi chờ tải data vẫn là một ngôn ngữ.
 */
export default function PageSkeleton() {
  return (
    <div className="container" style={{ paddingTop: '6rem', paddingBottom: '4rem' }}>
      <div className="page-inner" style={{ maxWidth: 900, margin: '0 auto' }}>
        <SkeletonList heading rows={4} gap="10px" label="Đang tải trang" />
      </div>
    </div>
  );
}
