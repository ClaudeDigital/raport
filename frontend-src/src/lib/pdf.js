import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { PIKAT_PRIMARE, AFATET } from './constants'

function san(name) {
  return (name || 'NMA').replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}
function fmtDate(d) {
  if (!d) return '___/___/______'
  const dt = new Date(d)
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
}
function wrap(text, max) {
  if (!text) return []
  const words = text.split(' '), lines = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).length > max) { lines.push(cur); cur = w }
    else cur = cur ? cur + ' ' + w : w
  }
  if (cur) lines.push(cur)
  return lines
}
// Vizaton një shenjë ✓ si dy vija vektoriale (jo tekst) — shmang çdo problem
// encoding-u të fonteve standarde (WinAnsi nuk e mbështet karakterin ✓).
function drawCheck(page, cx, cy, size = 11, color = rgb(0, 0, 0), thickness = 1.6) {
  const s = size / 11
  const p1 = { x: cx - 5 * s, y: cy + 1 * s }
  const p2 = { x: cx - 1 * s, y: cy - 4 * s }
  const p3 = { x: cx + 6 * s, y: cy + 6 * s }
  page.drawLine({ start: p1, end: p2, thickness, color })
  page.drawLine({ start: p2, end: p3, thickness, color })
}

// ── Faqja 1: Formulari zyrtar (shtohet te një PDFDocument ekzistues) ──
async function buildOfficialPage(doc, report, points) {
  const page = doc.addPage([595, 842])
  const { width, height } = page.getSize()
  const hv = await doc.embedFont(StandardFonts.HelveticaBold)
  const h = await doc.embedFont(StandardFonts.Helvetica)
  const m = 28
  let y = height - m

  // Header box
  const hH = 90
  page.drawRectangle({ x: m, y: y-hH, width: width-2*m, height: hH, borderColor: rgb(0,0,0), borderWidth: 1 })
  page.drawText('"NMA" SH.P.K.', { x: m+70, y: y-18, size: 10, font: hv })
  page.drawText('Prishtinë', { x: m+70, y: y-30, size: 9, font: h })
  page.drawText('Nr. Unik Identifikues 810863268', { x: m+70, y: y-42, size: 9, font: h })
  page.drawText('Nr. i licencës 03/2018', { x: m+70, y: y-54, size: 9, font: h })
  const numStr = String(report.report_number||1).padStart(6,'0')
  page.drawText(numStr, { x: width-m-90, y: y-22, size: 20, font: hv, color: rgb(0.6,0,0) })
  page.drawText('2026', { x: width-m-60, y: y-44, size: 13, font: hv })
  y -= hH

  // Title
  page.drawRectangle({ x: m, y: y-26, width: width-2*m, height: 26, borderColor: rgb(0,0,0), borderWidth: 1 })
  page.drawText('RAPORT INSPEKTIMI', { x: width/2-68, y: y-18, size: 13, font: hv })
  y -= 26

  // Row 1: Objekti | Investitori | Dita/Data
  const c1=170, c2=140, c3=width-2*m-c1-c2
  const r1H=22
  const drawCell=(x,cw,h2)=>page.drawRectangle({x,y:y-h2,width:cw,height:h2,borderColor:rgb(0,0,0),borderWidth:0.5})
  drawCell(m,c1,r1H); drawCell(m+c1,c2,r1H); drawCell(m+c1+c2,c3,r1H)
  page.drawText('OBJEKTI: '+(report.objekti||''), { x: m+3, y: y-15, size: 8, font: h })
  page.drawText('INVESTITORI: '+(report.investitori||''), { x: m+c1+3, y: y-15, size: 8, font: h })
  page.drawText('DITA: '+(report.dita||''), { x: m+c1+c2+3, y: y-10, size: 8, font: h })
  page.drawText('DATA: '+fmtDate(report.report_date), { x: m+c1+c2+3, y: y-19, size: 8, font: h })
  y -= r1H

  // Row 2: Realizuesi/Vendi | Koha/Temp/Moti
  const r2H=44
  drawCell(m,c1+c2,r2H); drawCell(m+c1+c2,c3,r2H)
  page.drawText('REALIZUESI I PUNËVE: '+(report.realizuesi||''), { x: m+3, y: y-12, size: 8, font: h })
  page.drawText('VENDI: '+(report.vendi||''), { x: m+3, y: y-28, size: 8, font: h })
  page.drawText('KOHA E INSPEKTIMIT: '+(report.koha_inspektimit||''), { x: m+c1+c2+3, y: y-10, size: 8, font: h })
  page.drawText('TEMPERATURA: '+(report.temperatura||'')+' °C', { x: m+c1+c2+3, y: y-21, size: 8, font: h })
  page.drawText('MOTI: '+(report.moti||''), { x: m+c1+c2+3, y: y-32, size: 8, font: h })
  y -= r2H

  // Table header
  const tH=22, pW=280, kW=58, mW=58, pmW=80, jaW=width-2*m-pW-kW-mW-pmW
  const cols=[pW,kW,mW,pmW,jaW]
  let ax=m
  cols.forEach(cw=>{ page.drawRectangle({x:ax,y:y-tH,width:cw,height:tH,borderColor:rgb(0,0,0),borderWidth:0.8}); ax+=cw })
  page.drawText('PIKAT PRIMARE PËR SSHP', { x: m+pW/2-70, y: y-15, size: 9, font: hv })
  page.drawText('KEQ', { x: m+pW+14, y: y-15, size: 9, font: hv })
  page.drawText('MIRË', { x: m+pW+kW+12, y: y-15, size: 9, font: hv })
  page.drawText('PJESËRISHT', { x: m+pW+kW+mW+4, y: y-10, size: 7.5, font: hv })
  page.drawText('MIRË', { x: m+pW+kW+mW+20, y: y-19, size: 9, font: hv })
  page.drawText('JO TË', { x: m+pW+kW+mW+pmW+6, y: y-10, size: 7.5, font: hv })
  page.drawText('APLIKUESHME', { x: m+pW+kW+mW+pmW+2, y: y-19, size: 6.5, font: hv })
  y -= tH

  // Rows
  const rowH=16
  const allRows=[...PIKAT_PRIMARE, '', '', '']
  for (const pika of allRows) {
    ax=m; cols.forEach(cw=>{ page.drawRectangle({x:ax,y:y-rowH,width:cw,height:rowH,borderColor:rgb(0,0,0),borderWidth:0.3}); ax+=cw })
    if (pika) {
      page.drawText(pika, { x: m+3, y: y-11, size: 7.5, font: h })
      const pt=points.find(p=>p.pika===pika)
      const v=pt?.vleresimi
      const cx=m+pW, cy=y-11
      if (v==='keq') page.drawText('X',{x:cx+kW/2-3,y:cy,size:10,font:hv})
      else if (v==='mire') page.drawText('X',{x:cx+kW+mW/2-3,y:cy,size:10,font:hv})
      else if (v==='pjeserisht_mire') page.drawText('X',{x:cx+kW+mW+pmW/2-3,y:cy,size:10,font:hv})
      else if (v==='jo_aplikueshme') page.drawText('X',{x:cx+kW+mW+pmW+jaW/2-3,y:cy,size:10,font:hv})
    }
    y -= rowH
  }

  // Vërejtje / Rekomandime
  const vrH=110, vrW=(width-2*m)/2
  page.drawRectangle({x:m,y:y-vrH,width:vrW,height:vrH,borderColor:rgb(0,0,0),borderWidth:0.8})
  page.drawRectangle({x:m+vrW,y:y-vrH,width:vrW,height:vrH,borderColor:rgb(0,0,0),borderWidth:0.8})
  page.drawText('VËREJTJE',{x:m+vrW/2-28,y:y-14,size:10,font:hv})
  page.drawText('REKOMANDIME',{x:m+vrW+vrW/2-42,y:y-14,size:10,font:hv})
  wrap(report.verejtje,45).slice(0,5).forEach((l,i)=>page.drawText(l,{x:m+4,y:y-28-i*13,size:8,font:h}))
  wrap(report.rekomandime,45).slice(0,5).forEach((l,i)=>page.drawText(l,{x:m+vrW+4,y:y-28-i*13,size:8,font:h}))
  y -= vrH

  // Afati
  const afH=42
  const aLabels=['TË GJITHA VËREJTJET TË\nPËRMIRESOHEN BRENDA\nAFATIT','MENJËHERË','6 ORE','12 ORE','24 ORE','48 ORE','72 ORE']
  const aKeys=['','menjehere','6','12','24','48','72']
  const aCols=[120,72,52,52,72,52,width-2*m-120-72-52-52-72-52]
  ax=m
  for(let i=0;i<aLabels.length;i++){
    page.drawRectangle({x:ax,y:y-afH,width:aCols[i],height:afH,borderColor:rgb(0,0,0),borderWidth:0.5})
    aLabels[i].split('\n').forEach((l,li)=>page.drawText(l,{x:ax+3,y:y-14-li*11,size:7,font:i===0?hv:h}))
    if(i>0 && report.afati===aKeys[i]) drawCheck(page, ax+aCols[i]/2, y-afH+9)
    ax+=aCols[i]
  }
  y -= afH

  // Signatures
  y -= 30
  const sW=(width-2*m)/2-20
  page.drawLine({start:{x:m,y},end:{x:m+sW,y},thickness:0.8,color:rgb(0,0,0)})
  page.drawLine({start:{x:m+sW+40,y},end:{x:width-m,y},thickness:0.8,color:rgb(0,0,0)})
  page.drawText('PËRGJEGJËSI I KOMPANISË',{x:m,y:y-14,size:8,font:h})
  page.drawText('KONSULENTI PËR SSHP',{x:m+sW+40,y:y-14,size:8,font:h})

  // Footer
  y -= 40
  page.drawRectangle({x:m+80,y:y-30,width:width-2*m-160,height:30,borderColor:rgb(0,0,0),borderWidth:0.5})
  page.drawText('"Nma" shpk',{x:width/2-30,y:y-12,size:8,font:hv})
  page.drawText('info@nma-ks.com , +383 44 119 009',{x:width/2-65,y:y-24,size:8,font:h})
}

