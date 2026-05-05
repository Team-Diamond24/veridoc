import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';

const SIDEBAR_NAV = [
  { to: '/',         icon: 'dashboard',    label: 'Dashboard',         end: true },
  { to: '/tenders',  icon: 'gavel',        label: 'Tender Analysis' },
  { to: '/evaluate', icon: 'description',  label: 'Bidder Evaluation' },
  { to: '/verdicts', icon: 'rule_folder',  label: 'Compliance Matrix' },
  { to: '/audit',    icon: 'receipt_long', label: 'Audit Trail' },
];

const HEADER_NAV = [
  { to: '/tenders',  label: 'Tenders' },
  { to: '/evaluate', label: 'Bidders' },
  { to: '/verdicts', label: 'Evaluations' },
  { to: '/audit',    label: 'Archives' },
];

export default function ForensicLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="fl-root">
      {/* ── Top Header ── */}
      <header className="fl-header">
        <div className="fl-header-left">
          <span className="fl-brand">ProcureAudit Forensic</span>
          <nav className="fl-header-nav">
            {HEADER_NAV.map(item => (
              <a
                key={item.to}
                className={`fl-header-link${pathname.startsWith(item.to) ? ' fl-active' : ''}`}
                onClick={() => navigate(item.to)}
                style={{ cursor: 'pointer' }}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="fl-header-right">
          <span className="material-symbols-outlined fl-icon-btn">notifications</span>
          <span className="material-symbols-outlined fl-icon-btn">history</span>
          <span className="material-symbols-outlined fl-icon-btn">account_circle</span>
        </div>
      </header>

      <div className="fl-body">
        {/* ── Sidebar ── */}
        <aside className="fl-sidebar">
          {/* Branding */}
          <div className="fl-sidebar-brand">
            <div className="fl-sidebar-logo">
              <span className="material-symbols-outlined">account_balance</span>
            </div>
            <div>
              <div className="fl-sidebar-org">Federal Procurement</div>
              <div className="fl-sidebar-unit">Forensic Unit</div>
            </div>
          </div>

          {/* New Evaluation button */}
          <div className="fl-sidebar-btn-wrap">
            <button className="fl-new-eval-btn" onClick={() => navigate('/tenders/upload')}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              New Evaluation
            </button>
          </div>

          {/* Main nav */}
          <nav className="fl-sidebar-nav">
            {SIDEBAR_NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `fl-nav-link${isActive ? ' fl-nav-active' : ''}`
                }
              >
                <span className="material-symbols-outlined fl-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Bottom links */}
          <div className="fl-sidebar-bottom">
            <span className="fl-nav-link" style={{ cursor: 'default' }}>
              <span className="material-symbols-outlined fl-nav-icon">settings</span>
              <span>Settings</span>
            </span>
            <span className="fl-nav-link" style={{ cursor: 'default' }}>
              <span className="material-symbols-outlined fl-nav-icon">help_outline</span>
              <span>Support</span>
            </span>
          </div>
        </aside>

        {/* ── Page content ── */}
        <main className="fl-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
