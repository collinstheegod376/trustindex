import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { MessageSquare, Send, ArrowLeft, Loader, User, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Support() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef()

  useEffect(() => {
    if (user) {
      fetchMessages()
      
      const subscription = supabase
        .channel('support_chats_page')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_chats' }, payload => {
          if (payload.new.user_id === user.id) {
            setMessages(prev => [...prev, payload.new])
          }
        })
        .subscribe()

      return () => {
        supabase.removeChannel(subscription)
      }
    }
  }, [user])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function fetchMessages() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('support_chats')
      .select('*')
      .eq('user_id', user.id)
      .gt('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: true })
    
    setMessages(data || [])
  }

  useEffect(() => {
    if (messages.length > 0 && user) {
      const lastMsg = messages[messages.length - 1]
      localStorage.setItem(`last_read_${user.id}`, lastMsg.id)
    }
  }, [messages, user])

  async function handleSend(e) {
    e.preventDefault()
    if (!newMessage.trim() || !user) return

    setLoading(true)
    const { error } = await supabase.from('support_chats').insert([
      { user_id: user.id, message: newMessage.trim(), is_admin: false }
    ])

    if (!error) setNewMessage('')
    setLoading(false)
  }

  if (!user) {
    return (
      <div className="container text-center" style={{ padding: '100px 0' }}>
        <h2>Please sign in to access support.</h2>
        <Link to="/profile" className="btn btn-primary" style={{ marginTop: '20px' }}>Sign In</Link>
      </div>
    )
  }

  return (
    <div className="container" style={{ maxWidth: '800px', animation: 'fadeInUp 0.8s ease-out both' }}>
      <Link to="/" className="btn btn-outline" style={{ marginBottom: '32px' }}>
        <ArrowLeft size={18} /> Back to Dashboard
      </Link>

      <div className="glass-panel" style={{ height: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--panel-border)', display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.03)' }}>
          <div style={{ padding: '12px', background: 'rgba(41, 121, 255, 0.1)', borderRadius: '12px' }}>
            <MessageSquare size={24} color="var(--accent-blue)" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Support Chat</h1>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--accent-green)' }}>● Admin Online (24h Ephemeral)</p>
          </div>
        </div>

        <div 
          ref={scrollRef}
          style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(0,0,0,0.2)' }}
        >
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
            🛡️ Secure & Ephemeral: Messages in this session are automatically cleared every 24 hours.
          </div>
          
          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center' }}>
              <MessageSquare size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p>No messages yet. Send a message to start a conversation with our admins.</p>
            </div>
          )}

          {messages.map(m => (
            <div 
              key={m.id} 
              style={{ 
                alignSelf: m.is_admin ? 'flex-start' : 'flex-end',
                maxWidth: '75%',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: m.is_admin ? 'flex-start' : 'flex-end', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{m.is_admin ? 'ADMIN' : 'YOU'}</span>
                {m.is_admin ? <ShieldCheck size={12} color="var(--accent-green)" /> : <User size={12} color="var(--accent-blue)" />}
              </div>
              <div style={{ 
                padding: '14px 20px',
                borderRadius: m.is_admin ? '0 20px 20px 20px' : '20px 20px 0 20px',
                background: m.is_admin ? 'rgba(255,255,255,0.08)' : 'var(--accent-blue)',
                color: 'white',
                fontSize: '1rem',
                border: m.is_admin ? '1px solid var(--panel-border)' : 'none',
                boxShadow: m.is_admin ? 'none' : '0 8px 24px rgba(41, 121, 255, 0.2)',
                lineHeight: '1.5'
              }}>
                {m.message}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSend} style={{ padding: '24px', background: 'rgba(255,255,255,0.03)', borderTop: '1px solid var(--panel-border)', display: 'flex', gap: '16px' }}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Describe your issue or ask a question..." 
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            style={{ margin: 0, height: '54px' }}
          />
          <button type="submit" className="btn btn-primary" style={{ width: '60px', height: '54px', padding: 0 }} disabled={loading}>
            {loading ? <Loader size={20} className="spinner" /> : <Send size={20} />}
          </button>
        </form>
      </div>
    </div>
  )
}
