import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getVerdictsSummary, exportReport, checkCollusion } from '../api';
import { toast } from 'react-toastify';

/* ─── helpers ─── */
function scoreColor(pct) {
  if (pct >= 70) return 'high';
  if (pct >= 40) return 'medium';
  return 'low';
}

function statusDotClass(verdict) {
  if (verdict === 'PASS')   return 'pass';
  if (verdict === 'FAIL')   return 'fail';
  if (verdict === 'REVIEW') return 'review';
  return 'pending';
}

function reviewChip(bidder) {
  const count = bidder.review_count ?? 0;
  const fails = bidder.fail_count   ?? 0;

  if (fails > 0)
    return <span className="beo-review-chip critical">Critical Flag</span>;
  if (count > 0)
    return <span className="beo-review-chip warning">{count} Unresolved</span>;
  return <span className="beo-review-chip ok">0 Pending</span>;
}

function stageLabel(verdict) {
  if (verdict === 'PASS')   return 'Financial Audit';
  if (verdict === 'REVIEW') return 'Technical Review';
  if (verdict === 'FAIL')   return 'Compliance Check';
  return 'Awaiting';
}

/* ─── sort options ─── */
const SORTS = [
  { label: 'Sort by: Confidence Score', fn: (a, b) => b._score - a._score },
  { label: 'Sort by: Company Name',     fn: (a, b) => a.company_name.localeCompare(b.company_name) },
  { label: 'Sort by: Verdict',          fn: (a, b) => a.overall_verdict?.localeCompare(b.overall_verdict ?? '') },
];

