import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getBidder, getBidderVerdicts, getTenderCriteria, overrideVerdict } from '../api';
import { VerdictBadge, ModalBadge, AxisBar } from '../components/Badges';
import { toast } from 'react-toastify';

function OverrideModal({ verdict, onClose, onSaved }) {
  const [form, setForm] = useState({ correct_verdict: 'PASS', axis_wrong: '', reason: '', officer_id: 'officer_001' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.reason.trim()) return toast.error('Please provide a reason for the override.');
    setLoading(true);
    try {
      await overrideVerdict(verdict.id, { ...form, axis_wrong: form.axis_wrong ? parseInt(form.axis_wrong) : null });
      toast.success('Override recorded successfully.');
      onSaved();
      onClose();
    } catch (err) { toast.error(err.response?.data?.detail || 'Override failed.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          ✏ Override Verdict
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="alert alert-warning">You are overriding an AI verdict. This correction will be logged and used to improve the system.</div>
            <div className="form-group">
              <label className="form-label">Correct Verdict <span className="form-required">*</span></label>
              <select className="form-control form-select" value={form.correct_verdict}
                onChange={e => setForm(p => ({ ...p, correct_verdict: e.target.value }))}>
                <option>PASS</option><option>FAIL</option><option>REVIEW</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Which Axis Was Wrong?</label>
              <select className="form-control form-select" value={form.axis_wrong}
                onChange={e => setForm(p => ({ ...p, axis_wrong: e.target.value }))}>
                <option value="">Not sure / Multiple axes</option>
                <option value="1">Axis 1 — Evidence Quality</option>
                <option value="2">Axis 2 — Semantic Match</option>
                <option value="3">Axis 3 — Threshold Compliance</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Reason <span className="form-required">*</span></label>
              <textarea className="form-control" rows={3} required
                placeholder="Explain why you disagree with the AI verdict..."
                value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Officer ID</label>
              <input className="form-control" value={form.officer_id}
                onChange={e => setForm(p => ({ ...p, officer_id: e.target.value }))} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-danger" disabled={loading}>
              {loading ? 'Saving...' : '✓ Confirm Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BidderDetail() {
  const { bidderId } = useParams();
  const [bidder, setBidder] = useState(null);
  const [verdicts, setVerdicts] = useState([]);
  const [criteria, setCriteria] = useState({});
  const [selectedVerdict, setSelectedVerdict] = useState(null);
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const load = async () => {
    try {
      const b = await getBidder(bidderId);
      setBidder(b.data);
      const v = await getBidderVerdicts(bidderId);
      setVerdicts(v.data);
      if (b.data.tender_id) {
        const c = await getTenderCriteria(b.data.tender_id);
        const map = {};
        c.data.forEach(cr => { map[cr.id] = cr; });
        setCriteria(map);
      }
    } catch { toast.error('Failed to load bidder data.'); }
  };

  useEffect(() => { load(); }, [bidderId]);

  if (!bidder) return <div className="text-center" style={{ padding: 40 }}>Loading...</div>;

  return (
    <div>
      {overrideTarget && (
        <OverrideModal verdict={overrideTarget} onClose={() => setOverrideTarget(null)} onSaved={load} />
      )}

      <div className="page-header">
        <div>
          <h2>{bidder.company_name}</h2>
          <div className="breadcrumb">Home › Tenders › Bidder Detail</div>
        </div>
        <VerdictBadge verdict={bidder.overall_verdict || 'PENDING'} />
      </div>

      {/* Bidder Info */}
      <div className="gov-card">
        <div className="gov-card-header">Bidder Information</div>
        <div className="grid-2">
          <div>
            <div className="info-row"><span className="info-label">Company Name</span><span className="info-value">{bidder.company_name}</span></div>
            <div className="info-row"><span className="info-label">Registration Number</span><span className="info-value">{bidder.registration_number || 'Not provided'}</span></div>
            <div className="info-row"><span className="info-label">Contact Email</span><span className="info-value">{bidder.contact_email || 'Not provided'}</span></div>
          </div>
          <div>
            <div className="info-row"><span className="info-label">Overall Verdict</span><span className="info-value"><VerdictBadge verdict={bidder.overall_verdict || 'PENDING'} /></span></div>
            <div className="info-row"><span className="info-label">Criteria Passed</span><span className="info-value" style={{ color: 'var(--gov-green)', fontWeight: 700 }}>{bidder.pass_count}</span></div>
            <div className="info-row"><span className="info-label">Criteria Failed</span><span className="info-value" style={{ color: 'var(--gov-red)', fontWeight: 700 }}>{bidder.fail_count}</span></div>
            <div className="info-row"><span className="info-label">Pending Review</span><span className="info-value" style={{ color: 'var(--gov-amber)', fontWeight: 700 }}>{bidder.review_count}</span></div>
          </div>
        </div>
      </div>

      {/* Verdict List */}
      <div className="gov-card">
        <div className="gov-card-header">Criterion-wise Evaluation ({verdicts.length} criteria evaluated)</div>

        {verdicts.length === 0 ? (
          <div className="text-muted text-center" style={{ padding: 20 }}>No verdicts yet. Run evaluation first.</div>
        ) : (
          verdicts.map(v => {
            const crit = criteria[v.criterion_id];
            const isExpanded = expandedId === v.id;
            return (
              <div key={v.id} style={{ border: '1px solid var(--gov-border)', marginBottom: 8, borderLeft: `4px solid ${v.verdict === 'PASS' ? 'var(--gov-green)' : v.verdict === 'FAIL' ? 'var(--gov-red)' : 'var(--gov-amber)'}` }}>
                {/* Row header */}
                <div className="flex justify-between items-center" style={{ padding: '10px 14px', cursor: 'pointer', background: isExpanded ? 'var(--gov-blue-light)' : 'white' }}
                  onClick={() => setExpandedId(isExpanded ? null : v.id)}>
                  <div className="flex gap-12 items-center">
                    <VerdictBadge verdict={v.verdict} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{crit?.name || `Criterion #${v.criterion_id}`}</div>
                      <div style={{ fontSize: 11, color: 'var(--gov-text-muted)' }}>
                        {crit && <ModalBadge modal={crit.modal_type} />} Confidence: {(v.confidence * 100).toFixed(0)}%
                        {v.is_overridden && <span style={{ color: 'var(--gov-amber)', marginLeft: 8 }}>✏ Overridden</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-8 items-center">
                    <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setOverrideTarget(v); }}>
                      ✏ Override
                    </button>
                    <span style={{ color: 'var(--gov-text-muted)', fontSize: 18 }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: 16, background: '#fafbfc', borderTop: '1px solid var(--gov-border)' }}>
                    <div className="grid-2" style={{ gap: 20 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--gov-navy)', marginBottom: 12, fontSize: 12, textTransform: 'uppercase' }}>3-Axis Scores</div>
                        <AxisBar label="Axis 1 — Evidence Quality" value={v.axis_evidence_quality} />
                        <AxisBar label="Axis 2 — Semantic Match" value={v.axis_semantic_match} />
                        <AxisBar label="Axis 3 — Threshold Compliance" value={v.axis_threshold_compliance} />

                        {crit && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gov-text-secondary)', marginBottom: 6 }}>CRITERION DETAILS</div>
                            <div className="info-row" style={{ padding: '4px 0' }}><span className="info-label">Evidence Required</span><span className="info-value" style={{ fontSize: 12 }}>{crit.evidence_type?.replace(/_/g, ' ') || '—'}</span></div>
                            {crit.threshold_value && (
                              <div className="info-row" style={{ padding: '4px 0' }}>
                                <span className="info-label">Threshold</span>
                                <span className="info-value" style={{ fontSize: 12 }}>
                                  {crit.threshold_currency === 'INR' ? '₹' : ''}{crit.threshold_value} {crit.threshold_unit}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--gov-navy)', marginBottom: 12, fontSize: 12, textTransform: 'uppercase' }}>AI Reasoning</div>
                        <div style={{ fontSize: 12, color: 'var(--gov-text-secondary)', whiteSpace: 'pre-wrap', background: 'white', padding: 10, border: '1px solid var(--gov-border)', maxHeight: 150, overflowY: 'auto' }}>
                          {v.reasoning || 'No reasoning available.'}
                        </div>

                        {v.counterfactual && (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontWeight: 700, color: 'var(--gov-amber)', marginBottom: 6, fontSize: 12, textTransform: 'uppercase' }}>📌 How to Pass This Criterion</div>
                            <div style={{ fontSize: 12, color: 'var(--gov-text-secondary)', whiteSpace: 'pre-wrap', background: 'var(--gov-amber-light)', padding: 10, border: '1px solid #f0c040' }}>
                              {v.counterfactual}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Evidence Chain */}
                    {v.evidence_chain?.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontWeight: 700, color: 'var(--gov-navy)', marginBottom: 10, fontSize: 12, textTransform: 'uppercase' }}>
                          Evidence Chain ({v.evidence_chain.length} document(s))
                        </div>
                        <div className="evidence-chain">
                          {v.evidence_chain.map((step, i) => (
                            <div key={i} className="evidence-step">
                              <div className="step-number">{step.step || i + 1}</div>
                              <div className="step-content">
                                <div className="step-source">📄 {step.source}</div>
                                <div className="step-text">"{step.text}"</div>
                                <div className="step-confidence">Confidence: {((step.confidence || 0) * 100).toFixed(0)}% | Page {step.page}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
