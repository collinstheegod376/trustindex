import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function RecentReports() {
  const { user, isAdmin } = useAuth()
  const [reports, setReports] = useState([])
  const [userVotes, setUserVotes] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReports()
  }, [user])

  async function fetchReports() {
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    
    const { data } = await supabase
      .from('reports')
      .select('*, tracked_accounts(x_handle), profiles(username, x_handle), votes(vote_type)')
      .eq('status', 'approved')
      .gt('created_at', seventyTwoHoursAgo)
      .order('created_at', { ascending: false })

    if (data) {
      const processed = data.map(r => {
        const votes = r.votes || []
        const score = votes.reduce((acc, v) => acc + (v.vote_type || 0), 0)
        return { ...r, score }
      })
      setReports(processed)

      if (user) {
        const myVotes = {}
        data.forEach(r => {
          const v = (r.votes || []).find(v => v.user_id === user.id)
          if (v) myVotes[r.id] = v.vote_type
        })
        setUserVotes(myVotes)
      }
    }
    setLoading(false)
  }

  async function handleVote(reportId, type) {
    if (!user) return alert('Sign in to vote')
    const current = userVotes[reportId]
    const newType = current === type ? 0 : type

    const { error } = await supabase.from('votes').upsert({
      user_id: user.id,
      report_id: reportId,
      vote_type: newType
    }, { onConflict: 'user_id,report_id' })

    if (!error) fetchReports()
  }

  async function handleDelete(reportId) {
    if (!window.confirm('Are you sure you want to delete this report from the community feed?')) return;
    const { error } = await supabase.from('reports').delete().eq('id', reportId);
    if (!error) fetchReports();
    else alert('Error: ' + error.message);
  }

  return (
    <div className="container" style={{ animation: 'fadeInUp 0.8s ease-out both' }}>
      <Link to="/" className="btn btn-outline" style={{ marginBottom: '32px' }}>
        <ArrowLeft size={18} /> Back to Dashboard
      </Link>

      <div className="glass-panel" style={{ padding: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
          <MessageSquare size={32} color="var(--accent-blue)" />
          <div>
            <h1 style={{ margin: 0 }}>Community Reports</h1>
            <p style={{ color: 'var(--text-muted)' }}>Real-time reports from the last 72 hours.</p>
          </div>
        </div>

        {loading ? (
          <div className="spinner" style={{ margin: '40px auto' }}></div>
        ) : (
          <div className="reports-feed">
            {reports.map((r, i) => (
              <div key={r.id} className="report-row glass-panel report-with-vote" style={{ animation: 'fadeInUp 0.6s ease-out both', animationDelay: `${i * 0.05}s`, marginBottom: '24px' }}>
                <div className="vote-column">
                  <button className={`vote-btn upvote ${userVotes[r.id] === 1 ? 'active' : ''}`} onClick={() => handleVote(r.id, 1)}>
                    <ThumbsUp size={20} fill={userVotes[r.id] === 1 ? 'currentColor' : 'none'} />
                  </button>
                  <span className="vote-count">{r.score}</span>
                  <button className={`vote-btn downvote ${userVotes[r.id] === -1 ? 'active' : ''}`} onClick={() => handleVote(r.id, -1)}>
                    <ThumbsDown size={20} fill={userVotes[r.id] === -1 ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <div className="report-content">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <a 
                        href={`https://x.com/${r.profiles?.x_handle || r.profiles?.username}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        style={{ color: 'var(--accent-blue)', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}
                        className="hover-glow"
                      >
                        @{r.profiles?.username}
                      </a>
                      <span style={{ color: 'var(--text-muted)' }}>→</span>
                      <a 
                        href={`https://x.com/${r.tracked_accounts?.x_handle}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        style={{ fontSize: '1.2rem', fontWeight: 800, color: 'inherit', textDecoration: 'none' }}
                        className="hover-glow"
                      >
                        @{r.tracked_accounts?.x_handle}
                      </a>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  
                  <p style={{ marginBottom: '12px', color: '#e2e8f0', fontSize: '1.1rem', lineHeight: '1.6' }}>{r.reason}</p>
                  {r.notes && <p style={{ marginBottom: '16px', color: 'var(--text-muted)', fontSize: '0.95rem', fontStyle: 'italic' }}>{r.notes}</p>}
                  
                  {r.proof_url && (
                    <div style={{ marginBottom: '20px' }}>
                      <img 
                        src={r.proof_url} 
                        alt="Proof" 
                        style={{ width: '100%', borderRadius: '12px', border: '1px solid var(--panel-border)', cursor: 'pointer' }}
                        onClick={() => window.open(r.proof_url, '_blank')}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <span className={`badge badge-${r.status === 'approved' ? 'green' : 'yellow'}`}>
                        {r.status}
                      </span>
                      {r.giveaway_url && (
                        <a 
                          href={r.giveaway_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="btn btn-outline" 
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          View Original Post
                        </a>
                      )}
                      {isAdmin && (
                        <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleDelete(r.id)}>
                          Delete Report
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
