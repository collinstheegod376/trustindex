import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Rocket, Send, ShieldCheck, ArrowLeft, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Promote() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type') || 'promote' // 'promote' or 'report'
  
  const [handle, setHandle] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const isReport = type === 'report'

  async function checkExisting(cleanHandle) {
    // 1. Check tracked_accounts
    const { data: existingAcc } = await supabase
      .from('tracked_accounts')
      .select('status')
      .eq('x_handle', cleanHandle)
      .single()

    if (existingAcc) {
      return { 
        exists: true, 
        msg: `This account is already in our database as [${existingAcc.status.toUpperCase()}].` 
      }
    }

    // 2. Check pending submissions
    const { data: existingSub } = await supabase
      .from('host_submissions')
      .select('status')
      .eq('x_handle', cleanHandle)
      .eq('status', 'pending')
      .single()

    if (existingSub) {
      return { 
        exists: true, 
        msg: "This account has already been submitted and is currently [PENDING VERIFICATION]." 
      }
    }

    return { exists: false }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!user) return setMessage({ type: 'error', text: 'Please sign in to continue.' })
    
    setLoading(true)
    const cleanHandle = handle.replace('@', '').trim().toLowerCase()
    
    const check = await checkExisting(cleanHandle)
    if (check.exists) {
      setMessage({ type: 'error', text: check.msg })
      setLoading(false)
      return
    }

    const { error } = await supabase.from('host_submissions').insert({ 
      user_id: user.id, 
      x_handle: cleanHandle,
      submission_type: type
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: isReport ? 'Report submitted! Admins will investigate.' : 'Host submitted! Admins will verify the profile soon.' })
      setHandle('')
      setTimeout(() => navigate('/'), 3000)
    }
    setLoading(false)
  }

  return (
    <div className="container" style={{ maxWidth: '600px', animation: 'fadeInUp 0.8s ease-out both' }}>
      <Link to="/" className="btn btn-outline" style={{ marginBottom: '32px' }}>
        <ArrowLeft size={18} /> Back to Dashboard
      </Link>

      <div className="glass-panel" style={{ padding: '48px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ 
            width: '80px', 
            height: '80px', 
            background: isReport ? 'linear-gradient(135deg, #ff3d00, #ff8e53)' : 'linear-gradient(135deg, var(--accent-blue), var(--accent-green))', 
            borderRadius: '24px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 24px',
            boxShadow: isReport ? '0 8px 32px rgba(255, 61, 0, 0.3)' : 'var(--glow-blue)',
            transform: 'rotate(-10deg)'
          }}>
            {isReport ? <AlertTriangle size={40} color="white" /> : <Rocket size={40} color="white" />}
          </div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '12px' }}>{isReport ? 'Flag a Host' : 'Promote a Host'}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
            {isReport 
              ? 'Submit a host who has been engaging in suspicious or scam behavior.' 
              : 'Submit an X profile to be verified by our community and admin team.'}
          </p>
        </div>

        {message.text && (
          <div className={`alert alert-${message.type}`} style={{ marginBottom: '32px', animation: 'fadeIn 0.5s ease-out' }}>
            {message.type === 'success' ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">X Handle or Profile Link</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="e.g. elonmusk" 
              value={handle} 
              onChange={e => setHandle(e.target.value)}
              required
              style={{ fontSize: '1.2rem', padding: '16px 20px' }}
            />
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ 
              width: '100%', 
              height: '60px', 
              fontSize: '1.1rem', 
              marginTop: '12px',
              background: isReport ? 'var(--accent-red)' : 'var(--accent-blue)'
            }}
            disabled={loading}
          >
            {loading ? 'Processing...' : isReport ? <><AlertTriangle size={20} /> Report as Scam</> : <><Send size={20} /> Submit for Verification</>}
          </button>
        </form>
      </div>
    </div>
  )
}
