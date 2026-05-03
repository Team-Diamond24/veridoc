import { useState, useEffect } from 'react';
import { getCorrections, validateCorrection } from '../api';
import { VerdictBadge } from '../components/Badges';
import { toast } from 'react-toastify';

export default function Corrections() {
  const [corrections, setCorrections] = useState([]);

  const load = () => getCorrections().then(r => setCorrections(r.data)).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleValidate = async (id) => {
    try {
      await validateCorrection(id);
      toast.success('Correction validated.');
      load();
    } catch { toast.error('Validation failed.'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Officer Corrections</h2>
          <div className="breadcrumb">Home › Corrections</div>
        </div>
      </div>
      <div className="alert alert-info">
        Officer override corrections are listed here. A senior analyst should validate each correction to prevent bias drift.
        Once 200+ corrections accumulate, the AI model can be retrained.
      </div>
      <div className="gov-card">
        <div className="gov-card-header">
          Correction Queue ({corrections.length} total | {corrections.filter(c => !c.is_validated).length} pending validation)
        </div>
        <div className="gov-table-wrap">
          <table className="gov-table">
            <thead>
              <tr>
                <th>#</th><th>Verdict ID</th><th>Original</th><th>Corrected</th>
                <th>Axis Wrong</th><th>Reason</th><th>Officer</th><th>Date</th><th>Validated</th>
              </tr>
            </thead>
            <tbody>
              {corrections.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--gov-text-muted)', padding: 20 }}>No corrections yet.</td></tr>
              ) : corrections.map(c => (
                <tr key={c.id}>
                  <td style={{ fontSize: 11, color: 'var(--gov-text-muted)' }}>{c.id}</td>
                  <td>{c.verdict_id}</td>
                  <td><VerdictBadge verdict={c.original_verdict} /></td>
                  <td><VerdictBadge verdict={c.corrected_verdict} /></td>
                  <td style={{ textAlign: 'center' }}>{c.axis_wrong ? `Axis ${c.axis_wrong}` : '—'}</td>
                  <td style={{ maxWidth: 200, fontSize: 12 }}>{c.reason || '—'}</td>
                  <td style={{ fontSize: 12 }}>{c.officer_id}</td>
                  <td style={{ fontSize: 11 }}>{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                  <td>
                    {c.is_validated ? (
                      <span style={{ color: 'var(--gov-green)', fontWeight: 700, fontSize: 12 }}>✓ Validated</span>
                    ) : (
                      <button className="btn btn-success btn-sm" onClick={() => handleValidate(c.id)}>Validate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
