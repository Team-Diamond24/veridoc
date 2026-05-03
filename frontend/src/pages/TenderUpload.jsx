import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadTender } from '../api';
import { toast } from 'react-toastify';

export default function TenderUpload() {
  const nav = useNavigate();
  const fileRef = useRef();
  const [form, setForm] = useState({
    tender_number: '', title: '', issuing_authority: 'CRPF HQ', deadline: '',
  });
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Please select a tender document.');
    if (!form.tender_number || !form.title) return toast.error('Tender Number and Title are required.');

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
    fd.append('file', file);

    setLoading(true);
    try {
      const res = await uploadTender(fd);
      toast.success('Tender uploaded! Criteria extraction started in background.');
      nav(`/tenders/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Upload Tender Document</h2>
          <div className="breadcrumb">Home › Tenders › Upload</div>
        </div>
      </div>

      <div className="alert alert-info">
        Upload the official tender PDF. VERIDOC will automatically extract eligibility criteria using AI.
        You can review and edit extracted criteria before starting evaluation.
      </div>

      <form onSubmit={handleSubmit}>
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

        <div className="gov-card">
          <div className="gov-card-header">Tender Document (PDF)</div>

          <div
            className={`file-drop-zone ${dragging ? 'dragging' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <div className="icon">📄</div>
            {file ? (
              <p style={{ color: 'var(--gov-green)', fontWeight: 600 }}>✓ {file.name} ({(file.size/1024/1024).toFixed(2)} MB)</p>
            ) : (
              <>
                <p>Drag & drop the tender PDF here, or <strong>click to browse</strong></p>
                <p className="file-hint">Accepted: PDF files only (typed or scanned)</p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => setFile(e.target.files[0])} />

          {file && (
            <div style={{ marginTop: 8 }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setFile(null)}>✕ Remove</button>
            </div>
          )}
        </div>

        <div className="flex gap-12">
          <button type="submit" className="btn btn-saffron" disabled={loading}>
            {loading ? <><span className="loading-spinner" /> Uploading & Extracting...</> : '⬆ Upload & Extract Criteria'}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => nav('/tenders')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
