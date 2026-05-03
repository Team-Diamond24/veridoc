import { useState, useEffect } from 'react';
import { getTenders } from '../api';
import { Link } from 'react-router-dom';
import { StatusPill } from '../components/Badges';

export default function VerdictsPage() {
  const [tenders, setTenders] = useState([]);

  useEffect(() => {
    getTenders().then(r => setTenders(r.data.filter(t => t.status === 'completed'))).catch(console.error);
  }, []);

  return (
    <div>
      <div className="page-header">
        <h2>View Verdicts</h2>
        <div className="breadcrumb">Home › Verdicts</div>
      </div>
      <div className="gov-card">
        <div className="gov-card-header">Completed Evaluations ({tenders.length})</div>
        {tenders.length === 0 ? (
          <div className="text-muted text-center" style={{ padding: 20 }}>
            No completed evaluations. <Link to="/evaluate">Start an evaluation →</Link>
          </div>
        ) : (
          <div className="gov-table-wrap">
            <table className="gov-table">
              <thead>
                <tr><th>Tender Number</th><th>Title</th><th>Authority</th><th>Criteria</th><th>Action</th></tr>
              </thead>
              <tbody>
                {tenders.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.tender_number}</td>
                    <td>{t.title}</td>
                    <td>{t.issuing_authority}</td>
                    <td style={{ textAlign: 'center' }}>{t.criteria_count}</td>
                    <td>
                      <Link to={`/verdicts/${t.id}`} className="btn btn-primary btn-sm">View Matrix</Link>
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
