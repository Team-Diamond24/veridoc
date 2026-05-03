export function VerdictBadge({ verdict }) {
  const map = {
    PASS: { cls: 'badge-pass', icon: '✓', label: 'PASS' },
    FAIL: { cls: 'badge-fail', icon: '✗', label: 'FAIL' },
    REVIEW: { cls: 'badge-review', icon: '⚠', label: 'REVIEW' },
    PENDING: { cls: 'badge-pending', icon: '…', label: 'PENDING' },
  };
  const { cls, icon, label } = map[verdict] || map.PENDING;
  return <span className={`badge ${cls}`}>{icon} {label}</span>;
}

export function ModalBadge({ modal }) {
  const map = {
    MANDATORY: 'badge-mandatory',
    OPTIONAL: 'badge-optional',
    CONDITIONAL: 'badge-conditional',
  };
  return <span className={`badge ${map[modal] || 'badge-pending'}`}>{modal}</span>;
}

export function StatusPill({ status }) {
  return <span className={`status-pill ${status?.toLowerCase()}`}>{status}</span>;
}

export function AxisBar({ label, value }) {
  const cls = value >= 80 ? 'high' : value >= 50 ? 'medium' : 'low';
  return (
    <div className="axis-bar-wrap">
      <div className="axis-bar-label">
        <span>{label}</span>
        <span style={{ fontWeight: 700 }}>{value?.toFixed(0)}/100</span>
      </div>
      <div className="axis-bar-track">
        <div
          className={`axis-bar-fill ${cls}`}
          style={{ width: `${Math.min(value || 0, 100)}%` }}
        />
      </div>
    </div>
  );
}
