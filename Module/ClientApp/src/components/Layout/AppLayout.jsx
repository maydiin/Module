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
    <div className="min-vh-100 d-flex flex-column bg-light">
      <nav className="navbar navbar-expand-lg navbar-light glass sticky-top py-3">
        <div className="container">
          <div className="d-flex align-items-center">
            <button
              className="btn btn-light border-0 me-3 d-flex align-items-center justify-content-center text-secondary shadow-sm transition-all hover-scale"
              onClick={toggleSidebar}
              style={{ width: '38px', height: '38px', borderRadius: '50%' }}
              title="Menüyü Aç/Kapat"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <Link className="navbar-brand fw-bold fs-4 d-flex align-items-center m-0" to="/">
              <span className="me-2 text-primary">📦</span>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                {t('app_name')}
              </span>
            </Link>
          </div>
          <button
            className="navbar-toggler border-0"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto gap-2 align-items-center">
              <li className="nav-item">
                <Link
                  className={`nav-link px-3 rounded-pill transition-all ${location.pathname === '/'
                    ? 'bg-primary text-white shadow-sm'
                    : 'hover-bg-accent'
                    }`}
                  to="/"
                >
                  {t('dashboard')}
                </Link>
              </li>
              <HasPermission permission="User.Manage">
                <li className="nav-item">
                  <Link
                    className={`nav-link px-3 rounded-pill transition-all ${location.pathname === '/users'
                      ? 'bg-primary text-white shadow-sm'
                      : 'hover-bg-accent'
                      }`}
                    to="/users"
                  >
                    Kullanıcılar
                  </Link>
                </li>
              </HasPermission>
              <HasPermission permission="Role.Manage">
                <li className="nav-item">
                  <Link
                    className={`nav-link px-3 rounded-pill transition-all ${location.pathname === '/roles'
                      ? 'bg-primary text-white shadow-sm'
                      : 'hover-bg-accent'
                      }`}
                    to="/roles"
                  >
                    Roller
                  </Link>
                </li>
              </HasPermission>
              <HasPermission permission="AuditLog.View">
                <li className="nav-item">
                  <Link
                    className={`nav-link px-3 rounded-pill transition-all ${location.pathname === '/audit-logs'
                      ? 'bg-primary text-white shadow-sm'
                      : 'hover-bg-accent'
                      }`}
                    to="/audit-logs"
                  >
                    {t('audit_logs_nav')}
                  </Link>
                </li>
              </HasPermission>

              {/* Tenant Selector for Super Admin */}
              {isSuperAdmin && tenants.length > 0 && (
                <li className="nav-item ms-lg-2">
                  <div className="d-flex align-items-center gap-2">
                    <span className="text-muted small">🏢</span>
                    <select
                      className="form-select form-select-sm border-primary border-opacity-50 rounded-pill px-3"
                      style={{ minWidth: '180px', fontSize: '0.85rem' }}
                      value={selectedTenantId || ''}
                      onChange={handleTenantChange}
                    >
                      <option value="">Kendi Tenant'ım</option>
                      {tenants.filter(t => !t.isHost).map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              )}

              <li className="nav-item ms-lg-3">
                <div className="d-flex align-items-center gap-3">
                  <span className="text-muted small">👤 {username}</span>
                  <button onClick={handleLogout} className="btn btn-sm btn-outline-danger rounded-pill px-3">
                    Çıkış Yap
                  </button>
                </div>
              </li>
              <li className="nav-item ms-lg-3">
                <div className="btn-group" role="group">
                  <button
                    type="button"
                    className={`btn btn-sm rounded-start-pill ${i18n.language.startsWith('en') ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => changeLanguage('en')}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm rounded-end-pill ${i18n.language.startsWith('tr') ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => changeLanguage('tr')}
                  >
                    TR
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </nav>
      <div className="d-flex flex-grow-1 overflow-hidden">
        <Sidebar className="flex-shrink-0" isOpen={isSidebarOpen} />
        <div className="d-flex flex-column flex-grow-1 w-100 overflow-auto">
          <main className="container-fluid py-4 px-lg-5 flex-grow-1 fade-in">
            {children}
          </main>
          <footer className="py-4 border-top bg-white mt-auto">
            <div className="container-fluid text-center">
              <p className="text-muted mb-0 small">
                &copy; {new Date().getFullYear()} {t('footer_text')}
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
