import { useState, useEffect, useRef } from 'react'
import Papa from 'papaparse'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat' // Importa o motor de calor
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'

// --- COMPONENTE DO MAPA DE CALOR ---
function HeatmapLayer({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !points || points.length === 0) return;
    const heat = L.heatLayer(points, {
      radius: 35,
      blur: 20,
      maxZoom: 13,
      gradient: { 0.4: 'blue', 0.6: 'lime', 1: 'red' }
    }).addTo(map);
    return () => map.removeLayer(heat);
  }, [map, points]);
  return null;
}

// --- FUNÇÕES AUXILIARES ---
const removerAcentos = (str) => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

const gerarCoordenadaEscola = (nomeEscola) => {
  let hash = 0;
  for (let i = 0; i < nomeEscola.length; i++) hash = nomeEscola.charCodeAt(i) + ((hash << 5) - hash);
  return [-8.3578 + ((hash % 100) / 3000), -36.6961 + (((hash >> 2) % 100) / 3000)];
};

// Lógica de Agrupamento por Bairros/Zonas de Pesqueira
const categorizarZona = (nome) => {
  const n = nome.toUpperCase();
  if (n.includes('MUTUCA') || n.includes('MIMOSO') || n.includes('PAPAGAIO') || n.includes('SALOBRO') || n.includes('PESQUEIRA') || n.includes('IPANEMA')) return 'DISTRITOS / RURAL';
  if (n.includes('CENTRO') || n.includes('CRISTO REI') || n.includes('MAGELA')) return 'CENTRO';
  if (n.includes('PRADO') || n.includes('XUCURUS')) return 'BAIRRO: PRADO';
  return 'OUTROS BAIRROS';
};

const criarIconeComparativo = (cor) => L.divIcon({
  html: `<div style="background-color: ${cor}; border: 2px solid white; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 0 8px rgba(0,0,0,0.4);"></div>`,
  className: '', iconSize: [20, 20], iconAnchor: [10, 10]
});

const criarIconeLeaflet = (votos, maxVotos, corBase, corBorda) => {
  const size = Math.min(Math.max((votos / maxVotos) * 85, 28), 85); 
  return L.divIcon({
    html: `<div style="background-color: ${corBase}; border: 2px solid ${corBorda}; border-radius: 50%; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: ${size > 35 ? '14px' : '11px'}; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;">${votos}</div>`,
    className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2]
  });
};

