/**
 * PageSkeleton — lightweight loading placeholder for lazy-loaded pages.
 * Shows a shimmer skeleton matching the general page layout.
 */
export default function PageSkeleton() {
  return (
    <div className="container" style={{ paddingTop: '6rem', paddingBottom: '4rem' }}>
      <div className="page-inner" style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Title shimmer */}
        <div style={{
          height: 32, width: '40%', borderRadius: 8,
          background: 'rgba(255,255,255,0.06)',
          animation: 'skeleton-shimmer 1.4s infinite',
          marginBottom: '1.5rem',
        }} />
        {/* Cards */}
        {[1, 2, 3].map(i => (
          <div key={i} className="card" style={{
            padding: '1.5rem',
            marginBottom: '1rem',
            animation: 'skeleton-shimmer 1.4s infinite',
            animationDelay: `${i * 0.1}s`,
          }}>
            <div style={{
              height: 16, width: '60%', borderRadius: 6,
              background: 'rgba(255,255,255,0.06)',
              marginBottom: '0.75rem',
            }} />
            <div style={{
              height: 12, width: '80%', borderRadius: 6,
              background: 'rgba(255,255,255,0.04)',
            }} />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes skeleton-shimmer {
          0%   { opacity: 1; }
          50%  { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
