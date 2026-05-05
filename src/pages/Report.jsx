import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabase'
import { AlertCircle, Link as LinkIcon, FileText, Send } from 'lucide-react'

export default function Report() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [handle, setHandle] = useState(searchParams.get('handle') || '')
  const [url, setUrl] = useState('')
  const [reason, setReason] = useState('No winner announced')
  const [proofUrl, setProofUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  if (!user) {
    return (
      <div className="glass-panel text-center" style={{ padding: '60px 20px', maxWidth: '500px', margin: '40px auto' }}>
        <AlertCircle size={48} color="#ff3d00" style={{ marginBottom: '16px' }} />
        <h2>Sign in Required</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
          You must be signed in to submit a report. This helps prevent spam and ensures the integrity of the Trust Index.
        </p>
        <Link to="/profile" className="btn btn-primary">Go to Sign In</Link>
      </div>
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const cleanHandle = handle.replace('@', '').trim()

    // 1. Get or Create the tracked_account
    let { data: account, error: accError } = await supabase
      .from('tracked_accounts')
      .select('id')
      .eq('x_handle', cleanHandle)
      .single()

    if (accError && accError.code === 'PGRST116') {
      // Doesn't exist, create it
      const { data: newAcc, error: createError } = await supabase
        .from('tracked_accounts')
        .insert([{ x_handle: cleanHandle }])
        .select()
        .single()
      
      if (createError) {
        setMessage({ type: 'error', text: 'Error tracking account: ' + createError.message })
        setLoading(false)
        return
      }
      account = newAcc
    }

    // 2. Insert the report
    const { error: reportError } = await supabase
      .from('reports')
      .insert([{
        tracked_account_id: account.id,
        reporter_id: user.id,
        giveaway_url: url,
        reason,
        proof_url: proofUrl,
        notes
      }])

    if (reportError) {
      setMessage({ type: 'error', text: 'Error submitting report: ' + reportError.message })
    } else {
      setMessage({ type: 'success', text: 'Report submitted successfully! It is pending community review.' })
      setTimeout(() => navigate('/'), 2000)
    }
    setLoading(false)
  }

  return (
    <div className="glass-panel" style={{ maxWidth: '600px', margin: '40px auto' }}>
      <h2>Report a Giveaway</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Help the community by flagging fake giveaways or confirming real ones. Please provide as much proof as possible.
      </p>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ padding: '12px', borderRadius: '8px', marginBottom: '20px', background: message.type === 'error' ? 'rgba(255, 61, 0, 0.1)' : 'rgba(0, 230, 118, 0.1)', color: message.type === 'error' ? 'var(--accent-red)' : 'var(--accent-green)', border: `1px solid ${message.type === 'error' ? 'rgba(255, 61, 0, 0.3)' : 'rgba(0, 230, 118, 0.3)'}` }}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label">X (Twitter) Handle</label>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. realfish"
            value={handle}
            onChange={e => setHandle(e.target.value)}
            required
          />
        </div>

        <div className="input-group">
          <label className="input-label">Giveaway Post URL</label>
          <div style={{ position: 'relative' }}>
            <LinkIcon size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
            <input
              type="url"
              className="input-field"
              placeholder="https://x.com/..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              style={{ paddingLeft: '40px' }}
              required
            />
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Reason for Report</label>
          <select className="input-field" value={reason} onChange={e => setReason(e.target.value)} style={{ appearance: 'none', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <option>No winner announced</option>
            <option>Winner is a bot/burner account</option>
            <option>Requires malicious/phishing link</option>
            <option>Engagement farming (constant fake giveaways)</option>
            <option>Verified Legit (I won and received the prize!)</option>
          </select>
        </div>

        <div className="input-group">
          <label className="input-label">Proof URL (Optional)</label>
          <input
            type="url"
            className="input-field"
            placeholder="Link to screenshot or transaction hash"
            value={proofUrl}
            onChange={e => setProofUrl(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label className="input-label">Additional Notes</label>
          <div style={{ position: 'relative' }}>
            <FileText size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
            <textarea
              className="input-field"
              placeholder="Provide any context..."
              rows="4"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ paddingLeft: '40px', resize: 'vertical' }}
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }} disabled={loading}>
          {loading ? 'Submitting...' : <><Send size={18} /> Submit Report</>}
        </button>
      </form>
    </div>
  )
}
