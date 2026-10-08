import React, { useState } from 'react';
import AppIcon from '../AppIcon';
import MuscleAnatomy2D from './MuscleAnatomy2D';
import ExerciseVideoPlayer, { getCustomVideoUrl } from './ExerciseVideoPlayer';
import MUSCLE_MAP from '../../data/body-muscles.json';

/**
 * ExerciseDetailModal — Modal chi tiết bài tập chuẩn phong cách Fitness Pro
 * Bao gồm:
 * 1. Video YouTube / Google Drive trên đầu
 * 2. 3 Tab chuyển nhanh: [Video] · [Cơ bắp] · [Hướng dẫn]
 * 3. Hướng dẫn chi tiết, Nhịp thở & Tempo
 * 4. Bản đồ giải phẫu 2D (Front & Back) sáng đèn các nhóm cơ mục tiêu
 * 5. Nút ĐÓNG to bản phía dưới
 */
export default function ExerciseDetailModal({ exercise, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('guide'); // 'video' | 'muscles' | 'guide'

  if (!isOpen || !exercise) return null;

  const primaryMuscle = exercise.primary;
  const secondaryMuscles = exercise.secondary || [];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'flex-end', // Trượt từ dưới lên (Bottom Sheet trên mobile)
        justifyContent: 'center',
        padding: '0',
        animation: 'fadeIn 0.2s ease'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '92vh',
          background: 'var(--body-card-bg, #FFFFFF)',
          color: 'var(--body-text-main, #0F172A)',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── HEADER MODAL ─────────────────────────────────────────── */}
        <div style={{
          padding: '18px 20px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--body-card-border, #E2E8F0)'
        }}>
          <div>
            <h3 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 800,
              letterSpacing: '-0.3px',
              textTransform: 'uppercase',
              color: 'var(--body-text-main)'
            }}>
              {exercise.name}
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--body-text-muted)', marginTop: '2px' }}>
              {exercise.level} · {exercise.equipment === 'bw' ? 'Không dụng cụ (Bodyweight)' : exercise.equipment === 'db' ? 'Tạ đơn (Dumbbell)' : 'Xà'}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: 'none',
              background: 'var(--body-shell-bg, #F1F5F9)',
              color: 'var(--body-text-main)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            title="Đóng"
          >
            <AppIcon name="x" size={18} />
          </button>
        </div>

        {/* ── NỘI DUNG CUỘN ────────────────────────────────────────── */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* 1. KHUNG VIDEO YOUTUBE / DRIVE TRÊN ĐẦU */}
          <div>
            <ExerciseVideoPlayer
              exerciseKey={exercise.key}
              exerciseName={exercise.name}
              defaultUrl={exercise.video_url}
              compact={false}
            />
          </div>

          {/* 2. THANH TAB CHUYỂN ĐỔI GỌN GÀNG (PILL TABS) */}
          <div style={{
            display: 'flex',
            background: 'var(--body-shell-bg, #F1F5F9)',
            padding: '4px',
            borderRadius: '9999px',
            gap: '4px'
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('video')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '9999px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                background: activeTab === 'video' ? '#2563EB' : 'transparent',
                color: activeTab === 'video' ? '#FFFFFF' : 'var(--body-text-muted)',
                transition: 'all 0.15s ease'
              }}
            >
              🎥 Video
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('muscles')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '9999px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                background: activeTab === 'muscles' ? '#2563EB' : 'transparent',
                color: activeTab === 'muscles' ? '#FFFFFF' : 'var(--body-text-muted)',
                transition: 'all 0.15s ease'
              }}
            >
              💪 Cơ bắp
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '9999px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                background: activeTab === 'guide' ? '#2563EB' : 'transparent',
                color: activeTab === 'guide' ? '#FFFFFF' : 'var(--body-text-muted)',
                transition: 'all 0.15s ease'
              }}
            >
              📋 Hướng dẫn
            </button>
          </div>

          {/* ── TAB 1: VIDEO TẬP TRUNG ──────────────────────────────── */}
          {activeTab === 'video' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '12px',
              borderRadius: '14px',
              background: 'var(--body-shell-bg, #F8FAFC)'
            }}>
              <div style={{ fontSize: '13px', color: 'var(--body-text-muted)', lineHeight: 1.5 }}>
                💡 Xem video thị phạm góc nhìn người thật để nắm chuẩn đường chuyển động và nhịp độ. Bạn có thể bấm nút phóng to toàn màn hình hoặc dán link YouTube/Drive yêu thích của bạn.
              </div>
            </div>
          )}

          {/* ── TAB 2: CƠ BẮP (2D ANATOMY MAP) ─────────────────────── */}
          {(activeTab === 'muscles' || activeTab === 'guide') && (
            <div style={{
              padding: '16px',
              borderRadius: '16px',
              background: 'var(--body-shell-bg, #F8FAFC)',
              border: '1px solid var(--body-card-border, #E2E8F0)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#2563EB' }}>
                  VÙNG TẬP TRUNG
                </span>
                <span style={{ fontSize: '11px', color: 'var(--body-text-muted)' }}>
                  Sáng xanh = Cơ hoạt động
                </span>
              </div>

              {/* Các Badges nhóm cơ */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  background: 'rgba(37, 99, 235, 0.12)',
                  color: '#2563EB',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563EB' }} />
                  {MUSCLE_MAP[primaryMuscle]?.name || primaryMuscle} (Chính)
                </span>

                {secondaryMuscles.map(m => (
                  <span key={m} style={{
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    background: 'rgba(96, 165, 250, 0.15)',
                    color: '#1D4ED8',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#60A5FA' }} />
                    {MUSCLE_MAP[m]?.name || m}
                  </span>
                ))}
              </div>

              {/* BẢN ĐỒ GIẢI PHẪU 2D TRƯỚC VÀ SAU */}
              <div style={{
                background: 'var(--body-card-bg, #FFFFFF)',
                borderRadius: '14px',
                padding: '16px 8px',
                border: '1px solid var(--body-card-border, #E2E8F0)',
                display: 'flex',
                justifyContent: 'center'
              }}>
                <MuscleAnatomy2D
                  primary={primaryMuscle}
                  secondary={secondaryMuscles}
                  height={240}
                  interactive={true}
                />
              </div>
            </div>
          )}

          {/* ── TAB 3: HƯỚNG DẪN TỪNG BƯỚC, NHỊP THỞ & TEMPO ───────── */}
          {activeTab === 'guide' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* THỜI LƯỢNG / SỐ SETS GỢI Ý */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'var(--body-shell-bg, #F8FAFC)',
                border: '1px solid var(--body-card-border, #E2E8F0)'
              }}>
                <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--body-text-muted)' }}>
                  GỢI Ý HIỆP TẬP
                </span>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#2563EB' }}>
                  {exercise.defaultSets || 3} hiệp × {exercise.defaultTarget || 12} {exercise.metric === 's' ? 'giây' : 'rep'}
                </span>
              </div>

              {/* HƯỚNG DẪN TỪNG BƯỚC */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--body-text-muted)', marginBottom: '8px' }}>
                  HƯỚNG DẪN ĐỘNG TÁC:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(exercise.steps || []).map((step, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: 'var(--body-shell-bg, #F1F5F9)',
                        color: 'var(--body-text-main)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                        flexShrink: 0
                      }}>
                        {idx + 1}
                      </span>
                      <span style={{ fontSize: '13px', lineHeight: 1.55, color: 'var(--body-text-main)' }}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* NHỊP THỞ VÀ TEMPO */}
              {(exercise.breathing || exercise.tempo) && (
                <div style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'var(--body-shell-bg, #F8FAFC)',
                  border: '1px solid var(--body-card-border, #E2E8F0)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {exercise.breathing && (
                    <div style={{ fontSize: '12.5px', lineHeight: 1.45, color: 'var(--body-text-main)' }}>
                      <strong>🌬️ Nhịp thở:</strong> {exercise.breathing}
                    </div>
                  )}
                  {exercise.tempo && (
                    <div style={{ fontSize: '12.5px', lineHeight: 1.45, color: 'var(--body-text-main)' }}>
                      <strong>⏱️ Tempo:</strong> {exercise.tempo}
                    </div>
                  )}
                </div>
              )}

              {/* CẢNH BÁO CHẤN THƯƠNG NẾU CÓ */}
              {exercise.injury_risk && (
                <div style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#DC2626', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <AppIcon name="warning" size={13} />
                    <span>Lưu ý an toàn khớp:</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--body-text-main)', lineHeight: 1.45 }}>
                    {exercise.injury_risk}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── FOOTER STICKY: NÚT ĐÓNG TO BẢN (BLUE PILL BUTTON) ─────── */}
        <div style={{
          padding: '12px 20px 20px',
          borderTop: '1px solid var(--body-card-border, #E2E8F0)',
          background: 'var(--body-card-bg, #FFFFFF)'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              height: '48px',
              borderRadius: '9999px',
              border: 'none',
              background: '#2563EB',
              color: '#FFFFFF',
              fontSize: '15px',
              fontWeight: 800,
              letterSpacing: '0.5px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
              transition: 'transform 0.1s ease, background 0.15s ease'
            }}
          >
            ĐÓNG
          </button>
        </div>
      </div>
    </div>
  );
}
