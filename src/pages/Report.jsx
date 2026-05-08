import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabase'
import { AlertCircle, Link as LinkIcon, FileText, Send, Upload, X, Image as ImageIcon, ArrowLeft } from 'lucide-react'

export default function Report() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, uploadProof } = useAuth()

  const [handle, setHandle] = useState(searchParams.get('handle') || '')
  const [url, setUrl] = useState('')
  const [reason, setReason] = useState('No winner announced')
  const [proofUrl, setProofUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const [proofFile, setProofFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)

  if (!user) return null // Handled by App.jsx auth redirect

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setProofFile(file)
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  const removeFile = () => {
    setProofFile(null)
    setPreviewUrl(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      const cleanHandle = handle.replace('@', '').trim()
      let currentProofUrl = proofUrl

      // Upload file if present
      if (proofFile) {
        const { url: uploadedUrl, error: uploadError } = await uploadProof(proofFile)
        if (uploadError) throw uploadError
        currentProofUrl = uploadedUrl
      }

      // 1. Get or Create the tracked_account
      let { data: account, error: accError } = await supabase
        .from('tracked_accounts')
        .select('id')
        .eq('x_handle', cleanHandle)
        .single()

      if (accError && accError.code === 'PGRST116') {
        const { data: newAcc, error: createError } = await supabase
          .from('tracked_accounts')
          .insert([{ x_handle: cleanHandle }])
          .select()
          .single()
        if (createError) throw createError
        account = newAcc
      } else if (accError) throw accError

      // 2. Insert the report
      const { error: reportError } = await supabase
        .from('reports')
        .insert([{
          tracked_account_id: account.id,
          reporter_id: user.id,
          giveaway_url: url,
          reason,
          proof_url: currentProofUrl,
          notes
        }])

      if (reportError) throw reportError

      setMessage({ type: 'success', text: 'Report submitted successfully! Redirecting...' })
      setTimeout(() => navigate('/'), 2000)
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: '680px', animation: 'fadeInUp 0.8s ease-out both' }}>
      <Link to="/" className="btn btn-outline" style={{ marginBottom: '32px' }}>
        <ArrowLeft size={18} /> Back to Dashboard
      </Link>
      <div className="glass-panel" style={{ padding: '40px' }}>
        <h2>Report a Giveaway</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
          Help the community by flagging fake giveaways. Please provide as much proof as possible.
        </p>

        {message.text && (
          <div className={`alert alert-${message.type}`} style={{ padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">X (Twitter) Handle</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. larp"
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
            <select className="input-field" value={reason} onChange={e => setReason(e.target.value)}>
              <option>No winner announced</option>
              <option>Winner is a bot/burner account</option>
              <option>Requires malicious/phishing link</option>
              <option>Engagement farming (constant fake giveaways)</option>
              <option>Verified Legit (I won and received the prize!)</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Proof (Attach Screenshot or Image)</label>
            <div className="file-upload-area" style={{
              border: '2px dashed var(--panel-border)',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center',
              position: 'relative',
              cursor: 'pointer',
              backgroundColor: 'rgba(255,255,255,0.02)'
            }}>
              {!previewUrl ? (
                <>
                  <Upload size={32} color="var(--text-muted)" style={{ marginBottom: '8px' }} />
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Click to upload proof screenshot</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                  />
                </>
              ) : (
                <div style={{ position: 'relative' }}>
                  <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }} />
                  <button
                    type="button"
                    onClick={removeFile}
                    style={{
                      position: 'absolute', top: '-10px', right: '-10px',
                      background: 'var(--accent-red)', border: 'none',
                      borderRadius: '50%', padding: '4px', cursor: 'pointer'
                    }}
                  >
                    <X size={16} color="white" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Or Proof URL</label>
            <div style={{ position: 'relative' }}>
              <ImageIcon size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
              <input
                type="url"
                className="input-field"
                placeholder="Transaction hash or hosted image link"
                value={proofUrl}
                onChange={e => setProofUrl(e.target.value)}
                style={{ paddingLeft: '40px' }}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Additional Notes</label>
            <textarea
              className="input-field"
              placeholder="Provide any context..."
              rows="4"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }} disabled={loading}>
            {loading ? 'Submitting...' : <><Send size={18} /> Submit Report</>}
          </button>
        </form>
      </div>
    </div>
  )
}
