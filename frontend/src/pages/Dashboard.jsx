import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardStats, getTenders } from '../api';
import { VerdictBadge, StatusPill } from '../components/Badges';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardStats(), getTenders()])
      .then(([s, t]) => {
        setStats(s.data);
        setTenders(t.data.slice(0, 5));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center" style={{ padding: 40 }}>Loading dashboard...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard — Tender Evaluation Overview</h2>
          <div className="breadcrumb">Home › Dashboard</div>
        </div>
        <Link to="/tenders/upload" className="btn btn-saffron">⬆ Upload New Tender</Link>
      </div>

      {/* Alert banner */}
      {stats?.pending_reviews > 0 && (
        <div className="alert alert-warning">
          ⚠ <strong>{stats.pending_reviews} bidder(s)</strong> have verdicts requiring officer review. Please review them before finalising the evaluation.
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="value">{stats?.total_tenders ?? 0}</div>
          <div className="label">Total Tenders</div>
        </div>
        <div className="stat-card saffron">
          <div className="value">{stats?.active_tenders ?? 0}</div>
          <div className="label">Active / Evaluating</div>
        </div>
        <div className="stat-card">
          <div className="value">{stats?.completed_evaluations ?? 0}</div>
          <div className="label">Completed</div>
        </div>
        <div className="stat-card">
          <div className="value">{stats?.total_bidders ?? 0}</div>
          <div className="label">Total Bidders</div>
        </div>
        <div className="stat-card green">
          <div className="value">{stats?.pass_count ?? 0}</div>
          <div className="label">Verdicts: PASS</div>
        </div>
        <div className="stat-card red">
          <div className="value">{stats?.fail_count ?? 0}</div>
          <div className="label">Verdicts: FAIL</div>
        </div>
        <div className="stat-card amber">
          <div className="value">{stats?.review_count ?? 0}</div>
          <div className="label">Pending Review</div>
        </div>
        <div className="stat-card">
          <div className="value">{stats?.override_rate ?? 0}%</div>
          <div className="label">Override Rate</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Recent Tenders */}
        <div className="gov-card">
          <div className="gov-card-header">
            Recent Tenders
            <Link to="/tenders" className="btn btn-outline btn-sm">View All</Link>
          </div>
          {tenders.length === 0 ? (
            <div className="text-center text-muted" style={{ padding: 20 }}>
              No tenders uploaded yet.{' '}
              <Link to="/tenders/upload">Upload your first tender →</Link>
            </div>
          ) : (
            <div className="gov-table-wrap">
              <table className="gov-table">
                <thead>
                  <tr>
                    <th>Tender No.</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Criteria</th>
                  </tr>
                </thead>
                <tbody>
                  {tenders.map(t => (
                    <tr key={t.id}>
                      <td><Link to={`/tenders/${t.id}`}>{t.tender_number}</Link></td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</td>
                      <td><StatusPill status={t.status} /></td>
                      <td>{t.criteria_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="gov-card">
          <div className="gov-card-header">Recent Activity</div>
          {(stats?.recent_activity || []).length === 0 ? (
            <div className="text-muted" style={{ padding: 20, textAlign: 'center' }}>No recent activity.</div>
          ) : (
            <div>
              {stats.recent_activity.map((log, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--gov-border)', fontSize: 12 }}>
                  <span style={{ color: 'var(--gov-text-muted)', minWidth: 130 }}>
                    {new Date(log.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  <span style={{ color: 'var(--gov-navy)', fontWeight: 600 }}>
                    {log.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  <span className="text-muted">{log.entity_type} #{log.entity_id}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="gov-card">
        <div className="gov-card-header">Quick Actions</div>
        <div className="flex gap-12 flex-wrap">
          <Link to="/tenders/upload" className="btn btn-primary">📄 Upload Tender Document</Link>
          <Link to="/evaluate" className="btn btn-saffron">⚖ Start Evaluation</Link>
          <Link to="/audit" className="btn btn-outline">📝 View Audit Log</Link>
          <Link to="/admin" className="btn btn-outline">📊 Bias Dashboard</Link>
        </div>
      </div>

      {/* System info */}
      <div className="alert alert-info" style={{ fontSize: 12 }}>
        <strong>VERIDOC v1.0</strong> — AI-Powered Tender Evaluation System for CRPF Procurement Division.
        All verdicts are subject to officer review. Reference: GFR 2017.
        Contact your System Administrator for technical support.
      </div>
    </div>
  );
}
