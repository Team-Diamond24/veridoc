import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* All routes use the ForensicLayout shell */}
        <Route element={<ForensicLayout />}>
          <Route path="/"                    element={<Dashboard />} />
          <Route path="/tenders"             element={<TendersList />} />
          <Route path="/tenders/upload"      element={<TenderUpload />} />
          <Route path="/tenders/:id"         element={<TenderDetail />} />
          <Route path="/evaluate"            element={<EvaluatePage />} />
          <Route path="/verdicts"            element={<VerdictsPage />} />
          <Route path="/verdicts/:tenderId"  element={<VerdictMatrix />} />
          <Route path="/bidder/:bidderId"    element={<BidderDetail />} />
          <Route path="/audit"               element={<AuditLog />} />
          <Route path="/corrections"         element={<Corrections />} />
          <Route path="/admin"               element={<AdminDashboard />} />
        </Route>
      </Routes>

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
