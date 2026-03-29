import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { logout, getTenants } from '../../services/api';
import { useTenant } from '../TenantContext';
import HasPermission from '../HasPermission';
import Sidebar from './Sidebar';
import { useAuth } from '../AuthContext';

function AppLayout({ children }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout: authLogout } = useAuth();
  const username = user?.username;
  const { selectedTenantId, setSelectedTenantId, isSuperAdmin } = useTenant();
  const [tenants, setTenants] = useState([]);
  const [tenantsLoaded, setTenantsLoaded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

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

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const handleLogout = async () => {
    await authLogout();
    navigate('/login');
  };

  const handleTenantChange = (e) => {
    const value = e.target.value;
    setSelectedTenantId(value || null);
  };

  // Find current tenant name for display
  const currentTenant = tenants.find(t => String(t.id) === String(selectedTenantId));

  return (
    <div className="min-vh-100 d-flex flex-column position-relative overflow-hidden" 
         style={{ backgroundColor: 'hsl(var(--background))' }}>
      
      {/* iOS Background Vibrancy Blobs */}
      <div className="position-absolute" style={{ 
          top: '-10%', left: '-10%', width: '40%', height: '40%', 
          background: 'radial-gradient(circle, hsla(250, 84%, 54%, 0.08) 0%, transparent 70%)',
          filter: 'blur(80px)', zIndex: 0, pointerEvents: 'none',
          animation: 'blobFloat 20s ease-in-out infinite alternate'
      }}></div>
      <div className="position-absolute" style={{ 
          bottom: '-10%', right: '-10%', width: '50%', height: '50%', 
          background: 'radial-gradient(circle, hsla(260, 80%, 65%, 0.08) 0%, transparent 70%)',
          filter: 'blur(100px)', zIndex: 0, pointerEvents: 'none',
          animation: 'blobFloat 25s ease-in-out infinite alternate-reverse'
      }}></div>

      <nav className="navbar navbar-expand-lg sticky-top py-4 transition-all" style={{ zIndex: 1020 }}>
        <div className="container-fluid px-lg-5">
          <div className="glass-pill px-4 py-2 d-flex align-items-center w-100 shadow-premium">
            <div className="d-flex align-items-center me-auto">
              <button
                className="btn btn-light border-0 me-3 d-flex align-items-center justify-content-center text-secondary shadow-sm hover-lift p-0"
                onClick={toggleSidebar}
                style={{ width: '42px', height: '42px', borderRadius: '14px', background: 'rgba(255,255,255,0.7)' }}
                title="Menüyü Aç/Kapat"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
              <Link className="navbar-brand fw-bold fs-4 d-flex align-items-center m-0" to="/">
                <span className="me-2 fs-3">📦</span>
                <span className="text-gradient">
                  {t('app_name')}
                </span>
              </Link>
            </div>
            
            <div className="collapse navbar-collapse flex-grow-0" id="navbarNav">
              <ul className="navbar-nav gap-2 align-items-center">
                <li className="nav-item">
                  <Link
                    className={`nav-link px-4 py-2 rounded-pill transition-all fw-bold ${location.pathname === '/'
                      ? 'bg-primary text-white shadow-md scale-105'
                      : 'text-secondary hover-bg-light'
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
                        ? 'bg-primary text-white shadow-md scale-105'
                        : 'text-secondary hover-bg-light'
                        }`}
                      style={{ fontSize: '0.9rem' }}
                      to="/users"
                    >
                      Kullanıcılar
                    </Link>
                  </li>
                </HasPermission>
                <HasPermission permission="Role.Manage">
                  <li className="nav-item">
                    <Link
                      className={`nav-link px-4 py-2 rounded-pill transition-all fw-bold ${location.pathname === '/roles'
                        ? 'bg-primary text-white shadow-md scale-105'
                        : 'text-secondary hover-bg-light'
                        }`}
                      style={{ fontSize: '0.9rem' }}
                      to="/roles"
                    >
                      Roller
                    </Link>
                  </li>
                </HasPermission>
                <HasPermission permission="AuditLog.View">
                  <li className="nav-item">
                    <Link
                      className={`nav-link px-4 py-2 rounded-pill transition-all fw-bold ${location.pathname === '/audit-logs'
                        ? 'bg-primary text-white shadow-md scale-105'
                        : 'text-secondary hover-bg-light'
                        }`}
                      style={{ fontSize: '0.9rem' }}
                      to="/audit-logs"
                    >
                      {t('audit_logs_nav')}
                    </Link>
                  </li>
                </HasPermission>

                <div className="vr mx-2 text-muted opacity-25 d-none d-lg-block" style={{ height: '20px' }}></div>

                {isSuperAdmin && tenants.length > 0 && (
                  <li className="nav-item ms-lg-2">
                    <select
                      className="form-select form-select-sm border-0 bg-white bg-opacity-50 rounded-pill px-3 shadow-sm hover-lift"
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

                <li className="nav-item ms-lg-2">
                  <div className="d-flex align-items-center gap-2">
                    <div className="bg-white bg-opacity-50 px-3 py-1 rounded-pill shadow-sm d-flex align-items-center border border-white border-opacity-50" style={{ height: '36px', backdropFilter: 'blur(10px)' }}>
                      <span className="text-dark small fw-bold">{username}</span>
                    </div>
                    <button onClick={handleLogout} className="btn-blur small rounded-pill px-3 shadow-sm hover-lift" style={{ height: '36px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      Çıkış
                    </button>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </nav>

      <div className="d-flex flex-grow-1 overflow-hidden position-relative" style={{ zIndex: 1 }}>
        <Sidebar className="flex-shrink-0" isOpen={isSidebarOpen} />
        <div className="d-flex flex-column flex-grow-1 w-100 overflow-auto">
          <main className="container-fluid py-4 px-lg-5 flex-grow-1 fade-in stagger-in">
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
