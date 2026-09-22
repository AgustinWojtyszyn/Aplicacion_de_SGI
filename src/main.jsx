import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import AppErrorBoundary from './components/AppErrorBoundary'
import './styles/index.css'
import './styles/navigation.css'
import './styles/documents.css'
import './styles/document-detail.css'
import './styles/dashboard.css'
import './styles/dashboard-meeting.css'
import './styles/dashboard-workspace.css'
import './styles/users.css'
import './styles/auth-flow.css'
import './styles/sgi.css'
import './styles/brand.css'
import './styles/tenants.css'
import './styles/work-entries.css'
import './styles/work-dashboard.css'
import './styles/document-followup.css'
import './styles/profile.css'
import './styles/history.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
)
