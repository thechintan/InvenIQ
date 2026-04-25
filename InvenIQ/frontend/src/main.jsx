import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            className: '',
            style: {
              padding: '13px 16px',
              fontSize: '13.5px',
              borderRadius: '12px',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontWeight: '500',
            },
            success: {
              style: {
                background: document.documentElement.classList.contains('dark') ? '#161b27' : '#fff',
                color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#1e293b',
                border: document.documentElement.classList.contains('dark') ? '1px solid #1e2535' : '1px solid #e2e8f0',
                boxShadow: document.documentElement.classList.contains('dark') ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.08)',
              },
              iconTheme: { primary: '#10B981', secondary: '#fff' },
            },
            error: {
              style: {
                background: document.documentElement.classList.contains('dark') ? '#161b27' : '#fff',
                color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#1e293b',
                border: document.documentElement.classList.contains('dark') ? '1px solid #1e2535' : '1px solid #e2e8f0',
                boxShadow: document.documentElement.classList.contains('dark') ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.08)',
              },
              iconTheme: { primary: '#EF4444', secondary: '#fff' },
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
