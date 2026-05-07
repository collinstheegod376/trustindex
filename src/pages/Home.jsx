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
  const [recentReports, setRecentReports] = useState([])
  const [stats, setStats] = useState({ total: 0, scams: 0, verified: 0 })
  const [userVotes, setUserVotes] = useState({}) // { reportId: voteType }

  useEffect(() => {
    loadDashboard()
  }, [user])

  async function loadDashboard() {
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const [verifiedRes, scamRes, reportsRes, allRes] = await Promise.all([
      supabase.from('tracked_accounts').select('*').eq('status', 'verified').order('trust_score', { ascending: false }).limit(5),
      supabase.from('tracked_accounts').select('*').eq('status', 'scam').order('trust_score', { ascending: true }).limit(5),
      supabase.from('reports').select('*, tracked_accounts(x_handle), profiles(username, x_handle, avatar_url), votes(vote_type)').eq('status', 'approved').gt('created_at', seventyTwoHoursAgo).order('created_at', { ascending: false }).limit(10),
      supabase.from('tracked_accounts').select('id, status')
    ])

    // Process reports to sum votes
    const processedReports = (reportsRes.data || []).map(r => {
      const votes = r.votes || [];
      const upvotes = votes.filter(v => v.vote_type === 1).length;
      const downvotes = votes.filter(v => v.vote_type === -1).length;
      return { ...r, upvotes, downvotes, score: upvotes - downvotes };
    }).sort((a, b) => b.score - a.score).slice(0, 5)

    setTopVerified(verifiedRes.data || [])
    setTopScams(scamRes.data || [])
    setRecentReports(processedReports)

    if (user) {
      const { data: vData } = await supabase.from('votes').select('report_id, vote_type').eq('user_id', user.id)
      const vMap = {}
      vData?.forEach(v => vMap[v.report_id] = v.vote_type)
      setUserVotes(vMap)
    }

    const all = allRes.data || []
    setStats({
      total: all.length,
      scams: all.filter(a => a.status === 'scam').length,
      verified: all.filter(a => a.status === 'verified').length
    })
  }

  async function handleVote(reportId, voteType) {
    if (!user) return alert('Please sign in to vote')

    const currentVote = userVotes[reportId]
    if (currentVote === voteType) {
      // Remove vote
      await supabase.from('votes').delete().eq('report_id', reportId).eq('user_id', user.id)
      setUserVotes(prev => {
        const next = { ...prev }
        delete next[reportId]
        return next
      })
    } else {
      // Upsert vote
      await supabase.from('votes').upsert({ report_id: reportId, user_id: user.id, vote_type: voteType })
      setUserVotes(prev => ({ ...prev, [reportId]: voteType }))
    }
    loadDashboard() // Refresh counts
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
                  <div className="result-handle">
                    <StatusIcon status={account.status} />
                    <a 
                      href={`https://x.com/${account.x_handle}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="external-link"
                    >
                      @{account.x_handle}
                    </a>
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
              <a 
                href={`https://x.com/${a.x_handle}`} 
                target="_blank" 
                rel="noreferrer" 
                className="board-handle external-link"
              >
                @{a.x_handle}
              </a>
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
              <a 
                href={`https://x.com/${a.x_handle}`} 
                target="_blank" 
                rel="noreferrer" 
                className="board-handle external-link"
              >
                @{a.x_handle}
              </a>
              <span className="badge badge-red">{a.trust_score}</span>
            </div>
          ))}
          <Link to="/wall-of-shame" className="btn btn-outline" style={{ width: '100%', marginTop: '20px', borderStyle: 'dashed' }}>
            View Wall of Shame <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Recent Reports */}
      <section className="recent-section" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
        <h2 style={{ marginBottom: '20px' }}>Recent Reports</h2>
        {recentReports.length === 0 && <p className="empty-msg">No reports filed yet. Be the first!</p>}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {recentReports.map((r, i) => (
            <div key={r.id} className="report-row glass-panel" style={{ animation: 'fadeInUp 0.6s ease-out both', animationDelay: `${i * 0.05}s`, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Header: User Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img 
                  src={r.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${r.profiles?.username || 'User'}&background=2979ff&color=fff`} 
                  alt="avatar" 
                  style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)' }}>{r.profiles?.username || 'Anonymous'}</span>
                    <a href={`https://x.com/${r.profiles?.x_handle || r.profiles?.username}`} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                      @{r.profiles?.x_handle || r.profiles?.username || 'anon'}
                    </a>
                    <span style={{ color: 'var(--text-muted)' }}>·</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--accent-red)', fontWeight: 600, marginTop: '2px' }}>
                    Flagging <a href={`https://x.com/${r.tracked_accounts?.x_handle}`} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>@{r.tracked_accounts?.x_handle}</a>
                  </div>
                </div>
              </div>

              {/* Body: Content */}
              <div style={{ paddingLeft: '60px' }}>
                <p style={{ marginBottom: '16px', color: '#e2e8f0', fontSize: '1.1rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                  {r.reason}
                </p>
                {r.notes && (
                  <p style={{ marginBottom: '16px', color: 'var(--text-muted)', fontSize: '0.95rem', fontStyle: 'italic' }}>
                    {r.notes}
                  </p>
                )}
                
                {/* Attached Image */}
                {r.proof_url && (
                  <div style={{ marginBottom: '16px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--panel-border)' }}>
                    <img 
                      src={r.proof_url} 
                      alt="Proof" 
                      style={{ width: '100%', display: 'block', cursor: 'pointer' }}
                      onClick={() => window.open(r.proof_url, '_blank')}
                    />
                  </div>
                )}

                {/* Action Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                    {/* Upvote */}
                    <button 
                      onClick={() => handleVote(r.id, 1)}
                      style={{ background: 'none', border: 'none', color: userVotes[r.id] === 1 ? '#00e676' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: '0.2s', padding: 0 }}
                      className="hover-glow"
                    >
                      <ThumbsUp size={18} fill={userVotes[r.id] === 1 ? 'currentColor' : 'none'} />
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.score > 0 ? r.score : 'Like'}</span>
                    </button>

                    {/* Downvote */}
                    <button 
                      onClick={() => handleVote(r.id, -1)}
                      style={{ background: 'none', border: 'none', color: userVotes[r.id] === -1 ? '#ff3d00' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: '0.2s', padding: 0 }}
                      className="hover-glow"
                    >
                      <ThumbsDown size={18} fill={userVotes[r.id] === -1 ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span className={`badge badge-${r.status === 'approved' ? 'green' : 'yellow'}`}>
                      {r.status}
                    </span>
                    {r.giveaway_url && (
                      <a 
                        href={r.giveaway_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="btn btn-outline" 
                        style={{ padding: '6px 16px', fontSize: '0.85rem', borderRadius: '20px' }}
                      >
                        <LinkIcon size={14} style={{ marginRight: '4px' }} /> View Original Post
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Link to="/recent-reports" className="btn btn-primary" style={{ width: '100%', marginTop: '32px', height: '56px', fontSize: '1.1rem' }}>
          View All Recent Reports <ArrowRight size={20} />
        </Link>
      </section>
    </div>
  )
}
