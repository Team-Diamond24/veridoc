import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getTenders } from '../api';
import { StatusPill } from '../components/Badges';

export default function EvaluatePage() {
  const [tenders, setTenders] = useState([]);
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get('tender_id');

  useEffect(() => {
    getTenders().then(r => setTenders(r.data)).catch(console.error);
  }, []);

  const ready = tenders.filter(t => ['ready', 'completed'].includes(t.status));
  const notReady = tenders.filter(t => !['ready', 'completed'].includes(t.status));

  return (
    <div>
      <div className="page-header">
        <h2>Evaluate Bids</h2>
        <div className="breadcrumb">Home › Evaluate</div>
      </div>

      <div className="alert alert-info">
        Select a tender to manage bidders, upload bid documents, and run AI evaluation.
        Only tenders with status <strong>Ready</strong> can be evaluated.
      </div>

      <div className="gov-card">
        <div className="gov-card-header">Tenders Ready for Evaluation ({ready.length})</div>
        {ready.length === 0 ? (
          <div className="text-muted text-center" style={{ padding: 20 }}>
            No tenders ready. <Link to="/tenders/upload">Upload a tender first →</Link>
          </div>
        ) : (
          <div className="gov-table-wrap">
            <table className="gov-table">
              <thead>
                <tr><th>Tender No.</th><th>Title</th><th>Authority</th><th>Criteria</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {ready.map(t => (
                  <tr key={t.id} style={{ background: String(t.id) === preselected ? 'var(--gov-blue-light)' : undefined }}>
                    <td style={{ fontWeight: 600 }}>{t.tender_number}</td>
                    <td>{t.title}</td>
                    <td>{t.issuing_authority}</td>
                    <td style={{ textAlign: 'center' }}>{t.criteria_count}</td>
                    <td><StatusPill status={t.status} /></td>
                    <td>
                      <div className="flex gap-8">
                        <Link to={`/tenders/${t.id}`} className="btn btn-saffron btn-sm">Manage & Evaluate</Link>
                        {t.status === 'completed' && (
                          <Link to={`/verdicts/${t.id}`} className="btn btn-primary btn-sm">View Results</Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {notReady.length > 0 && (
        <div className="gov-card">
          <div className="gov-card-header">Tenders Not Yet Ready ({notReady.length})</div>
          <div className="gov-table-wrap">
            <table className="gov-table">
              <thead>
                <tr><th>Tender No.</th><th>Title</th><th>Status</th><th>Reason</th></tr>
              </thead>
              <tbody>
                {notReady.map(t => (
                  <tr key={t.id}>
                    <td>{t.tender_number}</td>
                    <td>{t.title}</td>
                    <td><StatusPill status={t.status} /></td>
                    <td style={{ fontSize: 12, color: 'var(--gov-text-muted)' }}>
                      {t.status === 'uploaded' && 'Waiting for criteria extraction'}
                      {t.status === 'extracting' && 'Criteria extraction in progress'}
                      {t.status === 'evaluating' && 'Evaluation in progress'}
                      {t.status === 'extraction_failed' && 'Extraction failed — re-upload'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
