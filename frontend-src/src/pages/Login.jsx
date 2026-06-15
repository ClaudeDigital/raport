import { useState } from 'react'
import { api, setToken } from '../lib/api'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token } = await api.login(username, password)
      setToken(token)
      window.location.href = '/'
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-700 to-blue-900 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-4">
            <span className="text-blue-700 font-black text-2xl">NMA</span>
          </div>
          <h1 className="text-white text-2xl font-bold">SSHP Raport</h1>
          <p className="text-blue-200 text-sm mt-1">Sistemi i Inspektimit</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-xl space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Përdoruesi</label>
            <input type="text" className="input-field" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="admin" required autoComplete="username" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fjalëkalimi</label>
            <input type="password" className="input-field" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required autoComplete="current-password" />
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Duke u kyçur...' : 'Kyçu'}
          </button>
        </form>
        <p className="text-center text-blue-200 text-xs mt-6">"Nma" shpk — info@nma-ks.com</p>
      </div>
    </div>
  )
}
