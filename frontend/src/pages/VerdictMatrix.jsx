import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getVerdictsSummary, exportReport, checkCollusion } from '../api';
import { VerdictBadge } from '../components/Badges';
import { toast } from 'react-toastify';

export default function VerdictMatrix() {
  const { tenderId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collusion, setCollusion] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getVerdictsSummary(tenderId)
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load verdicts.'))
      .finally(() => setLoading(false));
  }, [tenderId]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportReport(tenderId);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `VERIDOC_Report_${tenderId}.pdf`; a.click();
      toast.success('Report downloaded.');
    } catch { toast.error('Export failed.'); }
    finally { setExporting(false); }
  };

  const handleCollusion = async () => {
    try {
      const r = await checkCollusion(tenderId);
      setCollusion(r.data);
    } catch { toast.error('Collusion check failed.'); }
  };

  if (loading) return <div className="text-center" style={{ padding: 40 }}>Loading results...</div>;
  if (!data) return null;

  const getCellClass = (verdict) => {
    if (verdict === 'PASS') return 'matrix-cell-pass';
    if (verdict === 'FAIL') return 'matrix-cell-fail';
    if (verdict === 'REVIEW') return 'matrix-cell-review';
    return 'matrix-cell-pending';
  };

  const cellSymbol = { PASS: '✓', FAIL: '✗', REVIEW: '⚠', PENDING: '…' };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Evaluation Results — {data.tender_title}</h2>
          <div className="breadcrumb">Home › <Link to="/tenders">Tenders</Link> › Verdicts</div>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-outline" onClick={handleCollusion}>🔍 Check Collusion</button>
          <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
            {exporting ? <><span className="loading-spinner" /> Exporting...</> : '📄 Export PDF Report'}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid">
        <div className="stat-card"><div className="value">{data.matrix?.length || 0}</div><div className="label">Total Bidders</div></div>
        <div className="stat-card green"><div className="value">{data.matrix?.filter(b => b.overall_verdict === 'PASS').length || 0}</div><div className="label">Overall PASS</div></div>
        <div className="stat-card red"><div className="value">{data.matrix?.filter(b => b.overall_verdict === 'FAIL').length || 0}</div><div className="label">Overall FAIL</div></div>
        <div className="stat-card amber"><div className="value">{data.matrix?.filter(b => b.overall_verdict === 'REVIEW').length || 0}</div><div className="label">Needs Review</div></div>
      </div>

      {/* Collusion flags */}
      {collusion && (
        <div className={`alert ${collusion.flag_count > 0 ? 'alert-danger' : 'alert-success'}`}>
          {collusion.flag_count > 0
            ? <>⚠ <strong>{collusion.flag_count} collusion flag(s) detected.</strong> Please review the flagged bidder pairs.</>
            : <>✓ No collusion patterns detected across bidders.</>}
          {collusion.flags.map((f, i) => (
            <div key={i} style={{ marginTop: 8, fontSize: 12 }}>
              [{f.severity}] {f.description}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-12 mb-16" style={{ fontSize: 12 }}>
        <span>Legend:</span>
        <span style={{ color: 'var(--gov-green)', fontWeight: 700 }}>✓ PASS</span>
        <span style={{ color: 'var(--gov-red)', fontWeight: 700 }}>✗ FAIL</span>
        <span style={{ color: 'var(--gov-amber)', fontWeight: 700 }}>⚠ REVIEW</span>
        <span style={{ color: '#999', fontWeight: 700 }}>… PENDING</span>
        <span style={{ color: 'var(--gov-text-muted)' }}>Click a cell for details</span>
      </div>

      {/* Matrix Table */}
      <div className="gov-card">
        <div className="gov-card-header">Verdict Matrix — {data.criteria?.length || 0} Criteria × {data.matrix?.length || 0} Bidders</div>
        <div className="gov-table-wrap" style={{ overflowX: 'auto' }}>
          <table className="gov-table" style={{ tableLayout: 'auto', minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={{ minWidth: 180 }}>Bidder / Company</th>
                <th style={{ minWidth: 80 }}>Overall</th>
                <th>P</th><th>F</th><th>R</th>
                {(data.criteria || []).map(c => (
                  <th key={c.id} style={{ minWidth: 90, fontSize: 10 }}
                    title={`${c.code}: ${c.name} [${c.modal}]`}>
                    {c.code}<br/>
                    <span style={{ fontWeight: 400, color: '#aac' }}>{c.modal?.charAt(0)}</span>
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data.matrix || []).map(bidder => (
                <tr key={bidder.bidder_id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{bidder.company_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gov-text-muted)' }}>{bidder.registration_number || ''}</div>
                  </td>
                  <td><VerdictBadge verdict={bidder.overall_verdict || 'PENDING'} /></td>
                  <td style={{ textAlign: 'center', color: 'var(--gov-green)', fontWeight: 700 }}>{bidder.pass_count}</td>
                  <td style={{ textAlign: 'center', color: 'var(--gov-red)', fontWeight: 700 }}>{bidder.fail_count}</td>
                  <td style={{ textAlign: 'center', color: 'var(--gov-amber)', fontWeight: 700 }}>{bidder.review_count}</td>
                  {(bidder.criteria_verdicts || []).map(cv => (
                    <td key={cv.criterion_id}
                      className={getCellClass(cv.verdict)}
                      title={`${cv.criterion_name}: ${cv.verdict}`}
                      style={{ cursor: cv.verdict_id ? 'pointer' : 'default' }}
                      onClick={() => cv.verdict_id && window.open(`/verdict/${cv.verdict_id}`, '_blank')}>
                      {cellSymbol[cv.verdict] || '…'}
                      {cv.is_overridden && <sup style={{ fontSize: 8 }}>*</sup>}
                    </td>
                  ))}
                  <td>
                    <Link to={`/bidder/${bidder.bidder_id}`} className="btn btn-outline btn-sm">Details</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: 'var(--gov-text-muted)', marginTop: 8 }}>
          * = Officer-overridden verdict | M = Mandatory, C = Conditional, O = Optional
        </div>
      </div>
    </div>
  );
}
