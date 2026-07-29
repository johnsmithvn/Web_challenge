/**
 * Self-check cho mediaUtils — chạy: `node src/utils/mediaUtils.test.js`
 *
 * mediaUtils là pure function, không import React/Vite nên chạy trực tiếp bằng node được.
 * Bảng case dưới đây khoá đúng hành vi TRƯỚC khi gộp isAudioUrl/isVideoUrl (v4.26.1),
 * gồm cả các case lệch nhau giữa 2 hàm cũ: '#podcast' chỉ tính cho audio,
 * '.webm' tính cho cả hai, và URL không parse được thì chỉ dựa vào đuôi file.
 */
import assert from 'node:assert/strict';
import { isAudioUrl, isVideoUrl, getMediaType, isYoutubeUrl, isDriveUrl } from './mediaUtils.js';

const AUDIO = [
  'https://cdn.example.com/track.mp3',
  'https://cdn.example.com/track.M4A',            // hoa/thường
  'https://cdn.example.com/a.flac?token=abc',     // có query sau đuôi
  'https://x.com/file#audio',                     // hash tag
  'https://x.com/file#podcast',                   // alias lịch sử, CHỈ audio
  'https://x.com/f?type=audio',
  'https://x.com/f?mime=audio%2Fmpeg',            // mime encode
  '/relative/song.wav',                           // URL tương đối → fallback đuôi file
];
const NOT_AUDIO = [
  'https://x.com/clip.mp4',
  'https://x.com/page',
  'https://x.com/f?type=video',
  '',
  null,
  undefined,
];
const VIDEO = [
  'https://x.com/clip.mp4',
  'https://x.com/clip.MOV',
  'https://x.com/c.mkv?t=1',
  'https://x.com/file#video',
  'https://x.com/f?type=video',
  'https://x.com/f?mime=video%2Fmp4',
  '/relative/clip.ogv',
];
const NOT_VIDEO = [
  'https://x.com/track.mp3',
  'https://x.com/file#podcast',   // podcast KHÔNG phải video
  'https://x.com/file#audio',
  'https://x.com/page',
  '',
  null,
];

for (const u of AUDIO)     assert.equal(isAudioUrl(u), true,  `phải là audio: ${u}`);
for (const u of NOT_AUDIO) assert.equal(isAudioUrl(u), false, `không phải audio: ${u}`);
for (const u of VIDEO)     assert.equal(isVideoUrl(u), true,  `phải là video: ${u}`);
for (const u of NOT_VIDEO) assert.equal(isVideoUrl(u), false, `không phải video: ${u}`);

// .webm + .ogg mơ hồ theo thiết kế: khớp cả 2 danh sách đuôi file
assert.equal(isAudioUrl('https://x.com/a.webm'), true);
assert.equal(isVideoUrl('https://x.com/a.webm'), true);

// getMediaType — thứ tự ưu tiên youtube > drive > audio > video > link
assert.equal(getMediaType('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'youtube');
assert.equal(getMediaType('https://drive.google.com/file/d/abc123/view'), 'drive');
assert.equal(getMediaType('https://x.com/track.mp3'), 'audio');
assert.equal(getMediaType('https://x.com/clip.mp4'), 'video');
assert.equal(getMediaType('https://x.com/article'), 'link');
assert.equal(getMediaType(''), 'link');

// youtube/drive không được lẫn sang nhau
assert.equal(isYoutubeUrl('https://youtu.be/dQw4w9WgXcQ'), true);
assert.equal(isDriveUrl('https://youtu.be/dQw4w9WgXcQ'), false);
assert.equal(isDriveUrl('https://drive.google.com/uc?id=xyz'), true);

console.log('mediaUtils check: OK');
