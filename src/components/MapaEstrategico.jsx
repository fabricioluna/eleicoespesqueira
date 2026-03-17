import { useState, useMemo, useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat' 

// --- COMPONENTE LAYER DE CALOR ---
function HeatmapLayer({ points, color }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !points || points.length === 0) return;
    
    const gradient = color === 'blue' 
      ? { 0.2: '#93c5fd', 0.5: '#3b82f6', 1: '#1d4ed8' } 
      : { 0.2: '#fdba74', 0.5: '#f97316', 1: '#ea580c' };

    const heatLayer = L.heatLayer(points, { 
      radius: 40,
      blur: 25,
      maxZoom: 13,
      max: 1.0,
      gradient: gradient
    }).addTo(map);

    return () => { 
      if (map && heatLayer) map.removeLayer(heatLayer); 
    };
  }, [map, points, color]);

  return null;
}

export default function MapaEstrategico({ dados, cargo, apelidos }) {
  const [candSel, setCandSel] = useState(null);
  const [mapaTipo, setMapaTipo] = useState('marcadores');

  const gerarCoordenada = (nome) => {
    let hash = 0;
    for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
    return [-8.3578 + ((hash % 100) / 3000), -36.6961 + (((hash >> 2) % 100) / 3000)];
  };

  const listaCands = useMemo(() => {
    const cSet = new Set();
    ['2020', '2024'].forEach(ano => {
      if (!dados[ano]) return;
      dados[ano].forEach(l => {
        if (l.DS_CARGO?.toUpperCase() === cargo) {
          const nv = l.NM_VOTAVEL?.toUpperCase();
          if (nv?.includes('BRANCO') || nv?.includes('NULO')) cSet.add(`BN|BRANCOS E NULOS`);
          else if (l.NR_VOTAVEL) {
            const ap = apelidos[ano]?.[l.NR_VOTAVEL]?.apelido || l.NM_VOTAVEL;
            cSet.add(`${l.NR_VOTAVEL}|${ap}`);
          }
        }
      });
    });
    return Array.from(cSet).sort((a, b) => a.split('|')[1].localeCompare(b.split('|')[1]));
  }, [dados, cargo, apelidos]);

  const processar = (num, nome) => {
    const procAno = (ano) => {
      if (ano === '2020' && nome.toUpperCase().includes('SEBASTIAO')) return null;
      let tot = 0; const locs = {}; const filtro = new Set();
      if (!dados[ano]) return null;

      dados[ano].forEach(l => {
        const id = `${l.NR_ZONA}-${l.NR_SECAO}-${l.NR_VOTAVEL}`;
        if (l.DS_CARGO?.toUpperCase() === cargo && !filtro.has(id)) {
          const match = (num === 'BN') ? (l.NM_VOTAVEL?.includes('BRANCO') || l.NM_VOTAVEL?.includes('NULO')) : (l.NR_VOTAVEL?.trim() === num);
          if (match) {
            const v = parseInt(l.QT_VOTOS) || 0; tot += v; filtro.add(id);
            let esc = l.NM_LOCAL_VOTACAO?.trim() || "OUTRAS SEÇÕES";
            const escFinal = (esc === "#NULO" || esc === "") ? "OUTRAS SEÇÕES / VOTOS GERAIS" : esc;
            if (!locs[escFinal]) locs[escFinal] = { tot: 0, coord: gerarCoordenada(escFinal) };
            locs[escFinal].tot += v;
          }
        }
      });
      return tot > 0 ? { tot, rnk: Object.entries(locs).map(([n, d]) => ({ esc: n, v: d.tot, coord: d.coord })), max: Math.max(...Object.values(locs).map(x => x.tot)) } : null;
    };
    setResComp(null); // Limpa comparativo se houver
    setCandSel({ nome, d20: procAno('2020'), d24: procAno('2024') });
  };

  // Funções de Ícones Dinâmicos
  const getIcon = (v, max, color, isCalorMode) => {
    if (isCalorMode) {
      // Marcador invisível mas com área de clique/hover grande (40px)
      return L.divIcon({
        className: 'calor-trigger',
        html: `<div style="width: 100%; height: 100%; background: transparent;"></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
    }
    // Marcador visual normal (Círculos com números)
    const size = Math.max(30, (v / max) * 85);
    return L.divIcon({
      html: `<div style="background-color: ${color}; border: 2px solid white; border-radius: 50%; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 10px; box-shadow: 0 0 15px rgba(0,0,0,0.4);">${v}</div>`,
      className: '', 
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {!candSel ? (
        <div className="bg-white p-10 rounded-[45px] border shadow-sm">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-widest">Cartografia Estratégica</h2>
            <p className="text-slate-400 text-xs font-bold mt-2 uppercase">Mapa de calor e densidade eleitoral</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button onClick={() => processar('BN', 'BRANCOS E NULOS')} className="p-5 bg-slate-900 text-white rounded-3xl font-black uppercase text-xs hover:bg-black transition-all">Brancos e Nulos</button>
            {listaCands.filter(c => !c.includes('BN|')).map((item, i) => {
              const [num, nome] = item.split('|');
              return (
                <button key={i} onClick={() => processar(num, nome)} className="p-5 bg-slate-50 border rounded-3xl hover:border-blue-500 hover:bg-white transition-all text-left">
                  <p className="text-[9px] font-black text-slate-400">Nº {num}</p>
                  <p className="font-black text-xs text-slate-700 truncate uppercase">{nome}</p>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border flex flex-col md:flex-row justify-between items-center gap-6">
            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">{candSel.nome}</h2>
            <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
              <button onClick={() => setMapaTipo('marcadores')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${mapaTipo === 'marcadores' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Marcadores</button>
              <button onClick={() => setMapaTipo('calor')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${mapaTipo === 'calor' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>Mapa de Calor</button>
            </div>
            <button onClick={()=>setCandSel(null)} className="bg-rose-50 text-rose-600 px-6 py-2 rounded-xl font-black text-[10px] uppercase border border-rose-100">← Voltar</button>
          </div>

          <div className="flex flex-col gap-10">
            {['d20', 'd24'].map(anoKey => {
              const r = candSel[anoKey];
              const is20 = anoKey === 'd20';
              if (!r) return (
                <div key={anoKey} className="bg-slate-100 h-40 rounded-[40px] flex items-center justify-center border-2 border-dashed border-slate-200">
                    <p className="font-black text-slate-400 uppercase text-xs">Sem dados históricos em {is20 ? '2020' : '2024'}</p>
                </div>
              );

              return (
                <div key={`${candSel.nome}-${anoKey}`} className="bg-slate-900 p-3 rounded-[60px] shadow-2xl relative overflow-hidden">
                  <div className={`absolute top-8 left-8 z-[1000] px-8 py-3 rounded-full text-white font-black text-sm uppercase shadow-2xl border-2 border-white/10 ${is20 ? 'bg-blue-600' : 'bg-orange-500'}`}>
                    Eleição {is20 ? '2020' : '2024'}
                  </div>

                  <div className="h-[650px] rounded-[50px] overflow-hidden border-[12px] border-slate-900">
                    <MapContainer 
                      key={`${candSel.nome}-${anoKey}-${mapaTipo}`}
                      center={[-8.3578, -36.6961]} 
                      zoom={13} 
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                      
                      {mapaTipo === 'calor' && (
                        <HeatmapLayer 
                          points={r.rnk.map(x => [x.coord[0], x.coord[1], x.v / r.max])} 
                          color={is20 ? 'blue' : 'orange'} 
                        />
                      )}

                      {r.rnk.map((l, i) => (
                        <Marker 
                          key={i} 
                          position={l.coord} 
                          icon={getIcon(l.v, r.max, is20 ? '#2563eb' : '#f97316', mapaTipo === 'calor')}
                        >
                          <Tooltip sticky>
                            <div className="p-2 min-w-[120px]">
                              <p className="text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 pb-1 mb-1">{l.esc}</p>
                              <div className="flex justify-between items-end">
                                <span className="text-xs font-bold text-slate-500 uppercase">Votos:</span>
                                <span className={`text-sm font-black ${is20 ? 'text-blue-600' : 'text-orange-600'}`}>{l.v.toLocaleString('pt-PT')}</span>
                              </div>
                            </div>
                          </Tooltip>
                        </Marker>
                      ))}
                    </MapContainer>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}