import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Search, ShieldCheck, ShieldAlert, AlertTriangle, TrendingUp, TrendingDown, ArrowRight, Link as LinkIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import './Home.css'

function TrustGauge({ score, status }) {
  const isScam = status === 'scam'
  const isVerified = status === 'verified'

  const color = isScam ? '#ff3d00' : isVerified ? '#00e676' : score >= 70 ? '#00e676' : score >= 31 ? '#ffd600' : '#ff3d00'
  const label = isScam ? 'SCAM' : isVerified ? 'VERIFIED' : score >= 70 ? 'VERIFIED' : score >= 31 ? 'SUSPICIOUS' : 'SCAM'
  const circumference = 2 * Math.PI * 45
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="trust-gauge">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="45" fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text x="50" y="46" textAnchor="middle" fill={color} fontSize="22" fontWeight="800">{score}</text>
        <text x="50" y="62" textAnchor="middle" fill="var(--text-muted)" fontSize="8" fontWeight="600">{label}</text>
      </svg>
    </div>
  )
}

function StatusIcon({ status }) {
  if (status === 'verified') return <ShieldCheck size={18} color="#00e676" />
  if (status === 'scam') return <ShieldAlert size={18} color="#ff3d00" />
  return <AlertTriangle size={18} color="#ffd600" />
}

