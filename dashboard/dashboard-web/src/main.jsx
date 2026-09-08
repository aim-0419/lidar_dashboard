import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// 디자인 토큰(:root 변수)과 공용 keyframes. 현재는 로그인 페이지에서만 참조한다.
import './styles/theme.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
