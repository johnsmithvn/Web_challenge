/**
 * useFileUpload — Upload files to external storage (R2 via Vercel API proxy).
 * Returns { upload, isUploading, error }.
 *
 * Usage:
 *   const { upload, isUploading } = useFileUpload();
 *   const url = await upload(file, 'audio');  // folder = 'audio'
 *   const url = await upload(file, 'images'); // folder = 'images'
 */
import { useState, useCallback } from 'react';

const UPLOAD_ENDPOINT = '/api/upload';
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const upload = useCallback(async (file, folder = 'uploads') => {
    if (!file) throw new Error('No file provided');
    if (file.size > MAX_FILE_SIZE) {
      const msg = `File quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Tối đa 25MB.`;
      setError(msg);
      throw new Error(msg);
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const res = await fetch(UPLOAD_ENDPOINT, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Upload failed (${res.status})`);
      }

      const data = await res.json();
      return data.url;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { upload, isUploading, error };
}
