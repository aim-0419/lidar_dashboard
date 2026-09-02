import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// 디자인 토큰은 tailwind 프리플라이트 뒤에 올려 기본 스타일을 덮어쓴다.
import './styles/theme.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
