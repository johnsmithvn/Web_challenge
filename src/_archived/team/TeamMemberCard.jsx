// prop-types not installed — types documented via JSDoc

const WEEK_LABELS  = ['', 'Tuần 1', 'Tuần 2', 'Tuần 3'];
const WEEK_COLORS  = ['', 'var(--cyan)', 'var(--purple)', 'var(--green)'];
const WEEK_DESC    = ['', 'Tự check được', '🔒 Cần đồng đội check', 'Tự check được'];

/**
 * TeamMemberCard — 1 card per member in team grid
 *
 * Props:
 *   member        — assembled member object from useTeam
 *   todayKey      — 'YYYY-MM-DD'
 *   isDayValidated — fn(member) => boolean
 *   needsTeamCheck — fn(member) => boolean
 *   onCheckClick  — fn(member) — opens check panel for this person
 *   canBeChecked  — boolean — whether current user can check this person
 */
export default function TeamMemberCard({
  member,
  todayKey,
  isDayValidated,
  needsTeamCheck,
  onCheckClick,
  canBeChecked,
}) {
  // Last 7 days for mini heatmap
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return d.toISOString().split('T')[0];
  });

  const validated   = isDayValidated(member);
  const needsCheck  = needsTeamCheck(member);
  const weekColor   = WEEK_COLORS[member.currentWeek] || 'var(--cyan)';

  return (
    <div className={`team-member-card card ${member.isMe ? 'team-member-card--me' : ''}`}>
      {/* Avatar */}
      <div className="team-member-card__avatar" style={{ borderColor: weekColor }}>
        {member.avatar_url
          ? <img src={member.avatar_url} alt={member.display_name} />
          : <span>{member.display_name?.[0]?.toUpperCase() || '👤'}</span>
        }
        {member.role === 'owner' && (
          <div className="team-member-card__owner-badge" title="Team Owner">👑</div>
        )}
      </div>

      {/* Name */}
      <div className="team-member-card__name">
        {member.display_name || 'Unknown'}
        {member.isMe && <span className="badge badge-cyan" style={{ fontSize: '0.6rem' }}>Bạn</span>}
      </div>

      {/* Week badge */}
      <div className="team-member-card__week" style={{ color: weekColor, borderColor: weekColor }}>
        {WEEK_LABELS[member.currentWeek] || 'Tuần 1'}
        <span className="team-member-card__week-desc">{WEEK_DESC[member.currentWeek]}</span>
      </div>

      {/* Streak */}
      <div className="team-member-card__streak">
        <span>🔥</span> {member.streak} streak
      </div>

      {/* Mini heatmap */}
      <div className="team-player-mini-heatmap">
        {weekDays.map(d => {
          const done = !!member.progress?.[d];
          return (
            <div
              key={d}
              className={`heatmap-cell ${done ? 'heatmap-cell--done' : 'heatmap-cell--empty'}`}
              title={d}
            />
          );
        })}
      </div>

      {/* Today status */}
      <div className={`team-today-badge ${validated ? 'done' : needsCheck ? 'locked' : 'pending'}`}>
        {validated
          ? '✅ Done hôm nay!'
          : needsCheck
            ? '🔒 Cần đồng đội check'
            : '⏳ Chưa tick hôm nay'}
      </div>

      {/* Check button — shown for non-self week-2 members */}
      {!member.isMe && needsCheck && canBeChecked && (
        <button
          className="btn btn-primary"
          style={{ marginTop: '0.5rem', width: '100%', fontSize: '0.82rem', padding: '0.5rem' }}
          onClick={() => onCheckClick(member)}
          id={`check-btn-${member.id}`}
        >
          ✅ Check cho {member.display_name?.split(' ').slice(-1)[0] || 'người này'}
        </button>
      )}

      {/* Already checked indicator */}
      {!member.isMe && needsCheck && !canBeChecked && (
        <div className="team-member-card__checked-indicator">
          ✓ Đã check hôm nay
        </div>
      )}
    </div>
  );
}


