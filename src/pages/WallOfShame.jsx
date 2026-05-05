import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { ArrowLeft, TrendingDown, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function WallOfShame() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('tracked_accounts')
        .select('*')
        .eq('status', 'scam')
        .order('trust_score', { ascending: true })
      setAccounts(data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  return (
    <div className="container" style={{ animation: 'fadeInUp 0.8s ease-out both' }}>
      <Link to="/" className="btn btn-outline" style={{ marginBottom: '32px' }}>
        <ArrowLeft size={18} /> Back to Dashboard
      </Link>

      <div className="glass-panel" style={{ padding: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
          <TrendingDown size={32} color="var(--accent-red)" />
          <div>
            <h1 style={{ margin: 0 }}>Wall of Shame</h1>
            <p style={{ color: 'var(--text-muted)' }}>Confirmed scam accounts identified by our community.</p>
          </div>
        </div>

        {loading ? (
          <div className="spinner" style={{ margin: '40px auto' }}></div>
        ) : (
          <div className="leaderboard-list">
            {accounts.map((acc, i) => (
              <div key={acc.id} className="report-row glass-panel" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-muted)', width: '30px' }}>#{i + 1}</span>
                  <a 
                    href={`https://x.com/${acc.x_handle}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    style={{ fontSize: '1.2rem', fontWeight: 700, color: 'inherit', textDecoration: 'none' }}
                    className="hover-glow"
                  >
                    @{acc.x_handle}
                  </a>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="badge badge-red" style={{ fontSize: '1rem' }}>{acc.trust_score}</span>
                  <ShieldAlert size={20} color="var(--accent-red)" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
