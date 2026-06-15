import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('sq-AL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function locked(ca) {
  return Date.now() > new Date(ca).getTime() + 12 * 3600000
}

export default function Dashboard() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const { logout } = useAuth()

  useEffect(() => {
    api.getReports().then(setReports).finally(() => setLoading(false))
  }, [])

  const filtered = reports.filter(r =>
    !search || [r.objekti, r.investitori, r.vendi].some(f => f?.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-700 text-white px-4 pb-4 pt-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold">Raportet SSHP</h1>
            <p className="text-blue-200 text-xs">NMA SH.P.K.</p>
          </div>
          <button onClick={logout} className="text-blue-200 text-sm p-2 active:opacity-70">Dil</button>
        </div>
        <input type="search" placeholder="Kërko objektin, investitorin..."
          className="w-full bg-blue-600 text-white placeholder-blue-300 rounded-xl px-4 py-2.5 text-sm outline-none"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="px-4 py-4 pb-28">
        {loading ? (
          <p className="text-center text-gray-400 py-12">Duke ngarkuar...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-16">
            <div className="text-5xl mb-3">📋</div>
            <p className="font-medium text-lg">Nuk ka raporte</p>
            <p className="text-sm">Shtyp + për të krijuar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => (
              <button key={r.id} onClick={() => navigate(`/raport/${r.id}`)}
                className="card w-full text-left active:scale-98 transition-transform">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                        #{String(r.report_number||0).padStart(6,'0')}
                      </span>
                      {locked(r.created_at)
                        ? <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">🔒 I mbyllur</span>
                        : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✏️ Editohet</span>}
                    </div>
                    <p className="font-semibold text-gray-800 truncate">{r.objekti || '(pa objekt)'}</p>
                    {r.investitori && <p className="text-sm text-gray-500 truncate">{r.investitori}</p>}
                    {r.vendi && <p className="text-xs text-gray-400 truncate">{r.vendi}</p>}
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className="text-sm text-gray-500">{fmtDate(r.report_date)}</p>
                    <p className="text-xl mt-1 text-gray-300">›</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <button onClick={() => navigate('/raport/ri')}
        className="fixed bottom-6 right-6 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center text-3xl active:scale-95 transition-transform z-20">
        +
      </button>
    </div>
  )
}
