const BASE = '/api'

function getToken() {
  return localStorage.getItem('raport_token')
}

export function setToken(t) {
  if (t) localStorage.setItem('raport_token', t)
  else localStorage.removeItem('raport_token')
}

async function req(method, path, body, isForm = false) {
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!isForm) headers['Content-Type'] = 'application/json'

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: isForm ? body : (body ? JSON.stringify(body) : undefined),
  })

  if (res.status === 401) {
    setToken(null)
    window.location.href = '/login'
    return
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export const api = {
  login: (username, password) => req('POST', '/auth/login', { username, password }),
  me: () => req('GET', '/auth/me'),
  changePassword: (current, newPass) => req('PUT', '/auth/password', { current, newPass }),

  getReports: () => req('GET', '/reports'),
  createReport: (data) => req('POST', '/reports', data),
  getReport: (id) => req('GET', `/reports/${id}`),
  updateReport: (id, data) => req('PUT', `/reports/${id}`, data),

  getPoints: (id) => req('GET', `/reports/${id}/points`),
  getBlocks: (id) => req('GET', `/reports/${id}/blocks`),
  createBlock: (id, data) => req('POST', `/reports/${id}/blocks`, data),
  updateBlock: (id, data) => req('PUT', `/blocks/${id}`, data),
  deleteBlock: (id) => req('DELETE', `/blocks/${id}`),

  uploadBlockPhoto: (blockId, file) => {
    const fd = new FormData()
    fd.append('photo', file)
    return req('POST', `/blocks/${blockId}/photo`, fd, true)
  },
  createBlockWithPhoto: (reportId, file, teksti = '') => {
    const fd = new FormData()
    fd.append('photo', file)
    fd.append('teksti', teksti)
    return req('POST', `/reports/${reportId}/blocks/photo`, fd, true)
  },
}
