import { useEffect, useState } from 'react'
import { api, setToken } from '../lib/api'

export function useAuth() {
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    const token = localStorage.getItem('raport_token')
    if (!token) { setUser(null); return }
    api.me().then(u => setUser(u)).catch(() => { setToken(null); setUser(null) })
  }, [])

  const logout = () => { setToken(null); setUser(null) }

  return { user, loading: user === undefined, logout }
}
