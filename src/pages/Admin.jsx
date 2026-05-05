import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabase'
import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react'

export default function Admin() {
  const { user, isAdmin } = useAuth()
  const [reports, setReports] = useState([])
  const [accounts, setAccounts] = useState([])
  
  // Manual add state
  const [newHandle, setNewHandle] = useState('')
  const [newStatus, setNewStatus] = useState('scam')
  const [newScore, setNewScore] = useState(10)
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    if (isAdmin) {
      fetchData()
    }
  }, [isAdmin])

  async function fetchData() {
    const { data: reps } = await supabase
      .from('reports')
      .select('*, tracked_accounts(x_handle, status), profiles(username)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    
    const { data: accs } = await supabase
      .from('tracked_accounts')
      .select('*')
      .order('trust_score', { ascending: true })

    setReports(reps || [])
    setAccounts(accs || [])
  }

  async function handleReportAction(reportId, accountId, action) {
    try {
      // action: 'approve_scam', 'approve_legit', 'reject'
      let newReportStatus = action === 'reject' ? 'rejected' : 'approved'
      
      const { error: repError } = await supabase.from('reports').update({ status: newReportStatus }).eq('id', reportId)
      if (repError) throw repError

      if (action === 'approve_scam') {
        const { error: accError } = await supabase.from('tracked_accounts').update({ 
          status: 'scam', 
          trust_score: 10 
        }).eq('id', accountId)
        if (accError) throw accError
      } else if (action === 'approve_legit') {
        const { error: accError } = await supabase.from('tracked_accounts').update({ 
          status: 'verified', 
          trust_score: 90 
        }).eq('id', accountId)
        if (accError) throw accError
      }

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
    <div style={{ padding: '20px 0' }}>
      <h1 style={{ marginBottom: '32px' }}><ShieldCheck size={32} style={{ verticalAlign: 'bottom' }}/> Admin Dashboard</h1>
      
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
                <div>
                  <strong>@{r.tracked_accounts.x_handle}</strong> reported by <em>@{r.profiles.username}</em>
                </div>
                <span className="badge badge-yellow">{r.status}</span>
              </div>
              <p><strong>Reason:</strong> {r.reason}</p>
              <p><strong>URL:</strong> <a href={r.giveaway_url} target="_blank" rel="noreferrer">{r.giveaway_url}</a></p>
              {r.notes && <p><strong>Notes:</strong> {r.notes}</p>}
              {r.proof_url && <p><strong>Proof:</strong> <a href={r.proof_url} target="_blank" rel="noreferrer">{r.proof_url}</a></p>}
              
              <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                <button className="btn btn-danger" onClick={() => handleReportAction(r.id, r.tracked_account_id, 'approve_scam')}>
                  <ShieldAlert size={16} /> Confirm as Scam
                </button>
                <button className="btn" style={{ background: 'rgba(0, 230, 118, 0.1)', color: 'var(--accent-green)', border: '1px solid rgba(0, 230, 118, 0.3)' }} onClick={() => handleReportAction(r.id, r.tracked_account_id, 'approve_legit')}>
                  <ShieldCheck size={16} /> Confirm as Legit
                </button>
                <button className="btn btn-outline" onClick={() => handleReportAction(r.id, r.tracked_account_id, 'reject')}>
                  Reject Report
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel">
        <h2 style={{ marginBottom: '20px' }}>All Tracked Accounts</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--panel-border)' }}>
                <th style={{ padding: '12px' }}>Handle</th>
                <th style={{ padding: '12px' }}>Score</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>@{a.x_handle}</td>
                  <td style={{ padding: '12px' }}>{a.trust_score}</td>
                  <td style={{ padding: '12px' }}>
                    <span className={`badge badge-${a.status === 'verified' ? 'green' : a.status === 'scam' ? 'red' : 'yellow'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select 
                        className="input-field" 
                        style={{ padding: '4px 8px', width: 'auto' }}
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
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                        onClick={async () => {
                          if (window.confirm(`Are you sure you want to delete @${a.x_handle}?`)) {
                            await supabase.from('tracked_accounts').delete().eq('id', a.id);
                            fetchData();
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
