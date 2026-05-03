import { useState, useEffect } from 'react';
import { getAuditLog } from '../api';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    getAuditLog(200).then(r => setLogs(r.data)).catch(console.error);
  }, []);

  const filtered = filter ? logs.filter(l => l.entity_type === filter) : logs;

  const actionColor = (action) => {
    if (action.includes('pass') || action.includes('complet')) return 'var(--gov-green)';
    if (action.includes('fail') || action.includes('delet')) return 'var(--gov-red)';
    if (action.includes('override') || action.includes('review')) return 'var(--gov-amber)';
    return 'var(--gov-navy)';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Audit Trail Log</h2>
          <div className="breadcrumb">Home › Audit Log</div>
        </div>
        <div className="flex gap-8 items-center">
          <label style={{ fontSize: 12, fontWeight: 600 }}>Filter by:</label>
          <select className="form-control form-select" style={{ width: 160 }} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All Entities</option>
            <option value="tender">Tender</option>
            <option value="bidder">Bidder</option>
            <option value="verdict">Verdict</option>
            <option value="correction">Correction</option>
          </select>
        </div>
      </div>

      <div className="alert alert-info">
        Complete audit trail of all system actions. Every decision, upload, override, and system event is logged here.
        This log is tamper-proof and satisfies GFR 2017 requirements.
      </div>

      <div className="gov-card">
        <div className="gov-card-header">Audit Records ({filtered.length})</div>
        <div className="gov-table-wrap">
          <table className="gov-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity Type</th>
                <th>Entity ID</th>
                <th>Officer / User</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gov-text-muted)', padding: 20 }}>No audit records found.</td></tr>
              ) : (
                filtered.map((log, i) => (
                  <tr key={log.id}>
                    <td style={{ color: 'var(--gov-text-muted)', fontSize: 11 }}>{log.id}</td>
                    <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}
                    </td>
                    <td style={{ color: actionColor(log.action), fontWeight: 600, fontSize: 12 }}>
                      {log.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </td>
                    <td style={{ textTransform: 'capitalize', fontSize: 12 }}>{log.entity_type}</td>
                    <td style={{ textAlign: 'center', fontSize: 12 }}>{log.entity_id ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>{log.user_id}</td>
                    <td style={{ fontSize: 11, color: 'var(--gov-text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
