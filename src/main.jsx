import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { reloadForStaleChunk } from './utils/chunkReload'

// Vite bắn event này khi preload một chunk lazy thất bại — gần như luôn là do vừa
// deploy bản mới trong lúc tab đang mở. Bắt ở đây thì user không kịp thấy màn lỗi.
window.addEventListener('vite:preloadError', () => { reloadForStaleChunk(); })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
