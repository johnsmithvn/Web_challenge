import React, { useState } from 'react';
import AppIcon from '../AppIcon';
import MuscleAnatomy2D from './MuscleAnatomy2D';
import ExerciseVideoPlayer from './ExerciseVideoPlayer';
import MUSCLE_MAP from '../../data/body-muscles.json';
import { muscleFigureFills } from '../../utils/workoutLogic';

const TABS = [
  { key: 'video', icon: 'video', label: 'Video' },
  { key: 'muscles', icon: 'barbell', label: 'Cơ bắp' },
  { key: 'guide', icon: 'listNumbers', label: 'Hướng dẫn' }
];

const EQUIP_LABEL = { bw: 'Không dụng cụ (Bodyweight)', db: 'Tạ đơn (Dumbbell)' };

/**
 * ExerciseDetailModal — chi tiết bài: video trên đầu, 3 tab [Video] · [Cơ bắp] · [Hướng dẫn],
 * hình cơ 2D (trước + sau), các bước, nhịp thở & tempo, cảnh báo chấn thương, nút Đóng.
 * Mobile: bottom sheet; desktop: hộp giữa màn.
 */
export default function ExerciseDetailModal({ exercise, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('guide');

  if (!isOpen || !exercise) return null;

  const primaryMuscle = exercise.primary;
  const secondaryMuscles = exercise.secondary || [];

  return (
    <div className="body-modal-backdrop body-exd-backdrop" onClick={onClose}>
      <div className="body-modal-box body-exd" role="dialog" aria-modal="true" aria-label={exercise.name} onClick={e => e.stopPropagation()}>
        <div className="body-exd-head">
          <div>
            <h3>{exercise.name}</h3>
            <p>{exercise.level} · {EQUIP_LABEL[exercise.equipment] || 'Xà'}</p>
          </div>
          <button type="button" className="body-icon-btn" onClick={onClose} title="Đóng" aria-label="Đóng">
            <AppIcon name="x" size={16} />
          </button>
        </div>

        <div className="body-exd-scroll">
          <ExerciseVideoPlayer
            exerciseKey={exercise.key}
            exerciseName={exercise.name}
            defaultUrl={exercise.video_url}
            compact={false}
          />

          <div className="body-chip-row body-exd-tabs" role="tablist">
            {TABS.map(t => (
              <button
                key={t.key}
                type="button"
                role="tab"
                className="body-chip"
                aria-selected={activeTab === t.key}
                onClick={() => setActiveTab(t.key)}
              >
                <AppIcon name={t.icon} size={14} />{t.label}
              </button>
            ))}
          </div>

          {activeTab === 'video' && (
            <p className="body-exd-box body-exd-note">
              <AppIcon name="lightbulb" size={15} />
              Xem video thị phạm góc nhìn người thật để nắm chuẩn đường chuyển động và nhịp độ. Bạn có thể bấm nút phóng to toàn màn hình hoặc dán link YouTube/Drive yêu thích của bạn.
            </p>
          )}

          {(activeTab === 'muscles' || activeTab === 'guide') && (
            <div className="body-exd-box body-exd-muscles">
              <div className="body-exd-row">
                <span className="body-eyebrow">Vùng tập trung</span>
                <small>Sáng màu = cơ hoạt động</small>
              </div>
              <div className="body-exd-pills">
                <span className="body-pill is-accent"><i />{MUSCLE_MAP[primaryMuscle]?.name || primaryMuscle} (Chính)</span>
                {secondaryMuscles.map(m => (
                  <span key={m} className="body-pill is-blue"><i />{MUSCLE_MAP[m]?.name || m}</span>
                ))}
              </div>
              <div className="body-exd-figure">
                <MuscleAnatomy2D
                  side="both"
                  height={240}
                  {...muscleFigureFills({ mode: 'group', selected: primaryMuscle, secondary: secondaryMuscles })}
                />
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <>
              <div className="body-exd-box body-exd-row">
                <span className="body-eyebrow">Gợi ý hiệp tập</span>
                <b className="body-exd-sets">
                  {exercise.defaultSets || 3} hiệp × {exercise.defaultTarget || 12} {exercise.metric === 's' ? 'giây' : 'rep'}
                </b>
              </div>

              <div>
                <div className="body-eyebrow body-exd-label">Hướng dẫn động tác</div>
                <ol className="body-exd-steps">
                  {(exercise.steps || []).map((step, idx) => (
                    <li key={idx}><span>{idx + 1}</span>{step}</li>
                  ))}
                </ol>
              </div>

              {(exercise.breathing || exercise.tempo) && (
                <div className="body-exd-box body-exd-text">
                  {exercise.breathing && <p><AppIcon name="wind" size={14} /><b>Nhịp thở:</b> {exercise.breathing}</p>}
                  {exercise.tempo && <p><AppIcon name="metronome" size={14} /><b>Tempo:</b> {exercise.tempo}</p>}
                </div>
              )}

              {exercise.injury_risk && (
                <div className="body-exd-box body-exd-risk">
                  <b><AppIcon name="warning" size={13} />Lưu ý an toàn khớp:</b>
                  <p>{exercise.injury_risk}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="body-exd-foot">
          <button type="button" className="body-btn body-btn-primary body-btn-lg" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}
