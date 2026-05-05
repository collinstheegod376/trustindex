import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Search, ShieldCheck, ShieldAlert, AlertTriangle, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import './Home.css'

function TrustGauge({ score }) {
  const color = score >= 70 ? '#00e676' : score >= 31 ? '#ffd600' : '#ff3d00'
  const label = score >= 70 ? 'VERIFIED' : score >= 31 ? 'SUSPICIOUS' : 'SCAM'
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

import { ArrowBigUp, ArrowBigDown } from 'lucide-react'
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
    const [verifiedRes, scamRes, reportsRes, allRes] = await Promise.all([
      supabase.from('tracked_accounts').select('*').eq('status', 'verified').order('trust_score', { ascending: false }).limit(5),
      supabase.from('tracked_accounts').select('*').eq('status', 'scam').order('trust_score', { ascending: true }).limit(5),
      supabase.from('reports').select('*, tracked_accounts(x_handle), profiles(username), votes(vote_type)').eq('status', 'approved').order('created_at', { ascending: false }).limit(10),
      supabase.from('tracked_accounts').select('id, status')
    ])

    // Process reports to sum votes
    const processedReports = (reportsRes.data || []).map(r => {
      const upvotes = r.votes.filter(v => v.vote_type === 1).length
      const downvotes = r.votes.filter(v => v.vote_type === -1).length
      return { ...r, voteCount: upvotes - downvotes }
    })

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

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    const handle = query.replace('@', '').trim()
    const { data } = await supabase
      .from('tracked_accounts')
      .select('*')
      .ilike('x_handle', `%${handle}%`)
    setResults(data || [])
    setSearching(false)
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
          <button type="submit" className="btn btn-primary" disabled={searching}>
            {searching ? 'Searching...' : 'Check Trust'}
          </button>
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
                    <span>@{account.x_handle}</span>
                  </div>
                  <span className={`badge badge-${account.status === 'verified' ? 'green' : account.status === 'scam' ? 'red' : 'yellow'}`}>
                    {account.status}
                  </span>
                </div>
                <TrustGauge score={account.trust_score} />
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
              <span className="board-handle">@{a.x_handle}</span>
              <span className="badge badge-green">{a.trust_score}</span>
            </div>
          ))}
        </div>
        <div className="board glass-panel">
          <h3><TrendingDown size={20} color="var(--accent-red)" /> Wall of Shame</h3>
          <p className="board-sub">Confirmed scam accounts</p>
          {topScams.length === 0 && <p className="empty-msg">No scam accounts flagged yet.</p>}
          {topScams.map((a, i) => (
            <div key={a.id} className="board-row">
              <span className="board-rank">#{i + 1}</span>
              <span className="board-handle">@{a.x_handle}</span>
              <span className="badge badge-red">{a.trust_score}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Reports */}
      <section className="recent-section">
        <h2>Recent Reports</h2>
        {recentReports.length === 0 && <p className="empty-msg">No reports filed yet. Be the first!</p>}
        {recentReports.map(r => (
          <div key={r.id} className="report-row glass-panel report-with-vote">
            <div className="vote-column">
              <button 
                className={`vote-btn ${userVotes[r.id] === 1 ? 'active-up' : ''}`}
                onClick={() => handleVote(r.id, 1)}
              >
                <ArrowBigUp size={24} fill={userVotes[r.id] === 1 ? 'currentColor' : 'none'} />
              </button>
              <span className="vote-count">{r.voteCount}</span>
              <button 
                className={`vote-btn ${userVotes[r.id] === -1 ? 'active-down' : ''}`}
                onClick={() => handleVote(r.id, -1)}
              >
                <ArrowBigDown size={24} fill={userVotes[r.id] === -1 ? 'currentColor' : 'none'} />
              </button>
            </div>
            <div className="report-content">
              <div className="report-meta">
                <span className="report-reporter">@{r.profiles?.username || 'anonymous'}</span>
                <span className="report-arrow">→</span>
                <span className="report-target">@{r.tracked_accounts?.x_handle || 'unknown'}</span>
              </div>
              <p className="report-reason">{r.reason}</p>
              {r.notes && <p className="report-notes">{r.notes}</p>}
              <div className="report-footer">
                <span className={`badge badge-${r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'yellow'}`}>
                  {r.status}
                </span>
                <span className="report-date">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
