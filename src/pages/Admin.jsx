import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabase'
import { ShieldCheck, ShieldAlert, AlertTriangle, ArrowLeft, MessageSquare, Send, Search } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Admin() {
  const { user, isAdmin } = useAuth()
  const [reports, setReports] = useState([])
  const [accounts, setAccounts] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [supportChats, setSupportChats] = useState([])
  const [adminReplies, setAdminReplies] = useState({}) // user_id -> message
  
  // Manual add state
  const [newHandle, setNewHandle] = useState('')
  const [newStatus, setNewStatus] = useState('scam')
  const [newScore, setNewScore] = useState(10)
  const [isAdding, setIsAdding] = useState(false)
  const [accountSearch, setAccountSearch] = useState('')

  useEffect(() => {
    if (isAdmin) {
      fetchData()
      
      const sub = supabase
        .channel('admin_chats')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_chats' }, () => {
          fetchData()
        })
        .subscribe()

      return () => supabase.removeChannel(sub)
    }
  }, [isAdmin])

  async function fetchData() {
    // Increase range to 25h to avoid any timezone/drift issues
    const rangeAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    
    const [repsRes, accsRes, subsRes, chatsRes] = await Promise.all([
      supabase.from('reports').select('*, tracked_accounts(x_handle, status), profiles(username)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('tracked_accounts').select('*').order('trust_score', { ascending: true }),
      supabase.from('host_submissions').select('*, profiles(username)').order('created_at', { ascending: false }),
      supabase.from('support_chats').select('*, profiles(username)').gt('created_at', rangeAgo).order('created_at', { ascending: true })
    ])

    if (chatsRes.error) console.error('Chats Error:', chatsRes.error)
    if (subsRes.error) console.error('Submissions Error:', subsRes.error)
    console.log('Fetched chats:', chatsRes.data?.length)

    setReports(repsRes.data || [])
    setAccounts(accsRes.data || [])
    setSubmissions(subsRes.data || [])
    setSupportChats(chatsRes.data || [])
  }

  async function handleAdminReply(targetUserId) {
    const reply = adminReplies[targetUserId]
    if (!reply?.trim()) return

    const { error } = await supabase.from('support_chats').insert([
      { user_id: targetUserId, message: reply.trim(), is_admin: true }
    ])

    if (!error) {
      setAdminReplies(prev => ({ ...prev, [targetUserId]: '' }))
      fetchData()
    }
  }

  async function handleHostSubmission(subId, handle, action, subType) {
    try {
      if (action === 'approve') {
        const status = subType === 'report' ? 'scam' : 'verified'
        const score = subType === 'report' ? 10 : 90
        
        // Add to tracked accounts
        const { error: accError } = await supabase.from('tracked_accounts').insert([{
          x_handle: handle,
          status: status,
          trust_score: score
        }])
        if (accError) throw accError
      }

      if (action === 'reject') {
        const { error: delError } = await supabase
          .from('host_submissions')
          .delete()
          .eq('id', subId)
        if (delError) throw delError
      } else {
        const { error: subError } = await supabase
          .from('host_submissions')
          .update({ status: action === 'approve' ? 'approved' : 'rejected' })
          .eq('id', subId)
        if (subError) throw subError
      }
      
      fetchData()
    } catch (error) {
      alert('Error: ' + error.message)
    }
  }

  async function handleReportAction(reportId, accountId, action) {
    try {
      if (action === 'reject') {
        const { error: delError } = await supabase.from('reports').delete().eq('id', reportId)
        if (delError) throw delError
        fetchData()
        return
      }

      if (action === 'approve_scam') {
        const { error: accError } = await supabase.from('tracked_accounts').update({ 
          status: 'scam', 
          trust_score: 10 
        }).eq('id', accountId)
        if (accError) throw accError
      }

      const { error: repError } = await supabase.from('reports').update({ status: 'approved' }).eq('id', reportId)
      if (repError) throw repError
      
      fetchData()
    } catch (error) {
      alert('Error performing action: ' + error.message)
    }
  }

  async function handleAddAccount(e) {
    e.preventDefault()
    if (!newHandle.trim()) return
    setIsAdding(true)
    const cleanHandle = newHandle.replace('@', '').trim()
    
    // Check if exists
    const { data: existing } = await supabase.from('tracked_accounts').select('id').eq('x_handle', cleanHandle).single()
    if (existing) {
      alert('Account already tracked. Please use the table below to update it.')
      setIsAdding(false)
      return
    }

    const { error } = await supabase.from('tracked_accounts').insert([{
      x_handle: cleanHandle,
      status: newStatus,
      trust_score: newScore
    }])

    if (error) alert(error.message)
    else {
      setNewHandle('')
      fetchData()
    }
    setIsAdding(false)
  }

  if (!isAdmin) {
    return (
      <div className="glass-panel text-center" style={{ margin: '40px auto', maxWidth: '500px', padding: '40px' }}>
        <ShieldAlert size={48} color="#ff3d00" />
        <h2 style={{ marginTop: '16px' }}>Access Denied</h2>
        <p>You must be an administrator to view this page.</p>
      </div>
    )
  }

  return (
    <div className="container" style={{ animation: 'fadeInUp 0.8s ease-out both' }}>
      <Link to="/" className="btn btn-outline" style={{ marginBottom: '32px' }}>
        <ArrowLeft size={18} /> Back to Dashboard
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <ShieldCheck size={36} color="var(--accent-blue)" />
        <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
      </div>

      <section className="glass-panel" style={{ marginBottom: '40px' }}>
        <h2 style={{ marginBottom: '20px' }}><MessageSquare size={20} /> Support Inbox (24h)</h2>
        {Array.from(new Set(supportChats.map(c => c.user_id))).length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>No recent chat activity.</p>
        )}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {Array.from(new Set(supportChats.map(c => c.user_id))).map(uid => {
            const userMessages = supportChats.filter(c => c.user_id === uid)
            const firstUserMsg = userMessages.find(m => m.profiles?.username)
            const displayName = firstUserMsg ? `@${firstUserMsg.profiles.username}` : `User ${uid.slice(0, 5)}`
            
            return (
            <div key={uid} style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
              <div style={{ marginBottom: '16px', fontWeight: 'bold', color: 'var(--accent-blue)' }}>{displayName}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', marginBottom: '16px', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                {userMessages.map(c => (
                  <div key={c.id} style={{ alignSelf: c.is_admin ? 'flex-end' : 'flex-start', color: c.is_admin ? 'var(--accent-green)' : 'white', fontSize: '0.9rem' }}>
                    <strong>{c.is_admin ? 'Admin' : displayName}:</strong> {c.message}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Reply to user..." 
                  value={adminReplies[uid] || ''}
                  onChange={e => setAdminReplies({ ...adminReplies, [uid]: e.target.value })}
                  style={{ margin: 0 }}
                />
                <button className="btn btn-primary" onClick={() => handleAdminReply(uid)}>
                  <Send size={18} />
                </button>
              </div>
            </div>
            )
          })}
        </div>
      </section>
      
      <section className="glass-panel" style={{ marginBottom: '40px' }}>
        <h2 style={{ marginBottom: '20px' }}>Manually Add Account</h2>
        <form onSubmit={handleAddAccount} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="input-group" style={{ margin: 0, flex: 1, minWidth: '200px' }}>
            <label className="input-label">X Handle</label>
            <input type="text" className="input-field" placeholder="e.g. elonmusk" value={newHandle} onChange={e=>setNewHandle(e.target.value)} required />
          </div>
          <div className="input-group" style={{ margin: 0, width: '150px' }}>
            <label className="input-label">Status</label>
            <select className="input-field" value={newStatus} onChange={e => {
              setNewStatus(e.target.value)
              setNewScore(e.target.value === 'scam' ? 10 : e.target.value === 'verified' ? 90 : 50)
            }}>
              <option value="scam">Scam (Red)</option>
              <option value="verified">Verified (Green)</option>
              <option value="pending">Pending (Yellow)</option>
            </select>
          </div>
          <div className="input-group" style={{ margin: 0, width: '100px' }}>
            <label className="input-label">Score (0-100)</label>
            <input type="number" min="0" max="100" className="input-field" value={newScore} onChange={e=>setNewScore(Number(e.target.value))} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={isAdding} style={{ height: '45px' }}>
            {isAdding ? 'Adding...' : 'Add Account'}
          </button>
        </form>
      </section>

      <section className="glass-panel" style={{ marginBottom: '40px' }}>
        <h2 style={{ marginBottom: '20px' }}>Pending Reports ({reports.length})</h2>
        {reports.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No pending reports.</p>}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {reports.map(r => (
            <div key={r.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <strong>@{r.tracked_accounts.x_handle}</strong> reported by <em>{r.profiles?.username || `User ${r.user_id?.slice(0,5)}`}</em>
                <span className="badge badge-yellow">{r.status}</span>
              </div>
              <p><strong>Reason:</strong> {r.reason}</p>
              <p><strong>URL:</strong> <a href={r.giveaway_url} target="_blank" rel="noreferrer">{r.giveaway_url}</a></p>
              {r.notes && <p><strong>Notes:</strong> {r.notes}</p>}
              {r.proof_url && <p><strong>Proof:</strong> <a href={r.proof_url} target="_blank" rel="noreferrer">{r.proof_url}</a></p>}
              
              <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                <button className="btn btn-danger" onClick={() => handleReportAction(r.id, r.tracked_account_id, 'approve_scam')}>
                  <ShieldAlert size={16} /> Accept Report
                </button>
                <button className="btn btn-outline" onClick={() => handleReportAction(r.id, r.tracked_account_id, 'reject')}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel" style={{ marginBottom: '40px' }}>
        <h2 style={{ marginBottom: '20px' }}>Promotion Requests ({submissions.filter(s => s.submission_type !== 'report').length})</h2>
        {submissions.filter(s => s.submission_type !== 'report').length === 0 && <p style={{ color: 'var(--text-muted)' }}>No new promotions.</p>}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {submissions.filter(s => s.submission_type !== 'report' && s.status === 'pending').map(s => (
            <div key={s.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <a href={`https://x.com/${s.x_handle}`} target="_blank" rel="noopener noreferrer" className="hover-glow" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <strong>@{s.x_handle}</strong>
                  </a> submitted by <em>{s.profiles?.username || `User ${s.user_id?.slice(0, 5)}`}</em>
                </div>
                <span className="badge badge-yellow">{s.status}</span>
              </div>
              
              <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                <button className="btn" style={{ background: 'rgba(0, 230, 118, 0.1)', color: 'var(--accent-green)', border: '1px solid rgba(0, 230, 118, 0.3)' }} onClick={() => handleHostSubmission(s.id, s.x_handle, 'approve', s.submission_type)}>
                  Approve Promotion
                </button>
                <button className="btn btn-outline" onClick={() => handleHostSubmission(s.id, s.x_handle, 'reject', s.submission_type)}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel" style={{ marginBottom: '40px' }}>
        <h2 style={{ marginBottom: '20px' }}>Host Scam Flags ({submissions.filter(s => s.submission_type === 'report').length})</h2>
        {submissions.filter(s => s.submission_type === 'report').length === 0 && <p style={{ color: 'var(--text-muted)' }}>No new scam flags.</p>}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {submissions.filter(s => s.submission_type === 'report' && s.status === 'pending').map(s => (
            <div key={s.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <a href={`https://x.com/${s.x_handle}`} target="_blank" rel="noopener noreferrer" className="hover-glow" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <strong>@{s.x_handle}</strong>
                  </a> flagged by <em>{s.profiles?.username || `User ${s.user_id?.slice(0, 5)}`}</em>
                </div>
                <span className="badge badge-red">FLAGGED</span>
              </div>
              
              <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                <button className="btn btn-danger" onClick={() => handleHostSubmission(s.id, s.x_handle, 'approve', s.submission_type)}>
                  Confirm as Scam
                </button>
                <button className="btn btn-outline" onClick={() => handleHostSubmission(s.id, s.x_handle, 'reject', s.submission_type)}>
                  Reject Flag
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
          <h2 style={{ margin: 0 }}>All Tracked Accounts</h2>
          <div className="input-group" style={{ margin: 0, minWidth: '250px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search by handle..." 
              style={{ paddingLeft: '40px', margin: 0, width: '100%' }}
              value={accountSearch}
              onChange={e => setAccountSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="tracked-accounts-grid">
          {accounts
            .filter(a => a.x_handle.toLowerCase().includes(accountSearch.toLowerCase()))
            .map(a => (
            <div key={a.id} className="tracked-account-card">
              <div className="tac-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src={`https://unavatar.io/x/${a.x_handle}`} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>@{a.x_handle}</span>
                </div>
                <span className={`badge badge-${a.status === 'verified' ? 'green' : a.status === 'scam' ? 'red' : 'yellow'}`}>
                  {a.status}
                </span>
              </div>
              <div className="tac-controls">
                <div className="tac-group">
                  <label>Score</label>
                  <input 
                    type="number" 
                    min="0" max="100" 
                    className="input-field" 
                    style={{ padding: '6px 12px', width: '80px', margin: 0, textAlign: 'center' }}
                    value={a.trust_score} 
                    onChange={async (e) => {
                      const newScore = Number(e.target.value);
                      await supabase.from('tracked_accounts').update({ trust_score: newScore }).eq('id', a.id);
                      fetchData();
                    }} 
                  />
                </div>
                <div className="tac-group" style={{ flex: 1 }}>
                  <label>Status</label>
                  <select 
                    className="input-field" 
                    style={{ padding: '6px 12px', width: '100%', margin: 0 }}
                    value={a.status}
                    onChange={async (e) => {
                      const newStatus = e.target.value;
                      const newScore = newStatus === 'verified' ? 90 : newStatus === 'scam' ? 10 : 50;
                      await supabase.from('tracked_accounts').update({ status: newStatus, trust_score: newScore }).eq('id', a.id);
                      fetchData();
                    }}
                  >
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="scam">Scam</option>
                  </select>
                </div>
                <div className="tac-group" style={{ justifyContent: 'flex-end' }}>
                  <label style={{ visibility: 'hidden' }}>Action</label>
                  <button 
                    className="btn btn-danger" 
                    style={{ padding: '6px 16px', height: '42px' }}
                    onClick={async () => {
                      if (window.confirm(`Delete @${a.x_handle}?`)) {
                        await supabase.from('tracked_accounts').delete().eq('id', a.id);
                        fetchData();
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {accounts.filter(a => a.x_handle.toLowerCase().includes(accountSearch.toLowerCase())).length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No accounts match your search.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
