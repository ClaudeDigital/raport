import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import imageCompression from 'browser-image-compression'
import { api } from '../lib/api'
import { PIKAT_PRIMARE, VLERESIMET, AFATET, MOTI_OPTIONS, LOCK_HOURS } from '../lib/constants'
import { saveDraft, loadDraft, clearDraft } from '../lib/storage'

const initPoints = () => PIKAT_PRIMARE.map((pika, i) => ({ pika, rendi: i+1, vleresimi: null }))
const toDay = () => new Date().toISOString().split('T')[0]
const toTime = () => new Date().toTimeString().slice(0,5)
const toDayName = () => new Date().toLocaleDateString('sq-AL', { weekday: 'long' })

export default function ReportForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id
  const fileRef = useRef({})

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [locked, setLocked] = useState(false)
  const [reportId, setReportId] = useState(id ? parseInt(id) : null)
  const [tab, setTab] = useState('koka')
  const [uploadIdx, setUploadIdx] = useState(null)

  const [head, setHead] = useState({
    objekti:'', investitori:'', realizuesi:'', vendi:'',
    dita: toDayName(), report_date: toDay(), koha_inspektimit: toTime(),
    temperatura:'', moti:'', verejtje:'', rekomandime:'', afati:''
  })
  const [points, setPoints] = useState(initPoints())
  const [blocks, setBlocks] = useState([])

  useEffect(() => {
    if (!isNew) loadReport()
    else {
      const draft = loadDraft()
      if (draft?.isNew) { setHead(draft.head||head); setPoints(draft.points||initPoints()) }
    }
  }, [id])

  useEffect(() => {
    if (locked) return
    const t = setInterval(() => saveDraft({ isNew, reportId, head, points }), 30000)
    return () => clearInterval(t)
  }, [head, points, locked])

  async function loadReport() {
    setLoading(true)
    const rep = await api.getReport(id)
    const lockTime = new Date(rep.created_at).getTime() + LOCK_HOURS * 3600000
    setLocked(Date.now() > lockTime)
    setHead({ objekti:rep.objekti||'', investitori:rep.investitori||'', realizuesi:rep.realizuesi||'',
      vendi:rep.vendi||'', dita:rep.dita||'', report_date:rep.report_date||toDay(),
      koha_inspektimit:rep.koha_inspektimit||'', temperatura:rep.temperatura||'',
      moti:rep.moti||'', verejtje:rep.verejtje||'', rekomandime:rep.rekomandime||'', afati:rep.afati||'' })
    const [pts, blks] = await Promise.all([api.getPoints(id), api.getBlocks(id)])
    if (pts?.length) setPoints(pts.map(p => ({ id:p.id, pika:p.pika, rendi:p.rendi, vleresimi:p.vleresimi })))
    setBlocks(blks || [])
    setLoading(false)
  }

  function setH(k, v) { setHead(h => ({ ...h, [k]: v })) }
  function togglePoint(idx, val) {
    setPoints(ps => ps.map((p,i) => i===idx ? { ...p, vleresimi: p.vleresimi===val ? null : val } : p))
  }

  async function ensureReport() {
    if (reportId) return reportId
    const rep = await api.createReport({ ...head, temperatura: head.temperatura||null, points })
    setReportId(rep.id)
    clearDraft()
    return rep.id
  }

  async function addBlock() {
    const rid = await ensureReport()
    const blk = await api.createBlock(rid, { teksti:'', foto_url: null })
    setBlocks(b => [...b, blk])
  }

  async function handlePhoto(idx, file) {
    if (!file) return
    setUploadIdx(idx)
    try {
      const rid = await ensureReport()
      const compressed = await imageCompression(file, { maxSizeMB:1, maxWidthOrHeight:1280, useWebWorker:true })
      const blk = blocks[idx]
      let updated
      if (blk.id) {
        updated = await api.uploadBlockPhoto(blk.id, compressed)
      } else {
        updated = await api.createBlockWithPhoto(rid, compressed)
      }
      setBlocks(bs => bs.map((b,i) => i===idx ? updated : b))
    } catch(e) { alert('Gabim: '+e.message) }
    setUploadIdx(null)
  }

  async function saveBlockText(idx) {
    const blk = blocks[idx]
    if (!blk.id || !reportId) return
    await api.updateBlock(blk.id, { teksti: blk.teksti, foto_url: blk.foto_url })
  }

  async function deleteBlock(idx) {
    const blk = blocks[idx]
    if (blk.id) await api.deleteBlock(blk.id)
    setBlocks(bs => bs.filter((_,i) => i!==idx))
  }

  async function saveReport() {
    setSaving(true)
    try {
      if (isNew && !reportId) {
        const rep = await api.createReport({ ...head, temperatura: head.temperatura||null, points })
        clearDraft()
        navigate(`/raport/${rep.id}`, { replace: true })
      } else {
        const rid = reportId || id
        await api.updateReport(rid, { ...head, temperatura: head.temperatura||null, points })
        clearDraft()
        navigate(`/raport/${rid}`)
      }
    } catch(e) { alert('Gabim: '+e.message) }
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Duke ngarkuar...</div>

  const tabs = [
    { key:'koka', label:'Koka' },
    { key:'pika', label:'Pikat (17)' },
    { key:'blloqe', label:`Foto (${blocks.length})` },
    { key:'fund', label:'Vërejtje' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-blue-700 text-white px-4 pb-3 pt-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-xl active:opacity-70">←</button>
          <h1 className="font-bold">{isNew ? 'Raport i Ri' : 'Edito Raportin'}</h1>
          <div className="w-10" />
        </div>
        {locked && <div className="mt-2 bg-orange-500 text-xs rounded-lg px-3 py-1.5 text-center">🔒 Raporti është i bllokuar (12h skaduan)</div>}
        <div className="flex mt-3 gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${tab===t.key ? 'bg-white text-blue-700' : 'text-blue-200'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto">

        {/* ── KOKA ── */}
        {tab==='koka' && (
          <div className="space-y-4">
            <div className="card space-y-3">
              <h2 className="section-title">Të dhënat e objektit</h2>
              <F label="Objekti" v={head.objekti} set={v=>setH('objekti',v)} dis={locked} ph="Emri i objektit" />
              <F label="Investitori" v={head.investitori} set={v=>setH('investitori',v)} dis={locked} ph="Emri i investitorit" />
              <F label="Realizuesi i Punëve" v={head.realizuesi} set={v=>setH('realizuesi',v)} dis={locked} ph="Kompania realizuese" />
              <F label="Vendi" v={head.vendi} set={v=>setH('vendi',v)} dis={locked} ph="Vendi i punëve" />
            </div>
            <div className="card space-y-3">
              <h2 className="section-title">Data &amp; Koha</h2>
              <F label="Data" type="date" v={head.report_date} set={v=>setH('report_date',v)} dis={locked} />
              <F label="Dita" v={head.dita} set={v=>setH('dita',v)} dis={locked} ph="Hënë, Martë..." />
              <F label="Koha e Inspektimit" type="time" v={head.koha_inspektimit} set={v=>setH('koha_inspektimit',v)} dis={locked} />
              <F label="Temperatura (°C)" type="number" v={head.temperatura} set={v=>setH('temperatura',v)} dis={locked} ph="22" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Moti</label>
                <div className="flex flex-wrap gap-2">
                  {MOTI_OPTIONS.map(m => (
                    <button key={m} disabled={locked} onClick={() => setH('moti', m)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${head.moti===m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PIKAT ── */}
        {tab==='pika' && (
          <div className="card">
            <h2 className="section-title">17 Pikat Primare për SSHP</h2>
            <div className="space-y-1">
              {points.map((p, idx) => (
                <div key={idx} className="py-3 border-b border-gray-100 last:border-0">
                  <p className="text-sm font-medium text-gray-800 mb-2">{idx+1}. {p.pika}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {VLERESIMET.map(v => {
                      const sel = p.vleresimi===v.key
                      const bg = sel ? (v.key==='keq' ? 'bg-red-500 text-white border-red-500'
                        : v.key==='mire' ? 'bg-green-500 text-white border-green-500'
                        : v.key==='pjeserisht_mire' ? 'bg-yellow-500 text-white border-yellow-500'
                        : 'bg-gray-400 text-white border-gray-400') : 'bg-white text-gray-600 border-gray-200'
                      return (
                        <button key={v.key} disabled={locked} onClick={() => togglePoint(idx, v.key)}
                          className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-colors active:scale-95 ${bg}`}>
                          {sel ? '✓ ' : ''}{v.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── BLLOQE ── */}
        {tab==='blloqe' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 text-center">Shto foto + përshkrim gjatë inspektimit</p>
            {blocks.map((blk, idx) => (
              <div key={blk.id||idx} className="card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-600">Blloku {idx+1}</span>
                  {!locked && <button onClick={() => deleteBlock(idx)} className="text-red-400 text-sm p-1">✕ Fshi</button>}
                </div>
                {blk.foto_url ? (
                  <div className="relative">
                    <img src={blk.foto_url} alt="" className="w-full rounded-xl object-cover max-h-56" />
                    {!locked && (
                      <button onClick={() => fileRef.current[idx]?.click()}
                        className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
                        Ndrysho
                      </button>
                    )}
                  </div>
                ) : !locked && (
                  <button onClick={() => fileRef.current[idx]?.click()} disabled={uploadIdx===idx}
                    className="w-full border-2 border-dashed border-gray-300 rounded-xl py-8 text-center text-gray-400">
                    {uploadIdx===idx ? '⏳ Duke ngarkuar...' : <><div className="text-3xl mb-1">📷</div><div className="text-sm">Shto Foto</div></>}
                  </button>
                )}
                <input ref={el => fileRef.current[idx]=el} type="file" accept="image/*" capture="environment"
                  className="hidden" onChange={e => handlePhoto(idx, e.target.files[0])} />
                <textarea disabled={locked} className="input-field resize-none text-sm" rows={3}
                  placeholder="Përshkrim i vërejtjes..."
                  value={blk.teksti||''}
                  onChange={e => setBlocks(bs => bs.map((b,i) => i===idx ? {...b, teksti: e.target.value} : b))}
                  onBlur={() => saveBlockText(idx)} />
              </div>
            ))}
            {!locked && (
              <button onClick={addBlock} className="btn-secondary">+ Shto Bllok Foto/Tekst</button>
            )}
          </div>
        )}

        {/* ── FUND ── */}
        {tab==='fund' && (
          <div className="space-y-4">
            <div className="card space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vërejtje</label>
                <textarea disabled={locked} className="input-field resize-none" rows={4}
                  placeholder="Shkruaj vërejtjet..." value={head.verejtje} onChange={e => setH('verejtje', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rekomandime</label>
                <textarea disabled={locked} className="input-field resize-none" rows={4}
                  placeholder="Shkruaj rekomandimet..." value={head.rekomandime} onChange={e => setH('rekomandime', e.target.value)} />
              </div>
            </div>
            <div className="card">
              <h2 className="section-title">Afati i përmirësimit</h2>
              <div className="grid grid-cols-3 gap-2">
                {AFATET.map(a => (
                  <button key={a.key} disabled={locked}
                    onClick={() => setH('afati', head.afati===a.key ? '' : a.key)}
                    className={`py-3 rounded-xl text-sm font-semibold border transition-colors active:scale-95 ${head.afati===a.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'}`}>
                    {head.afati===a.key ? '✓ ' : ''}{a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {!locked && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-20">
          <button onClick={saveReport} disabled={saving} className="btn-primary">
            {saving ? 'Duke ruajtur...' : '💾 Ruaj Raportin'}
          </button>
        </div>
      )}
      {locked && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-20">
          <button onClick={() => navigate(`/raport/${id||reportId}`)} className="btn-secondary">← Kthehu</button>
        </div>
      )}
    </div>
  )
}

function F({ label, v, set, type='text', dis, ph }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} className="input-field" value={v} onChange={e=>set(e.target.value)} disabled={dis} placeholder={ph} />
    </div>
  )
}
