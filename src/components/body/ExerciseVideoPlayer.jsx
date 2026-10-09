import React, { useState } from 'react';
import AppIcon from '../AppIcon';
import { ConfirmModal } from '../ConfirmModal';
import { useExerciseVideo } from '../../hooks/useExerciseVideo';
import {
  getYoutubeEmbedUrl,
  isYoutubeUrl,
  isDriveUrl,
  extractDriveFileId,
  normalizeHttpUrl
} from '../../utils/mediaUtils';

/**
 * Component hiển thị và nhúng video YouTube / Google Drive cho bài tập.
 * Link tự gắn lưu ở bảng body_exercise_videos (useExerciseVideo); không có thì dùng link mặc định.
 */
export default function ExerciseVideoPlayer({
  exerciseKey,
  exerciseName,
  defaultUrl = '',
  compact = false
}) {
  const { customUrl, saveUrl, removeUrl } = useExerciseVideo(exerciseKey);
  const videoUrl = customUrl || defaultUrl || '';
  const [isEditing, setIsEditing] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [isOpen, setIsOpen] = useState(!compact); // Mở mặc định ở trang thư viện, thu gọn ở màn hình tập
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  // Đổi bài tập → đóng form sửa, mở lại video ở trang thư viện
  const [prevKey, setPrevKey] = useState(exerciseKey);
  if (prevKey !== exerciseKey) {
    setPrevKey(exerciseKey);
    setIsEditing(false);
    setErrorMsg('');
    if (!compact) setIsOpen(true);
  }

  const handleStartEdit = () => {
    setInputUrl(videoUrl || '');
    setErrorMsg('');
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!inputUrl.trim()) {
      if (customUrl) setConfirmRemoveOpen(true);
      else setIsEditing(false);
      return;
    }

    const clean = normalizeHttpUrl(inputUrl);
    const isYt = isYoutubeUrl(clean);
    const isGdrive = isDriveUrl(clean);
    const isDirect = /\.(mp4|webm|mov)(\?|$)/i.test(clean);

    if (!clean || (!isYt && !isGdrive && !isDirect)) {
      setErrorMsg('Vui lòng nhập link YouTube hợp lệ (watch, youtu.be, shorts), Google Drive hoặc file video direct (.mp4)!');
      return;
    }

    setSaving(true);
    try {
      await saveUrl(clean);
      setIsEditing(false);
      setIsOpen(true);
      setErrorMsg('');
    } catch (err) {
      console.error('Save exercise video failed:', err);
      setErrorMsg('Không lưu được link, vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = () => setConfirmRemoveOpen(true);

  const handleConfirmRemove = async () => {
    setConfirmRemoveOpen(false);
    try {
      await removeUrl();
      setIsEditing(false);
      setErrorMsg('');
    } catch (err) {
      console.error('Remove exercise video failed:', err);
      setErrorMsg('Không gỡ được link, vui lòng thử lại.');
    }
  };

  // Xác định định dạng embed
  const isYt = videoUrl ? isYoutubeUrl(videoUrl) : false;
  const isGdrive = videoUrl ? isDriveUrl(videoUrl) : false;
  const ytEmbedUrl = isYt ? getYoutubeEmbedUrl(videoUrl) : null;
  const driveId = isGdrive ? extractDriveFileId(videoUrl) : null;
  const isDirect = videoUrl && /\.(mp4|webm|mov)(\?|$)/i.test(videoUrl);

  return (
    <div style={{
      borderRadius: '14px',
      background: 'var(--body-shell-bg)',
      border: '1px solid var(--body-card-border)',
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🎥</span>
          <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--body-text-main)' }}>
            Video thị phạm (YouTube / Google Drive)
          </span>
          {videoUrl && (
            <span className="body-badge body-badge-accent" style={{ fontSize: '11px', padding: '1px 6px' }}>
              {isYt ? 'YouTube' : isGdrive ? 'Google Drive' : 'Video'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {videoUrl && (
            <>
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="body-btn body-btn-ghost"
                style={{ padding: '4px 8px', fontSize: '12px', height: '28px' }}
                title={isOpen ? 'Thu gọn video' : 'Mở xem video'}
              >
                {isOpen ? 'Thu gọn' : 'Xem video'}
              </button>

              <button
                type="button"
                onClick={handleStartEdit}
                className="body-btn body-btn-ghost"
                style={{ padding: '4px 8px', fontSize: '12px', height: '28px' }}
                title="Thay đổi link video"
              >
                Đổi link
              </button>

              <a
                href={videoUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="body-btn body-btn-ghost"
                style={{ padding: '4px 8px', fontSize: '12px', height: '28px', textDecoration: 'none' }}
                title="Mở tab mới trên YouTube hoặc Google Drive"
              >
                <AppIcon name="external" size={13} />
              </a>
            </>
          )}

          {!videoUrl && !isEditing && (
            <button
              type="button"
              onClick={handleStartEdit}
              className="body-btn body-btn-ghost"
              style={{ padding: '4px 10px', fontSize: '12px', height: '28px', color: 'var(--body-accent)' }}
            >
              + Gắn link video
            </button>
          )}
        </div>
      </div>

      {/* Editing Form */}
      {isEditing && (
        <form onSubmit={handleSave} style={{
          padding: '12px',
          borderRadius: '10px',
          background: 'var(--body-card-bg)',
          border: '1px solid var(--body-card-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-main)' }}>
            Dán link YouTube (watch/shorts/youtu.be) hoặc Google Drive:
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="url"
              placeholder="https://www.youtube.com/watch?v=... hoặc drive.google.com/..."
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              autoFocus
              style={{
                flex: 1,
                height: '34px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid var(--body-card-border)',
                background: 'var(--body-shell-bg)',
                color: 'var(--body-text-main)',
                fontSize: '12.5px'
              }}
            />
            <button
              type="submit"
              className="body-btn body-btn-primary"
              disabled={saving}
              style={{ height: '34px', padding: '0 12px', fontSize: '12px' }}
            >
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="body-btn body-btn-ghost"
              style={{ height: '34px', padding: '0 10px', fontSize: '12px' }}
            >
              Hủy
            </button>
          </div>

          {errorMsg && (
            <div style={{ fontSize: '11.5px', color: '#DC2626' }}>
              {errorMsg}
            </div>
          )}

          <div style={{ fontSize: '11px', color: 'var(--body-text-muted)', lineHeight: 1.4 }}>
            💡 Hỗ trợ: YouTube video, YouTube Shorts, Google Drive (quyền Ai có link đều xem được), hoặc direct link MP4.
          </div>

          {customUrl && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
              <button
                type="button"
                onClick={handleRemove}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#DC2626',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  padding: '2px 4px'
                }}
              >
                {defaultUrl ? 'Gỡ link đã gắn (về video mặc định)' : 'Gỡ video khỏi bài tập này'}
              </button>
            </div>
          )}
        </form>
      )}

      {/* Video Player Display */}
      {videoUrl && isOpen && !isEditing && (
        <div style={{
          position: 'relative',
          width: '100%',
          paddingBottom: '56.25%', // 16:9 Aspect Ratio
          height: 0,
          borderRadius: '10px',
          overflow: 'hidden',
          background: '#000',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)'
        }}>
          {isYt && ytEmbedUrl && (
            <iframe
              src={ytEmbedUrl}
              title={`Video hướng dẫn ${exerciseName}`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none'
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}

          {isGdrive && driveId && (
            <iframe
              src={`https://drive.google.com/file/d/${driveId}/preview`}
              title={`Video Drive ${exerciseName}`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none'
              }}
              allow="autoplay"
              allowFullScreen
            />
          )}

          {isDirect && (
            <video
              src={videoUrl}
              controls
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: '#000'
              }}
            />
          )}
        </div>
      )}

      {/* No Video attached prompt */}
      {!videoUrl && !isEditing && (
        <div style={{
          padding: '12px',
          borderRadius: '10px',
          background: 'var(--body-card-bg)',
          border: '1px dashed var(--body-card-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12.5px',
          color: 'var(--body-text-muted)'
        }}>
          <span>Chưa có video thị phạm. Bạn có thể gắn link YouTube hoặc Google Drive yêu thích để xem mẫu khi tập.</span>
          <button
            type="button"
            onClick={handleStartEdit}
            className="body-btn body-btn-ghost"
            style={{ fontSize: '12px', padding: '4px 10px', flexShrink: 0 }}
          >
            Gắn link ngay
          </button>
        </div>
      )}

      <ConfirmModal
        open={confirmRemoveOpen}
        title="Gỡ link video?"
        message={defaultUrl
          ? `Gỡ link bạn đã gắn cho "${exerciseName}" và quay về video mặc định?`
          : `Gỡ video khỏi bài tập "${exerciseName}"?`}
        confirmLabel="Gỡ"
        danger
        onConfirm={handleConfirmRemove}
        onCancel={() => setConfirmRemoveOpen(false)}
      />
    </div>
  );
}
