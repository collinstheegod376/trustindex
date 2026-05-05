import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogIn, UserPlus, Upload, ShieldCheck, LogOut } from 'lucide-react'
import './Profile.css'

export default function Profile() {
  const navigate = useNavigate()
  const { user, profile, signIn, signUp, signOut, updateProfile, uploadAvatar } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const [editUsername, setEditUsername] = useState('')
  const [editXHandle, setEditXHandle] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (profile) {
      setEditUsername(profile.username || '')
      setEditXHandle(profile.x_handle || '')
    }
  }, [profile])

  async function handleAuth(e) {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    let error;
    if (isLogin) {
      const res = await signIn(email, password)
      error = res.error
    } else {
      const res = await signUp(email, password, username)
      error = res.error
      if (!error) setMessage({ type: 'success', text: 'Check your email for the confirmation link.' })
    }

    if (error) setMessage({ type: 'error', text: error.message })
    setLoading(false)
  }

  async function handleUpdateProfile(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await updateProfile({ 
      username: editUsername, 
      x_handle: editXHandle.replace('@', '').trim() 
    })
    if (error) setMessage({ type: 'error', text: error.message })
    else {
      setMessage({ type: 'success', text: 'Profile updated!' })
      setTimeout(() => navigate('/'), 1000)
    }
    setLoading(false)
  }

  async function handleAvatarUpload(e) {
    try {
      setUploading(true)
      if (!e.target.files || e.target.files.length === 0) return
      const file = e.target.files[0]
      const { error } = await uploadAvatar(file)
      if (error) setMessage({ type: 'error', text: error.message })
      else setMessage({ type: 'success', text: 'Avatar uploaded!' })
    } finally {
      setUploading(false)
    }
  }

  if (!user) {
    return (
      <div className="auth-container">
        <div className="glass-panel auth-panel">
          <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="auth-sub">Join the community to report and verify X giveaways.</p>
          
          {message.text && (
            <div className={`alert alert-${message.type}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleAuth}>
            {!isLogin && (
              <div className="input-group">
                <label className="input-label">Username</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Your display name"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="input-group">
              <label className="input-label">Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }} disabled={loading}>
              {loading ? 'Processing...' : isLogin ? <><LogIn size={18} /> Sign In</> : <><UserPlus size={18} /> Sign Up</>}
            </button>
          </form>

          <p className="auth-switch">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button className="text-btn" onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? 'Sign up here' : 'Log in here'}
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="profile-container">
      <div className="glass-panel profile-panel">
        <div className="profile-header">
          <div className="avatar-section">
            <div className="avatar-wrapper">
              {profile?.avatar_url ? (
                <img key={profile.avatar_url} src={profile.avatar_url} alt="Avatar" className="avatar-img" />
              ) : (
                <div className="avatar-placeholder">{profile?.username?.[0]?.toUpperCase() || 'U'}</div>
              )}
              <label className="avatar-upload-btn" htmlFor="single">
                {uploading ? '...' : <Upload size={16} />}
              </label>
              <input
                style={{ visibility: 'hidden', position: 'absolute' }}
                type="file"
                id="single"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploading}
              />
            </div>
            <div className="profile-titles">
              <h2>{profile?.username || 'Anonymous User'}</h2>
              <span className={`badge badge-${profile?.role === 'admin' ? 'green' : 'blue'}`}>
                {profile?.role === 'admin' ? <><ShieldCheck size={12}/> Admin</> : 'Community Member'}
              </span>
            </div>
          </div>
          <button className="btn btn-outline" onClick={signOut}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>

        <div className="profile-body">
          <h3>Settings</h3>
          {message.text && (
            <div className={`alert alert-${message.type}`} style={{marginTop: '10px'}}>
              {message.text}
            </div>
          )}



          <form onSubmit={handleUpdateProfile} style={{marginTop: '32px'}}>
            <div className="input-group">
              <label className="input-label">Username</label>
              <input
                type="text"
                className="input-field"
                value={editUsername}
                onChange={e => setEditUsername(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Your X Handle (Optional)</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. yourname"
                value={editXHandle}
                onChange={e => setEditXHandle(e.target.value)}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Linking your X profile builds trust with the community.</p>
            </div>
            <div className="input-group">
              <label className="input-label">Email (Cannot be changed)</label>
              <input type="email" className="input-field" value={user.email} disabled />
            </div>
            <button type="submit" className="btn btn-primary" style={{width: '100%'}} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
