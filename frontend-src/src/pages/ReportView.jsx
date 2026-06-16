import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { LOCK_HOURS, AFATET } from '../lib/constants'
import { generateCombinedPdf, downloadBlob } from '../lib/pdf'

const fmtDate = d => d ? new Date(d).toLocaleDateString('sq-AL', { day:'2-digit', month:'2-digit', year:'numeric' }) : ''
const isLocked = ca => Date.now() > new Date(ca).getTime() + LOCK_HOURS * 3600000
function timeLeft(ca) {
  const ms = new Date(ca).getTime() + LOCK_HOURS*3600000 - Date.now()
  if (ms <= 0) return null
  return `${Math.floor(ms/3600000)}h ${Math.floor((ms%3600000)/60000)}min`
}

const VLBL = { keq:'Keq', mire:'Mirë', pjeserisht_mire:'Pjesërisht mirë', jo_aplikueshme:'Jo të aplik.' }
const VCLS = { keq:'bg-red-100 text-red-700', mire:'bg-green-100 text-green-700', pjeserisht_mire:'bg-yellow-100 text-yellow-700', jo_aplikueshme:'bg-gray-100 text-gray-500' }

export default function ReportView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [points, setPoints] = useState([])
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [genPdf, setGenPdf] = useState(false)

  useEffect(() => {
    Promise.all([api.getReport(id), api.getPoints(id), api.getBlocks(id)])
      .then(([rep, pts, blks]) => { setReport(rep); setPoints(pts||[]); setBlocks(blks||[]) })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false))
  }, [id])

  async function handlePdf() {
    setGenPdf(true)
    try {
      const { blob, filename } = await generateCombinedPdf(report, points, blocks)
      downloadBlob(blob, filename)
    } catch(e) { alert('PDF error: '+e.message) }
    setGenPdf(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Duke ngarkuar...</div>
  if (!report) return null

  const lk = isLocked(report.created_at)
  const rem = timeLeft(report.created_at)
  const afatLabel = AFATET.find(a => a.key === report.afati)?.label

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-blue-700 text-white px-4 pb-4 pt-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 text-xl active:opacity-70">←</button>
          <div className="text-center">
            <div className="font-bold text-sm">Raport #{String(report.report_number).padStart(6,'0')}</div>
            <div className="text-blue-200 text-xs">{fmtDate(report.report_date)}</div>
          </div>
          {!lk
            ? <button onClick={() => navigate(`/raport/${id}/edito`)} className="bg-white text-blue-700 text-sm font-bold px-3 py-1.5 rounded-xl">Edito</button>
            : <div className="w-16" />}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {lk
          ? <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-700 text-center">🔒 Raporti është i mbyllur (12h skaduan)</div>
          : <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 text-center">✏️ Mund të editohet edhe <strong>{rem}</strong></div>}

        <div className="card space-y-2">
          <Row l="Objekti" v={report.objekti} />
          <Row l="Investitori" v={report.investitori} />
          <Row l="Realizuesi" v={report.realizuesi} />
          <Row l="Vendi" v={report.vendi} />
          <div className="grid grid-cols-3 gap-3 pt-1">
            <Row l="Data" v={fmtDate(report.report_date)} />
            <Row l="Koha" v={report.koha_inspektimit} />
            <Row l="Temp" v={report.temperatura ? `${report.temperatura}°C` : '-'} />
          </div>
          {report.moti && <Row l="Moti" v={report.moti} />}
        </div>

        <div className="card">
          <h2 className="section-title">17 Pikat Primare SSHP</h2>
          <div className="space-y-1">
            {points.map((p,i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700 flex-1 pr-2">{i+1}. {p.pika}</span>
                {p.vleresimi
                  ? <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${VCLS[p.vleresimi]}`}>{VLBL[p.vleresimi]}</span>
                  : <span className="text-xs text-gray-300 shrink-0">—</span>}
              </div>
            ))}
          </div>
        </div>

        {blocks.length > 0 && (
          <div className="card">
            <h2 className="section-title">Dokumentimi ({blocks.length} blloqe)</h2>
            <div className="space-y-4">
              {blocks.map((b,i) => (
                <div key={i} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <p className="text-xs font-bold text-blue-600 mb-2">Blloku {i+1}</p>
                  {b.foto_url && <img src={b.foto_url} alt="" className="w-full rounded-xl object-cover max-h-52 mb-2" />}
                  {b.teksti && <p className="text-sm text-gray-700">{b.teksti}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {(report.verejtje || report.rekomandime) && (
          <div className="grid gap-3">
            {report.verejtje && <div className="card"><h3 className="font-bold text-sm text-gray-500 mb-1">Vërejtje</h3><p className="text-sm">{report.verejtje}</p></div>}
            {report.rekomandime && <div className="card"><h3 className="font-bold text-sm text-gray-500 mb-1">Rekomandime</h3><p className="text-sm">{report.rekomandime}</p></div>}
          </div>
        )}

        {report.afati && (
          <div className="card text-center">
            <p className="text-xs text-gray-400 mb-1">Afati i përmirësimit</p>
            <p className="font-bold text-blue-700 text-lg">{afatLabel}</p>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-20">
        <button onClick={handlePdf} disabled={genPdf} className="btn-primary" style={{background:'#16a34a'}}>
          {genPdf ? '⏳ Duke shkarkuar...' : '📄 Shkarko raportin'}
        </button>
      </div>
    </div>
  )
}

function Row({ l, v }) {
  return <div><p className="text-xs text-gray-400 font-medium">{l}</p><p className="text-sm font-medium">{v||'—'}</p></div>
}
