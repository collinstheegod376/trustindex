import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, User, ShieldCheck, Menu, X, Loader } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Report from './pages/Report';
import Promote from './pages/Promote';
import HallOfFame from './pages/HallOfFame';
import WallOfShame from './pages/WallOfShame';
import RecentReports from './pages/RecentReports';

function Navigation() {
  const { isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  return (
    <header className="nav-header">
      <Link to="/" className="nav-brand">
        <ShieldAlert color="var(--accent-blue)" size={28} />
        <span>TrustIndex</span>
      </Link>

      <button className="mobile-menu-btn" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <X size={24} color="#f0f0f5" /> : <Menu size={24} color="#f0f0f5" />}
      </button>

      <div className={`nav-links ${isOpen ? 'active' : ''}`}>
        {isAdmin && (
          <Link to="/admin" className="btn btn-outline">
            <ShieldCheck size={18} /> Admin
          </Link>
        )}
        <Link to="/promote" className="btn btn-outline">Add Your Host</Link>
        <Link to="/report" className="btn btn-outline">Report Giveaway</Link>
        <Link to="/profile" className="btn btn-primary">
          <User size={18} /> Profile
        </Link>
      </div>
    </header>
  );
}

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-color)' }}>
        <Loader size={48} color="var(--accent-blue)" className="spinner" />
      </div>
    );
  }

  return (
    <Router>
      {!user ? (
        <div style={{ minHeight: '100vh', background: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
          <header className="nav-header" style={{ justifyContent: 'center' }}>
            <div className="nav-brand">
              <ShieldAlert color="var(--accent-blue)" size={28} />
              <span>TrustIndex</span>
            </div>
          </header>
          <main className="container" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <Profile />
          </main>
        </div>
      ) : (
        <>
          <Navigation />
          <main className="container">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/report" element={<Report />} />
              <Route path="/promote" element={<Promote />} />
              <Route path="/hall-of-fame" element={<HallOfFame />} />
              <Route path="/wall-of-shame" element={<WallOfShame />} />
              <Route path="/recent-reports" element={<RecentReports />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </>
      )}
    </Router>
  );
}

export default App;
