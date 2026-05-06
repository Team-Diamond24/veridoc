import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { toast } from 'react-toastify';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleRegister = (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please enter both username and password.');
      return;
    }

    // Dummy registration logic
    let role = 'USER';
    if (username.toLowerCase() === 'admin') {
      role = 'ADMIN';
    }

    login(username, role);
    toast.success(`Account created successfully! Logged in as ${role}`);
    navigate('/');
  };

  return (
    <div style={{ maxWidth: 400, margin: '80px auto' }}>
      <div className="gov-card">
        <div className="gov-card-header" style={{ fontSize: '18px', borderBottom: 'none' }}>
          Register for VeriDoc
        </div>
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input 
              type="text" 
              className="form-input" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              placeholder="Choose a username"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="Choose a password"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}>
            Register
          </button>
        </form>
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: '0.75rem' }}>
          Already have an account? <span style={{ color: '#2563eb', cursor: 'pointer' }} onClick={() => navigate('/login')}>Login here</span>
        </div>
      </div>
    </div>
  );
}
