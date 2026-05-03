import { NavLink, useLocation } from 'react-router-dom';

const navItems = [
  { section: 'Main' },
  { to: '/', icon: '🏠', label: 'Dashboard' },
  { section: 'Tender Management' },
  { to: '/tenders', icon: '📋', label: 'All Tenders' },
  { to: '/tenders/upload', icon: '⬆', label: 'Upload Tender' },
  { section: 'Evaluation' },
  { to: '/evaluate', icon: '⚖', label: 'Evaluate Bids' },
  { to: '/verdicts', icon: '🔍', label: 'View Verdicts' },
  { section: 'Administration' },
  { to: '/audit', icon: '📝', label: 'Audit Log' },
  { to: '/corrections', icon: '✏', label: 'Corrections' },
  { to: '/admin', icon: '📊', label: 'Admin / Bias' },
];

export default function Sidebar() {
  return (
    <nav className="gov-sidebar">
      <div style={{ padding: '12px 0' }}>
        {navItems.map((item, i) =>
          item.section ? (
            <div key={i} className="sidebar-section-label">{item.section}</div>
          ) : (
            <NavLink
              key={i}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </NavLink>
          )
        )}
      </div>
    </nav>
  );
}
