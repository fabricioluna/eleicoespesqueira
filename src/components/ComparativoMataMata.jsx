import { useState, useMemo, useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet'

export default function ComparativoMataMata({ dados, cargo, apelidos }) {
  const [compAno, setCompAno] = useState('2024');
  const [cand1, setCand1] = useState(null);
  const [cand2, setCand2] = useState(null);
  const [cand3, setCand3] = useState(null);
  const [res, setRes] = useState(null);

  // --- TRAVA DE SEGURANÇA: Só gera a lista se os dados existirem ---
  const listaCands = useMemo(() => {
    const cSet = new Set();
    
    // Verifica se dados e o ano específico existem
    if (!dados || !dados[compAno]) return [];

    dados[compAno].forEach(l => {
      if (l.DS_CARGO?.toUpperCase() === cargo) {
        const nv = l.NM_VOTAVEL?.toUpperCase();
        if (nv?.includes('BRANCO') || nv?.includes('NULO')) {
          cSet.add(`BN|BRANCOS E NULOS`);
        } else if (l.NR_VOTAVEL) {
          const ap = apelidos?.[compAno]?.[l.NR_VOTAVEL]?.apelido || l.NM_VOTAVEL;
          cSet.add(`${l.NR_VOTAVEL}|${ap}`);
        }
      }
    });
    return Array.from(cSet).sort((a, b) => a.split('|')[1].localeCompare(b.split('|')[1]));
  }, [dados, compAno, cargo, apelidos]);

  const gerarCoordenada = (nome) => {
    let hash = 0;
    for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
    return [-8.3578 + ((hash % 100) / 3000), -36.6961 + (((hash >> 2) % 100) / 3000)];
  };

  const processarDuelo = () => {
    // Verifica se os dados estão prontos antes de processar
    if (!dados || !dados[compAno] || (!cand1 && !cand2)) return;

    const d = dados[compAno];
    const escolas = {};
    let tot1 = 0, tot2 = 0, tot3 = 0;
    const filtro = new Set();

    d.forEach(l => {
      const id = `${l.NR_ZONA}-${l.NR_SECAO}-${l.NR_VOTAVEL}`;
      if (l.DS_CARGO?.toUpperCase() === cargo && !filtro.has(id)) {
        const v = parseInt(l.QT_VOTOS) || 0;
        const numVotavel = l.NR_VOTAVEL?.trim();
        const nomeVotavel = l.NM_VOTAVEL?.toUpperCase();

        let esc = l.NM_LOCAL_VOTACAO?.trim() || "OUTRAS SEÇÕES";
        const escFinal = (esc === "#NULO" || esc === "") ? "OUTRAS SEÇÕES / VOTOS GERAIS" : esc;

        if (!escolas[escFinal]) {
          escolas[escFinal] = { v1: 0, v2: 0, v3: 0, coord: gerarCoordenada(escFinal) };
        }

        const checkMatch = (cand) => {
          if (!cand) return false;
          if (cand.num === 'BN') return nomeVotavel?.includes('BRANCO') || nomeVotavel?.includes('NULO');
          return numVotavel === cand.num;
        };

        if (checkMatch(cand1)) { escolas[escFinal].v1 += v; tot1 += v; filtro.add(id); }
        else if (checkMatch(cand2)) { escolas[escFinal].v2 += v; tot2 += v; filtro.add(id); }
        else if (checkMatch(cand3)) { escolas[escFinal].v3 += v; tot3 += v; filtro.add(id); }
      }
    });

    setRes({ tot1, tot2, tot3, detalhe: Object.entries(escolas) });
  };

  const criarIconeVencedor = (v1, v2, v3) => {
    let cor = '#94a3b8'; 
    if (v1 > v2 && v1 > v3) cor = '#10b981';      
    else if (v2 > v1 && v2 > v3) cor = '#ef4444'; 
    else if (v3 > v1 && v3 > v2) cor = '#3b82f6'; 

    return L.divIcon({
      html: `<div style="background-color: ${cor}; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
      className: '', iconSize: [24, 24], iconAnchor: [12, 12]
    });
  };

  // Se não houver dados ainda, mostra um carregando simples
  if (!dados || !dados['2024']) {
    return <div className="text-center p-20 font-black text-slate-400 uppercase">Carregando Banco de Dados...</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Ano Base</label>
            <select 
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none"
              value={compAno}
              onChange={(e) => { setCompAno(e.target.value); setRes(null); setCand1(null); setCand2(null); setCand3(null); }}
            >
              <option value="2024">Eleição 2024</option>
              <option value="2020">Eleição 2020</option>
            </select>
          </div>

          {[1, 2, 3].map(idx => (
            <div key={idx}>
              <label className={`text-[10px] font-black uppercase mb-2 block ${idx===1?'text-emerald-500':idx===2?'text-red-500':'text-blue-500'}`}>
                Candidato {idx}
              </label>
              <select 
                className={`w-full p-4 bg-slate-50 border-2 rounded-2xl font-bold text-[10px] outline-none ${idx===1?'border-emerald-50':idx===2?'border-red-50':'border-blue-50'}`}
                onChange={(e) => {
                  const val = e.target.value ? { num: e.target.value.split('|')[0], nome: e.target.value.split('|')[1] } : null;
                  if (idx === 1) setCand1(val); if (idx === 2) setCand2(val); if (idx === 3) setCand3(val);
                }}
              >
                <option value="">Selecione...</option>
                {listaCands.map((c, i) => <option key={i} value={c}>{c.split('|')[1]}</option>)}
              </select>
            </div>
          ))}

          <button 
            onClick={processarDuelo}
            disabled={!cand1 && !cand2}
            className="bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl uppercase text-xs hover:bg-black transition-all disabled:opacity-30"
          >
            Comparar
          </button>
        </div>
      </div>

      {res && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900 p-3 rounded-[50px] shadow-2xl relative overflow-hidden">
               <div className="absolute top-8 right-8 z-[1000] bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-white space-y-2">
                  <p className="text-[8px] font-black uppercase opacity-60">Legenda de Domínio</p>
                  {cand1 && <div className="flex items-center gap-2 text-[10px] font-bold"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> {cand1.nome}</div>}
                  {cand2 && <div className="flex items-center gap-2 text-[10px] font-bold"><div className="w-2 h-2 bg-red-500 rounded-full"></div> {cand2.nome}</div>}
                  {cand3 && <div className="flex items-center gap-2 text-[10px] font-bold"><div className="w-2 h-2 bg-blue-500 rounded-full"></div> {cand3.nome}</div>}
               </div>
               <div className="h-[700px] rounded-[40px] overflow-hidden">
                  <MapContainer center={[-8.3578, -36.6961]} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                    {res.detalhe.map(([n, d], i) => (
                      <Marker key={i} position={d.coord} icon={criarIconeVencedor(d.v1, d.v2, d.v3)}>
                        <Tooltip sticky>
                          <div className="p-2 font-sans">
                            <p className="text-[10px] font-black uppercase border-b mb-2">{n}</p>
                            <div className="space-y-1">
                              {cand1 && <p className="text-xs font-bold text-emerald-600">{cand1.nome}: {d.v1}v</p>}
                              {cand2 && <p className="text-xs font-bold text-red-600">{cand2.nome}: {d.v2}v</p>}
                              {cand3 && <p className="text-xs font-bold text-blue-600">{cand3.nome}: {d.v3}v</p>}
                            </div>
                          </div>
                        </Tooltip>
                      </Marker>
                    ))}
                  </MapContainer>
               </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="grid grid-cols-1 gap-4">
               {cand1 && <div className="bg-emerald-500 p-6 rounded-[30px] text-white shadow-lg"><p className="text-[10px] font-black uppercase opacity-70">Total {cand1.nome}</p><p className="text-4xl font-black">{res.tot1.toLocaleString('pt-PT')}</p></div>}
               {cand2 && <div className="bg-red-500 p-6 rounded-[30px] text-white shadow-lg"><p className="text-[10px] font-black uppercase opacity-70">Total {cand2.nome}</p><p className="text-4xl font-black">{res.tot2.toLocaleString('pt-PT')}</p></div>}
               {cand3 && <div className="bg-blue-500 p-6 rounded-[30px] text-white shadow-lg"><p className="text-[10px] font-black uppercase opacity-70">Total {cand3.nome}</p><p className="text-4xl font-black">{res.tot3.toLocaleString('pt-PT')}</p></div>}
            </div>
            <div className="bg-white p-8 rounded-[40px] border shadow-sm h-[480px] overflow-y-auto custom-scrollbar">
               <h4 className="text-xs font-black text-slate-400 uppercase mb-6 tracking-widest">Território por Escola</h4>
               <div className="space-y-3">
                  {res.detalhe.sort((a,b) => (b[1].v1 + b[1].v2 + b[1].v3) - (a[1].v1 + a[1].v2 + a[1].v3)).map(([n, d], i) => {
                    const max = Math.max(d.v1, d.v2, d.v3);
                    return (
                      <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-2 truncate">{n}</p>
                        <div className="flex gap-2">
                           {cand1 && <div className={`flex-1 p-2 rounded-xl text-center ${d.v1 === max && d.v1 > 0 ? 'bg-emerald-500 text-white shadow-md' : 'bg-white'}`}><p className="text-[10px] font-black">{d.v1}</p></div>}
                           {cand2 && <div className={`flex-1 p-2 rounded-xl text-center ${d.v2 === max && d.v2 > 0 ? 'bg-red-500 text-white shadow-md' : 'bg-white'}`}><p className="text-[10px] font-black">{d.v2}</p></div>}
                           {cand3 && <div className={`flex-1 p-2 rounded-xl text-center ${d.v3 === max && d.v3 > 0 ? 'bg-blue-500 text-white shadow-md' : 'bg-white'}`}><p className="text-[10px] font-black">{d.v3}</p></div>}
                        </div>
                      </div>
                    )
                  })}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}