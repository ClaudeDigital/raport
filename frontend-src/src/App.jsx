import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ReportForm from './pages/ReportForm'
import ReportView from './pages/ReportView'

function Guard({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Duke ngarkuar...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Duke ngarkuar...</div>
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<Guard><Dashboard /></Guard>} />
      <Route path="/raport/ri" element={<Guard><ReportForm /></Guard>} />
      <Route path="/raport/:id/edito" element={<Guard><ReportForm /></Guard>} />
      <Route path="/raport/:id" element={<Guard><ReportView /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
