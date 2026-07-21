import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import './App.css'

/* Eager load Home for fast first paint */
import Home from './pages/Home'

/* Lazy load heavy pages — code-splitting */
const LevelsList   = lazy(() => import('./pages/LevelsList'))
const LevelDetail  = lazy(() => import('./pages/LevelDetail'))
const Roadmap      = lazy(() => import('./pages/Roadmap'))
const Assessment   = lazy(() => import('./pages/Assessment'))
const Methodology  = lazy(() => import('./pages/Methodology'))
const LoginPage    = lazy(() => import('./pages/LoginPage'))
const AdminLayout     = lazy(() => import('./admin/AdminLayout'))
const AdminDashboard  = lazy(() => import('./admin/AdminDashboard'))
const PerformersPage  = lazy(() => import('./admin/PerformersPage'))
const CustomersPage   = lazy(() => import('./admin/CustomersPage'))
const PerformerDetail = lazy(() => import('./admin/PerformerDetail'))
const CustomerDetail  = lazy(() => import('./admin/CustomerDetail'))
const MindMapPage     = lazy(() => import('./admin/MindMapPage'))

/* Lightweight spinner while chunk loads */
function PageSpinner() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2E5BFF] border-t-transparent" />
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        {/* Main site routes */}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/levels" element={<LevelsList />} />
          <Route path="/level/:id" element={<LevelDetail />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/assessment" element={<Assessment />} />
          <Route path="/methodology" element={<Methodology />} />
        </Route>

        {/* Login */}
        <Route path="/login" element={<LoginPage />} />

        {/* Admin panel */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="performers" element={<PerformersPage />} />
          <Route path="performers/:id" element={<PerformerDetail />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="mindmap" element={<MindMapPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
