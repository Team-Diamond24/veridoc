import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  uploadTender, createBidder, uploadBidderDocs,
  triggerEvaluation, getTender, getBidders,
} from '../api';
import { toast } from 'react-toastify';

function fmtMB(bytes) { return `${(bytes / 1024 / 1024).toFixed(2)} MB`; }

function pipelineIdx(status) {
  return { uploaded: 0, extracting: 0, ready: 1, evaluating: 2, completed: 3 }[status] ?? 0;
}

function deriveStatus(b) {
  if (b.status === 'failed')     return 'error';
  if (b.status === 'processed')  return 'ingested';
  if (b.status === 'processing') return 'processing';
  return 'pending';
}

function StatusBadge({ status }) {
  if (status === 'processing')
    return (
      <span className="obw-badge-processing">
        <span className="material-symbols-outlined obw-spin">sync</span>Processing
      </span>
    );
  if (status === 'ingested')
    return (
      <span className="obw-badge-ingested">
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>Ingested
      </span>
    );
  if (status === 'error')
    return (
      <span className="obw-badge-processing" style={{ background: 'var(--gov-red-light)', color: 'var(--gov-red)' }}>
        Error
      </span>
    );
  return (
    <span className="obw-badge-processing" style={{ background: '#f0f0f0', color: '#888' }}>Pending</span>
  );
}

const STEPS = ['OCR / Ingestion', 'Obligation Extr.', 'Evidence Mapping', 'Verdict Gen.'];

