import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { toast } from 'react-toastify';

/* ──────────────────────────────────────────────────────────
   Register page — mirrors the ForensicLayout dual-tier header
   so the navbar looks identical to the Dashboard & Login.
─────────────────────────────────────────────────────────── */

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fontLevel, setFontLevel] = useState(1);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const FONT_SIZES = [13, 16, 20];
  const applyFont = (level) => {
    setFontLevel(level);
    document.documentElement.style.fontSize = FONT_SIZES[level] + 'px';
  };

  const handleRegister = (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please enter both username and password.');
      return;
    }
    let role = 'USER';
    if (username.toLowerCase() === 'admin') role = 'ADMIN';
    login(username, role);
    toast.success(`Account created successfully! Logged in as ${role}`);
    navigate('/');
  };

  return (
    <div className="gp-root">

      {/* ── TIER 1: Utility Bar ── */}
      <div className="gp-utility-bar">
        <div className="gp-utility-inner">
          <div className="gp-utility-left">
            <span className="gp-utility-label hide-mobile">Accessibility</span>
            <span className="gp-utility-sep hide-mobile">|</span>
            <span className="gp-utility-label hide-mobile">Screen Reader</span>
          </div>
          <div className="gp-utility-right">
            <button
              className={`gp-font-btn${fontLevel === 0 ? ' gp-font-active' : ''}`}
              onClick={() => applyFont(0)}
              title="Decrease font size"
            >A<sup>-</sup></button>
            <button
              className={`gp-font-btn${fontLevel === 1 ? ' gp-font-active' : ''}`}
              onClick={() => applyFont(1)}
              title="Default font size"
            >A</button>
            <button
              className={`gp-font-btn${fontLevel === 2 ? ' gp-font-active' : ''}`}
              onClick={() => applyFont(2)}
              title="Increase font size"
            >A<sup>+</sup></button>
            <span className="gp-utility-sep">|</span>
          </div>
        </div>
      </div>

      {/* ── TIER 2: Main Header ── */}
      <header className="gp-header">
        <div className="gp-header-inner">
          <div className="gp-brand-group" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <div className="gp-brand-text">
              <h1 className="gp-title">VeriDoc <span className="gp-title-suffix">Forensic</span></h1>
              <p className="gp-subtitle">AI-Powered Tender Evaluation | CRPF Division</p>
            </div>
          </div>


        </div>
      </header>

      {/* ── Page Body ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: '#f8fafc' }}>
        <div style={{ width: '100%', maxWidth: '440px' }}>

          {/* Breadcrumb */}
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>home</span>
            Home &rsaquo; Create Account
          </p>

          {/* Card */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderTop: '4px solid #1e293b',
            borderRadius: '8px',
            padding: '36px 32px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}>

            {/* Icon + title */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{
                width: '52px', height: '52px', background: '#f1f5f9',
                borderRadius: '50%', display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', marginBottom: '12px',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '26px', color: '#1e293b' }}>person_add</span>
              </div>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                Create an Account
              </h2>
              <p style={{ fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.6 }}>
                Register to access the secure VeriDoc procurement evaluation portal.
              </p>
            </div>

            <form onSubmit={handleRegister}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">
                  Username <span className="form-required">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  style={{ padding: '11px 14px', fontSize: '14px', borderRadius: '6px' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '28px' }}>
                <label className="form-label">
                  Password <span className="form-required">*</span>
                </label>
                <input
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Choose a password"
                  style={{ padding: '11px 14px', fontSize: '14px', borderRadius: '6px' }}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '0.875rem', borderRadius: '6px', gap: '8px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>how_to_reg</span>
                Register Account
              </button>
            </form>

            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                Already have an account?{' '}
                <span
                  style={{ color: '#1e293b', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => navigate('/login')}
                >
                  Login here
                </span>
              </p>
            </div>
          </div>

          {/* Security note */}
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#94a3b8' }}>verified_user</span>
            <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
              Secured under GFR 2017. Unauthorized access is a punishable offence.
            </span>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '14px 24px', textAlign: 'center', background: '#ffffff', borderTop: '1px solid #e2e8f0', color: '#94a3b8', fontSize: '0.6875rem' }}>
        © 2026 VeriDoc Forensic | CRPF Procurement Division. All rights reserved.
      </div>
    </div>
  );
}
