import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getTenders, deleteTender } from '../api';
import { StatusPill } from '../components/Badges';
import { toast } from 'react-toastify';

export default function TendersList() {
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);

  const load = () => {
    getTenders().then(r => setTenders(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id, num) => {
    if (!confirm(`Delete tender ${num}? This cannot be undone.`)) return;
    try {
      await deleteTender(id);
      toast.success('Tender deleted.');
      load();
    } catch { toast.error('Delete failed.'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>All Tenders</h2>
          <div className="breadcrumb">Home › Tenders</div>
        </div>
        <Link to="/tenders/upload" className="btn btn-saffron">⬆ Upload New Tender</Link>
      </div>

      <div className="gov-card">
        <div className="gov-card-header">
          Tender Register ({tenders.length} records)
        </div>
        {loading ? (
          <div className="text-center" style={{ padding: 30 }}>Loading...</div>
        ) : tenders.length === 0 ? (
          <div className="text-center text-muted" style={{ padding: 30 }}>
            No tenders found. <Link to="/tenders/upload">Upload your first tender →</Link>
          </div>
        ) : (
          <div className="gov-table-wrap">
            <table className="gov-table">
              <thead>
                <tr>
                  <th>S.No.</th>
                  <th>Tender Number</th>
                  <th>Title</th>
                  <th>Issuing Authority</th>
                  <th>Deadline</th>
                  <th>Criteria</th>
                  <th>Status</th>
                  <th>Uploaded On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenders.map((t, i) => (
                  <tr key={t.id}>
                    <td>{i + 1}</td>
                    <td><Link to={`/tenders/${t.id}`} style={{ fontWeight: 600 }}>{t.tender_number}</Link></td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</td>
                    <td>{t.issuing_authority}</td>
                    <td>{t.deadline || '—'}</td>
                    <td style={{ textAlign: 'center' }}>{t.criteria_count}</td>
                    <td><StatusPill status={t.status} /></td>
                    <td>{new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                    <td>
                      <div className="flex gap-8">
                        <Link to={`/tenders/${t.id}`} className="btn btn-outline btn-sm">View</Link>
                        <Link to={`/evaluate?tender_id=${t.id}`} className="btn btn-primary btn-sm">Evaluate</Link>
                        {user?.role === 'ADMIN' && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id, t.tender_number)}>Del</button>
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
    </div>
  );
}
