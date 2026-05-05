import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { ShieldAlert, User, ShieldCheck } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Report from './pages/Report';

function App() {
  const { isAdmin } = useAuth();

  return (
    <Router>
      <header className="nav-header">
        <Link to="/" className="nav-brand">
          <ShieldAlert color="#2979ff" size={28} />
          <span>TrustIndex</span>
        </Link>
        <div className="nav-links">
          {isAdmin && (
            <Link to="/admin" className="btn btn-outline">
              <ShieldCheck size={18} /> Admin
            </Link>
          )}
          <Link to="/report" className="btn btn-outline">Report Giveaway</Link>
          <Link to="/profile" className="btn btn-primary">
            <User size={18} /> Profile
          </Link>
        </div>
      </header>
      
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/report" element={<Report />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
