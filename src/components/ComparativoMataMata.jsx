import { useState } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet'

export default function ComparativoMataMata({ dados, cargo }) {
  const [compAno, setCompAno] = useState('2024');
  const [cands, setCands] = useState([null, null, null]);
  const [res, setRes] = useState(null);

  const lista = Array.from(new Set(dados[compAno].filter(l => l.DS_CARGO?.toUpperCase() === cargo).map(l => {
    const nv = l.NM_VOTAVEL?.toUpperCase();
    if (nv?.includes('BRANCO') || nv?.includes('NULO')) return "BRANCOS E NULOS - BN";
    return `${l.NM_VOTAVEL} - ${l.NR_VOTAVEL}`;
  }))).sort();

  const comparar = () => {
    const d = dados[compAno]; const esc = {}; let vts = [0,0,0]; const filtro = new Set();
    d.forEach(l => {
      const id = `${l.NR_ZONA}-${l.NR_SECAO}-${l.NR_VOTAVEL}`;
      if (l.DS_CARGO?.toUpperCase() === cargo && !filtro.has(id)) {
        const e = l.NM_LOCAL_VOTACAO?.trim(); if (!e) return;
        if (!esc[e]) esc[e] = { v: [0,0,0], coord: [-8.3578, -36.6961] }; // Simplificado
        const v = parseInt(l.QT_VOTOS) || 0; const nv = l.NM_VOTAVEL?.toUpperCase();
        cands.forEach((o, i) => {
          if (o && ((o.num==='BN' && (nv?.includes('BRANCO')||nv?.includes('NULO'))) || l.NR_VOTAVEL?.trim()===o.num)) {
            esc[e].v[i] += v; vts[i] += v; filtro.add(id);
          }
        });
      }
    });
    setRes({ vts, det: Object.entries(esc) });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-white p-8 rounded-[40px] shadow-sm border grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
        <div><label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Ano</label>
          <select className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" onChange={e => {setCompAno(e.target.value); setRes(null);}}><option value="2024">2024</option><option value="2020">2020</option></select>
        </div>
        {[0,1,2].map(i => (
          <div key={i}>
            <label className={`text-[10px] font-black uppercase mb-2 block ${i===0?'text-emerald-500':i===1?'text-red-500':'text-blue-500'}`}>Oponente {i+1}</label>
            <select className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-[10px]" onChange={e => {
                const n = [...cands]; n[i] = e.target.value ? {nome: e.target.value.split(' - ')[0], num: e.target.value.split(' - ').pop()} : null;
                setCands(n);
            }}>
              <option value="">Nenhum</option>
              {lista.map((item, idx) => <option key={idx} value={item}>{item}</option>)}
            </select>
          </div>
        ))}
        <button onClick={comparar} className="bg-blue-700 text-white font-black py-4 rounded-2xl uppercase text-xs">Duelo</button>
      </div>
      {res && (
        <div className="space-y-6">
           <div className="grid grid-cols-3 gap-4">
              {cands.map((o, i) => o && (
                <div key={i} className={`p-6 rounded-3xl text-white ${i===0?'bg-emerald-500':i===1?'bg-red-500':'bg-blue-500'}`}>
                  <p className="text-[10px] uppercase font-bold opacity-70">{o.nome}</p>
                  <p className="text-3xl font-black">{res.vts[i]}</p>
                </div>
              ))}
           </div>
           <div className="bg-white p-6 rounded-3xl border h-[500px] overflow-y-auto">
              {res.det.map(([n, d], i) => (
                <div key={i} className="flex justify-between p-4 border-b last:border-0 items-center">
                  <span className="text-xs font-bold text-slate-500">{n}</span>
                  <div className="flex gap-4">
                    {cands.map((o, idx) => o && <span key={idx} className="text-xs font-black">{d.v[idx]}v</span>)}
                  </div>
                </div>
              ))}
           </div>
        </div>
      )}
    </div>
  );
}