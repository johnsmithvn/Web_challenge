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
    <div className="body-vid">
      <div className="body-vid-head">
        <div className="body-vid-title">
          <AppIcon name="video" size={16} />
          <b>Video thị phạm (YouTube / Google Drive)</b>
          {videoUrl && (
            <span className="body-badge body-badge-accent">
              {isYt ? 'YouTube' : isGdrive ? 'Google Drive' : 'Video'}
            </span>
          )}
        </div>

        <div className="body-vid-actions">
          {videoUrl && (
            <>
              <button type="button" onClick={() => setIsOpen(!isOpen)} className="body-btn body-btn-ghost" title={isOpen ? 'Thu gọn video' : 'Mở xem video'}>
                {isOpen ? 'Thu gọn' : 'Xem video'}
              </button>
              <button type="button" onClick={handleStartEdit} className="body-btn body-btn-ghost" title="Thay đổi link video">
                Đổi link
              </button>
              <a href={videoUrl} target="_blank" rel="noreferrer noopener" className="body-btn body-btn-ghost" title="Mở tab mới trên YouTube hoặc Google Drive" aria-label="Mở video ở tab mới">
                <AppIcon name="external" size={13} />
              </a>
            </>
          )}

          {!videoUrl && !isEditing && (
            <button type="button" onClick={handleStartEdit} className="body-btn body-btn-ghost">
              <AppIcon name="plus" size={13} />Gắn link video
            </button>
          )}
        </div>
      </div>

      {isEditing && (
        <form onSubmit={handleSave} className="body-vid-form">
          <label htmlFor={`vid-url-${exerciseKey}`}>Dán link YouTube (watch/shorts/youtu.be) hoặc Google Drive:</label>
          <div className="body-vid-form-row">
            <input
              id={`vid-url-${exerciseKey}`}
              type="url"
              className="body-input"
              placeholder="https://www.youtube.com/watch?v=... hoặc drive.google.com/..."
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              autoFocus
            />
            <button type="submit" className="body-btn body-btn-primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
            <button type="button" onClick={() => setIsEditing(false)} className="body-btn body-btn-ghost">
              Hủy
            </button>
          </div>

          {errorMsg && <p className="body-vid-error">{errorMsg}</p>}

          <p className="body-vid-hint">
            <AppIcon name="lightbulb" size={13} />
            Hỗ trợ: YouTube video, YouTube Shorts, Google Drive (quyền Ai có link đều xem được), hoặc direct link MP4.
          </p>

          {customUrl && (
            <button type="button" onClick={handleRemove} className="body-vid-remove">
              {defaultUrl ? 'Gỡ link đã gắn (về video mặc định)' : 'Gỡ video khỏi bài tập này'}
            </button>
          )}
        </form>
      )}

      {/* Khung video 16:9 — nền đen cố định cho trình phát */}
      {videoUrl && isOpen && !isEditing && (
        <div className="body-vid-frame">
          {isYt && ytEmbedUrl && (
            <iframe
              src={ytEmbedUrl}
              title={`Video hướng dẫn ${exerciseName}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
          {isGdrive && driveId && (
            <iframe
              src={`https://drive.google.com/file/d/${driveId}/preview`}
              title={`Video Drive ${exerciseName}`}
              allow="autoplay"
              allowFullScreen
            />
          )}
          {isDirect && <video src={videoUrl} controls />}
        </div>
      )}

      {!videoUrl && !isEditing && (
        <div className="body-vid-empty">
          <span>Chưa có video thị phạm. Bạn có thể gắn link YouTube hoặc Google Drive yêu thích để xem mẫu khi tập.</span>
          <button type="button" onClick={handleStartEdit} className="body-btn body-btn-ghost">
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
