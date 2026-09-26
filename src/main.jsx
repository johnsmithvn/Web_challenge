import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { reloadForStaleChunk, isStaleChunkError } from './utils/chunkReload'

// Vite bắn event này khi preload một chunk lazy thất bại.
// Chỉ tải lại trang khi thực sự là lỗi stale chunk (do deploy bản mới),
// tránh tải lại bừa bãi khi tab bị ngủ/treo mạng ở background.
window.addEventListener('vite:preloadError', (event) => {
  if (isStaleChunkError(event?.payload)) {
    reloadForStaleChunk();
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
