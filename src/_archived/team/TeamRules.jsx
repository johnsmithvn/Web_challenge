import { useState } from 'react';
// prop-types not installed — types documented via JSDoc

const TRIGGERS = [
  { value: 'miss_day',      label: '☠️ Bỏ 1 ngày',          desc: 'Khi ai đó bỏ lỡ 1 ngày' },
  { value: 'streak_7',      label: '🔥 Streak 7 ngày',       desc: 'Khi đạt streak 7 ngày liên tiếp' },
  { value: 'complete_week2',label: '🏆 Qua được Tuần 2',      desc: 'Khi hoàn thành tuần 2' },
  { value: 'custom',        label: '✏️ Khác (custom)',        desc: 'Tự định nghĩa điều kiện' },
];

/**
 * TeamRuleCard — display a single rule with agreements + respond buttons
 */
export function TeamRuleCard({ rule, agreements, myAgreement, memberCount, onAgree, onReject, userId }) {
  const agreedCount = agreements.filter(a => a.agreed).length;
  const status = rule.status; // 'pending' | 'active' | 'rejected'

  const statusConfig = {
    active:   { label: '✅ Active',     cls: 'rule-status--active' },
    rejected: { label: '❌ Bị từ chối', cls: 'rule-status--rejected' },
    pending:  { label: `⏳ ${agreedCount}/${memberCount} đồng ý`, cls: 'rule-status--pending' },
  };
  const sc = statusConfig[status] || statusConfig.pending;

  const isProposer     = rule.proposed_by === userId;
  const myVote         = myAgreement?.agreed;
  const canVote        = status === 'pending' && !isProposer && myAgreement === null;
  const alreadyVoted   = status === 'pending' && (isProposer || myAgreement !== null);

  return (
    <div className={`team-rule-card ${status === 'active' ? 'team-rule-card--active' : ''} ${status === 'rejected' ? 'team-rule-card--rejected' : ''}`}>
      {/* Icon + type */}
      <div className="team-rule-card__top">
        <span className="team-rule-card__type-icon">
          {rule.rule_type === 'reward' ? '🏆' : '🔴'}
        </span>
        <span className={`rule-status ${sc.cls}`}>{sc.label}</span>
      </div>

      {/* Description */}
      <div className="team-rule-card__desc">{rule.description}</div>

      {/* Amount (if set) */}
      {rule.amount_vnd > 0 && (
        <div className="team-rule-card__amount">
          💸 {rule.amount_vnd.toLocaleString('vi-VN')}đ
        </div>
      )}

      {/* Trigger */}
      <div className="team-rule-card__trigger">
        {TRIGGERS.find(t => t.value === rule.trigger)?.label || rule.trigger}
      </div>

      {/* Actions */}
      {canVote && (
        <div className="team-rule-card__actions">
          <button className="btn btn-ghost" style={{ fontSize: '0.82rem', padding: '0.4rem 1rem' }}
            onClick={() => onReject(rule.id)} id={`reject-rule-${rule.id}`}>
            ❌ Từ Chối
          </button>
          <button className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '0.4rem 1rem' }}
            onClick={() => onAgree(rule.id)} id={`agree-rule-${rule.id}`}>
            ✅ Đồng Ý
          </button>
        </div>
      )}

      {alreadyVoted && status === 'pending' && (
        <div className="team-rule-card__voted">
          {isProposer
            ? '✏️ Bạn đề xuất rule này — chờ người khác đồng ý'
            : myVote ? '✅ Bạn đã đồng ý' : '❌ Bạn đã từ chối'}
        </div>
      )}
    </div>
  );
}



/**
 * TeamRules — full section: list rules + propose form
 */
export default function TeamRules({ teamId, memberIds, userId, useTeamRulesHook }) {
  const {
    rules, loading,
    proposing, propError, setPropError,
    proposeRule, respondToRule,
    getAgreementsForRule, myAgreementForRule,
  } = useTeamRulesHook;

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    ruleType:   'punishment',
    trigger:    'miss_day',
    description:'',
    amountVnd:  '',
  });

  const handlePropose = async () => {
    await proposeRule({
      ruleType:   form.ruleType,
      trigger:    form.trigger,
      description: form.description,
      amountVnd:  form.amountVnd ? parseInt(form.amountVnd, 10) : null,
    });
    if (!propError) {
      setForm({ ruleType: 'punishment', trigger: 'miss_day', description: '', amountVnd: '' });
      setShowForm(false);
    }
  };

  return (
    <div className="card team-rules-section">
      <div className="team-rules-header">
        <div className="dash-card-title">⚖️ Team Rules</div>
        <button
          className="btn btn-ghost"
          style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }}
          onClick={() => { setShowForm(v => !v); setPropError(''); }}
          id="add-rule-btn"
        >
          {showForm ? '✕ Đóng' : '+ Thêm Rule'}
        </button>
      </div>

      {/* Propose form */}
      {showForm && (
        <div className="team-rule-form">
          {/* Type */}
          <div className="team-rule-form__row">
            <label>Loại rule</label>
            <div className="team-rule-form__type-btns">
              {['punishment', 'reward'].map(t => (
                <button
                  key={t}
                  className={`team-rule-type-btn ${form.ruleType === t ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, ruleType: t }))}
                  id={`rule-type-${t}`}
                >
                  {t === 'reward' ? '🏆 Thưởng' : '🔴 Phạt'}
                </button>
              ))}
            </div>
          </div>

          {/* Trigger */}
          <div className="team-rule-form__row">
            <label>Điều kiện kích hoạt</label>
            <div className="team-rule-form__triggers">
              {TRIGGERS.map(t => (
                <button
                  key={t.value}
                  className={`team-rule-trigger-btn ${form.trigger === t.value ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, trigger: t.value }))}
                  id={`rule-trigger-${t.value}`}
                  title={t.desc}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="team-rule-form__row">
            <label>Mô tả rule *</label>
            <textarea
              className="auth-input"
              placeholder="VD: Bỏ 1 ngày phải chuyển khoản 50k cho teammate..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
              id="rule-description"
            />
          </div>

          {/* Amount */}
          <div className="team-rule-form__row">
            <label>Số tiền (tuỳ chọn, VNĐ)</label>
            <input
              type="number"
              className="auth-input"
              placeholder="VD: 50000"
              value={form.amountVnd}
              onChange={e => setForm(f => ({ ...f, amountVnd: e.target.value }))}
              id="rule-amount"
              style={{ maxWidth: 200 }}
            />
          </div>

          {propError && <div className="auth-error">{propError}</div>}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)} id="rule-cancel">Huỷ</button>
            <button
              className="btn btn-primary"
              onClick={handlePropose}
              disabled={proposing || !form.description.trim()}
              id="rule-propose"
            >
              {proposing ? '⏳...' : '✉️ Đề Xuất Rule'}
            </button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {loading ? (
        <div className="team-rules-empty">⏳ Đang tải...</div>
      ) : rules.length === 0 ? (
        <div className="team-rules-empty">
          Chưa có rule nào. Hãy đề xuất quy tắc chung để tạo động lực!
        </div>
      ) : (
        <div className="team-rules-list">
          {rules.map(rule => (
            <TeamRuleCard
              key={rule.id}
              rule={rule}
              agreements={getAgreementsForRule(rule.id)}
              myAgreement={myAgreementForRule(rule.id)}
              memberCount={memberIds.length}
              userId={userId}
              onAgree={id  => respondToRule(id, true)}
              onReject={id => respondToRule(id, false)}
            />
          ))}
        </div>
      )}
    </div>
  );
}


