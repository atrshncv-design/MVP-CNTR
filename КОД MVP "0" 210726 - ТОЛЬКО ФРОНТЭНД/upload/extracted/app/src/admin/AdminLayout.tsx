import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  GraduationCap,
  Factory,
  LogOut,
  Menu,
  X,
  Search,
  ChevronRight,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { isAuthenticated, logoutAdmin } from '@/data/adminData';

const SIDEBAR_ITEMS = [
  { path: '/admin', label: 'Дашборд', icon: LayoutDashboard },
  { path: '/admin/performers', label: 'Исполнители', icon: GraduationCap },
  { path: '/admin/customers', label: 'Заказчики', icon: Factory },
  { path: '/admin/mindmap', label: 'Майнд-карта', icon: Target },
];

function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  const labels: Record<string, string> = {
    admin: 'Админ-панель',
    performers: 'Исполнители',
    customers: 'Заказчики',
    mindmap: 'Майнд-карта',
  };

  return (
    <nav className="flex items-center gap-1.5 text-sm text-[#94A3B8]">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={14} />}
          {i < segments.length - 1 ? (
            <Link
              to={`/${segments.slice(0, i + 1).join('/')}`}
              className="transition-colors hover:text-white"
            >
              {labels[seg] || seg}
            </Link>
          ) : (
            <span className="text-white">{labels[seg] || seg}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    logoutAdmin();
    navigate('/');
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex min-h-[100dvh] bg-[#0F172A]">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSidebar}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={
          'fixed left-0 top-0 z-50 h-full w-[260px] flex-shrink-0 transform bg-[#0F172A] border-r border-white/5 transition-transform duration-300 lg:static lg:translate-x-0 ' +
          (sidebarOpen ? 'translate-x-0' : '-translate-x-full')
        }
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 border-b border-white/5 px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#2E5BFF] to-[#4A82FF]">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <Link to="/" className="font-mono text-base font-bold text-white tracking-tight">
              УГТ Платформа
            </Link>
            <button
              onClick={closeSidebar}
              className="ml-auto text-[#94A3B8] hover:text-white lg:hidden"
            >
              <X size={20} />
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {SIDEBAR_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/admin'}
                onClick={closeSidebar}
                className={({ isActive }) =>
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ' +
                  (isActive
                    ? 'bg-[#2E5BFF]/10 text-[#4A82FF] border-l-2 border-[#2E5BFF]'
                    : 'text-[#94A3B8] hover:bg-white/5 hover:text-white border-l-2 border-transparent')
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Logout */}
          <div className="border-t border-white/5 p-3">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#94A3B8] transition-colors hover:bg-white/5 hover:text-[#EF4444]"
            >
              <LogOut size={18} />
              Выйти
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="flex h-16 items-center gap-4 border-b border-white/5 bg-[#0F172A]/80 backdrop-blur-xl px-4 sm:px-6">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-white/5 hover:text-white lg:hidden"
          >
            <Menu size={20} />
          </button>

          <div className="hidden sm:block">
            <Breadcrumbs />
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Search */}
            <div className="relative hidden sm:block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" />
              <input
                type="text"
                placeholder="Поиск..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-56 rounded-lg border border-white/10 bg-[#1E293B] pl-9 pr-4 text-sm text-white placeholder-[#475569] outline-none focus:border-[#2E5BFF] focus:ring-1 focus:ring-[#2E5BFF]/30"
              />
            </div>

            {/* Admin badge */}
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#1E293B] px-3 py-1.5">
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#2E5BFF] to-[#4A82FF] flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">А</span>
              </div>
              <span className="hidden text-sm font-medium text-white sm:inline">Администратор</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={useLocation().pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
