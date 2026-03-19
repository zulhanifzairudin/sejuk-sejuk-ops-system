import { Navigate, Route, Routes } from 'react-router-dom'
import AdminDashboard from './pages/AdminDashboard'
import Login from './pages/Login'
import ManagerDashboard from './pages/ManagerDashboard'
import TechnicianDashboard from './pages/TechnicianDashboard'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/technician" element={<TechnicianDashboard />} />
      <Route path="/manager" element={<ManagerDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
