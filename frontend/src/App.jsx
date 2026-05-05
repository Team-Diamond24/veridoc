import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ForensicLayout from './components/ForensicLayout';

import Dashboard from './pages/Dashboard';
import TendersList from './pages/TendersList';
import TenderUpload from './pages/TenderUpload';
import TenderDetail from './pages/TenderDetail';
import EvaluatePage from './pages/EvaluatePage';
import VerdictsPage from './pages/VerdictsPage';
import VerdictMatrix from './pages/VerdictMatrix';
import BidderDetail from './pages/BidderDetail';
import AuditLog from './pages/AuditLog';
import Corrections from './pages/Corrections';
import AdminDashboard from './pages/AdminDashboard';

/* Legacy VERIDOC shell — used for all existing pages */
function LegacyLayout() {
  return (
    <>
      <Header />
      <Sidebar />
      <main className="gov-main">
        <Outlet />
      </main>
      <footer className="gov-footer">
        VERIDOC v1.0 — AI-Powered Tender Evaluation System | CRPF Procurement Division |
        Built under GFR 2017 Compliance | Team Diamond
      </footer>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Forensic layout: new mockup-style screens ── */}
        <Route element={<ForensicLayout />}>
          <Route path="/tenders/upload"      element={<TenderUpload />} />
          <Route path="/verdicts/:tenderId"  element={<VerdictMatrix />} />
        </Route>

        {/* ── Legacy layout: existing VERIDOC screens ── */}
        <Route element={<LegacyLayout />}>
          <Route path="/"                    element={<Dashboard />} />
          <Route path="/tenders"             element={<TendersList />} />
          <Route path="/tenders/:id"         element={<TenderDetail />} />
          <Route path="/evaluate"            element={<EvaluatePage />} />
          <Route path="/verdicts"            element={<VerdictsPage />} />
          <Route path="/bidder/:bidderId"    element={<BidderDetail />} />
          <Route path="/audit"               element={<AuditLog />} />
          <Route path="/corrections"         element={<Corrections />} />
          <Route path="/admin"               element={<AdminDashboard />} />
        </Route>
      </Routes>

      {/* Toast lives outside Routes — works for both layouts */}
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        theme="light"
        toastStyle={{ fontSize: 13 }}
      />
    </BrowserRouter>
  );
}
