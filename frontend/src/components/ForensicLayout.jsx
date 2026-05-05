import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';

/*
  ForensicLayout — 3-tier Government Portal layout.
  Tier 1: Utility bar (accessibility, login)
  Tier 2: Branding bar (logo + org name)
  Tier 3: Navy navigation ribbon
  + Left sidebar + main content canvas
*/

const SIDEBAR_NAV = [
  { to: '/',         icon: 'dashboard',    label: 'Dashboard',         end: true },
  { to: '/tenders',  icon: 'gavel',        label: 'Tender Analysis' },
  { to: '/evaluate', icon: 'description',  label: 'Bidder Evaluation' },
  { to: '/verdicts', icon: 'rule_folder',  label: 'Compliance Matrix' },
  { to: '/audit',    icon: 'receipt_long', label: 'Audit Trail' },
];

const NAV_LINKS = [
  { to: '/',         label: 'Home',        end: true },
  { to: '/tenders',  label: 'Tenders' },
  { to: '/evaluate', label: 'Bidders' },
  { to: '/verdicts', label: 'Evaluations' },
  { to: '/audit',    label: 'Archives' },
  { to: '/admin',    label: 'Admin' },
];

export default function ForensicLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="gp-root">
      {/* ═══ TIER 1: Utility Bar ═══ */}
      <div className="gp-utility-bar">
        <div className="gp-utility-inner">
          <div className="gp-utility-left">
            <span className="gp-utility-label">Screen Reader Access</span>
            <span className="gp-utility-sep">|</span>
            <span className="gp-utility-label">Skip to main content</span>
          </div>
          <div className="gp-utility-right">
            <button className="gp-font-btn" title="Decrease font size">A<sup>-</sup></button>
            <button className="gp-font-btn gp-font-active" title="Default font size">A</button>
            <button className="gp-font-btn" title="Increase font size">A<sup>+</sup></button>
            <span className="gp-utility-sep">|</span>
            <span className="material-symbols-outlined gp-utility-icon" title="Toggle Theme">dark_mode</span>
            <span className="gp-utility-sep">|</span>
            <button className="gp-login-btn" onClick={() => navigate('/admin')}>Login</button>
            <button className="gp-register-btn">Register</button>
          </div>
        </div>
      </div>

      {/* ═══ TIER 2: Branding Bar ═══ */}
      <div className="gp-brand-bar">
        <div className="gp-brand-inner">
          <div className="gp-brand-left">
            <div className="gp-emblem">
              <span className="material-symbols-outlined">account_balance</span>
            </div>
            <div className="gp-brand-text">
              <div className="gp-brand-title">VeriDoc</div>
              <div className="gp-brand-subtitle">AI-Powered Tender Evaluation System | CRPF Procurement Division</div>
            </div>
          </div>
          <div className="gp-brand-right">
            <div className="gp-brand-date">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
            <div className="gp-system-status">
              <span className="gp-status-dot" />
              System Operational
            </div>
          </div>
        </div>
      </div>

      {/* ═══ TIER 3: Navigation Ribbon ═══ */}
      <nav className="gp-nav-ribbon">
        <div className="gp-nav-inner">
          {NAV_LINKS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `gp-nav-link${isActive ? ' gp-nav-active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <div className="gp-nav-search">
            <span className="material-symbols-outlined">search</span>
          </div>
        </div>
      </nav>

      {/* ═══ TICKER BAR ═══ */}
      <div className="gp-ticker">
        <div className="gp-ticker-inner">
          <span className="gp-ticker-badge">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>campaign</span>
            Updates
          </span>
          <div className="gp-ticker-text">
            <marquee scrollamount="3">
              VeriDoc v2.0 Forensic Module is now live — All verdicts are subject to officer review under GFR 2017 guidelines. Contact System Administrator for technical support.
            </marquee>
          </div>
        </div>
      </div>

      <div className="gp-body">
        {/* ── SideNavBar ── */}
        <aside className="gp-sidebar">
          {/* Org branding block */}
          <div className="gp-sidebar-brand">
            <div className="gp-sidebar-logo">
              <span className="material-symbols-outlined">shield</span>
            </div>
            <div>
              <div className="gp-sidebar-org">Procurement</div>
              <div className="gp-sidebar-unit">Forensic Division</div>
            </div>
          </div>

          {/* New Evaluation button */}
          <div className="gp-sidebar-btn-wrap">
            <button className="gp-new-eval-btn" onClick={() => navigate('/tenders/upload')}>
              <span className="material-symbols-outlined">add</span>
              <span>New Evaluation</span>
            </button>
          </div>

          {/* Main nav links */}
          <nav className="gp-sidebar-nav">
            {SIDEBAR_NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `gp-sidebar-link${isActive ? ' gp-sidebar-active' : ''}`
                }
              >
                <span className="material-symbols-outlined gp-sidebar-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Bottom links */}
          <div className="gp-sidebar-bottom">
            <span className="gp-sidebar-link" style={{ cursor: 'pointer' }}>
              <span className="material-symbols-outlined gp-sidebar-icon">settings</span>
              <span>Settings</span>
            </span>
            <span className="gp-sidebar-link" style={{ cursor: 'pointer' }}>
              <span className="material-symbols-outlined gp-sidebar-icon">help_outline</span>
              <span>Support</span>
            </span>
          </div>
        </aside>

        {/* ── Main Content Canvas ── */}
        <main className="gp-main">
          <div className="gp-main-inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
