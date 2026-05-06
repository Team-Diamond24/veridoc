import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 120000,
});

// Tenders
export const getTenders = () => api.get('/api/tender/');
export const getTender = (id) => api.get(`/api/tender/${id}`);
export const uploadTender = (formData) => api.post('/api/tender/upload', formData);
export const getTenderCriteria = (id) => api.get(`/api/tender/${id}/criteria`);
export const updateCriterion = (id, data) => api.put(`/api/tender/criteria/${id}`, data);
export const deleteTender = (id) => api.delete(`/api/tender/${id}`);
export const generateDummyTender = () => api.post('/api/tender/generate-dummy');

// Bidders
export const getBidders = (tenderId) => api.get(`/api/bidder/tender/${tenderId}`);
export const getBidder = (id) => api.get(`/api/bidder/${id}`);
export const createBidder = (data) => api.post('/api/bidder/create', data);
export const uploadBidderDocs = (bidderId, formData) =>
  api.post(`/api/bidder/${bidderId}/upload-documents`, formData);
export const getBidderDocs = (bidderId) => api.get(`/api/bidder/${bidderId}/documents`);
export const deleteBidder = (id) => api.delete(`/api/bidder/${id}`);

// Evaluation
export const triggerEvaluation = (tenderId) => api.post(`/api/tender/${tenderId}/evaluate`);
export const getVerdictsSummary = (tenderId) => api.get(`/api/tender/${tenderId}/verdicts/summary`);
export const getBidderVerdicts = (bidderId) => api.get(`/api/bidder/${bidderId}/verdicts`);
export const getVerdictDetail = (verdictId) => api.get(`/api/verdict/${verdictId}/detail`);
export const overrideVerdict = (verdictId, data) => api.post(`/api/verdict/${verdictId}/override`, data);
export const checkCollusion = (tenderId) => api.get(`/api/tender/${tenderId}/collusion-check`);

// Reports & Audit
export const getDashboardStats = () => api.get('/api/dashboard/stats');
export const getAuditLog = (limit = 100) => api.get(`/api/audit-log?limit=${limit}`);
export const getCorrections = () => api.get('/api/corrections');
export const validateCorrection = (id) => api.post(`/api/corrections/${id}/validate`);
export const getBiasReport = () => api.get('/api/admin/bias-dashboard');
export const exportReport = (tenderId) =>
  api.get(`/api/report/${tenderId}`, { responseType: 'blob' });

export default api;
