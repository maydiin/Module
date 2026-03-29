import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { logout, getTenants } from '../../services/api';
import { useTenant } from '../TenantContext';
import HasPermission from '../HasPermission';
import Sidebar from './Sidebar';
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import Icon from '../Icon';

function AppLayout({ children }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout: authLogout } = useAuth();
  const username = user?.username;
  const { selectedTenantId, setSelectedTenantId, isSuperAdmin } = useTenant();
  const [tenants, setTenants] = useState([]);
  const [tenantsLoaded, setTenantsLoaded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 992);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 992);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const { theme } = useTheme();

  // Track screen size
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 992;
      setIsMobile(mobile);
      if (!mobile) {
        setIsSidebarOpen(true);
        setIsMobileNavOpen(false);
      } else {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile nav when route changes
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  const toggleSidebar = () => {
    if (isMobile) {
      setIsSidebarOpen(prev => !prev);
    } else {
      setIsSidebarOpen(prev => !prev);
    }
  };

  useEffect(() => {
    if (isSuperAdmin && !tenantsLoaded) {
      loadTenants();
    }
  }, [isSuperAdmin]);

  const loadTenants = async () => {
    try {
      const data = await getTenants();
      setTenants(data);
      setTenantsLoaded(true);
    } catch (err) {
      console.error('Failed to load tenants', err);
    }
  };

  const handleLogout = async () => {
    await authLogout();
    navigate('/login');
  };

  const handleTenantChange = (e) => {
    const value = e.target.value;
    setSelectedTenantId(value || null);
  };

  const currentTenant = tenants.find(t => String(t.id) === String(selectedTenantId));

  const navLinks = [
    { to: '/', label: t('dashboard'), permission: null },
  ];

  return (
    <div className="min-vh-100 d-flex flex-column position-relative overflow-hidden"
         style={{ backgroundColor: 'hsl(var(--background))' }}>

      {/* iOS Background Vibrancy Blobs */}
      <div className="position-absolute" style={{
          top: '-10%', left: '-10%', width: '40%', height: '40%',
          background: 'radial-gradient(circle, hsla(var(--primary), 0.08) 0%, transparent 70%)',
          filter: 'blur(80px)', zIndex: 0, pointerEvents: 'none',
          animation: 'blobFloat 20s ease-in-out infinite alternate'
      }}></div>
      <div className="position-absolute" style={{
          bottom: '-10%', right: '-10%', width: '50%', height: '50%',
          background: 'radial-gradient(circle, hsla(var(--secondary), 0.08) 0%, transparent 70%)',
          filter: 'blur(100px)', zIndex: 0, pointerEvents: 'none',
          animation: 'blobFloat 25s ease-in-out infinite alternate-reverse'
      }}></div>

      {/* Navbar */}
      <nav className="navbar navbar-expand-lg sticky-top py-4 transition-all" style={{ zIndex: 1020 }}>
        <div className="container-fluid px-lg-5">
          <div className="glass-pill px-4 py-2 d-flex align-items-center w-100 shadow-premium">
            <div className="d-flex align-items-center me-auto">
              <button
                className="btn btn-light border-0 me-3 d-flex align-items-center justify-content-center text-secondary shadow-sm hover-bg-theme p-0"
                onClick={toggleSidebar}
                style={{ width: '42px', height: '42px', borderRadius: '14px', background: 'hsla(var(--primary), 0.1)', flexShrink: 0 }}
                title="Menüyü Aç/Kapat"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
              <Link className="navbar-brand fw-bold fs-4 d-flex align-items-center m-0" to="/">
                <Icon name="box" size={32} className="me-2 icon-theme" />
                <span className="text-gradient">
                  {t('app_name')}
                </span>
              </Link>
            </div>

            {/* Desktop nav links */}
            <div className="collapse navbar-collapse flex-grow-0 nav-desktop-only" id="navbarNav">
              <ul className="navbar-nav gap-2 align-items-center">
                <li className="nav-item">
                  <Link
                    className={`nav-link px-4 py-2 rounded-pill transition-all fw-bold ${location.pathname === '/'
                      ? 'menu-active scale-105'
                      : 'text-secondary hover-bg-theme'
                      }`}
                    style={{ fontSize: '0.9rem' }}
                    to="/"
                  >
                    {t('dashboard')}
                  </Link>
                </li>
                <HasPermission permission="User.Manage">
                  <li className="nav-item">
                    <Link
                      className={`nav-link px-4 py-2 rounded-pill transition-all fw-bold ${location.pathname === '/users'
                        ? 'menu-active scale-105'
                        : 'text-secondary hover-bg-theme'
                        }`}
                      style={{ fontSize: '0.9rem' }}
                      to="/users"
                    >
                      {t('users', 'Kullanıcılar')}
                    </Link>
                  </li>
                </HasPermission>
                <HasPermission permission="Role.Manage">
                  <li className="nav-item">
                    <Link
                      className={`nav-link px-4 py-2 rounded-pill transition-all fw-bold ${location.pathname === '/roles'
                        ? 'menu-active scale-105'
                        : 'text-secondary hover-bg-theme'
                        }`}
                      style={{ fontSize: '0.9rem' }}
                      to="/roles"
                    >
                      {t('roles', 'Roller')}
                    </Link>
                  </li>
                </HasPermission>
                <HasPermission permission="AuditLog.View">
                  <li className="nav-item">
                    <Link
                      className={`nav-link px-4 py-2 rounded-pill transition-all fw-bold ${location.pathname === '/audit-logs'
                        ? 'menu-active scale-105'
                        : 'text-secondary hover-bg-theme'
                        }`}
                      style={{ fontSize: '0.9rem' }}
                      to="/audit-logs"
                    >
                      {t('audit_logs_nav')}
                    </Link>
                  </li>
                </HasPermission>

                {isSuperAdmin && tenants.length > 0 && (
                  <li className="nav-item ms-lg-2">
                    <select
                      className="form-select form-select-sm border-0 bg-white bg-opacity-40 rounded-pill px-3 shadow-sm hover-lift text-foreground"
                      style={{ minWidth: '160px', fontSize: '0.8rem', height: '36px', backdropFilter: 'blur(10px)' }}
                      value={selectedTenantId || ''}
                      onChange={handleTenantChange}
                    >
                      <option value="">🏢 Kendi Tenant'ım</option>
                      {tenants.filter(t => !t.isHost).map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          🏢 {tenant.name}
                        </option>
                      ))}
                    </select>
                  </li>
                )}

                {/* Settings Link */}
                <li className="nav-item">
                  <Link
                    to="/settings"
                    className={`nav-link p-2 rounded-circle transition-all d-flex align-items-center justify-content-center shadow-sm hover-lift ${location.pathname === '/settings' ? 'menu-active scale-110 shadow-md' : 'btn-blur'}`}
                    style={{ width: '36px', height: '36px' }}
                    title={t('settings', 'Ayarlar')}
                  >
                    <Icon name="settings" size={20} color="currentColor" />
                  </Link>
                </li>

                <li className="nav-item ms-lg-2">
                  <div className="d-flex align-items-center gap-2">
                    <div className="bg-white bg-opacity-40 px-3 py-1 rounded-pill shadow-sm d-flex align-items-center border border-white border-opacity-30" style={{ height: '36px', backdropFilter: 'blur(10px)' }}>
                      <span className="text-foreground small fw-bold">{username}</span>
                    </div>
                    <button onClick={handleLogout} className="btn-blur small rounded-pill px-3 shadow-sm hover-lift" style={{ height: '36px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      Çıkış
                    </button>
                  </div>
                </li>
              </ul>
            </div>

            {/* Mobile right-side actions */}
            <div className="d-flex align-items-center gap-2" style={{ display: isMobile ? 'flex' : 'none' }}>
              {/* Mobile: Settings icon */}
              <Link
                to="/settings"
                className={`d-lg-none nav-link p-2 rounded-circle transition-all d-flex align-items-center justify-content-center shadow-sm hover-lift ${location.pathname === '/settings' ? 'menu-active' : 'btn-blur'}`}
                style={{ width: '36px', height: '36px' }}
              >
                <Icon name="settings" size={18} color="currentColor" />
              </Link>

              {/* Mobile: Hamburger for nav sheet */}
              <button
                className="d-lg-none btn border-0 d-flex align-items-center justify-content-center p-0"
                onClick={() => setIsMobileNavOpen(prev => !prev)}
                style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'hsla(var(--primary), 0.1)', flexShrink: 0 }}
              >
                <Icon name="settings" size={18} color="currentColor" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Body */}
      <div className="d-flex flex-grow-1 overflow-hidden position-relative" style={{ zIndex: 1 }}>

        {/* Sidebar overlay for mobile */}
        {isMobile && (
          <div
            className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`}
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <Sidebar
          isOpen={isSidebarOpen}
          isMobile={isMobile}
          onClose={() => setIsSidebarOpen(false)}
        />

        <div className="d-flex flex-column flex-grow-1 w-100 overflow-auto" style={{ minWidth: 0 }}>
          <main className="container-fluid py-4 px-3 px-lg-5 flex-grow-1 fade-in stagger-in">
            {children}
          </main>
          <footer className="py-4 mt-auto">
            <div className="container-fluid text-center">
              <p className="text-muted mb-0 small opacity-50 fw-medium">
                &copy; {new Date().getFullYear()} {t('footer_text')}
              </p>
            </div>
          </footer>
        </div>
      </div>

      {/* Mobile Bottom Nav Sheet */}
      <div className={`mobile-nav-sheet d-lg-none ${isMobileNavOpen ? 'open' : ''}`}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center gap-2">
            <div className="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }}>
              <Icon name="settings" size={18} className="icon-theme" />
            </div>
            <span className="fw-bold text-foreground">{username}</span>
          </div>
          <button
            className="btn border-0 p-0 d-flex align-items-center justify-content-center btn-blur"
            onClick={() => setIsMobileNavOpen(false)}
            style={{ width: '36px', height: '36px', borderRadius: '12px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="d-flex flex-column gap-1">
          <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
            <Icon name="box" size={20} className="icon-theme" /> {t('dashboard')}
          </Link>
          <HasPermission permission="User.Manage">
            <Link to="/users" className={`nav-link ${location.pathname === '/users' ? 'active' : ''}`}>
              <Icon name="settings" size={20} className="icon-theme" /> {t('users', 'Kullanıcılar')}
            </Link>
          </HasPermission>
          <HasPermission permission="Role.Manage">
            <Link to="/roles" className={`nav-link ${location.pathname === '/roles' ? 'active' : ''}`}>
              <Icon name="fields" size={20} className="icon-theme" /> {t('roles', 'Roller')}
            </Link>
          </HasPermission>
          <HasPermission permission="AuditLog.View">
            <Link to="/audit-logs" className={`nav-link ${location.pathname === '/audit-logs' ? 'active' : ''}`}>
              <Icon name="records" size={20} className="icon-theme" /> {t('audit_logs_nav')}
            </Link>
          </HasPermission>

          {isSuperAdmin && tenants.length > 0 && (
            <div className="mt-3 pt-3 border-top border-theme-accent">
              <select
                className="form-select form-select-sm rounded-3 text-foreground"
                style={{ fontSize: '0.85rem' }}
                value={selectedTenantId || ''}
                onChange={handleTenantChange}
              >
                <option value="">🏢 Kendi Tenant'ım</option>
                {tenants.filter(t => !t.isHost).map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>🏢 {tenant.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-3 pt-3 border-top border-theme-accent">
            <button
              onClick={handleLogout}
              className="btn btn-blur w-100 rounded-3 fw-bold"
              style={{ height: '44px' }}
            >
              Çıkış Yap
            </button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile nav sheet */}
      {isMobileNavOpen && (
        <div
          onClick={() => setIsMobileNavOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1049,
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(2px)'
          }}
        />
      )}

      <style>{`
        @keyframes blobFloat {
          0% { transform: translate(0, 0); }
          100% { transform: translate(100px, 50px); }
        }
      `}</style>
    </div>
  );
}

export default AppLayout;
