import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

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

const FONT_SIZES = [13, 16, 20]; // small, default, large (px)

export default function ForensicLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [fontLevel, setFontLevel] = useState(1); // 0=small, 1=default, 2=large
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useContext(AuthContext);

  const getNavItems = () => {
    if (user?.role === 'ADMIN') {
      return [...SIDEBAR_NAV, { to: '/admin', icon: 'admin_panel_settings', label: 'Admin Dashboard' }];
    }
    return SIDEBAR_NAV;
  };

  const applyFont = (level) => {
    setFontLevel(level);
    document.documentElement.style.fontSize = FONT_SIZES[level] + 'px';
  };

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
            <button
              className={`gp-font-btn${fontLevel === 0 ? ' gp-font-active' : ''}`}
              onClick={() => applyFont(0)}
              title="Decrease font size"
            >A<sup>-</sup></button>
            <button
              className={`gp-font-btn${fontLevel === 1 ? ' gp-font-active' : ''}`}
              onClick={() => applyFont(1)}
              title="Default font size"
            >A</button>
            <button
              className={`gp-font-btn${fontLevel === 2 ? ' gp-font-active' : ''}`}
              onClick={() => applyFont(2)}
              title="Increase font size"
            >A<sup>+</sup></button>
            <span className="gp-utility-sep">|</span>
            {user ? (
              <>
                <span className="gp-utility-label hide-mobile" style={{ fontWeight: 600 }}>{user.username} ({user.role})</span>
                <button className="gp-login-btn" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
              </>
            ) : (
              <>
                <button className="gp-login-btn" onClick={() => navigate('/login')}>Login</button>
                <button className="gp-register-btn" onClick={() => navigate('/register')}>Register</button>
              </>
            )}
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
                {getNavItems().map(item => (
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
