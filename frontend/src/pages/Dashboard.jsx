import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDashboardStats, getTenders } from '../api';
import { StatusPill } from '../components/Badges';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getDashboardStats(), getTenders()])
      .then(([s, t]) => {
        setStats(s.data);
        setTenders(t.data.slice(0, 5));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="obw-spin material-symbols-outlined" style={{ fontSize: 40, color: '#585f65' }}>sync</div>
      </div>
    );
  }

  return (
    <div className="db-container">
      {/* ── Page Header ── */}
      <div className="db-welcome-section">
        <div className="db-welcome-text">
          <h1 className="db-greeting">Good morning, Officer.</h1>
          <p className="db-summary">The system is operational. You have <strong>3 bidders</strong> awaiting your final forensic verdict.</p>
        </div>
      </div>

      {/* ── Section 0: Hero Primary Action ── */}
      <div className="db-hero-centered">
        <div className="db-hero-content">
          <div className="db-hero-icon-wrap">
            <span className="material-symbols-outlined">analytics</span>
          </div>
          <h2 className="db-hero-title">Commence Forensic Evaluation</h2>
          <p className="db-hero-subtitle">Initialize a new tender analysis by uploading primary constraints and bidder submissions.</p>
          <button 
            className="db-hero-primary-btn" 
            onClick={() => navigate('/tenders/upload')}
          >
            <span className="material-symbols-outlined">cloud_upload</span>
            Upload New Tender
          </button>
        </div>
      </div>

      {/* ── Section 1: Core Metrics ── */}
      <div className="db-stats-grid">
        <div className="db-stat-card">
          <div className="db-stat-top">
            <span className="db-stat-label">Total Tenders</span>
            <span className="material-symbols-outlined db-stat-icon">gavel</span>
          </div>
          <div className="db-stat-value">{stats?.total_tenders ?? 0}</div>
        </div>

        <div className="db-stat-card pass">
          <div className="db-stat-top">
            <span className="db-stat-label">Cleared (Pass)</span>
            <span className="material-symbols-outlined db-stat-icon">check_circle</span>
          </div>
          <div className="db-stat-value">{stats?.pass_count ?? 0}</div>
        </div>

        <div className="db-stat-card review">
          <div className="db-stat-top">
            <span className="db-stat-label">Under Review</span>
            <span className="material-symbols-outlined db-stat-icon">pending</span>
          </div>
          <div className="db-stat-value">{stats?.review_count ?? 0}</div>
        </div>

        <div className="db-stat-card fail">
          <div className="db-stat-top">
            <span className="db-stat-label">Flagged (Fail)</span>
            <span className="material-symbols-outlined db-stat-icon">error</span>
          </div>
          <div className="db-stat-value">{stats?.fail_count ?? 0}</div>
        </div>
      </div>

      {/* ── Section 2: Data Grids ── */}
      <div className="db-grid-2">
        {/* Recent Submissions */}
        <div className="db-card">
          <div className="db-card-header">
            <h3 className="db-card-title">Recent Submissions</h3>
            <Link 
              to="/tenders" 
              className="obw-btn-draft" 
              style={{ fontSize: 12, padding: '4px 12px' }}
            >
              View All
            </Link>
          </div>
          <div style={{ flex: 1 }}>
            {tenders.length === 0 ? (
              <div className="text-center text-muted" style={{ padding: 40 }}>
                No records found.
              </div>
            ) : (
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Entity / Tender No.</th>
                    <th>Status</th>
                    <th>Criteria</th>
                  </tr>
                </thead>
                <tbody>
                  {tenders.map(t => (
                    <tr key={t.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#1b1b1c' }}>{t.tender_number}</div>
                        <div style={{ fontSize: 11, color: '#44474a', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 200 }}>
                          {t.title}
                        </div>
                      </td>
                      <td><StatusPill status={t.status} /></td>
                      <td>{t.criteria_count} items</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Forensic Audit Log (Recent Activity) */}
        <div className="db-card">
          <div className="db-card-header">
            <h3 className="db-card-title">Forensic Audit Log</h3>
          </div>
          <div className="db-activity-list">
            {(stats?.recent_activity || []).length === 0 ? (
              <div className="text-muted" style={{ padding: 40, textAlign: 'center' }}>No recent logs.</div>
            ) : (
              stats.recent_activity.map((log, i) => (
                <div key={i} className="db-activity-item">
                  <div className="db-activity-dot" />
                  <div className="db-activity-content">
                    <div className="db-activity-title">
                      {log.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </div>
                    <div className="db-activity-meta">{log.entity_type} #{log.entity_id}</div>
                  </div>
                  <div className="db-activity-time">
                    {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Section 3: Quick Operations ── */}
      <div className="obw-step">
        <h2 className="obw-step-title">Quick Operations</h2>
        <div className="obw-actions" style={{ borderTop: 'none', paddingTop: 0, justifyContent: 'flex-start', gap: 16 }}>
          <Link to="/tenders/upload" className="obw-btn-commence">
            <span className="material-symbols-outlined">description</span>
            Initialize Tender
          </Link>
          <Link to="/evaluate" className="obw-btn-draft">
            <span className="material-symbols-outlined">rule_folder</span>
            Evaluate Bidders
          </Link>
          <Link to="/audit" className="obw-btn-draft">
            <span className="material-symbols-outlined">receipt_long</span>
            Audit Trails
          </Link>
          <Link to="/admin" className="obw-btn-draft">
            <span className="material-symbols-outlined">analytics</span>
            Bias Analysis
          </Link>
        </div>
      </div>

      {/* Footer Info */}
      <div className="obw-ledger-header" style={{ marginTop: 64, border: '1px solid #c4c7ca', background: '#fcf9f9' }}>
        <div style={{ fontSize: 12, color: '#44474a' }}>
          <strong>VeriDoc Forensic v1.0</strong> — Built under GFR 2017 Compliance. AI-assisted analysis for procurement integrity.
        </div>
      </div>
    </div>
  );
}
