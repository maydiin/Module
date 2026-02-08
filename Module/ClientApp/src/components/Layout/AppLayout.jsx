import { Link, useLocation } from 'react-router-dom';

function AppLayout({ children }) {
  const location = useLocation();

  return (
    <div className="min-vh-100 d-flex flex-column bg-light">
      <nav className="navbar navbar-expand-lg navbar-light glass sticky-top py-3">
        <div className="container">
          <Link className="navbar-brand fw-bold fs-4 d-flex align-items-center" to="/">
            <span className="me-2 text-primary">📦</span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
              Module Central
            </span>
          </Link>
          <button
            className="navbar-toggler border-0"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto gap-2">
              <li className="nav-item">
                <Link
                  className={`nav-link px-3 rounded-pill transition-all ${location.pathname === '/'
                      ? 'bg-primary text-white shadow-sm'
                      : 'hover-bg-accent'
                    }`}
                  to="/"
                >
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </nav>
      <main className="container my-5 flex-grow-1 fade-in">
        {children}
      </main>
      <footer className="py-5 border-top bg-white">
        <div className="container text-center">
          <p className="text-muted mb-0 small">
            &copy; {new Date().getFullYear()} Module Management System. Crafted for Excellence.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default AppLayout;

