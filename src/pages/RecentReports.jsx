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
      .select('*, tracked_accounts(x_handle), profiles(username, x_handle, avatar_url), votes(vote_type)')
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

      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <MessageSquare size={28} color="var(--accent-blue)" />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Community Reports</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Real-time reports from the last 72 hours.</p>
          </div>
        </div>

        {loading ? (
          <div className="spinner" style={{ margin: '40px auto' }}></div>
        ) : (
          <div className="reports-feed">
            {reports.map((r, i) => (
              <div key={r.id} className="report-row glass-panel" style={{ animation: 'fadeInUp 0.6s ease-out both', animationDelay: `${i * 0.05}s`, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
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
                          View Original Post
                        </a>
                      )}
                      {isAdmin && (
                        <button className="btn btn-danger" style={{ padding: '6px 16px', fontSize: '0.85rem', borderRadius: '20px' }} onClick={() => handleDelete(r.id)}>
                          Delete
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
