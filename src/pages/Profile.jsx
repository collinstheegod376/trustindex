import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogIn, UserPlus, Upload, ShieldCheck, LogOut, ArrowLeft } from 'lucide-react'
import './Profile.css'

export default function Profile() {
  const navigate = useNavigate()
  const { user, profile, signIn, signUp, signOut, updateProfile, uploadAvatar, signInWithTwitter, signInWithGoogle } = useAuth()
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
    }

    if (error) setMessage({ type: 'error', text: error.message })
    setLoading(false)
  }

  async function handleTwitterAuth() {
    setLoading(true)
    const { error } = await signInWithTwitter()
    if (error) setMessage({ type: 'error', text: error.message })
    setLoading(false)
  }

  async function handleGoogleAuth() {
    setLoading(true)
    const { error } = await signInWithGoogle()
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

          <button type="button" className="btn btn-outline" style={{ width: '100%', marginBottom: '12px', display: 'flex', justifyContent: 'center', gap: '8px' }} onClick={handleTwitterAuth} disabled={loading}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Continue with X (Twitter)
          </button>

          <button type="button" className="btn btn-outline" style={{ width: '100%', marginBottom: '16px', display: 'flex', justifyContent: 'center', gap: '8px' }} onClick={handleGoogleAuth} disabled={loading}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
          
          <div className="auth-divider">
            <span>OR EMAIL</span>
          </div>

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
      <Link to="/" className="btn btn-outline" style={{ marginBottom: '32px' }}>
        <ArrowLeft size={18} /> Back to Dashboard
      </Link>
      <div className="glass-panel profile-panel">
        <div className="profile-header">
          <div className="avatar-section">
            <div className="avatar-wrapper">
              {profile?.avatar_url ? (
                <img key={profile.avatar_url} src={profile.avatar_url} alt="Avatar" className="avatar-img" />
              ) : profile?.x_handle ? (
                <img key={profile.x_handle} src={`https://unavatar.io/twitter/${profile.x_handle}`} alt="X Avatar" className="avatar-img" />
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