import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Home() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [topVerified, setTopVerified] = useState([])
  const [topScams, setTopScams] = useState([])
  const [stats, setStats] = useState({ total: 0, scams: 0, verified: 0 })

  useEffect(() => {
    loadDashboard()
  }, [user])

  async function loadDashboard() {
    const [verifiedRes, scamRes, allRes] = await Promise.all([
      supabase.from('tracked_accounts').select('*').eq('status', 'verified').order('trust_score', { ascending: false }).limit(5),
      supabase.from('tracked_accounts').select('*').eq('status', 'scam').order('trust_score', { ascending: true }).limit(5),
      supabase.from('tracked_accounts').select('id, status')
    ])

    setTopVerified(verifiedRes.data || [])
    setTopScams(scamRes.data || [])

    const all = allRes.data || []
    setStats({
      total: all.length,
      scams: all.filter(a => a.status === 'scam').length,
      verified: all.filter(a => a.status === 'verified').length
    })
  }



  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim()) {
        performSearch()
      } else {
        setResults([])
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(delayDebounceFn)
  }, [query])

  async function performSearch() {
    setSearching(true)
    const handle = query.replace('@', '').trim()
    const { data } = await supabase
      .from('tracked_accounts')
      .select('*')
      .ilike('x_handle', `%${handle}%`)
    setResults(data || [])
    setSearching(false)
  }

  async function handleSearch(e) {
    e.preventDefault()
    if (query.trim()) performSearch()
  }

  return (
    <div className="home-page">
      {/* Hero */}
      <section className="hero">
        <div className="hero-glow" />
        <h1>Stop Getting Scammed.</h1>
        <p className="hero-sub">Search any X handle to check their giveaway reputation before you engage.</p>
        <form className="search-bar glass-panel" onSubmit={handleSearch}>
          <Search size={20} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search @username..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="search-input"
          />
          {searching && <span className="spinner" style={{width: '16px', height: '16px', border: '2px solid var(--accent-blue)', borderTopColor: 'transparent', borderRadius: '50%'}}></span>}
        </form>

      </section>

      {/* Search Results */}
      {results.length > 0 && (
        <section className="search-results">
          <h2>Results</h2>
          <div className="results-grid">
            {results.map(account => (
              <div key={account.id} className="result-card glass-panel">
                <div className="result-header">
                  <div className="result-handle" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img 
                      src={`https://unavatar.io/x/${account.x_handle}`} 
                      alt={account.x_handle}
                      style={{ width: '32px', height: '32px', borderRadius: '50%', border: `2px solid ${account.status === 'verified' ? 'var(--accent-green)' : account.status === 'scam' ? 'var(--accent-red)' : '#ffd600'}`, objectFit: 'cover' }}
                      onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${account.x_handle}&background=1E293B&color=fff`; }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <StatusIcon status={account.status} />
                      <a 
                        href={`https://x.com/${account.x_handle}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="external-link"
                        style={{ fontSize: '1.2rem', fontWeight: 'bold' }}
                      >
                        @{account.x_handle}
                      </a>
                    </div>
                  </div>
                  <span className={`badge badge-${account.status === 'verified' ? 'green' : account.status === 'scam' ? 'red' : 'yellow'}`}>
                    {account.status}
                  </span>
                </div>
                <TrustGauge score={account.trust_score} status={account.status} />
                <Link to={`/report?handle=${account.x_handle}`} className="btn btn-outline" style={{ width: '100%' }}>
                  Report This Account <ArrowRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {results.length === 0 && query && !searching && (
        <section className="search-results">
          <div className="glass-panel no-results">
            <AlertTriangle size={32} color="#ffd600" />
            <h3>No records found for "@{query.replace('@', '')}"</h3>
            <p>This account hasn't been tracked yet. Be the first to report it.</p>
            <Link to={`/report?handle=${query.replace('@', '')}`} className="btn btn-primary">
              Submit a Report <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      )}

      {/* Stats Bar */}
      <section className="stats-bar">
        <div className="stat-card glass-panel">
          <span className="stat-num">{stats.total}</span>
          <span className="stat-label">Tracked Accounts</span>
        </div>
        <div className="stat-card glass-panel">
          <span className="stat-num" style={{ color: 'var(--accent-green)' }}>{stats.verified}</span>
          <span className="stat-label">Verified Legit</span>
        </div>
        <div className="stat-card glass-panel">
          <span className="stat-num" style={{ color: 'var(--accent-red)' }}>{stats.scams}</span>
          <span className="stat-label">Confirmed Scams</span>
        </div>
      </section>

      {/* Leaderboards */}
      <section className="leaderboards">
        <div className="board glass-panel">
          <h3><TrendingUp size={20} color="var(--accent-green)" /> Hall of Fame</h3>
          <p className="board-sub">Top verified giveaway accounts</p>
          {topVerified.length === 0 && <p className="empty-msg">No verified accounts yet.</p>}
          {topVerified.map((a, i) => (
            <div key={a.id} className="board-row">
              <span className="board-rank">#{i + 1}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <img 
                  src={`https://unavatar.io/x/${a.x_handle}`} 
                  alt={a.x_handle}
                  style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid var(--accent-green)', objectFit: 'cover' }}
                  onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${a.x_handle}&background=1E293B&color=fff`; }}
                />
                <a 
                  href={`https://x.com/${a.x_handle}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="board-handle external-link"
                >
                  @{a.x_handle}
                </a>
              </div>
              <span className="badge badge-green">{a.trust_score}</span>
            </div>
          ))}
          <Link to="/hall-of-fame" className="btn btn-outline" style={{ width: '100%', marginTop: '20px', borderStyle: 'dashed' }}>
            View Hall of Fame <ArrowRight size={16} />
          </Link>
        </div>
        <div className="board glass-panel">
          <h3><TrendingDown size={20} color="var(--accent-red)" /> Wall of Shame</h3>
          <p className="board-sub">Confirmed scam accounts</p>
          {topScams.length === 0 && <p className="empty-msg">No scam accounts flagged yet.</p>}
          {topScams.map((a, i) => (
            <div key={a.id} className="board-row">
              <span className="board-rank">#{i + 1}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <img 
                  src={`https://unavatar.io/x/${a.x_handle}`} 
                  alt={a.x_handle}
                  style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid var(--accent-red)', objectFit: 'cover' }}
                  onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${a.x_handle}&background=1E293B&color=fff`; }}
                />
                <a 
                  href={`https://x.com/${a.x_handle}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="board-handle external-link"
                >
                  @{a.x_handle}
                </a>
              </div>
              <span className="badge badge-red">{a.trust_score}</span>
            </div>
          ))}
          <Link to="/wall-of-shame" className="btn btn-outline" style={{ width: '100%', marginTop: '20px', borderStyle: 'dashed' }}>
            View Wall of Shame <ArrowRight size={16} />
          </Link>
        </div>
      </section>


    </div>
  )
}