export default function VerdictMatrix() {
  const { tenderId } = useParams();
  const nav = useNavigate();
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [collusion,  setCollusion]  = useState(null);
  const [exporting,  setExporting]  = useState(false);
  const [sortIdx,    setSortIdx]    = useState(0);

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
      a.href = url;
      a.download = `VERIDOC_Report_${tenderId}.pdf`;
      a.click();
      toast.success('Report downloaded.');
    } catch { toast.error('Export failed.'); }
    finally { setExporting(false); }
  };

  const handleCollusion = async () => {
    try {
      const r = await checkCollusion(tenderId);
      setCollusion(r.data);
      toast.info(r.data.flag_count > 0
        ? `${r.data.flag_count} collusion flag(s) detected.`
        : 'No collusion patterns detected.');
    } catch { toast.error('Collusion check failed.'); }
  };

  if (loading) return <div className="text-center" style={{ padding: 40 }}>Loading results...</div>;
  if (!data)   return null;

  const matrix = data.matrix ?? [];

  /* Derive confidence score = pass / total */
  const withScore = matrix.map(b => {
    const total = (b.pass_count ?? 0) + (b.fail_count ?? 0) + (b.review_count ?? 0);
    const score = total > 0 ? Math.round((b.pass_count ?? 0) / total * 100) : 0;
    return { ...b, _score: score };
  });

  const sorted = [...withScore].sort(SORTS[sortIdx].fn);

  const passCount   = matrix.filter(b => b.overall_verdict === 'PASS').length;
  const reviewCount = matrix.filter(b => b.overall_verdict === 'REVIEW').length;
  const failCount   = matrix.filter(b => b.overall_verdict === 'FAIL').length;

  return (
    <div>
      {/* Page Header */}
      <div className="beo-page-header">
        <div>
          <h2>Bidder Evaluation Overview</h2>
          <p>
            Forensic summary of {matrix.length} submission{matrix.length !== 1 ? 's' : ''} for{' '}
            <strong>{data.tender_title ?? `Tender #${tenderId}`}</strong>
          </p>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-outline" onClick={handleCollusion}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>policy</span>
            Collusion Check
          </button>
          <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
            {exporting
              ? <><span className="loading-spinner" /> Exporting...</>
              : <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span> Export Data</>}
          </button>
        </div>
      </div>

      {/* Collusion banner */}
      {collusion && (
        <div className={`alert ${collusion.flag_count > 0 ? 'alert-danger' : 'alert-success'}`}>
          {collusion.flag_count > 0
            ? <>⚠ <strong>{collusion.flag_count} collusion flag(s) detected.</strong></>
            : <>✓ No collusion patterns detected.</>}
          {collusion.flags?.map((f, i) => (
            <div key={i} style={{ fontSize: 12, marginTop: 4 }}>[{f.severity}] {f.description}</div>
          ))}
        </div>
      )}

      {/* Bento Stats */}
      <div className="beo-bento-grid">
        <div className="beo-bento-card">
          <div className="beo-bento-top">
            <span className="beo-bento-label">Total Bidders</span>
            <span className="material-symbols-outlined beo-bento-icon">groups</span>
          </div>
          <div className="beo-bento-value">{matrix.length}</div>
        </div>

        <div className="beo-bento-card pass">
          <div className="beo-bento-top">
            <span className="beo-bento-label">Cleared (Pass)</span>
            <span className="material-symbols-outlined beo-bento-icon">check_circle</span>
          </div>
          <div className="beo-bento-value">{passCount}</div>
        </div>

        <div className="beo-bento-card review">
          <div className="beo-bento-top">
            <span className="beo-bento-label">Under Review</span>
            <span className="material-symbols-outlined beo-bento-icon">pending</span>
          </div>
          <div className="beo-bento-value">{reviewCount}</div>
        </div>

        <div className="beo-bento-card fail">
          <div className="beo-bento-top">
            <span className="beo-bento-label">Flagged (Fail)</span>
            <span className="material-symbols-outlined beo-bento-icon">error</span>
          </div>
          <div className="beo-bento-value">{failCount}</div>
        </div>
      </div>

      {/* Submission Analysis Table */}
      <div className="beo-table-wrap">
        <div className="beo-table-header">
          <span className="beo-table-title">Submission Analysis</span>
          <div className="flex gap-8 items-center">
            <select
              className="form-control form-select"
              style={{ width: 220, padding: '5px 32px 5px 10px', fontSize: 12 }}
              value={sortIdx}
              onChange={e => setSortIdx(Number(e.target.value))}
            >
              {SORTS.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="text-muted text-center" style={{ padding: 32 }}>
            No bidder verdicts yet.{' '}
            <Link to={`/tenders/${tenderId}`}>Run evaluation first →</Link>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 48, textAlign: 'center' }}>Sts</th>
                <th>Entity Name / ID</th>
                <th style={{ width: 180 }}>Evaluation Stage</th>
                <th style={{ width: 220 }}>Confidence Score</th>
                <th style={{ width: 160 }}>Review Items</th>
                <th style={{ width: 120, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(bidder => {
                const verdict = bidder.overall_verdict ?? 'PENDING';
                const score   = bidder._score;
                const dot     = statusDotClass(verdict);
                return (
                  <tr key={bidder.bidder_id}>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`beo-status-dot ${dot}`} />
                    </td>
                    <td>
                      <div className="beo-entity-name">{bidder.company_name}</div>
                      <div className="beo-entity-id">
                        {bidder.registration_number ? `REG-${bidder.registration_number}` : `BID-${bidder.bidder_id}`}
                      </div>
                    </td>
                    <td>
                      <span className="beo-stage-badge">{stageLabel(verdict)}</span>
                    </td>
                    <td>
                      <div className="beo-score-wrap">
                        <span className="beo-score-num">{score}%</span>
                        <div className="beo-score-track">
                          <div
                            className={`beo-score-fill ${scoreColor(score)}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>{reviewChip(bidder)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Link to={`/bidder/${bidder.bidder_id}`} className="beo-view-btn">
                        View Details
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Back link */}
      <div style={{ marginTop: 20 }}>
        <button className="btn btn-outline btn-sm" onClick={() => nav(-1)}>
          ← Back
        </button>
      </div>
    </div>
  );
}
