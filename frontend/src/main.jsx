import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { useUserStore } from './store/useUserStore'
import './index.css'
import './utils/authDebug.js'

// UI-3: Apply saved theme preference on load (only if user previously chose dark)
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
}

// Rehydrate persisted auth before first render so guards see logged-in state
useUserStore.persist.rehydrate();

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)