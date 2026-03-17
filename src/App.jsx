import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat' 
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'

// --- COMPONENTE DO MAPA DE CALOR ---
function HeatmapLayer({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !points || points.length === 0) return;
    const heat = L.heatLayer(points, { radius: 35, blur: 20, maxZoom: 13, gradient: { 0.4: 'blue', 0.6: 'lime', 1: 'red' } }).addTo(map);
    return () => map.removeLayer(heat);
  }, [map, points]);
  return null;
}

// --- FUNÇÕES AUXILIARES ---
const removerAcentos = (str) => !str ? '' : str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const gerarCoordenadaEscola = (nome) => {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  return [-8.3578 + ((hash % 100) / 3000), -36.6961 + (((hash >> 2) % 100) / 3000)];
};
const categorizarZona = (nome) => {
  const n = nome.toUpperCase();
  if (n.includes('MUTUCA') || n.includes('MIMOSO') || n.includes('PAPAGAIO') || n.includes('SALOBRO') || n.includes('PESQUEIRA') || n.includes('IPANEMA')) return 'RURAL';
  if (n.includes('CENTRO') || n.includes('CRISTO REI') || n.includes('MAGELA')) return 'CENTRO';
  return 'BAIRROS';
};

const criarIconeComparativo = (cor) => L.divIcon({
  html: `<div style="background-color: ${cor}; border: 2px solid white; border-radius: 50%; width: 22px; height: 22px; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
  className: '', iconSize: [22, 22], iconAnchor: [11, 11]
});

const criarIconeLeaflet = (votos, maxVotos, corBase, corBorda, modoCalor) => {
  if (modoCalor) return L.divIcon({ html: `<div style="background-color: rgba(255,255,255,0.1); border-radius: 50%; width: 10px; height: 10px;"></div>`, className: '', iconSize: [10, 10], iconAnchor: [5, 5] });
  const size = Math.min(Math.max((votos / maxVotos) * 85, 28), 85); 
  return L.divIcon({
    html: `<div style="background-color: ${corBase}; border: 2px solid ${corBorda}; border-radius: 50%; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: ${size > 35 ? '14px' : '11px'}; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;">${votos}</div>`,
    className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2]
  });
};

function App() {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [logado, setLogado] = useState(false);
  const [dados2020, setDados2020] = useState([]);
  const [dados2024, setDados2024] = useState([]);
  const [dicionarioApelidos, setDicionarioApelidos] = useState({ '2020': {}, '2024': {} });
  const [abaAtiva, setAbaAtiva] = useState('candidato'); 
  const [cargoAtivo, setCargoAtivo] = useState('PREFEITO'); 
  const [mapaTipo, setMapaTipo] = useState('marcadores'); 
  const [listaCandidatos, setListaCandidatos] = useState([]);
  const [listaEscolas, setListaEscolas] = useState([]);
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [resultadoCandidato, setResultadoCandidato] = useState(null);
  const [resultadoEscola, setResultadoEscola] = useState(null);
  const [compAno, setCompAno] = useState('2024');
  const [compCand1, setCompCand1] = useState(null);
  const [compCand2, setCompCand2] = useState(null);
  const [compCand3, setCompCand3] = useState(null);
  const [resultadoComp, setResultadoComp] = useState(null);

  const handleLogin = (e) => { e.preventDefault(); if (usuario === 'pesqueira' && senha === 'pesqueira10') setLogado(true); };

  useEffect(() => {
    if (logado) {
      Promise.all([
        new Promise(resolve => Papa.parse('/eleicoespesqueira2020.csv', { download: true, header: true, delimiter: ';', complete: resolve })),
        new Promise(resolve => Papa.parse('/eleicoespesqueira2024.csv', { download: true, header: true, delimiter: ';', complete: resolve })),
        fetch('/apelidos_2020.json').then(res => res.json()).catch(() => ({})),
        fetch('/apelidos_2024.json').then(res => res.json()).catch(() => ({}))
      ]).then(([resM20, resM24, a20, a24]) => {
        setDados2020(resM20.data); setDados2024(resM24.data);
        setDicionarioApelidos({ '2020': a20, '2024': a24 });
      });
    }
  }, [logado]);

  useEffect(() => {
    const cands = new Set(); const escolas = new Set();
    const processar = (dados, ano) => {
      dados.forEach(l => {
        if (l.NM_MUNICIPIO?.toUpperCase() !== 'PESQUEIRA') return;
        if (l.NM_LOCAL_VOTACAO) escolas.add(l.NM_LOCAL_VOTACAO.trim());
        if (l.DS_CARGO?.toUpperCase() === cargoAtivo) {
          const nomeV = l.NM_VOTAVEL?.toUpperCase();
          if (nomeV?.includes('BRANCO') || nomeV?.includes('NULO')) cands.add(`(${ano}) BRANCOS E NULOS - BN`);
          else if (l.NR_VOTAVEL) cands.add(`(${ano}) ${dicionarioApelidos[ano][l.NR_VOTAVEL]?.apelido || l.NM_VOTAVEL} - ${l.NR_VOTAVEL}`);
        }
      });
    };
    processar(dados2020, '2020'); processar(dados2024, '2024');
    setListaCandidatos(Array.from(cands).sort()); setListaEscolas(Array.from(escolas).sort());
  }, [cargoAtivo, dados2020, dados2024, dicionarioApelidos]);

  const analisarCandidato = (num, nome) => {
    const processar = (dados, ano) => {
      let total = 0; const locais = {}; const zonas = { 'CENTRO': 0, 'BAIRROS': 0, 'RURAL': 0 };
      const filtroDuplicidade = new Set();
      dados.forEach(l => {
        if (l.NM_MUNICIPIO?.toUpperCase() !== 'PESQUEIRA' || l.DS_CARGO?.toUpperCase() !== cargoAtivo) return;
        const idLinha = `${l.NR_ZONA}-${l.NR_SECAO}-${l.NR_VOTAVEL}`;
        if (filtroDuplicidade.has(idLinha)) return;

        const match = (num === 'BN') ? (l.NM_VOTAVEL?.includes('BRANCO') || l.NM_VOTAVEL?.includes('NULO')) : (l.NR_VOTAVEL?.trim() === num);
        if (match) {
          const v = parseInt(l.QT_VOTOS, 10) || 0; total += v;
          filtroDuplicidade.add(idLinha);
          const esc = l.NM_LOCAL_VOTACAO?.trim();
          if (esc) {
            zonas[categorizarZona(esc)] += v;
            if (!locais[esc]) locais[esc] = { total: 0, coord: gerarCoordenadaEscola(esc) };
            locais[esc].total += v;
          }
        }
      });
      return total > 0 ? { total, zonas, ranking: Object.entries(locais).map(([n,d])=>({escola:n, votos:d.total, coord:d.coord})).sort((a,b)=>b.votos-a.votos), max: Math.max(...Object.values(locais).map(x => x.total)) } : null;
    };
    setResultadoCandidato({ nome, a20: processar(dados2020, '2020'), a24: processar(dados2024, '2024') });
  };

  const analisarLocal = (escola) => {
    const processar = (dados, ano) => {
      let total = 0; const cands = {}; const filtro = new Set();
      dados.forEach(l => {
        if (l.NM_MUNICIPIO?.toUpperCase() !== 'PESQUEIRA' || l.DS_CARGO?.toUpperCase() !== cargoAtivo || l.NM_LOCAL_VOTACAO?.trim() !== escola) return;
        const id = `${l.NR_ZONA}-${l.NR_SECAO}-${l.NR_VOTAVEL}`;
        if (filtro.has(id)) return;
        const v = parseInt(l.QT_VOTOS, 10) || 0; total += v; filtro.add(id);
        const nv = l.NM_VOTAVEL?.toUpperCase();
        let ap = (nv?.includes('BRANCO') || nv?.includes('NULO')) ? 'BRANCOS E NULOS' : (dicionarioApelidos[ano][l.NR_VOTAVEL]?.apelido || nv);
        cands[ap] = (cands[ap] || 0) + v;
      });
      if (total === 0) return null;
      const sorted = Object.entries(cands).map(([n,v])=>({nome:n, votos:v, pct:((v/total)*100).toFixed(1)})).sort((a,b)=>b.votos-a.votos);
      const lider = sorted[0];
      const oposicaoTotal = total - lider.votos - (cands['BRANCOS E NULOS'] || 0);
      let status = lider.pct > 50 ? "DOMINADO" : (oposicaoTotal > lider.votos ? "CRÍTICO" : "DISPUTADO");
      return { total, ranking: sorted, status, oposicaoTotal };
    };
    setResultadoEscola({ escola, a20: processar(dados2020, '2020'), a24: processar(dados2024, '2024') });
  };

  const analisarComparativo = () => {
    if (!compCand1 || !compCand2) return;
    const d = compAno === '2020' ? dados2020 : dados2024;
    const escolas = {}; let vt1 = 0, vt2 = 0, vt3 = 0;
    d.forEach(l => {
      if (l.NM_MUNICIPIO?.toUpperCase() !== 'PESQUEIRA' || l.DS_CARGO?.toUpperCase() !== cargoAtivo) return;
      const esc = l.NM_LOCAL_VOTACAO?.trim(); if (!esc) return;
      if (!escolas[esc]) escolas[esc] = { v1: 0, v2: 0, v3: 0, coord: gerarCoordenadaEscola(esc) };
      const v = parseInt(l.QT_VOTOS, 10) || 0; const nv = l.NM_VOTAVEL?.toUpperCase();
      const m1 = (compCand1.num === 'BN') ? (nv?.includes('BRANCO') || nv?.includes('NULO')) : (l.NR_VOTAVEL?.trim() === compCand1.num);
      const m2 = (compCand2.num === 'BN') ? (nv?.includes('BRANCO') || nv?.includes('NULO')) : (l.NR_VOTAVEL?.trim() === compCand2.num);
      const m3 = compCand3 ? ((compCand3.num === 'BN') ? (nv?.includes('BRANCO') || nv?.includes('NULO')) : (l.NR_VOTAVEL?.trim() === compCand3.num)) : false;
      if (m1) { escolas[esc].v1 += v; vt1 += v; } if (m2) { escolas[esc].v2 += v; vt2 += v; } if (m3) { escolas[esc].v3 += v; vt3 += v; }
    });
    setResultadoComp({ vt1, vt2, vt3, detalhe: Object.entries(escolas) });
  };

  if (!logado) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md">
        <h1 className="text-3xl font-black text-slate-800 text-center mb-8 uppercase tracking-tighter">Eleição Inteligente</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="text" placeholder="Usuário" className="w-full px-4 py-4 bg-slate-50 border-2 rounded-2xl font-bold" onChange={e => setUsuario(e.target.value)} />
          <input type="password" placeholder="Senha" className="w-full px-4 py-4 bg-slate-50 border-2 rounded-2xl font-bold" onChange={e => setSenha(e.target.value)} />
          <button className="w-full bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-800 transition-all uppercase">Entrar</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans pb-20">
      {/* HEADER */}
      <div className="bg-white border-b sticky top-0 z-[1001] shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div><h1 className="text-xl font-black text-slate-800">PESQUEIRA ESTRATÉGICA</h1></div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setCargoAtivo('PREFEITO')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${cargoAtivo === 'PREFEITO' ? 'bg-blue-700 text-white shadow-md' : 'text-slate-400'}`}>PREFEITO</button>
            <button onClick={() => setCargoAtivo('VEREADOR')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${cargoAtivo === 'VEREADOR' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400'}`}>VEREADOR</button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 flex gap-8">
          {['candidato', 'escola', 'mapa', 'comparativo'].map(t => (
            <button key={t} onClick={() => setAbaAtiva(t)} className={`py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${abaAtiva === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-300'}`}>
              {t === 'candidato' ? '1. Números' : t === 'escola' ? '2. Escolas' : t === 'mapa' ? '3. Mapas' : '4. Mata-Mata'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
        {/* BUSCA */}
        {abaAtiva !== 'comparativo' && (
          <div className="mb-8 relative z-[1000]">
            <input type="text" placeholder={`Pesquisar...`} className="w-full p-6 bg-white border-2 border-slate-200 rounded-3xl shadow-sm text-lg font-bold outline-none focus:border-blue-600" value={termoPesquisa} onChange={e => {
              setTermoPesquisa(e.target.value);
              const alvo = (abaAtiva === 'escola' ? listaEscolas : listaCandidatos);
              setResultadoCandidato(null); setResultadoEscola(null);
            }} />
            {termoPesquisa && (
              <div className="absolute w-full mt-2 bg-white border rounded-3xl shadow-2xl max-h-60 overflow-y-auto z-[1001]">
                {(abaAtiva === 'escola' ? listaEscolas : listaCandidatos).filter(i => removerAcentos(i).includes(removerAcentos(termoPesquisa))).map((s, i) => (
                  <div key={i} className="p-4 hover:bg-blue-50 cursor-pointer font-bold border-b text-slate-700" onClick={() => {
                    if (abaAtiva === 'escola') analisarLocal(s);
                    else analisarCandidato(s.split(' - ').pop(), s.substring(7, s.lastIndexOf(' - ')));
                    setTermoPesquisa('');
                  }}>{s}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- ABA 1: NÚMEROS E GRÁFICOS (RESTAURADO) --- */}
        {abaAtiva === 'candidato' && resultadoCandidato && (
          <div className="space-y-8 animate-fade-in">
            <h2 className="text-4xl font-black text-slate-800 text-center uppercase tracking-tighter">{resultadoCandidato.nome}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-emerald-500 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <p className="text-[10px] font-black uppercase opacity-70 mb-2">Votos 2020</p>
                <p className="text-5xl font-black">{resultadoCandidato.a20?.total.toLocaleString('pt-PT') || 0}</p>
              </div>
              <div className="bg-blue-600 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <p className="text-[10px] font-black uppercase opacity-70 mb-2">Votos 2024</p>
                <p className="text-5xl font-black">{resultadoCandidato.a24?.total.toLocaleString('pt-PT') || 0}</p>
              </div>
              <div className={`p-8 rounded-3xl text-white shadow-xl relative overflow-hidden ${resultadoCandidato.a24?.total > resultadoCandidato.a20?.total ? 'bg-indigo-600' : 'bg-rose-600'}`}>
                <p className="text-[10px] font-black uppercase opacity-70 mb-2">Saldo Real</p>
                <p className="text-5xl font-black">{(resultadoCandidato.a24?.total || 0) - (resultadoCandidato.a20?.total || 0)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                  <h3 className="text-xs font-black text-slate-400 uppercase mb-8">Evolução por Eleição</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[{a:'2020', v:resultadoCandidato.a20?.total||0}, {a:'2024', v:resultadoCandidato.a24?.total||0}]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="a" axisLine={false} tickLine={false} tick={{fill:'#94a3b8', fontWeight:'bold'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill:'#94a3b8'}} />
                        <RechartsTooltip cursor={{fill:'#f8fafc'}} contentStyle={{borderRadius:'20px', border:'none', boxShadow:'0 10px 20px rgba(0,0,0,0.1)'}} />
                        <Bar dataKey="v" radius={[15, 15, 0, 0]} barSize={80}>
                           <Cell fill="#10b981" /><Cell fill="#3b82f6" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>
               <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                  <h3 className="text-xs font-black text-slate-400 uppercase mb-8">Distribuição por Zonas (2024)</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={Object.entries(resultadoCandidato.a24?.zonas || {}).map(([name, value]) => ({name, value}))} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                           <Cell fill="#3b82f6" /><Cell fill="#10b981" /><Cell fill="#f59e0b" />
                        </Pie>
                        <RechartsTooltip />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
               </div>
            </div>

            {/* TABELA DELTA (RESTAURADA) */}
            {resultadoCandidato.a20 && resultadoCandidato.a24 && (
               <div className="bg-slate-900 text-white p-10 rounded-[50px] shadow-2xl">
                 <h3 className="text-2xl font-black mb-10 uppercase tracking-tighter">📊 Balanço de Votos por Escola</h3>
                 <div className="overflow-x-auto max-h-[600px] custom-scrollbar pr-4">
                   <table className="w-full text-left border-separate border-spacing-y-2">
                     <thead className="text-[10px] font-black text-slate-500 uppercase">
                       <tr><th className="px-6">Local</th><th className="text-center">2020</th><th className="text-center">2024</th><th className="text-center">Saldo</th></tr>
                     </thead>
                     <tbody>
                       {listaEscolas.map(e => {
                         const v20 = resultadoCandidato.a20.ranking.find(x => x.escola === e)?.votos || 0;
                         const v24 = resultadoCandidato.a24.ranking.find(x => x.escola === e)?.votos || 0;
                         const d = v24 - v20; if (v20 === 0 && v24 === 0) return null;
                         return (
                           <tr key={e} className="bg-slate-800/40 hover:bg-slate-800 transition-all">
                             <td className="p-4 rounded-l-2xl text-xs font-bold">{e}</td>
                             <td className="text-center text-slate-400 font-mono">{v20}</td>
                             <td className="text-center font-black text-slate-100 font-mono">{v24}</td>
                             <td className="text-center rounded-r-2xl"><span className={`px-4 py-1 rounded-full text-[10px] font-black ${d > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>{d > 0 ? '▲ +' : '▼ '}{d}</span></td>
                           </tr>
                         );
                       })}
                     </tbody>
                   </table>
                 </div>
               </div>
            )}
          </div>
        )}

        {/* --- ABA 3: MAPAS (VERTICALIDADE E CLAREZA) --- */}
        {abaAtiva === 'mapa' && resultadoCandidato && (
          <div className="space-y-12 animate-fade-in">
             <div className="bg-white p-6 rounded-3xl shadow-sm border flex justify-between items-center">
                <h3 className="font-black text-slate-800 uppercase tracking-widest">Cartografia: {resultadoCandidato.nome}</h3>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                   <button onClick={() => setMapaTipo('marcadores')} className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${mapaTipo === 'marcadores' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>MARCADORES</button>
                   <button onClick={() => setMapaTipo('calor')} className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${mapaTipo === 'calor' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>CALOR</button>
                </div>
             </div>
             {['a20', 'a24'].map(ano => {
               const r = resultadoCandidato[ano]; if (!r) return null;
               return (
                 <div key={ano} className="bg-slate-900 p-2 rounded-[50px] shadow-2xl relative overflow-hidden">
                    <span className="absolute top-8 left-8 z-[1000] bg-blue-600 text-white px-8 py-2 rounded-full font-black text-sm uppercase shadow-2xl">{ano.replace('a', 'Eleição ')}</span>
                    <div className="h-[700px] rounded-[45px] overflow-hidden border-[12px] border-slate-900">
                      <MapContainer center={[-8.3578, -36.6961]} zoom={13} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                        {mapaTipo === 'marcadores' ? 
                          r.ranking.map((l, i) => <Marker key={i} position={l.coord} icon={criarIconeLeaflet(l.votos, r.max, ano==='a20'?'#10b981':'#3b82f6', '#000', false)}><Tooltip sticky><span className="font-bold">{l.escola}</span><br/>{l.votos} votos</Tooltip></Marker>)
                          : (
                            <>
                              <HeatmapLayer points={r.ranking.map(x => [x.coord[0], x.coord[1], x.votos / (r.total/10)])} />
                              {r.ranking.map((l, i) => <Marker key={i} position={l.coord} icon={criarIconeLeaflet(l.votos, 1, '', '', true)}><Tooltip sticky><span className="font-bold">{l.escola}</span><br/>{l.votos} votos</Tooltip></Marker>)}
                            </>
                          )
                        }
                      </MapContainer>
                    </div>
                 </div>
               );
             })}
          </div>
        )}

        {/* --- ABA 2: ESCOLAS (RAIO-X DOMÍNIO) --- */}
        {abaAtiva === 'escola' && resultadoEscola && (
          <div className="space-y-8 animate-fade-in">
            <h2 className="text-4xl font-black text-slate-800 text-center uppercase tracking-tighter">{resultadoEscola.escola}</h2>
            {['a20', 'a24'].map(ano => {
              const r = resultadoEscola[ano]; if (!r) return null;
              return (
                <div key={ano} className="bg-white p-12 rounded-[50px] shadow-sm border border-slate-100 relative overflow-hidden">
                  <div className={`absolute top-0 right-0 px-12 py-4 font-black text-xs text-white rounded-bl-[40px] shadow-lg ${r.status === 'DOMINADO' ? 'bg-blue-600' : (r.status === 'CRÍTICO' ? 'bg-rose-600' : 'bg-amber-500')}`}>{r.status}</div>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-[0.2em]">{ano.replace('a', 'Eleição ')}</p>
                  <p className="text-8xl font-black text-slate-800 mb-2">{r.total}v</p>
                  <p className="text-xs font-black text-slate-400 uppercase mb-12 pb-6 border-b">Oposição Unida: {r.oposicaoTotal}v</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {r.ranking.map((c, i) => (
                      <div key={i} className={`flex justify-between items-center p-6 rounded-[30px] border transition-all shadow-sm ${i === 0 ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-transparent hover:bg-white hover:border-slate-200'}`}>
                        <span className="text-xs font-black text-slate-600 truncate mr-4">{i+1}. {c.nome}</span>
                        <span className="text-xs font-black text-blue-700 bg-white px-4 py-2 rounded-full shadow-inner">{c.votos}v ({c.pct}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* --- ABA 4: MATA-MATA (DUELO TRIPLO) --- */}
        {abaAtiva === 'comparativo' && (
           <div className="space-y-8 animate-fade-in">
             <div className="bg-white p-8 rounded-[40px] shadow-sm border grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="md:col-span-1"><label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Ano</label><select className="w-full p-4 bg-slate-50 border-2 rounded-2xl font-bold outline-none" onChange={e => setCompAno(e.target.value)}><option value="2024">2024</option><option value="2020">2020</option></select></div>
                {[1,2,3].map(idx => (
                  <div key={idx} className="md:col-span-1">
                    <label className="text-[10px] font-black uppercase mb-2 block">Oponente {idx}</label>
                    <select className="w-full p-4 bg-slate-50 border-2 rounded-2xl font-bold outline-none" onChange={e => {
                        const val = e.target.value ? JSON.parse(e.target.value) : null;
                        if(idx===1) setCompCand1(val); if(idx===2) setCompCand2(val); if(idx===3) setCompCand3(val);
                    }}>
                      <option value="">Nenhum</option>
                      {listaCandidatos.filter(c => c.includes(`(${compAno})`)).map((c, i) => <option key={i} value={JSON.stringify({nome: c.split(' - ')[0].substring(7), num: c.split(' - ').pop()})}>{c.split(' - ')[0].substring(7)}</option>)}
                    </select>
                  </div>
                ))}
                <button onClick={analisarComparativo} className="bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl uppercase text-xs">Comparar</button>
             </div>
             {resultadoComp && (
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="h-[700px] bg-slate-900 rounded-[40px] overflow-hidden border-8 border-slate-900 shadow-2xl">
                    <MapContainer center={[-8.3578, -36.6961]} zoom={13} style={{ height: '100%', width: '100%' }}>
                       <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                       {resultadoComp.detalhe.map(([n, d], i) => {
                          const vts = [d.v1, d.v2, d.v3]; const win = vts.indexOf(Math.max(...vts));
                          const colors = ['#2563eb', '#e11d48', '#10b981'];
                          return <Marker key={i} position={d.coord} icon={criarIconeComparativo(Math.max(...vts) > 0 ? colors[win] : '#94a3b8')}><Tooltip sticky><span className="font-bold">{n}</span><br/>{compCand1?.nome}: {d.v1}v<br/>{compCand2?.nome}: {d.v2}v{compCand3 ? `<br/>${compCand3.nome}: ${d.v3}v` : ''}</Tooltip></Marker>
                       })}
                    </MapContainer>
                  </div>
                  <div className="space-y-4 overflow-y-auto max-h-[700px] pr-2 custom-scrollbar">
                     {resultadoComp.detalhe.sort((a,b) => (b[1].v1+b[1].v2+b[1].v3) - (a[1].v1+a[1].v2+a[1].v3)).map(([n, d], i) => (
                       <div key={i} className="bg-white p-6 rounded-[30px] border shadow-sm flex flex-col gap-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{n}</p>
                          <div className="flex gap-2">
                             <div className="flex-1 p-3 rounded-2xl bg-slate-50"><p className="text-[8px] font-bold text-slate-400 uppercase">{compCand1?.nome}</p><p className="font-black">{d.v1}v</p></div>
                             <div className="flex-1 p-3 rounded-2xl bg-slate-50"><p className="text-[8px] font-bold text-slate-400 uppercase">{compCand2?.nome}</p><p className="font-black">{d.v2}v</p></div>
                             {compCand3 && <div className="flex-1 p-3 rounded-2xl bg-slate-50"><p className="text-[8px] font-bold text-slate-400 uppercase">{compCand3.nome}</p><p className="font-black">{d.v3}v</p></div>}
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
             )}
           </div>
        )}
      </div>
    </div>
  );
}

export default App