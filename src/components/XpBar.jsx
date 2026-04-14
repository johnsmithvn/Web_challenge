import { useXpStore } from '../hooks/useXpStore';
import '../styles/xpbar.css';

export default function XpBar({ compact = false }) {
  const { totalXp, levelInfo } = useXpStore();

  if (compact) {
    return (
      <div className="xpbar-compact" title={`${totalXp} XP — ${levelInfo.name}`}>
        <span className="xpbar-compact__emoji">{levelInfo.emoji}</span>
        <div className="xpbar-compact__track">
          <div className="xpbar-compact__fill" style={{ width: `${levelInfo.levelPct}%` }} />
        </div>
        <span className="xpbar-compact__xp">{totalXp} XP</span>
      </div>
    );
  }

  return (
    <div className="xpbar card">
      <div className="xpbar__header">
        <div className="xpbar__level-badge">
          <span className="xpbar__emoji">{levelInfo.emoji}</span>
          <div>
            <div className="xpbar__level-name">{levelInfo.name}</div>
            <div className="xpbar__level-num">Level {levelInfo.level}</div>
          </div>
        </div>
        <div className="xpbar__total gradient-text">{totalXp} XP</div>
      </div>

      <div style={{ margin: '0.75rem 0 0.4rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <span>{levelInfo.xpInLevel} XP</span>
        {levelInfo.next && <span>→ {levelInfo.next.name} ({levelInfo.xpNeeded} XP)</span>}
        {!levelInfo.next && <span>🏆 MAX LEVEL!</span>}
      </div>

      <div className="progress-bar-track" style={{ height: 8 }}>
        <div className="progress-bar-fill" style={{ width: `${levelInfo.levelPct}%` }} />
      </div>

      {levelInfo.next && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem', textAlign: 'right' }}>
          {levelInfo.levelPct}% đến {levelInfo.next.emoji} {levelInfo.next.name}
        </div>
      )}
    </div>
  );
}