// ── Faqet e dokumentimit me foto (shtohen te një PDFDocument ekzistues) ──
async function buildDocPages(doc, report, blocks) {
  const hv = await doc.embedFont(StandardFonts.HelveticaBold)
  const hf = await doc.embedFont(StandardFonts.Helvetica)
  const m = 36, pw = 595-2*m

  const newPage = () => {
    const p = doc.addPage([595, 842])
    let y = p.getHeight()-40
    p.drawText('"NMA" SH.P.K. — DOKUMENTIM INSPEKTIMI',{x:m,y,size:11,font:hv})
    p.drawText(`Data: ${fmtDate(report.report_date)}  |  Objekti: ${report.objekti||''}  |  Vendi: ${report.vendi||''}`,{x:m,y:y-15,size:8,font:hf})
    p.drawLine({start:{x:m,y:y-20},end:{x:595-m,y:y-20},thickness:0.5,color:rgb(0.5,0.5,0.5)})
    return { p, y: y-32 }
  }

  let { p: page, y } = newPage()

  for (let i=0; i<blocks.length; i++) {
    const blk=blocks[i]
    if (y < 100) { const n=newPage(); page=n.p; y=n.y }
    page.drawText(`Blloku ${i+1}`,{x:m,y,size:9,font:hv,color:rgb(0.2,0.4,0.8)})
    y -= 14

    if (blk.foto_url) {
      try {
        const res = await fetch(blk.foto_url)
        const buf = await res.arrayBuffer()
        const ct = res.headers.get('content-type')||''
        const img = ct.includes('png') ? await doc.embedPng(buf) : await doc.embedJpg(buf)
        const {width:iw,height:ih}=img.scale(1)
        const sc=Math.min(pw/iw,150/ih)
        const dw=iw*sc, dh=ih*sc
        if (y-dh < 60) { const n=newPage(); page=n.p; y=n.y }
        page.drawImage(img,{x:m,y:y-dh,width:dw,height:dh})
        y -= dh+6
      } catch {
        page.drawText('[Foto nuk u ngarkua]',{x:m,y,size:8,font:hf,color:rgb(0.6,0.6,0.6)})
        y -= 14
      }
    }
    if (blk.teksti) {
      for (const l of wrap(blk.teksti, 90).slice(0,8)) {
        page.drawText(l,{x:m,y,size:9,font:hf}); y-=13
      }
    }
    page.drawLine({start:{x:m,y:y-4},end:{x:595-m,y:y-4},thickness:0.3,color:rgb(0.8,0.8,0.8)})
    y -= 14
  }
}

