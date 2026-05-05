import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';

/*
  ForensicLayout — Refined Government Portal layout with collapsible sidebar.
  - Dual-tier header (Utility + Branding/Nav)
  - Collapsible sidebar
  - Integrated VeriDoc branding
*/

const SIDEBAR_NAV = [
  { to: '/',         icon: 'dashboard',    label: 'Dashboard',         end: true },
  { to: '/tenders',  icon: 'gavel',        label: 'Tender Analysis' },
  { to: '/evaluate', icon: 'description',  label: 'Bidder Evaluation' },
  { to: '/verdicts', icon: 'rule_folder',  label: 'Compliance Matrix' },
  { to: '/audit',    icon: 'receipt_long', label: 'Audit Trail' },
];

export default function ForensicLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className={`gp-root ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* ── TIER 1: Utility Bar ── */}
      <div className="gp-utility-bar">
        <div className="gp-utility-inner">
          <div className="gp-utility-left">
            <button className="gp-sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
              <span className="material-symbols-outlined">
                {collapsed ? 'menu' : 'menu_open'}
              </span>
            </button>
            <span className="gp-utility-label hide-mobile">Accessibility</span>
            <span className="gp-utility-sep hide-mobile">|</span>
            <span className="gp-utility-label hide-mobile">Screen Reader</span>
          </div>
          <div className="gp-utility-right">
            <button className="gp-font-btn">A<sup>-</sup></button>
            <button className="gp-font-btn gp-font-active">A</button>
            <button className="gp-font-btn">A<sup>+</sup></button>
            <span className="gp-utility-sep">|</span>
            <button className="gp-login-btn">Login</button>
            <button className="gp-register-btn">Register</button>
          </div>
        </div>
      </div>

      {/* ── TIER 2: Main Header ── */}
      <header className="gp-header">
        <div className="gp-header-inner">
          <div className="gp-brand-group" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <div className="gp-emblem">
              <span className="material-symbols-outlined">shield</span>
            </div>
            <div className="gp-brand-text">
              <h1 className="gp-title">VeriDoc <span className="gp-title-suffix">Forensic</span></h1>
              <p className="gp-subtitle">AI-Powered Tender Evaluation | CRPF Division</p>
            </div>
          </div>
          
          <nav className="gp-top-nav">
            <NavLink to="/tenders" className="gp-top-link">Tenders</NavLink>
            <NavLink to="/evaluate" className="gp-top-link">Bidders</NavLink>
            <NavLink to="/verdicts" className="gp-top-link">Evaluations</NavLink>
            <div className="gp-nav-search">
              <span className="material-symbols-outlined">search</span>
            </div>
          </nav>
        </div>
      </header>

      <div className="gp-layout-body">
        {/* ── Collapsible Sidebar ── */}
        <aside className={`gp-sidebar ${collapsed ? 'collapsed' : ''}`}>
          <div className="gp-sidebar-content">
            <div className="gp-sidebar-section">
              <p className="gp-section-label">{collapsed ? '' : 'Main Navigation'}</p>
              <nav className="gp-side-nav">
                {SIDEBAR_NAV.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `gp-side-link ${isActive ? 'active' : ''}`}
                    title={item.label}
                  >
                    <span className="material-symbols-outlined">{item.icon}</span>
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                ))}
              </nav>
            </div>

            <div className="gp-sidebar-footer">
              <button className="gp-side-link" title="Settings">
                <span className="material-symbols-outlined">settings</span>
                {!collapsed && <span>Settings</span>}
              </button>
              <button className="gp-side-link" title="Support">
                <span className="material-symbols-outlined">help_outline</span>
                {!collapsed && <span>Support</span>}
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main Canvas ── */}
        <main className="gp-main-canvas">
          <div className="gp-content-wrapper">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
