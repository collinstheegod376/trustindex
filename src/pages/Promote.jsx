import { useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Rocket, Send, ShieldCheck, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Promote() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [handle, setHandle] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  async function handleSubmit(e) {
    e.preventDefault()
    if (!user) return setMessage({ type: 'error', text: 'Please sign in to submit a host.' })
    
    setLoading(true)
    const cleanHandle = handle.replace('@', '').trim()
    
    const { error } = await supabase.from('host_submissions').insert({ 
      user_id: user.id, 
      x_handle: cleanHandle 
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Host submitted! Admins will verify the profile soon.' })
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
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-green))', 
            borderRadius: '24px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 24px',
            boxShadow: 'var(--glow-blue)',
            transform: 'rotate(-10deg)'
          }}>
            <Rocket size={40} color="white" />
          </div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '12px' }}>Promote a Host</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
            Submit an X profile to be verified by our community and admin team.
          </p>
        </div>

        {message.text && (
          <div className={`alert alert-${message.type}`} style={{ marginBottom: '32px', animation: 'fadeIn 0.5s ease-out' }}>
            {message.type === 'success' ? <ShieldCheck size={20} /> : null}
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
            style={{ width: '100%', height: '60px', fontSize: '1.1rem', marginTop: '12px' }}
            disabled={loading}
          >
            {loading ? 'Submitting...' : <><Send size={20} /> Submit for Verification</>}
          </button>
        </form>

        <p style={{ marginTop: '32px', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Approved hosts appear on the verified leaderboard within 24-48 hours.
        </p>
      </div>
    </div>
  )
}
