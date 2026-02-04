import { Link, useLocation } from 'react-router-dom';

function AppLayout({ children }) {
  const location = useLocation();

  return (
    <div className="min-vh-100 d-flex flex-column">
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm">
        <div className="container">
          <Link className="navbar-brand fw-bold" to="/">
            📦 Module Management
          </Link>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
            aria-controls="navbarNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto">
              <li className="nav-item">
                <Link
                  className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
                  to="/"
                >
                  Modules
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </nav>
      <main className="container my-4 flex-grow-1">
        {children}
      </main>
      <footer className="bg-light py-3 mt-auto">
        <div className="container text-center text-muted">
          <small>Module Management System © 2024</small>
        </div>
      </footer>
    </div>
  );
}

export default AppLayout;

