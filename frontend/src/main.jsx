import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import './utils/authDebug.js' // Load authentication debugger
import './utils/authPersistence.js' // Load authentication persistence layer FIRST

// UI-3: Apply saved theme preference on load (only if user previously chose dark)
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
}

// Temporarily disable StrictMode to prevent double-render issues during authentication
ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)