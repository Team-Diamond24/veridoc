import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { toast } from 'react-toastify';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please enter both username and password.');
      return;
    }

    // Dummy authentication logic
    let role = 'USER';
    if (username.toLowerCase() === 'admin') {
      role = 'ADMIN';
    }

    login(username, role);
    toast.success(`Logged in successfully as ${role}`);
    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--gov-bg)' }}>
      {/* Top Bar matching header theme */}
      <div style={{ 
        height: 'var(--header-height, 80px)', 
        background: 'var(--gov-navy)', 
        borderBottom: '4px solid var(--gov-saffron)', 
        display: 'flex', 
        alignItems: 'center', 
        padding: '0 24px',
        color: 'white',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="emblem" style={{ 
            width: '52px', 
            height: '52px', 
            background: 'white', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: 'var(--gov-navy)', 
            fontWeight: 'bold',
            fontSize: '24px'
          }}>
            V
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, letterSpacing: '0.5px' }}>VeriDoc Portal</h1>
            <p style={{ margin: 0, fontSize: '0.6875rem', color: '#b0c4de', letterSpacing: '0.3px' }}>Government e-Procurement System</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="gov-card" style={{ 
          maxWidth: '440px', 
          width: '100%', 
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)', 
          borderTop: '4px solid var(--gov-navy)',
          padding: '32px'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--gov-navy-dark)', marginBottom: '8px' }}>Authorized Sign In</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--gov-text-muted)' }}>Enter your credentials to access the secure tender evaluation platform.</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Username <span className="form-required">*</span></label>
              <input 
                type="text" 
                className="form-control" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                placeholder="Try 'admin' for admin privileges"
                style={{ padding: '12px 14px', fontSize: '14px' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '28px' }}>
              <label className="form-label">Password <span className="form-required">*</span></label>
              <input 
                type="password" 
                className="form-control" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="Any password works (Dummy)"
                style={{ padding: '12px 14px', fontSize: '14px' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '0.875rem' }}>
              Secure Login
            </button>
          </form>

          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--gov-border)', textAlign: 'center' }}>
            <p style={{ fontSize: '0.8125rem', color: 'var(--gov-text-muted)' }}>
              Don't have an account? <span style={{ color: 'var(--gov-navy)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/register')}>Register here</span>
            </p>
          </div>
        </div>
      </div>

      {/* Footer matching standard theme */}
      <div style={{ padding: '16px', textAlign: 'center', background: 'var(--gov-navy-dark)', color: '#8090a0', fontSize: '0.75rem' }}>
        © 2026 VeriDoc Procurement Portal. All rights reserved.
      </div>
    </div>
  );
}
