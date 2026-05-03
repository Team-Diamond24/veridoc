import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getTender, getTenderCriteria, getBidders, createBidder, uploadBidderDocs, triggerEvaluation, getBidderDocs, deleteBidder } from '../api';
import { StatusPill, ModalBadge } from '../components/Badges';
import { toast } from 'react-toastify';

export default function TenderDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [tender, setTender] = useState(null);
  const [criteria, setCriteria] = useState([]);
  const [bidders, setBidders] = useState([]);
  const [activeTab, setActiveTab] = useState('criteria');
  const [showAddBidder, setShowAddBidder] = useState(false);
  const [bidderForm, setBidderForm] = useState({ company_name: '', registration_number: '', contact_email: '' });
  const [uploadFiles, setUploadFiles] = useState({});
  const [evaluating, setEvaluating] = useState(false);
  const [polling, setPolling] = useState(false);

  const load = async () => {
    try {
      const [t, c, b] = await Promise.all([getTender(id), getTenderCriteria(id), getBidders(id)]);
      setTender(t.data); setCriteria(c.data); setBidders(b.data);
    } catch { toast.error('Failed to load tender data.'); }
  };

  useEffect(() => { load(); }, [id]);

  // Poll for status changes
  useEffect(() => {
    if (!tender) return;
    if (['extracting', 'evaluating'].includes(tender.status)) {
      const t = setInterval(load, 3000);
      return () => clearInterval(t);
    }
  }, [tender?.status]);

  const handleAddBidder = async (e) => {
    e.preventDefault();
    try {
      await createBidder({ ...bidderForm, tender_id: parseInt(id) });
      toast.success('Bidder added.');
      setShowAddBidder(false);
      setBidderForm({ company_name: '', registration_number: '', contact_email: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to add bidder.'); }
  };

  const handleUploadDocs = async (bidderId) => {
    const files = uploadFiles[bidderId];
    if (!files?.length) return toast.error('Select files first.');
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append('files', f));
    try {
      await uploadBidderDocs(bidderId, fd);
      toast.success('Documents uploaded & processing started.');
      setUploadFiles(p => ({ ...p, [bidderId]: null }));
      load();
    } catch { toast.error('Upload failed.'); }
  };

  const handleEvaluate = async () => {
    if (!confirm('Start AI evaluation for all bidders? This may take a few minutes.')) return;
    setEvaluating(true);
    try {
      await triggerEvaluation(id);
      toast.success('Evaluation started! Results will appear shortly.');
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Evaluation failed.'); }
    finally { setEvaluating(false); }
  };

  if (!tender) return <div className="text-center" style={{ padding: 40 }}>Loading...</div>;

  const canEvaluate = tender.status === 'ready' && bidders.length > 0 && criteria.length > 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>{tender.title}</h2>
          <div className="breadcrumb">Home › <Link to="/tenders">Tenders</Link> › {tender.tender_number}</div>
        </div>
        <div className="flex gap-8">
          {tender.status === 'completed' && (
            <Link to={`/verdicts/${id}`} className="btn btn-success">⚖ View Results</Link>
          )}
          <button
            className="btn btn-saffron"
            onClick={handleEvaluate}
            disabled={!canEvaluate || evaluating || tender.status === 'evaluating'}
          >
            {evaluating || tender.status === 'evaluating'
              ? <><span className="loading-spinner" /> Evaluating...</>
              : '▶ Start Evaluation'}
          </button>
        </div>
      </div>

      {/* Tender Info */}
      <div className="gov-card">
        <div className="gov-card-header">Tender Information</div>
        <div className="grid-2">
          <div>
            <div className="info-row"><span className="info-label">Tender Number</span><span className="info-value">{tender.tender_number}</span></div>
            <div className="info-row"><span className="info-label">Issuing Authority</span><span className="info-value">{tender.issuing_authority}</span></div>
            <div className="info-row"><span className="info-label">Submission Deadline</span><span className="info-value">{tender.deadline || 'Not specified'}</span></div>
          </div>
          <div>
            <div className="info-row"><span className="info-label">Status</span><span className="info-value"><StatusPill status={tender.status} /></span></div>
            <div className="info-row"><span className="info-label">Criteria Extracted</span><span className="info-value">{tender.criteria_count}</span></div>
            <div className="info-row"><span className="info-label">Bidders Registered</span><span className="info-value">{bidders.length}</span></div>
          </div>
        </div>
        {tender.status === 'extracting' && (
          <div className="alert alert-warning mt-8">⏳ Criteria extraction in progress. This page will refresh automatically.</div>
        )}
        {tender.status === 'evaluating' && (
          <div className="alert alert-warning mt-8">⏳ AI Evaluation in progress. This page will refresh automatically.</div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 0 }}>
        {['criteria', 'bidders'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="btn" style={{
              borderRadius: '3px 3px 0 0',
              background: activeTab === tab ? 'var(--gov-navy)' : 'white',
              color: activeTab === tab ? 'white' : 'var(--gov-navy)',
              border: '1px solid var(--gov-border)',
              borderBottom: activeTab === tab ? 'none' : undefined,
            }}>
            {tab === 'criteria' ? `📋 Criteria (${criteria.length})` : `👥 Bidders (${bidders.length})`}
          </button>
        ))}
      </div>

      {/* Criteria Tab */}
      {activeTab === 'criteria' && (
        <div className="gov-card" style={{ borderRadius: '0 3px 3px 3px' }}>
          {criteria.length === 0 ? (
            <div className="text-muted text-center" style={{ padding: 20 }}>
              {tender.status === 'uploaded' ? 'Waiting for criteria extraction...' : 'No criteria extracted yet.'}
            </div>
          ) : (
            <div className="gov-table-wrap">
              <table className="gov-table">
                <thead>
                  <tr>
                    <th>Code</th><th>Criterion Name</th><th>Type</th>
                    <th>Threshold</th><th>Evidence Required</th><th>Pages</th>
                  </tr>
                </thead>
                <tbody>
                  {criteria.map(c => (
                    <tr key={c.id}>
                      <td><code>{c.criterion_code}</code></td>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td><ModalBadge modal={c.modal_type} /></td>
                      <td>
                        {c.threshold_value
                          ? `${c.threshold_currency === 'INR' ? '₹' : ''}${c.threshold_value} ${c.threshold_unit || ''}`
                          : '—'}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--gov-text-muted)' }}>
                        {c.evidence_type?.replace(/_/g, ' ') || '—'}
                      </td>
                      <td style={{ fontSize: 11 }}>{c.page_references?.join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Bidders Tab */}
      {activeTab === 'bidders' && (
        <div className="gov-card" style={{ borderRadius: '0 3px 3px 3px' }}>
          <div className="flex justify-between items-center mb-16">
            <span style={{ fontSize: 13, color: 'var(--gov-text-secondary)' }}>{bidders.length} bidder(s) registered</span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddBidder(true)}>+ Add Bidder</button>
          </div>

          {showAddBidder && (
            <div className="gov-card" style={{ background: 'var(--gov-blue-light)', marginBottom: 16 }}>
              <div className="gov-card-header">Register New Bidder</div>
              <form onSubmit={handleAddBidder}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Company Name <span className="form-required">*</span></label>
                    <input className="form-control" required value={bidderForm.company_name}
                      onChange={e => setBidderForm(p => ({ ...p, company_name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Registration Number</label>
                    <input className="form-control" value={bidderForm.registration_number}
                      onChange={e => setBidderForm(p => ({ ...p, registration_number: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Email</label>
                  <input type="email" className="form-control" value={bidderForm.contact_email}
                    onChange={e => setBidderForm(p => ({ ...p, contact_email: e.target.value }))} />
                </div>
                <div className="flex gap-8">
                  <button type="submit" className="btn btn-primary">Save Bidder</button>
                  <button type="button" className="btn btn-outline" onClick={() => setShowAddBidder(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {bidders.length === 0 ? (
            <div className="text-muted text-center" style={{ padding: 20 }}>No bidders registered. Add a bidder to begin.</div>
          ) : (
            bidders.map(b => (
              <div key={b.id} className="gov-card" style={{ marginBottom: 12 }}>
                <div className="flex justify-between items-center">
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--gov-navy)' }}>{b.company_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--gov-text-muted)' }}>
                      Reg: {b.registration_number || 'N/A'} | Status: <StatusPill status={b.status} />
                    </div>
                  </div>
                  <div className="flex gap-8">
                    <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                      📎 Upload Docs
                      <input type="file" multiple style={{ display: 'none' }}
                        accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg,.png"
                        onChange={e => setUploadFiles(p => ({ ...p, [b.id]: e.target.files }))} />
                    </label>
                    {uploadFiles[b.id]?.length && (
                      <button className="btn btn-success btn-sm" onClick={() => handleUploadDocs(b.id)}>
                        ⬆ Upload {uploadFiles[b.id].length} file(s)
                      </button>
                    )}
                    {b.status === 'evaluated' && (
                      <Link to={`/bidder/${b.id}`} className="btn btn-primary btn-sm">View Verdicts</Link>
                    )}
                  </div>
                </div>
                {uploadFiles[b.id]?.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gov-text-muted)' }}>
                    Selected: {Array.from(uploadFiles[b.id]).map(f => f.name).join(', ')}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