export default function TenderUpload() {
  const nav = useNavigate();
  const tenderFileRef = useRef();
  const bidderFileRef = useRef();

  const [form, setForm] = useState({
    tender_number: '', title: '', issuing_authority: 'CRPF HQ', deadline: '',
  });
  const [tenderFile, setTenderFile]     = useState(null);
  const [tDrag, setTDrag]               = useState(false);
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Done, setStep1Done]       = useState(false);
  const [tenderId, setTenderId]         = useState(null);

  const [bidderFiles, setBidderFiles]   = useState([]);
  const [bDrag, setBDrag]               = useState(false);
  const [step2Loading, setStep2Loading] = useState(false);

  const [tenderData, setTenderData]     = useState(null);
  const [bidderRows, setBidderRows]     = useState([]);
  const [lastUpdated, setLastUpdated]   = useState(null);
  const [ingesting, setIngesting]       = useState(false);

  useEffect(() => {
    if (!tenderId) return;
    const poll = () =>
      Promise.all([getTender(tenderId), getBidders(tenderId)])
        .then(([t, b]) => {
          setTenderData(t.data);
          setBidderRows(b.data);
          setLastUpdated(new Date().toLocaleTimeString('en-GB', { hour12: false }));
        })
        .catch(() => {});
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [tenderId]);

  const handleStep1 = async (e) => {
    e.preventDefault();
    if (!tenderFile) return toast.error('Please select a tender document.');
    if (!form.tender_number || !form.title) return toast.error('Tender Number and Title are required.');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
    fd.append('file', tenderFile);
    setStep1Loading(true);
    try {
      const res = await uploadTender(fd);
      setTenderId(res.data.id);
      setStep1Done(true);
      toast.success('Tender document uploaded — criteria extraction started.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed.');
    } finally { setStep1Loading(false); }
  };

  const addBidders = async (files) => {
    if (!tenderId) return toast.warn('Complete Step 1 first.');
    setStep2Loading(true);
    for (const file of Array.from(files)) {
      try {
        const companyName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
        const br = await createBidder({ tender_id: tenderId, company_name: companyName, registration_number: '', contact_email: '' });
        const fd = new FormData();
        fd.append('files', file);
        await uploadBidderDocs(br.data.id, fd);
        setBidderFiles(prev => [...prev, { name: file.name }]);
        toast.success(`${file.name} added.`);
      } catch (err) {
        toast.error(`Failed: ${file.name}`);
      }
    }
    setStep2Loading(false);
  };

  const handleCommence = async () => {
    if (!tenderId) return toast.warn('Complete Step 1 first.');
    setIngesting(true);
    try {
      await triggerEvaluation(tenderId);
      toast.success('Ingestion & evaluation pipeline started.');
      nav(`/verdicts/${tenderId}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not start ingestion.');
    } finally { setIngesting(false); }
  };

  const activeStep = tenderData ? pipelineIdx(tenderData.status) : 0;

  return (
    <div>
      {/* Page Header */}
      <div className="obw-page-header">
        <h1>Tender Initialization</h1>
        <p>Upload primary tender constraints and bidder submissions for forensic ingestion.</p>
      </div>

      {/* ── STEP 1 ── */}
      <div className="obw-step">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <h2 className="obw-step-title">Step 1: Primary Tender Directive</h2>
          {step1Done && (
            <span className="material-symbols-outlined" style={{ color: 'var(--gov-green)', marginLeft: 8 }}>check_circle</span>
          )}
        </div>
        <p className="obw-step-subtitle">Upload the master requirements document (PDF/DOCX).</p>

        {!step1Done ? (
          <form onSubmit={handleStep1}>
            <div className="gov-card">
              <div className="gov-card-header">Tender Details</div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Tender Number <span className="form-required">*</span></label>
                  <input className="form-control" placeholder="e.g. CRPF/HQ/2026/001"
                    value={form.tender_number}
                    onChange={e => setForm(p => ({ ...p, tender_number: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Issuing Authority</label>
                  <input className="form-control" value={form.issuing_authority}
                    onChange={e => setForm(p => ({ ...p, issuing_authority: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Tender Title <span className="form-required">*</span></label>
                <input className="form-control" placeholder="e.g. Supply of Uniforms for CRPF Personnel"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Bid Submission Deadline</label>
                <input type="date" className="form-control" value={form.deadline}
                  onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
              </div>
            </div>

            <div className="obw-drop-card">
              <div
                className={`obw-drop-inner${tDrag ? ' dragging' : ''}`}
                onDragOver={e => { e.preventDefault(); setTDrag(true); }}
                onDragLeave={() => setTDrag(false)}
                onDrop={e => { e.preventDefault(); setTDrag(false); const f = e.dataTransfer.files[0]; if (f) setTenderFile(f); }}
                onClick={() => tenderFileRef.current?.click()}
              >
                {tenderFile ? (
                  <div className="obw-file-selected">
                    <div className="obw-file-info">
                      <span className="material-symbols-outlined" style={{ color: 'var(--gov-navy)' }}>description</span>
                      <div>
                        <div className="obw-file-name">{tenderFile.name}</div>
                        <div className="obw-file-meta">{fmtMB(tenderFile.size)} • Ready</div>
                      </div>
                    </div>
                    <button type="button" className="obw-delete-btn"
                      onClick={e => { e.stopPropagation(); setTenderFile(null); }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="material-symbols-outlined obw-drop-icon">cloud_upload</span>
                    <span className="obw-drop-label">Drag &amp; Drop or Click to Browse</span>
                    <span style={{ fontSize: 11, color: 'var(--gov-text-muted)', marginTop: 4 }}>PDF / DOCX</span>
                  </>
                )}
              </div>
            </div>
            <input ref={tenderFileRef} type="file" accept=".pdf,.docx"
              style={{ display: 'none' }} onChange={e => setTenderFile(e.target.files[0])} />

            <div style={{ marginTop: 16 }}>
              <button type="submit" className="btn btn-primary" disabled={step1Loading}>
                {step1Loading
                  ? <><span className="loading-spinner" /> Uploading &amp; Extracting...</>
                  : <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload_file</span> Upload &amp; Extract Criteria</>}
              </button>
            </div>
          </form>
        ) : (
          <div className="alert alert-success">
            <strong>✓ Tender document uploaded.</strong> Criteria extraction running.
            {' '}Tender ID: <strong>{tenderId}</strong> | Status: <strong>{tenderData?.status ?? 'processing'}</strong>
          </div>
        )}
      </div>

      {/* ── STEP 2 ── */}
      <div className="obw-step">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 className="obw-step-title">
            Step 2: Bidder Submissions
            {bidderFiles.length > 0 && (
              <span className="obw-count-chip">{bidderFiles.length} Detected</span>
            )}
          </h2>
        </div>
        <p className="obw-step-subtitle">Upload zipped folders or multiple documents per bidder.</p>

        <div className="obw-bidder-drop-card">
          <div
            className={`obw-bidder-add${bDrag ? ' dragging' : ''}`}
            onDragOver={e => { e.preventDefault(); setBDrag(true); }}
            onDragLeave={() => setBDrag(false)}
            onDrop={e => { e.preventDefault(); setBDrag(false); addBidders(e.dataTransfer.files); }}
            onClick={() => bidderFileRef.current?.click()}
          >
            {step2Loading
              ? <span className="loading-spinner" style={{ borderTopColor: 'var(--gov-navy)', borderColor: 'rgba(0,0,0,0.12)' }} />
              : <>
                  <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--gov-text-secondary)', marginBottom: 6 }}>add_circle</span>
                  <span style={{ fontSize: 13, color: 'var(--gov-text-secondary)' }}>Add Bidder Folder / ZIP</span>
                </>}
          </div>
          <input ref={bidderFileRef} type="file" accept=".zip,.pdf,.docx" multiple
            style={{ display: 'none' }} onChange={e => addBidders(e.target.files)} />

          {bidderFiles.length > 0 ? (
            <div className="obw-bidder-list">
              {bidderFiles.map(b => (
                <div key={b.name} className="obw-bidder-row">
                  <div className="obw-bidder-row-left">
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--gov-text-muted)' }}>folder_zip</span>
                    <span className="obw-bidder-name">{b.name}</span>
                  </div>
                  <button className="obw-delete-btn"
                    onClick={() => setBidderFiles(prev => prev.filter(x => x.name !== b.name))}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted text-center" style={{ padding: 16 }}>
              No bidder submissions added yet. Drag &amp; drop ZIPs above.
            </div>
          )}
        </div>
      </div>

      {/* ── STEP 3 ── */}
      <div className="obw-step">
        <h2 className="obw-step-title" style={{ marginBottom: 16 }}>
          Step 3: Systematic Ingestion Pipeline &amp; Ledger
        </h2>

        {/* Pipeline */}
        <div className="obw-pipeline-card">
          <div className="obw-pipeline-track">
            {STEPS.map((label, i) => {
              const done   = i < activeStep;
              const active = i === activeStep;
              return (
                <div key={i} className="obw-pipeline-step">
                  <div className={`obw-step-bubble ${done ? 'done' : active ? 'active' : 'pending'}`}>
                    {done
                      ? <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check</span>
                      : i + 1}
                  </div>
                  <span className={`obw-step-label${active ? ' active' : ''}`}>{label}</span>
                  <span className="obw-step-sublabel">{done ? 'Done' : active ? 'In Progress' : 'Pending'}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ledger */}
        <div className="obw-ledger">
          <div className="obw-ledger-header">
            <span className="obw-ledger-title">Entity Processing Ledger</span>
            <span className="obw-ledger-time">
              {lastUpdated ? `Last updated: ${lastUpdated} GMT` : 'Waiting for data...'}
            </span>
          </div>
          {bidderRows.length === 0 ? (
            <div className="text-muted text-center" style={{ padding: 24 }}>
              {tenderId ? 'No bidders yet — add submissions in Step 2.' : 'Complete Step 1 to begin tracking.'}
            </div>
          ) : (
            <table className="obw-ledger-table">
              <thead>
                <tr>
                  <th>Entity ID</th>
                  <th>File Count</th>
                  <th>Current Operation</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {bidderRows.map(bidder => {
                  const st      = deriveStatus(bidder);
                  const isError = st === 'error';
                  return (
                    <tr key={bidder.id} className={isError ? 'error-row' : 'normal-row'}>
                      <td className="entity-cell">
                        <div className="obw-entity-row">
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--gov-text-muted)' }}>corporate_fare</span>
                          {bidder.company_name}
                        </div>
                      </td>
                      <td>{bidder.document_count ?? '—'} docs</td>
                      <td>
                        {isError ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--gov-red)' }}>warning</span>
                              <span style={{ color: 'var(--gov-red)', fontWeight: 600, fontSize: 12 }}>Processing Error</span>
                            </div>
                            <div className="obw-error-detail">Check documents and re-upload.</div>
                          </>
                        ) : bidder.status === 'processing' ? (
                          <span style={{ color: 'var(--gov-text-secondary)', fontSize: 12 }}>Extracting content…</span>
                        ) : bidder.status === 'processed' ? (
                          <span style={{ color: 'var(--gov-text-secondary)', fontSize: 12 }}>Awaiting evaluation</span>
                        ) : (
                          <span style={{ color: 'var(--gov-text-muted)', fontSize: 12 }}>Queued</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isError ? (
                          <button className="obw-badge-error"
                            onClick={() => toast.info(`Check bidder: ${bidder.company_name}`)}>
                            Resolve Issue
                          </button>
                        ) : (
                          <StatusBadge status={st} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="obw-actions">
        <button className="btn btn-outline" onClick={() => nav('/tenders')}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>pause</span>
          Save Draft
        </button>
        <button className="btn btn-primary" onClick={handleCommence} disabled={!step1Done || ingesting}>
          {ingesting
            ? <><span className="loading-spinner" /> Starting...</>
            : <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_arrow</span> Commence Ingestion</>}
        </button>
      </div>
    </div>
  );
}
