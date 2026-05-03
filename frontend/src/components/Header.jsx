export default function Header() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <header className="gov-header">
      <div className="emblem" title="Government of India">🇮🇳</div>
      <div className="header-text">
        <h1>VERIDOC</h1>
        <p>AI-Powered Tender Evaluation System | Central Reserve Police Force (CRPF)</p>
      </div>
      <div className="header-right">
        <span>Date: {dateStr}</span>
        <span className="status-pill">● System Operational</span>
        <span>Officer: Procurement Division</span>
      </div>
    </header>
  );
}
