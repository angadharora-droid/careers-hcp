import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import { ToastProvider } from './components/Toast.jsx';
import JobList from './pages/JobList.jsx';
import JobDetail from './pages/JobDetail.jsx';
import ApplyForm from './pages/ApplyForm.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ScrollToTop />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<JobList />} />
            <Route path="/jobs/:job_code" element={<JobDetail />} />
            <Route path="/jobs/:job_code/apply" element={<ApplyForm />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