function App() {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [logado, setLogado] = useState(false);
  const [dadosMapa2020, setDadosMapa2020] = useState([]);
  const [dadosMapa2024, setDadosMapa2024] = useState([]);
  const [dicionarioApelidos, setDicionarioApelidos] = useState({ '2020': {}, '2024': {} });
  const [carregando, setCarregando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('candidato'); 
  const [cargoAtivo, setCargoAtivo] = useState('PREFEITO'); 
  const [mapaTipo, setMapaTipo] = useState('marcadores'); // 'marcadores' ou 'calor'
  
  const [listaCandidatos, setListaCandidatos] = useState([]);
  const [listaEscolas, setListaEscolas] = useState([]);
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  
  const [resultadoCandidato, setResultadoCandidato] = useState(null);
  const [resultadoEscola, setResultadoEscola] = useState(null);

  const [compAno, setCompAno] = useState('2024');
  const [compCand1, setCompCand1] = useState(null);
  const [compCand2, setCompCand2] = useState(null);
  const [resultadoComp, setResultadoComp] = useState(null);

  const handleLogin = (e) => {
    e.preventDefault();
    if (usuario === 'pesqueira' && senha === 'pesqueira10') {
      setLogado(true); setErro('');
    } else setErro('Credenciais incorretas.');
  };

  useEffect(() => {
    if (logado) {
      setCarregando(true);
      Promise.all([
        new Promise(resolve => Papa.parse('/eleicoespesqueira2020.csv', { download: true, header: true, delimiter: ';', skipEmptyLines: true, complete: resolve, error: () => resolve({data:[]}) })),
        new Promise(resolve => Papa.parse('/eleicoespesqueira2024.csv', { download: true, header: true, delimiter: ';', skipEmptyLines: true, complete: resolve, error: () => resolve({data:[]}) })),
        fetch('/apelidos_2020.json').then(res => res.ok ? res.json() : {}).catch(() => ({})),
        fetch('/apelidos_2024.json').then(res => res.ok ? res.json() : {}).catch(() => ({}))
      ]).then(([resM20, resM24, apelidos20, apelidos24]) => {
        setDadosMapa2020(resM20.data);
        setDadosMapa2024(resM24.data);
        setDicionarioApelidos({ '2020': apelidos20, '2024': apelidos24 });
        setCarregando(false);
      });
    }
  }, [logado]);

  useEffect(() => {
    const cands = new Set(); const escolas = new Set();
    const processar = (linha, ano) => {
      if (linha.NM_MUNICIPIO?.trim().toUpperCase() !== 'PESQUEIRA') return;
      const esc = linha.NM_LOCAL_VOTACAO?.trim();
      if (esc) escolas.add(esc);
      if (linha.DS_CARGO?.trim().toUpperCase() === cargoAtivo) {
        const nomeV = linha.NM_VOTAVEL?.toUpperCase();
        if (nomeV?.includes('BRANCO') || nomeV?.includes('NULO')) cands.add(`(${ano}) BRANCOS E NULOS - BN`);
        else if (linha.NR_VOTAVEL) {
          const apelido = dicionarioApelidos[ano][linha.NR_VOTAVEL]?.apelido || linha.NM_VOTAVEL || 'N/A';
          cands.add(`(${ano}) ${apelido} - ${linha.NR_VOTAVEL}`);
        }
      }
    };
    dadosMapa2020.forEach(l => processar(l, '2020'));
    dadosMapa2024.forEach(l => processar(l, '2024'));
    setListaCandidatos(Array.from(cands).sort());
    setListaEscolas(Array.from(escolas).sort());
    setResultadoCandidato(null); setResultadoEscola(null); setResultadoComp(null);
  }, [cargoAtivo, dadosMapa2020, dadosMapa2024, dicionarioApelidos]);

  const handleDigitacao = (e) => {
    const v = e.target.value; setTermoPesquisa(v);
    const alvo = (abaAtiva === 'candidato' || abaAtiva === 'mapa') ? listaCandidatos : listaEscolas;
    if (v.length > 0) {
      const filtro = alvo.filter(item => removerAcentos(item).includes(removerAcentos(v)));
      setSugestoes(filtro); setMostrarSugestoes(filtro.length > 0);
    } else setMostrarSugestoes(false);
  };

  const selecionarItem = (item) => {
    setTermoPesquisa(item); setMostrarSugestoes(false);
    if (abaAtiva === 'candidato' || abaAtiva === 'mapa') {
      const num = item.split(' - ').pop().trim();
      const nome = item.substring(7, item.lastIndexOf(' - ')).trim();
      analisarCandidato(num, nome);
    } else analisarLocal(item.trim());
  };

  const analisarCandidato = (numBusca, nomeExibicao) => {
    const processar = (dados, ano) => {
      let total = 0; const locais = {}; let max = 0; const zonas = {};
      dados.forEach(l => {
        if (l.NM_MUNICIPIO?.toUpperCase() !== 'PESQUEIRA' || l.DS_CARGO?.toUpperCase() !== cargoAtivo) return;
        const match = (numBusca === 'BN') ? (l.NM_VOTAVEL?.includes('BRANCO') || l.NM_VOTAVEL?.includes('NULO')) : (l.NR_VOTAVEL?.trim() === numBusca);
        if (match) {
          const v = parseInt(l.QT_VOTOS, 10) || 0; total += v;
          const esc = l.NM_LOCAL_VOTACAO?.trim();
          if (esc) {
            const z = categorizarZona(esc);
            zonas[z] = (zonas[z] || 0) + v;
            if (!locais[esc]) locais[esc] = { total: 0, coord: gerarCoordenadaEscola(esc) };
            locais[esc].total += v; if (locais[esc].total > max) max = locais[esc].total;
          }
        }
      });
      if (total === 0) return null;
      return { total, max, zonas, ranking: Object.entries(locais).map(([n,d])=>({escola:n, votos:d.total, coord:d.coord})).sort((a,b)=>b.votos-a.votos) };
    };
    setResultadoCandidato({ nome: nomeExibicao, ano2020: processar(dadosMapa2020, '2020'), ano2024: processar(dadosMapa2024, '2024') });
  };

  const analisarLocal = (escola) => {
    const processar = (dados, ano) => {
      let total = 0; const cands = {};
      dados.forEach(l => {
        if (l.NM_MUNICIPIO?.toUpperCase() !== 'PESQUEIRA' || l.DS_CARGO?.toUpperCase() !== cargoAtivo || l.NM_LOCAL_VOTACAO?.trim() !== escola) return;
        const v = parseInt(l.QT_VOTOS, 10) || 0; total += v;
        const num = l.NR_VOTAVEL?.trim();
        const nomeV = l.NM_VOTAVEL?.toUpperCase();
        let apelido = (nomeV?.includes('BRANCO') || nomeV?.includes('NULO')) ? 'BRANCOS E NULOS' : (dicionarioApelidos[ano][num]?.apelido || nomeV);
        cands[apelido] = (cands[apelido] || 0) + v;
      });
      if (total === 0) return null;
      return { total, ranking: Object.entries(cands).map(([n,v])=>({nome:n, votos:v, pct:((v/total)*100).toFixed(1)})).sort((a,b)=>b.votos-a.votos) };
    };
    setResultadoEscola({ escola, ano2020: processar(dadosMapa2020, '2020'), ano2024: processar(dadosMapa2024, '2024') });
  };

  const analisarComparativo = () => {
    if (!compCand1 || !compCand2) return;
    const dados = compAno === '2020' ? dadosMapa2020 : dadosMapa2024;
    const escolas = {}; let v1 = 0; let v2 = 0;
    dados.forEach(l => {
      if (l.NM_MUNICIPIO?.toUpperCase() !== 'PESQUEIRA' || l.DS_CARGO?.toUpperCase() !== cargoAtivo) return;
      const esc = l.NM_LOCAL_VOTACAO?.trim(); if (!esc) return;
      if (!escolas[esc]) escolas[esc] = { v1: 0, v2: 0, coord: gerarCoordenadaEscola(esc) };
      const v = parseInt(l.QT_VOTOS, 10) || 0;
      const match1 = (compCand1.num === 'BN') ? (l.NM_VOTAVEL?.toUpperCase().includes('BRANCO') || l.NM_VOTAVEL?.toUpperCase().includes('NULO')) : (l.NR_VOTAVEL?.trim() === compCand1.num);
      const match2 = (compCand2.num === 'BN') ? (l.NM_VOTAVEL?.toUpperCase().includes('BRANCO') || l.NM_VOTAVEL?.toUpperCase().includes('NULO')) : (l.NR_VOTAVEL?.trim() === compCand2.num);
      if (match1) { escolas[esc].v1 += v; v1 += v; }
      if (match2) { escolas[esc].v2 += v; v2 += v; }
    });
    setResultadoComp({ v1, v2, v1Esc: Object.values(escolas).filter(e=>e.v1>e.v2).length, v2Esc: Object.values(escolas).filter(e=>e.v2>e.v1).length, detalhe: Object.entries(escolas).sort((a,b)=>b[1].v1+b[1].v2 - (a[1].v1+a[1].v2)) });
  };

  const getPointsCalor = (res) => {
    if (!res) return [];
    return res.ranking.map(l => [l.coord[0], l.coord[1], l.votos / res.max]);
  };

  if (logado) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col p-4 md:p-8 font-sans pb-20">
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 flex justify-between items-center border-l-4 border-blue-700">
          <div><h1 className="text-2xl md:text-3xl font-black text-slate-800">Eleição Inteligente</h1><p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Pesqueira/PE</p></div>
          <button onClick={() => setLogado(false)} className="px-4 py-2 text-red-600 bg-red-50 rounded-lg font-bold">Sair</button>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <button onClick={() => setCargoAtivo('PREFEITO')} className={`flex-1 py-3 rounded-lg font-black transition-all ${cargoAtivo === 'PREFEITO' ? 'bg-blue-700 text-white shadow-md' : 'bg-slate-50 text-slate-500'}`}>👔 Prefeito</button>
            <button onClick={() => setCargoAtivo('VEREADOR')} className={`flex-1 py-3 rounded-lg font-black transition-all ${cargoAtivo === 'VEREADOR' ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-50 text-slate-500'}`}>🏛️ Vereador</button>
          </div>

          <div className="flex flex-wrap border-b mb-6 gap-y-2">
            {['candidato', 'escola', 'mapa', 'comparativo'].map(aba => (
              <button key={aba} onClick={() => {setAbaAtiva(aba); setTermoPesquisa(''); setResultadoEscola(null); setResultadoCandidato(null); setResultadoComp(null);}} className={`pb-4 px-6 font-bold text-sm border-b-4 transition-all ${abaAtiva === aba ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-400'}`}>
                {aba === 'candidato' ? '1. Analisar Candidato' : aba === 'escola' ? '2. Por Escola' : aba === 'mapa' ? '3. Mapa Estratégico' : '4. Comparativo Mata-Mata'}
              </button>
            ))}
          </div>
          
          {abaAtiva !== 'comparativo' ? (
            <div className="relative z-50">
              <input type="text" placeholder="Pesquisar..." className="w-full px-4 py-4 bg-slate-50 border-2 rounded-lg text-lg outline-none focus:border-blue-500" value={termoPesquisa} onChange={handleDigitacao} />
              {mostrarSugestoes && (
                <ul className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {sugestoes.map((s, i) => <li key={i} onClick={() => selecionarItem(s)} className="px-4 py-3 hover:bg-slate-100 cursor-pointer border-b last:border-0 font-bold text-sm">{s}</li>)}
                </ul>
              )}
              {abaAtiva === 'escola' && !resultadoEscola && (
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {listaEscolas.map((e, idx) => (
                    <button key={idx} onClick={() => analisarLocal(e)} className="text-left px-4 py-3 bg-white border rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all text-[10px] font-black uppercase shadow-sm">{e}</button>
                  ))}
                </div>
              )}
              {(abaAtiva === 'candidato' || abaAtiva === 'mapa') && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {Array.from(new Map(listaCandidatos.map(c => [c.substring(7, c.lastIndexOf(' - ')), c.split(' - ').pop()])).entries())
                    .filter(([n]) => cargoAtivo === 'PREFEITO' || n === 'BRANCOS E NULOS')
                    .map(([n, num], i) => (
                      <button key={i} onClick={() => analisarCandidato(num, n)} className={`px-4 py-2 border rounded-lg font-bold text-[10px] uppercase shadow-sm ${n === 'BRANCOS E NULOS' ? 'bg-slate-800 text-white' : 'bg-white hover:border-blue-500'}`}>{n}</button>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 animate-fade-in grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-1"><label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Ano</label><select value={compAno} onChange={(e)=>setCompAno(e.target.value)} className="w-full p-3 border rounded-lg font-bold"><option value="2020">2020</option><option value="2024">2024</option></select></div>
                <div className="md:col-span-1"><label className="text-[10px] font-black uppercase text-blue-500 mb-2 block">Oponente 1</label><select value={compCand1 ? JSON.stringify(compCand1) : ''} onChange={(e)=>setCompCand1(JSON.parse(e.target.value))} className="w-full p-3 border-2 border-blue-100 rounded-lg font-bold"><option value="">Selec...</option>{listaCandidatos.filter(c=>c.startsWith(`(${compAno})`)).map((c,i)=><option key={i} value={JSON.stringify({nome:c.substring(7, c.lastIndexOf(' - ')), num:c.split(' - ').pop()})}>{c.substring(7, c.lastIndexOf(' - '))}</option>)}</select></div>
                <div className="md:col-span-1"><label className="text-[10px] font-black uppercase text-red-500 mb-2 block">Oponente 2</label><select value={compCand2 ? JSON.stringify(compCand2) : ''} onChange={(e)=>setCompCand2(JSON.parse(e.target.value))} className="w-full p-3 border-2 border-red-100 rounded-lg font-bold"><option value="">Selec...</option>{listaCandidatos.filter(c=>c.startsWith(`(${compAno})`)).map((c,i)=><option key={i} value={JSON.stringify({nome:c.substring(7, c.lastIndexOf(' - ')), num:c.split(' - ').pop()})}>{c.substring(7, c.lastIndexOf(' - '))}</option>)}</select></div>
                <button onClick={analisarComparativo} disabled={!compCand1 || !compCand2} className="w-full bg-blue-700 text-white font-black py-4 rounded-lg uppercase text-xs">Comparar</button>
            </div>
          )}
        </div>

        {/* RESULTADO CANDIDATO / REGIONALIZAÇÃO */}
        {resultadoCandidato && (abaAtiva === 'candidato' || abaAtiva === 'mapa') && (
          <div className="bg-slate-900 rounded-2xl shadow-2xl p-6 text-white flex flex-col gap-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-800 pb-6">
              <h3 className="text-3xl font-black text-blue-400 uppercase tracking-tighter">{resultadoCandidato.nome}</h3>
              {abaAtiva === 'mapa' && (
                <div className="flex bg-slate-800 p-1 rounded-lg">
                  <button onClick={() => setMapaTipo('marcadores')} className={`px-4 py-2 rounded font-black text-[10px] uppercase transition-all ${mapaTipo === 'marcadores' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Marcadores</button>
                  <button onClick={() => setMapaTipo('calor')} className={`px-4 py-2 rounded font-black text-[10px] uppercase transition-all ${mapaTipo === 'calor' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Mapa de Calor</button>
                </div>
              )}
            </div>

            {/* RESUMO POR ZONA (NOVIDADE MÓDULO 3) */}
            {abaAtiva === 'candidato' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['2020', '2024'].map(ano => {
                  const res = resultadoCandidato[`ano${ano}`];
                  if (!res) return null;
                  return (
                    <div key={ano} className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                      <p className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Peso Regional {ano}</p>
                      <div className="space-y-3">
                        {Object.entries(res.zonas).sort((a,b)=>b[1]-a[1]).map(([z, v]) => (
                          <div key={z}>
                            <div className="flex justify-between text-xs font-bold mb-1"><span>{z}</span><span>{v}v</span></div>
                            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{width: `${(v/res.total*100)}%`}}></div></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {['2020', '2024'].map(ano => {
                const res = resultadoCandidato[`ano${ano}`];
                return (
                  <div key={ano} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 h-[600px] flex flex-col relative">
                    <span className="absolute top-6 right-6 bg-blue-600 px-3 py-1 rounded-full text-[10px] font-black">{ano}</span>
                    {res ? (
                      <div className="flex flex-col h-full">
                        <p className="text-xs font-black text-slate-500 uppercase mb-1">Votação Total</p>
                        <p className={`text-6xl font-black mb-6 ${ano === '2020' ? 'text-emerald-400' : 'text-blue-400'}`}>{res.total.toLocaleString('pt-PT')}</p>
                        
                        {abaAtiva === 'mapa' && (
                          <div className="h-[350px] mb-6 rounded-xl overflow-hidden border-2 border-slate-900 shadow-inner">
                            <MapContainer center={[-8.3578, -36.6961]} zoom={13} style={{ height: '100%', width: '100%' }}>
                              <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                              {mapaTipo === 'marcadores' ? 
                                res.ranking.map((l, i) => <Marker key={i} position={l.coord} icon={criarIconeLeaflet(l.votos, res.max, ano === '2020' ? '#10b981' : '#3b82f6', '#000')}><Tooltip><span className="font-bold">{l.escola}</span><br/>{l.votos}v</Tooltip></Marker>)
                                : <HeatmapLayer points={getPointsCalor(res)} />
                              }
                            </MapContainer>
                          </div>
                        )}
                        
                        <ul className="overflow-y-auto flex-1 space-y-2 pr-2 custom-scrollbar">
                          {res.ranking.map((l, i) => (
                            <li key={i} className="bg-slate-900/50 p-3 rounded-xl flex justify-between text-xs font-bold border-l-4 border-slate-700">
                              <span className="truncate pr-4">{i+1}. {l.escola}</span>
                              <span className={ano === '2020' ? 'text-emerald-400' : 'text-blue-400'}>{l.votos}v</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : <div className="m-auto font-black text-slate-600 uppercase text-3xl">Sem Dados</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* COMPARATIVO MATA-MATA (MÓDULO 2) */}
        {abaAtiva === 'comparativo' && resultadoComp && (
          <div className="flex flex-col gap-8 animate-fade-in">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-600 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden">
                   <div className="absolute -right-4 -bottom-4 text-9xl font-black opacity-10">01</div>
                   <p className="text-[10px] font-black uppercase mb-2 opacity-70">{compCand1.nome}</p>
                   <p className="text-6xl font-black">{resultadoComp.v1.toLocaleString('pt-PT')}</p>
                   <p className="mt-4 font-black text-xs bg-black/20 inline-block px-4 py-1 rounded-full">Líder em {resultadoComp.v1Esc} escolas</p>
                </div>
                <div className="bg-red-600 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden">
                   <div className="absolute -right-4 -bottom-4 text-9xl font-black opacity-10">02</div>
                   <p className="text-[10px] font-black uppercase mb-2 opacity-70">{compCand2.nome}</p>
                   <p className="text-6xl font-black">{resultadoComp.v2.toLocaleString('pt-PT')}</p>
                   <p className="mt-4 font-black text-xs bg-black/20 inline-block px-4 py-1 rounded-full">Líder em {resultadoComp.v2Esc} escolas</p>
                </div>
             </div>
             <div className="bg-white p-4 rounded-3xl shadow-sm border h-[600px] overflow-hidden">
                <MapContainer center={[-8.3578, -36.6961]} zoom={13} style={{ height: '100%', width: '100%' }}>
                   <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                   {resultadoComp.detalhe.map(([n, d], i) => (
                      <Marker key={i} position={d.coord} icon={criarIconeComparativo(d.v1 > d.v2 ? '#2563eb' : d.v2 > d.v1 ? '#dc2626' : '#94a3b8')}>
                         <Tooltip><span className="font-bold">{n}</span><br/>{compCand1.nome}: {d.v1}v<br/>{compCand2.nome}: {d.v2}v</Tooltip>
                      </Marker>
                   ))}
                </MapContainer>
             </div>
          </div>
        )}

        {/* POR ESCOLA (MANTIDO) */}
        {abaAtiva === 'escola' && resultadoEscola && (
          <div className="bg-emerald-950 rounded-2xl shadow-2xl p-8 text-white animate-fade-in flex flex-col gap-6">
            <div className="flex justify-between items-center border-b border-emerald-900 pb-4"><h3 className="text-3xl font-black text-emerald-400 uppercase tracking-tighter">{resultadoEscola.escola}</h3><button onClick={()=>setResultadoEscola(null)} className="px-4 py-2 bg-emerald-800 rounded-lg text-[10px] font-black uppercase">Fechar</button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {['2020', '2024'].map(ano => {
                const res = resultadoEscola[`ano${ano}`];
                return (
                  <div key={ano} className="bg-emerald-900/40 p-6 rounded-2xl border border-emerald-800 h-[500px] flex flex-col">
                    <p className="text-[10px] font-black mb-4 uppercase text-emerald-600 tracking-widest">Eleição {ano}</p>
                    {res ? (<div className="flex flex-col h-full"><p className="text-5xl font-black mb-6 text-emerald-400">{res.total}v</p><ul className="overflow-y-auto flex-1 space-y-2 pr-2 custom-scrollbar">{res.ranking.map((c, i) => <li key={i} className={`flex justify-between p-3 rounded-xl text-xs font-bold ${c.nome === 'BRANCOS E NULOS' ? 'bg-slate-900 text-slate-400' : 'bg-emerald-950/50'}`}><span>{i+1}. {c.nome}</span><span className="text-amber-400">{c.votos}v ({c.pct}%)</span></li>)}</ul></div>) : <p className="m-auto font-black text-emerald-800 uppercase">Sem Dados</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md">
        <h1 className="text-4xl font-black text-slate-800 text-center mb-10 tracking-tighter uppercase">Eleição Inteligente</h1>
        <form onSubmit={handleLogin} className="space-y-6">
          <input type="text" placeholder="Usuário" className="w-full px-4 py-4 bg-slate-50 border-2 rounded-xl outline-none focus:border-blue-600" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
          <input type="password" placeholder="Senha" className="w-full px-4 py-4 bg-slate-50 border-2 rounded-xl outline-none focus:border-blue-600" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <button type="submit" className="w-full bg-blue-700 text-white font-black py-5 rounded-xl shadow-xl uppercase tracking-widest hover:bg-blue-800 transition-all">Aceder Painel</button>
        </form>
      </div>
    </div>
  );
}

export default App