// ── PDF i kombinuar: formulari zyrtar + dokumentimi, NJË skedar i vetëm ──
export async function generateCombinedPdf(report, points, blocks) {
  const doc = await PDFDocument.create()
  await buildOfficialPage(doc, report, points)
  if (blocks?.length) await buildDocPages(doc, report, blocks)
  const bytes = await doc.save()
  return { blob: new Blob([bytes],{type:'application/pdf'}), filename: `Raport_${san(report.objekti)}.pdf` }
}

// Ruajtur për përdorim eventual më vete (jo më të përdorura nga UI-ja kryesore)
export async function generateOfficialPdf(report, points) {
  const doc = await PDFDocument.create()
  await buildOfficialPage(doc, report, points)
  const bytes = await doc.save()
  return { blob: new Blob([bytes],{type:'application/pdf'}), filename: `Raport_${san(report.objekti)}.pdf` }
}
export async function generateDocPdf(report, blocks) {
  const doc = await PDFDocument.create()
  await buildDocPages(doc, report, blocks)
  const bytes = await doc.save()
  return { blob: new Blob([bytes],{type:'application/pdf'}), filename: `Raport_${san(report.objekti)}_Inspektimi.pdf` }
}

// Shkarkim i vërtetë te disku: ankora duhet të jetë në DOM dhe revoke-u i
// vonuar — disa browser (sidomos Firefox/mobile) nuk e ruajnë skedarin nëse
// klikohet jashtë DOM-it ose nëse URL-ja revokohet menjëherë.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
