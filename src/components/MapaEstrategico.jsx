import { useState, useMemo } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'

function HeatmapLayer({ points }) {
  const map = useMap();
  const [heatLayer, setHeatLayer] = useState(null);

  useState(() => {
    if (!map || !points || points.length === 0) return;
    const heat = L.heatLayer(points, { radius: 30, blur: 15, maxZoom: 13, gradient: { 0.4: 'blue', 0.6: 'cyan', 1: 'orange' } }).addTo(map);
    setHeatLayer(heat);
    return () => map.removeLayer(heat);
  }, [map, points]);
  return null;
}

export default function MapaEstrategico({ dados, cargo, apelidos }) {
  const [candRef, setCandRef] = useState(null);
  const [mapaTipo, setMapaTipo] = useState('marcadores');

  const removerAcentos = (str) => !str ? '' : str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const gerarCoordenada = (nome) => {
    let hash = 0;
    for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
    return [-8.3578 + ((hash % 100) / 3000), -36.6961 + (((hash >> 2) % 100) / 3000)];
  };

  const listaCands = useMemo(() => {
    const cSet = new Set();
    ['2020', '2024'].forEach(ano => {
      dados[ano].forEach(l => {
        if (l.DS_CARGO?.toUpperCase() === cargo && l.NR_VOTAVEL) {
          const nv = l.NM_VOTAVEL?.toUpperCase();
          if (nv?.includes('BRANCO') || nv?.includes('NULO')) cSet.add(`(${ano}) BRANCOS E NULOS - BN`);
          else cSet.add(`(${ano}) ${apelidos[ano][l.NR_VOTAVEL]?.apelido || l.NM_VOTAVEL} - ${l.NR_VOTAVEL}`);
        }
      });
    });
    return Array.from(cSet).sort();
  }, [dados, cargo, apelidos]);

  const processar = (fullStr) => {
    const num = fullStr.split(' - ').pop();
    const nome = fullStr.substring(7, fullStr.lastIndexOf(' - '));
    const proc = (ano) => {
      let tot = 0; const locs = {}; const filtro = new Set();
      dados[ano].forEach(l => {
        const id = `${l.NR_ZONA}-${l.NR_SECAO}-${l.NR_VOTAVEL}`;
        if (l.DS_CARGO?.toUpperCase() === cargo && !filtro.has(id)) {
          const match = (num === 'BN') ? (l.NM_VOTAVEL?.includes('BRANCO') || l.NM_VOTAVEL?.includes('NULO')) : (l.NR_VOTAVEL?.trim() === num);
          if (match) {
            const v = parseInt(l.QT_VOTOS) || 0; tot += v; filtro.add(id);
            const esc = l.NM_LOCAL_VOTACAO?.trim();
            if (esc) { if (!locs[esc]) locs[esc] = { tot: 0, coord: gerarCoordenada(esc) }; locs[esc].tot += v; }
          }
        }
      });
      return tot > 0 ? { tot, rnk: Object.entries(locs).map(([n,d])=>({esc: n, v: d.tot, coord: d.coord})), max: Math.max(...Object.values(locs).map(x => x.tot)) } : null;
    };
    setCandRef({ nome, d20: proc('2020'), d24: proc('2024') });
  };

  const criarIcone = (v, max, cor, modo) => L.divIcon({
    html: `<div style="background-color: ${modo ? 'rgba(0,0,0,0.05)' : cor}; border: ${modo ? 'none' : '1px solid black'}; border-radius: 50%; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 9px;">${modo ? '' : v}</div>`,
    className: '', iconSize: modo ? [10, 10] : [Math.max(25, (v/max)*70), Math.max(25, (v/max)*70)]
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {!candRef ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {listaCands.map((c, i) => (
            <button key={i} onClick={() => processar(c)} className="p-3 bg-white border rounded-xl text-[9px] font-black uppercase hover:border-blue-500 truncate text-left">{c}</button>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
           <div className="bg-white p-6 rounded-3xl shadow-sm border flex justify-between items-center">
              <h3 className="font-black text-slate-800 uppercase tracking-widest">{candRef.nome}</h3>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                 <button onClick={() => setMapaTipo('marcadores')} className={`px-6 py-2 rounded-lg text-xs font-black ${mapaTipo === 'marcadores' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>MARCADORES</button>
                 <button onClick={() => setMapaTipo('calor')} className={`px-6 py-2 rounded-lg text-xs font-black ${mapaTipo === 'calor' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>CALOR</button>
                 <button onClick={() => setCandRef(null)} className="ml-4 px-4 py-2 text-red-500 font-bold text-xs uppercase">X</button>
              </div>
           </div>
           {['d20', 'd24'].map(ano => candRef[ano] && (
             <div key={ano} className="bg-slate-900 p-2 rounded-[50px] shadow-2xl relative overflow-hidden">
                <span className={`absolute top-8 left-8 z-[1000] text-white px-8 py-2 rounded-full font-black text-sm uppercase ${ano==='d20'?'bg-blue-500':'bg-orange-500'}`}>{ano.replace('d', 'Eleição ')}</span>
                <div className="h-[600px] rounded-[45px] overflow-hidden border-[10px] border-slate-900">
                  <MapContainer center={[-8.3578, -36.6961]} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                    {mapaTipo === 'calor' && <HeatmapLayer points={candRef[ano].rnk.map(x => [x.coord[0], x.coord[1], x.v / (candRef[ano].tot/10)])} />}
                    {candRef[ano].rnk.map((l, i) => (
                      <Marker key={i} position={l.coord} icon={criarIcone(l.v, candRef[ano].max, ano==='d20'?'#3b82f6':'#f97316', mapaTipo==='calor')}>
                        <Tooltip sticky><span className="font-bold">{l.esc}</span><br/>{l.v} votos</Tooltip>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
             </div>
           ))}
        </div>
      )}
    </div>
  );
}