import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LogIn, LayoutDashboard } from 'lucide-react';
import { NAV_LINKS } from '@/data/ugtData';
import { isAuthenticated } from '@/data/adminData';

function isAdminLoggedIn(): boolean {
  try {
    return isAuthenticated();
  } catch {
    return false;
  }
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setLoggedIn(isAdminLoggedIn());
  }, [location.pathname]);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const isLoginPage = location.pathname === '/login';
  const isAdminPage = location.pathname.startsWith('/admin');

  return (
    <nav
      className={
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300 ' +
        (scrolled
          ? 'glass shadow-md border-b border-white/15'
          : 'bg-transparent border-b border-transparent')
      }
      style={{ height: 72 }}
    >
      <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <span
            className="font-mono text-lg font-bold tracking-tight"
            style={{ color: scrolled ? '#0F172A' : '#FFFFFF' }}
          >
            ТЕХНОЗРЕЛОСТЬ
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-1 md:flex">
          {/* Main nav links */}
          {NAV_LINKS.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={
                'relative rounded-md px-3 py-2 text-[15px] font-medium transition-colors duration-200 ' +
                (isActive(link.path)
                  ? scrolled
                    ? 'text-[#2E5BFF]'
                    : 'text-[#4A82FF]'
                  : scrolled
                    ? 'text-[#475569] hover:text-[#2E5BFF]'
                    : 'text-white/70 hover:text-white')
              }
            >
              {link.label}
              {isActive(link.path) && (
                <span
                  className={
                    'absolute bottom-0 left-3 right-3 h-[2px] rounded-full ' +
                    (scrolled ? 'bg-[#2E5BFF]' : 'bg-[#4A82FF]')
                  }
                />
              )}
            </Link>
          ))}

          {/* Divider */}
          <div
            className="mx-2 h-5 w-px"
            style={{ backgroundColor: scrolled ? '#DEE2E8' : 'rgba(255,255,255,0.2)' }}
          />

          {/* Login / Admin link */}
          {loggedIn && !isLoginPage ? (
            <Link
              to="/admin"
              className={
                'flex items-center gap-1.5 rounded-md px-3 py-2 text-[15px] font-medium transition-colors duration-200 ' +
                (isAdminPage
                  ? scrolled
                    ? 'text-[#2E5BFF]'
                    : 'text-[#4A82FF]'
                  : scrolled
                    ? 'text-[#475569] hover:text-[#2E5BFF]'
                    : 'text-white/70 hover:text-white')
              }
            >
              <LayoutDashboard size={16} />
              Админ-панель
            </Link>
          ) : (
            !isLoginPage && (
              <Link
                to="/login"
                className={
                  'flex items-center gap-1.5 rounded-md px-3 py-2 text-[15px] font-medium transition-colors duration-200 ' +
                  (scrolled
                    ? 'text-[#475569] hover:text-[#2E5BFF]'
                    : 'text-white/70 hover:text-white')
                }
              >
                <LogIn size={16} />
                Вход
              </Link>
            )
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          className="flex h-10 w-10 items-center justify-center rounded-md md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <X size={24} className={scrolled ? 'text-[#0F172A]' : 'text-white'} />
          ) : (
            <Menu size={24} className={scrolled ? 'text-[#0F172A]' : 'text-white'} />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="glass absolute left-0 right-0 top-[72px] border-b border-white/15 shadow-lg md:hidden">
          <div className="flex flex-col p-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={
                  'rounded-md px-4 py-3 text-base font-medium transition-colors ' +
                  (isActive(link.path)
                    ? 'bg-[#2E5BFF]/10 text-[#2E5BFF]'
                    : 'text-[#475569] hover:bg-[#F5F7FA] hover:text-[#0F172A]')
                }
              >
                {link.label}
              </Link>
            ))}
            {/* Mobile: Login / Admin */}
            {loggedIn ? (
              <Link
                to="/admin"
                className={
                  'flex items-center gap-2 rounded-md px-4 py-3 text-base font-medium transition-colors ' +
                  (isAdminPage
                    ? 'bg-[#2E5BFF]/10 text-[#2E5BFF]'
                    : 'text-[#475569] hover:bg-[#F5F7FA] hover:text-[#0F172A]')
                }
              >
                <LayoutDashboard size={18} />
                Админ-панель
              </Link>
            ) : (
              <Link
                to="/login"
                className={
                  'flex items-center gap-2 rounded-md px-4 py-3 text-base font-medium text-[#475569] transition-colors hover:bg-[#F5F7FA] hover:text-[#0F172A]'
                }
              >
                <LogIn size={18} />
                Вход
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
