import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, User, ShieldCheck, Menu, X, Loader } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Report from './pages/Report';
import Promote from './pages/Promote';
import Support from './pages/Support';
import HallOfFame from './pages/HallOfFame';
import WallOfShame from './pages/WallOfShame';
import RecentReports from './pages/RecentReports';
import { supabase } from './supabase';

function Navigation() {
  const { user, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewMsg, setHasNewMsg] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Notification logic
  useEffect(() => {
    if (!user) return;

    const checkNew = async () => {
      const { data } = await supabase
        .from('support_chats')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_admin', true)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (data?.[0]) {
        const lastRead = localStorage.getItem(`last_read_${user.id}`);
        if (lastRead !== data[0].id) setHasNewMsg(true);
      }
    };

    checkNew();

    const sub = supabase
      .channel('nav_notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_chats' }, payload => {
        if (payload.new.user_id === user.id && payload.new.is_admin) {
          setHasNewMsg(true);
        }
      })
      .subscribe();

    return () => supabase.removeChannel(sub);
  }, [user, location.pathname]);

  useEffect(() => {
    if (location.pathname === '/support') setHasNewMsg(false);
  }, [location.pathname]);

  return (
    <header className="nav-header">
      <Link to="/" className="nav-brand">
        <ShieldAlert color="var(--accent-blue)" size={28} />
        <span>TrustIndex</span>
      </Link>

      <button className="mobile-menu-btn" onClick={() => setIsOpen(!isOpen)} style={{ position: 'relative' }}>
        {isOpen ? <X size={24} color="#f0f0f5" /> : <Menu size={24} color="#f0f0f5" />}
        {hasNewMsg && !isOpen && (
          <div style={{ position: 'absolute', top: 0, right: 0, width: '12px', height: '12px', background: '#ff3d00', borderRadius: '50%', border: '2px solid var(--panel-bg)' }} />
        )}
      </button>

      <div className={`nav-links ${isOpen ? 'active' : ''}`}>
        {isAdmin && (
          <Link to="/admin" className="btn btn-outline">
            <ShieldCheck size={18} /> Admin
          </Link>
        )}
        <Link to="/promote?type=promote" className="btn btn-outline">Add a Host</Link>
        <Link to="/promote?type=report" className="btn btn-outline" style={{ color: 'var(--accent-red)', borderColor: 'rgba(255, 61, 0, 0.3)' }}>Report a Host</Link>
        <Link to="/report" className="btn btn-outline">Report Giveaway</Link>
        
        <Link to="/support" className="btn btn-outline" style={{ position: 'relative' }}>
          Support Chat
          {hasNewMsg && (
            <div style={{ position: 'absolute', top: '-5px', right: '-5px', width: '10px', height: '10px', background: '#ff3d00', borderRadius: '50%', boxShadow: '0 0 10px rgba(255, 61, 0, 0.5)' }} />
          )}
        </Link>

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
          <Route path="/support" element={<Support />} />
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
