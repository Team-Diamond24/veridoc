import { useState, useEffect } from 'react';
import { getBiasReport, getTenders, deleteTender, generateDummyTender } from '../api';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';

export default function AdminDashboard() {
  const [report, setReport] = useState(null);
  const [tenders, setTenders] = useState([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    getBiasReport().then(r => setReport(r.data)).catch(console.error);
    loadTenders();
  }, []);

  const loadTenders = () => {
    getTenders().then(r => setTenders(r.data)).catch(console.error);
  };

  const handleGenerateDummy = async () => {
    setGenerating(true);
    try {
      await generateDummyTender();
      toast.success('Dummy tender created successfully!');
      loadTenders();
    } catch (e) {
      toast.error('Failed to generate dummy tender.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id, num) => {
    if (!confirm(`Delete tender ${num}?`)) return;
    try {
      await deleteTender(id);
      toast.success('Deleted.');
      loadTenders();
    } catch { toast.error('Delete failed.'); }
  };

  if (!report) return <div className="text-center" style={{ padding: 40 }}>Loading admin dashboard...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Admin Dashboard — Management & Active Learning</h2>
        <div className="breadcrumb">Home › Admin</div>
      </div>

      {/* Tender Management */}
      <div className="gov-card">
        <div className="gov-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Tender Management (Admin Only)</span>
          <button className="btn btn-primary btn-sm" onClick={handleGenerateDummy} disabled={generating}>
            {generating ? 'Generating...' : '+ Generate Dummy Tender & Bidders'}
          </button>
        </div>
        <div className="gov-table-wrap">
          <table className="gov-table">
            <thead>
              <tr><th>ID</th><th>Tender No.</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {tenders.length === 0 ? <tr><td colSpan="4" className="text-center text-muted">No tenders found.</td></tr> : tenders.map(t => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td style={{ fontWeight: 600 }}><Link to={`/tenders/${t.id}`}>{t.tender_number}</Link></td>
                  <td>{t.status}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Link to={`/tenders/${t.id}`} className="btn btn-outline btn-sm">Update/View</Link>
                      <Link to={`/evaluate?tender_id=${t.id}`} className="btn btn-saffron btn-sm">Evaluate</Link>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id, t.tender_number)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="stats-grid">
        <div className="stat-card"><div className="value">{report.total_corrections}</div><div className="label">Total Corrections</div></div>
        <div className="stat-card green"><div className="value">{report.validated_corrections}</div><div className="label">Validated</div></div>
        <div className={`stat-card ${report.retraining_ready ? 'green' : 'amber'}`}>
          <div className="value">{report.retraining_ready ? '✓' : `${200 - report.total_corrections}`}</div>
          <div className="label">{report.retraining_ready ? 'Retraining Ready' : `More corrections needed`}</div>
        </div>
        <div className="stat-card"><div className="value">{report.avg_override_rate?.toFixed(1)}</div><div className="label">Avg Overrides/Officer</div></div>
      </div>

      {/* Retraining Status */}
      <div className={`alert ${report.retraining_ready ? 'alert-success' : 'alert-warning'}`}>
        {report.retraining_ready
          ? '✓ Retraining threshold reached (200+ corrections). You may initiate model retraining.'
          : `⏳ Retraining requires ${report.retraining_threshold} corrections. Currently at ${report.total_corrections}. ${report.retraining_threshold - report.total_corrections} more needed.`}
      </div>

      {/* Bias Alerts */}
      {report.alerts?.length > 0 && (
        <div className="gov-card">
          <div className="gov-card-header" style={{ color: 'var(--gov-red)' }}>⚠ Bias Alerts ({report.alerts.length})</div>
          {report.alerts.map((alert, i) => (
            <div key={i} className="alert alert-danger">
              <strong>Officer: {alert.officer_id}</strong><br />
              Override count: {alert.override_count} (average: {alert.avg_overrides?.toFixed(1)})<br />
              {alert.alert}
            </div>
          ))}
        </div>
      )}

      {/* Per-Officer Stats */}
      <div className="gov-card">
        <div className="gov-card-header">Per-Officer Override Statistics</div>
        {Object.keys(report.officer_stats || {}).length === 0 ? (
          <div className="text-muted text-center" style={{ padding: 20 }}>No correction data available yet.</div>
        ) : (
          <div className="gov-table-wrap">
            <table className="gov-table">
              <thead>
                <tr><th>Officer ID</th><th>Total Overrides</th><th>PASS→FAIL</th><th>FAIL→PASS</th><th>Validated</th><th>Bias Risk</th></tr>
              </thead>
              <tbody>
                {Object.entries(report.officer_stats).map(([officer, stats]) => {
                  const isHighRisk = report.alerts?.some(a => a.officer_id === officer);
                  return (
                    <tr key={officer} style={{ background: isHighRisk ? 'var(--gov-red-light)' : undefined }}>
                      <td style={{ fontWeight: 600 }}>{officer}</td>
                      <td style={{ textAlign: 'center' }}>{stats.total}</td>
                      <td style={{ textAlign: 'center', color: 'var(--gov-red)' }}>{stats.pass_to_fail}</td>
                      <td style={{ textAlign: 'center', color: 'var(--gov-green)' }}>{stats.fail_to_pass}</td>
                      <td style={{ textAlign: 'center' }}>{stats.validated}</td>
                      <td>
                        {isHighRisk
                          ? <span className="badge badge-fail">HIGH RISK</span>
                          : <span className="badge badge-pass">NORMAL</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* System Info */}
      <div className="gov-card">
        <div className="gov-card-header">System Information</div>
        <div className="info-row"><span className="info-label">Model Version</span><span className="info-value">LegalBERT v1.0 (Rule-based fallback active)</span></div>
        <div className="info-row"><span className="info-label">Verdict Engine</span><span className="info-value">3-Axis Rule-Based + Claude Sonnet 4 (if API key set)</span></div>
        <div className="info-row"><span className="info-label">Evidence Mapper</span><span className="info-value">IndexRAG (TF-IDF + Semantic similarity)</span></div>
        <div className="info-row"><span className="info-label">OCR Engine</span><span className="info-value">pdfplumber (typed) + pytesseract (scanned)</span></div>
        <div className="info-row"><span className="info-label">Database</span><span className="info-value">SQLite (dev) / PostgreSQL (prod)</span></div>
        <div className="info-row"><span className="info-label">Compliance Reference</span><span className="info-value">GFR 2017 — General Financial Rules of India</span></div>
      </div>
    </div>
  );
}
