import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      theme="system"
      position="top-right"
      offset={80}
      richColors
      closeButton
      toastOptions={{ className: 'font-sans' }}
    />
  </StrictMode>,
)
