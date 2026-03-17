import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet'

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

const criarIconeComparativo = (cor) => {
  return L.divIcon({
    html: `<div style="background-color: ${cor}; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`,
    className: '', iconSize: [24, 24], iconAnchor: [12, 12]
  });
};

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
  
  const [listaCandidatos, setListaCandidatos] = useState([]);
  const [listaEscolas, setListaEscolas] = useState([]);

  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  
  const [resultadoCandidato, setResultadoCandidato] = useState(null);
  const [resultadoEscola, setResultadoEscola] = useState(null);

  // ESTADOS DO COMPARATIVO (MATA-MATA)
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
    const nomesCandidatos = new Set();
    const nomesEscolasSet = new Set();
    
    const processarMapa = (linha, ano) => {
      const municipio = linha.NM_MUNICIPIO ? linha.NM_MUNICIPIO.trim().toUpperCase() : '';
      if (municipio !== 'PESQUEIRA') return;
      const escola = linha.NM_LOCAL_VOTACAO ? linha.NM_LOCAL_VOTACAO.trim() : '';
      if (escola) nomesEscolasSet.add(escola);
      const cargo = linha.DS_CARGO ? linha.DS_CARGO.trim().toUpperCase() : '';
      const numero = linha.NR_VOTAVEL ? linha.NR_VOTAVEL.trim() : '';
      const nomeVotavel = linha.NM_VOTAVEL ? linha.NM_VOTAVEL.trim().toUpperCase() : '';
      
      if (cargo === cargoAtivo) {
        if (nomeVotavel === 'VOTO BRANCO' || nomeVotavel === 'VOTO NULO' || nomeVotavel === 'VOTO NULO E BRANCO') {
          nomesCandidatos.add(`(${ano}) BRANCOS E NULOS - BN`);
        } else if (numero) {
          const apelido = dicionarioApelidos[ano][numero]?.apelido || linha.NM_VOTAVEL || 'NÃO IDENTIFICADO';
          nomesCandidatos.add(`(${ano}) ${apelido} - ${numero}`);
        }
      }
    };
    dadosMapa2020.forEach(l => processarMapa(l, '2020'));
    dadosMapa2024.forEach(l => processarMapa(l, '2024'));
    setListaCandidatos(Array.from(nomesCandidatos).sort());
    setListaEscolas(Array.from(nomesEscolasSet).sort());
    setTermoPesquisa(''); setResultadoCandidato(null); setResultadoEscola(null); setResultadoComp(null); setCompCand1(null); setCompCand2(null);
  }, [abaAtiva, cargoAtivo, dadosMapa2020, dadosMapa2024, dicionarioApelidos]);

  const handleDigitacao = (e) => {
    const valor = e.target.value;
    setTermoPesquisa(valor);
    const listaAlvo = (abaAtiva === 'candidato' || abaAtiva === 'mapa') ? listaCandidatos : listaEscolas;
    if (valor.length > 0) {
      const termoLimpo = removerAcentos(valor);
      const filtro = listaAlvo.filter(item => removerAcentos(item).includes(termoLimpo));
      setSugestoes(filtro); setMostrarSugestoes(filtro.length > 0);
    } else setMostrarSugestoes(false);
  };

  const selecionarItem = (item) => {
    setTermoPesquisa(item); setMostrarSugestoes(false);
    if (abaAtiva === 'candidato' || abaAtiva === 'mapa') {
      const partes = item.split(' - ');
      const num = partes.pop().trim();
      const nome = item.substring(7, item.lastIndexOf(' - ')).trim();
      analisarCandidato(num, nome);
    } else analisarLocal(item.trim());
  };

  const analisarCandidato = (numeroBusca, nomeExibicao) => {
    const processarAno = (dadosMapa, ano) => {
      let totalVotos = 0; const locais = {}; let max = 0;
      dadosMapa.forEach(linha => {
        if (linha.NM_MUNICIPIO?.trim().toUpperCase() !== 'PESQUEIRA' || linha.DS_CARGO?.trim().toUpperCase() !== cargoAtivo) return;
        let match = (numeroBusca === 'BN') ? (linha.NM_VOTAVEL?.includes('BRANCO') || linha.NM_VOTAVEL?.includes('NULO')) : (linha.NR_VOTAVEL?.trim() === numeroBusca);
        if (match) {
          const v = parseInt(linha.QT_VOTOS, 10) || 0; totalVotos += v;
          const esc = linha.NM_LOCAL_VOTACAO?.trim();
          if (esc) {
            if (!locais[esc]) locais[esc] = { totalEscola: 0, coord: gerarCoordenadaEscola(esc) };
            locais[esc].totalEscola += v;
            if (locais[esc].totalEscola > max) max = locais[esc].totalEscola;
          }
        }
      });
      if (totalVotos === 0) return null;
      return { total: totalVotos, maxVotosNumaEscola: max, rankingLocais: Object.entries(locais).map(([n, d]) => ({ escola: n, votos: d.totalEscola, coord: d.coord })).sort((a,b)=>b.votos-a.votos) };
    };
    setResultadoCandidato({ nomeExato: nomeExibicao, ano2020: processarAno(dadosMapa2020, '2020'), ano2024: processarAno(dadosMapa2024, '2024') });
  };

  const analisarLocal = (escolaBusca) => {
    const processarAno = (dadosMapa, ano) => {
      let total = 0; const cands = {};
      dadosMapa.forEach(linha => {
        if (linha.NM_MUNICIPIO?.trim().toUpperCase() !== 'PESQUEIRA' || linha.DS_CARGO?.trim().toUpperCase() !== cargoAtivo || linha.NM_LOCAL_VOTACAO?.trim() !== escolaBusca) return;
        const v = parseInt(linha.QT_VOTOS, 10) || 0; total += v;
        const num = linha.NR_VOTAVEL?.trim();
        const nomeV = linha.NM_VOTAVEL?.trim().toUpperCase();
        let apelido = (nomeV?.includes('BRANCO') || nomeV?.includes('NULO')) ? 'BRANCOS E NULOS' : (dicionarioApelidos[ano][num]?.apelido || nomeV);
        if (!cands[apelido]) cands[apelido] = 0; cands[apelido] += v;
      });
      if (total === 0) return null;
      return { total, rankingCandidatos: Object.entries(cands).map(([n,v])=>({nome:n, votos:v, percentual:((v/total)*100).toFixed(1)})).sort((a,b)=>b.votos-a.votos) };
    };
    setResultadoEscola({ nomeExato: escolaBusca, ano2020: processarAno(dadosMapa2020, '2020'), ano2024: processarAno(dadosMapa2024, '2024') });
  };

  // --- LÓGICA MATA-MATA (COMPARATIVO) ---
  const analisarComparativo = () => {
    if (!compCand1 || !compCand2) return;
    const dados = compAno === '2020' ? dadosMapa2020 : dadosMapa2024;
    const escolas = {};
    let vTotal1 = 0; let vTotal2 = 0;
    
    dados.forEach(linha => {
      if (linha.NM_MUNICIPIO?.trim().toUpperCase() !== 'PESQUEIRA' || linha.DS_CARGO?.trim().toUpperCase() !== cargoAtivo) return;
      const esc = linha.NM_LOCAL_VOTACAO?.trim();
      if (!esc) return;
      if (!escolas[esc]) escolas[esc] = { v1: 0, v2: 0, coord: gerarCoordenadaEscola(esc) };
      
      const v = parseInt(linha.QT_VOTOS, 10) || 0;
      const num = linha.NR_VOTAVEL?.trim();
      const nomeV = linha.NM_VOTAVEL?.toUpperCase();

      const match1 = (compCand1.num === 'BN') ? (nomeV?.includes('BRANCO') || nomeV?.includes('NULO')) : (num === compCand1.num);
      const match2 = (compCand2.num === 'BN') ? (nomeV?.includes('BRANCO') || nomeV?.includes('NULO')) : (num === compCand2.num);

      if (match1) { escolas[esc].v1 += v; vTotal1 += v; }
      if (match2) { escolas[esc].v2 += v; vTotal2 += v; }
    });

    const vitorias1 = Object.values(escolas).filter(e => e.v1 > e.v2).length;
    const vitorias2 = Object.values(escolas).filter(e => e.v2 > e.v1).length;
    setResultadoComp({ vTotal1, vTotal2, vitorias1, vitorias2, detalhe: Object.entries(escolas).sort((a,b) => b[1].v1 + b[1].v2 - (a[1].v1 + a[1].v2)) });
  };

  const getCandsPorAno = (ano) => {
    return listaCandidatos.filter(c => c.startsWith(`(${ano})`)).map(c => ({ nome: c.substring(7, c.lastIndexOf(' - ')).trim(), num: c.split(' - ').pop().trim() }));
  };

  if (logado) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col p-4 md:p-8 font-sans pb-20">
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 flex justify-between items-center border-l-4 border-blue-700">
          <div><h1 className="text-2xl md:text-3xl font-black text-slate-800">Eleição Inteligente</h1><p className="text-sm text-slate-500 font-medium tracking-widest uppercase">Pesqueira/PE</p></div>
          <button onClick={() => setLogado(false)} className="px-4 py-2 text-red-600 bg-red-50 rounded-lg font-bold">Sair</button>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-col md:flex-row gap-4 mb-8 bg-slate-50 p-2 rounded-xl">
            <button onClick={() => setCargoAtivo('PREFEITO')} className={`flex-1 py-3 px-4 rounded-lg font-black transition-all ${cargoAtivo === 'PREFEITO' ? 'bg-blue-700 text-white shadow-md' : 'text-slate-500'}`}>👔 Prefeito</button>
            <button onClick={() => setCargoAtivo('VEREADOR')} className={`flex-1 py-3 px-4 rounded-lg font-black transition-all ${cargoAtivo === 'VEREADOR' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500'}`}>🏛️ Vereador</button>
          </div>

          <div className="flex flex-wrap border-b mb-6 gap-y-2">
            {['candidato', 'escola', 'mapa', 'comparativo'].map(aba => (
              <button key={aba} onClick={() => {setAbaAtiva(aba); setTermoPesquisa(''); setResultadoEscola(null); setResultadoCandidato(null); setResultadoComp(null);}} className={`pb-4 px-6 font-bold text-lg border-b-4 transition-all ${abaAtiva === aba ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-400'}`}>
                {aba === 'candidato' ? '1. Candidatos e BN' : aba === 'escola' ? '2. Analisar Escola' : aba === 'mapa' ? '3. Mapa' : '4. Comparativo Mata-Mata'}
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
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in">
                  {listaEscolas.map((e, idx) => (
                    <button key={idx} onClick={() => analisarLocal(e)} className="text-left px-4 py-3 bg-white border rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all text-xs font-bold shadow-sm">{e}</button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-2 uppercase">Ano da Eleição</label>
                  <select value={compAno} onChange={(e)=>setCompAno(e.target.value)} className="w-full p-3 bg-white border rounded-lg font-bold">
                    <option value="2020">Eleição 2020</option>
                    <option value="2024">Eleição 2024</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-blue-500 mb-2 uppercase">Oponente 1 (Cor Azul)</label>
                  <select value={compCand1 ? JSON.stringify(compCand1) : ''} onChange={(e)=>setCompCand1(JSON.parse(e.target.value))} className="w-full p-3 bg-white border-2 border-blue-200 rounded-lg font-bold">
                    <option value="">Selecionar...</option>
                    {getCandsPorAno(compAno).map((c,i) => <option key={i} value={JSON.stringify(c)}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-red-500 mb-2 uppercase">Oponente 2 (Cor Vermelha)</label>
                  <select value={compCand2 ? JSON.stringify(compCand2) : ''} onChange={(e)=>setCompCand2(JSON.parse(e.target.value))} className="w-full p-3 bg-white border-2 border-red-200 rounded-lg font-bold">
                    <option value="">Selecionar...</option>
                    {getCandsPorAno(compAno).map((c,i) => <option key={i} value={JSON.stringify(c)}>{c.nome}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={analisarComparativo} disabled={!compCand1 || !compCand2} className="w-full mt-6 bg-blue-700 text-white font-black py-4 rounded-lg shadow-lg disabled:opacity-50 uppercase tracking-widest">Iniciar Mata-Mata</button>
            </div>
          )}
        </div>

        {/* MÓDULO COMPARATIVO (MATA-MATA) */}
        {abaAtiva === 'comparativo' && resultadoComp && (
          <div className="flex flex-col gap-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-600 p-8 rounded-2xl text-white shadow-xl">
                <p className="text-xs font-black uppercase mb-2 opacity-80">Total de Votos - {compCand1.nome}</p>
                <p className="text-5xl font-black">{resultadoComp.vTotal1.toLocaleString('pt-PT')}</p>
                <p className="mt-4 text-sm font-bold bg-blue-800/40 inline-block px-3 py-1 rounded">Venceu em {resultadoComp.vitorias1} escolas</p>
              </div>
              <div className="bg-red-600 p-8 rounded-2xl text-white shadow-xl">
                <p className="text-xs font-black uppercase mb-2 opacity-80">Total de Votos - {compCand2.nome}</p>
                <p className="text-5xl font-black">{resultadoComp.vTotal2.toLocaleString('pt-PT')}</p>
                <p className="mt-4 text-sm font-bold bg-red-800/40 inline-block px-3 py-1 rounded">Venceu em {resultadoComp.vitorias2} escolas</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row gap-8">
              <div className="lg:w-1/2 h-[600px] rounded-xl overflow-hidden border">
                <MapContainer center={[-8.3578, -36.6961]} zoom={13} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                  {resultadoComp.detalhe.map(([n, d], i) => {
                    const cor = d.v1 > d.v2 ? '#2563eb' : d.v2 > d.v1 ? '#dc2626' : '#64748b';
                    return (
                      <Marker key={i} position={d.coord} icon={criarIconeComparativo(cor)}>
                        <Tooltip><span className="font-bold">{n}</span><br/>{compCand1.nome}: {d.v1}v<br/>{compCand2.nome}: {d.v2}v</Tooltip>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>
              <div className="lg:w-1/2 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                <h4 className="font-black text-slate-800 uppercase mb-4 text-sm">Placar por Escola</h4>
                <div className="space-y-3">
                  {resultadoComp.detalhe.map(([n, d], i) => (
                    <div key={i} className="bg-slate-50 p-4 rounded-xl border flex flex-col gap-2">
                      <p className="font-black text-xs text-slate-400 uppercase">{n}</p>
                      <div className="flex items-center gap-4">
                        <div className={`flex-1 p-2 rounded-lg border-l-4 ${d.v1 > d.v2 ? 'bg-blue-50 border-blue-600' : 'bg-white'}`}>
                          <p className="text-[10px] font-bold text-slate-500 uppercase">{compCand1.nome}</p>
                          <p className={`text-lg font-black ${d.v1 > d.v2 ? 'text-blue-700' : 'text-slate-400'}`}>{d.v1}v</p>
                        </div>
                        <div className="font-black text-slate-300">VS</div>
                        <div className={`flex-1 p-2 rounded-lg border-r-4 text-right ${d.v2 > d.v1 ? 'bg-red-50 border-red-600' : 'bg-white'}`}>
                          <p className="text-[10px] font-bold text-slate-500 uppercase">{compCand2.nome}</p>
                          <p className={`text-lg font-black ${d.v2 > d.v1 ? 'text-red-700' : 'text-slate-400'}`}>{d.v2}v</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MÓDULOS ANTERIORES (CANDIDATO E ESCOLA) - MANTIDOS IGUAIS */}
        {abaAtiva === 'candidato' && resultadoCandidato && (
           <div className="bg-slate-900 rounded-xl shadow-lg p-8 text-white animate-fade-in flex flex-col gap-8">
            <h3 className="text-3xl font-black text-center text-blue-400 border-b border-slate-800 pb-4 uppercase">{resultadoCandidato.nomeExato}</h3>
            {gerarAnaliseDelta() && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h4 className="text-xl font-black mb-6 uppercase tracking-widest text-slate-400">📈 Evolução de Votos (2020 ➔ 2024)</h4>
                <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                  <thead className="bg-slate-900 uppercase text-xs font-black text-slate-500"><tr><th className="px-4 py-3">Escola</th><th className="text-center">2020</th><th className="text-center">2024</th><th className="text-center">Delta</th></tr></thead>
                  <tbody className="divide-y divide-slate-700">{gerarAnaliseDelta().map((d, i) => (
                    <tr key={i} className="hover:bg-slate-700/30"><td className="px-4 py-3 font-bold">{d.escola}</td><td className="text-center">{d.v20}</td><td className="text-center font-bold">{d.v24}</td><td className="text-center"><span className={`px-2 py-1 rounded font-black text-[10px] ${d.delta > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{d.delta > 0 ? '▲ +' : '▼ '}{d.delta}</span></td></tr>
                  ))}</tbody></table></div>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {['2020', '2024'].map(ano => {
                const res = resultadoCandidato[`ano${ano}`];
                return (
                  <div key={ano} className="bg-slate-800 p-6 rounded-xl border border-slate-700 h-[500px] flex flex-col">
                    <div className="flex justify-between mb-4"><p className="font-bold text-slate-400 uppercase text-xs tracking-widest">Ano {ano}</p><span className="bg-blue-600 px-2 py-1 rounded text-[10px] font-black">{ano}</span></div>
                    {res ? (<div className="flex flex-col h-full"><p className={`text-5xl font-black mb-4 ${ano === '2020' ? 'text-emerald-400' : 'text-blue-400'}`}>{res.total.toLocaleString('pt-PT')}</p>
                      <ul className="overflow-y-auto flex-1 space-y-2 pr-2 custom-scrollbar">
                        {res.rankingLocais.map((l, i) => <li key={i} className="bg-slate-900/50 p-3 rounded flex justify-between text-xs font-bold border-l-2 border-slate-600"><span>{i+1}. {l.escola}</span><span className={ano === '2020' ? 'text-emerald-400' : 'text-blue-400'}>{l.votos}v</span></li>)}
                      </ul></div>) : <p className="m-auto font-black text-slate-600 uppercase">Sem Dados</p>}
                  </div>
                );
              })}
            </div>
           </div>
        )}

        {abaAtiva === 'escola' && resultadoEscola && (
          <div className="bg-emerald-950 rounded-xl shadow-lg p-8 text-white border border-emerald-900 flex flex-col gap-6 animate-fade-in">
            <div className="flex justify-between items-center border-b border-emerald-900 pb-4">
              <h3 className="text-3xl font-black text-emerald-400 uppercase tracking-tighter">{resultadoEscola.nomeExato}</h3>
              <button onClick={() => setResultadoEscola(null)} className="px-4 py-2 bg-emerald-800 rounded-lg text-xs font-black uppercase">Fechar</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {['2020', '2024'].map(ano => {
                const res = resultadoEscola[`ano${ano}`];
                return (
                  <div key={ano} className="bg-emerald-900/40 p-6 rounded-xl border border-emerald-800 h-[500px] flex flex-col">
                    <p className="text-xs font-black mb-4 uppercase text-emerald-600 tracking-widest">Eleição {ano}</p>
                    {res ? (<div className="flex flex-col h-full"><p className="text-4xl font-black mb-4 text-emerald-400">{res.total}v</p>
                      <ul className="overflow-y-auto flex-1 space-y-2 pr-2 custom-scrollbar">
                        {res.rankingCandidatos.map((c, i) => <li key={i} className={`flex justify-between p-3 rounded text-xs font-bold ${c.nome === 'BRANCOS E NULOS' ? 'bg-slate-900 text-slate-400' : 'bg-emerald-950/50'}`}><span>{i+1}. {c.nome}</span><span className="text-amber-400">{c.votos}v ({c.percentual}%)</span></li>)}
                      </ul></div>) : <p className="m-auto font-black text-emerald-800 uppercase">Sem Dados</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {abaAtiva === 'mapa' && resultadoCandidato && (
           <div className="bg-slate-900 rounded-2xl p-6 h-[700px] border-4 border-slate-800 shadow-2xl animate-fade-in relative">
              <h3 className="absolute top-10 left-1/2 -translate-x-1/2 z-[1000] bg-white text-slate-900 px-6 py-2 rounded-full font-black shadow-xl uppercase text-sm border-2 border-blue-500">
                Mapa Geográfico: {resultadoCandidato.nomeExato}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 h-full gap-4 pt-12">
                {['2020', '2024'].map(ano => {
                   const res = resultadoCandidato[`ano${ano}`];
                   return (
                     <div key={ano} className="h-full rounded-xl overflow-hidden border-2 border-slate-700 relative">
                        <div className="absolute top-4 right-4 z-[1000] bg-slate-800 text-white px-3 py-1 rounded-lg font-black text-xs">{ano}</div>
                        {res ? (
                          <MapContainer center={[-8.3578, -36.6961]} zoom={13} style={{ height: '100%', width: '100%' }}>
                            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                            {res.rankingLocais.map((l, i) => <Marker key={i} position={l.coord} icon={criarIconeLeaflet(l.votos, res.maxVotosNumaEscola, ano === '2020' ? 'rgba(16, 185, 129, 0.8)' : 'rgba(59, 130, 246, 0.8)', ano === '2020' ? '#047857' : '#1d4ed8')}><Tooltip><span className="font-bold">{l.escola}</span><br/>{l.votos}v</Tooltip></Marker>)}
                          </MapContainer>
                        ) : <div className="h-full flex items-center justify-center bg-slate-800 text-slate-600 font-black">SEM DADOS</div>}
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
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <h1 className="text-3xl font-black text-slate-800 text-center mb-8 tracking-tighter uppercase">Eleição Inteligente</h1>
        <form onSubmit={handleLogin} className="space-y-6">
          <input type="text" placeholder="Usuário" className="w-full px-4 py-3 bg-slate-50 border rounded-lg outline-none" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
          <input type="password" placeholder="Senha" className="w-full px-4 py-3 bg-slate-50 border rounded-lg outline-none" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <button type="submit" className="w-full bg-blue-700 text-white font-black py-4 rounded-lg shadow-xl uppercase tracking-widest">Aceder Inteligência</button>
        </form>
      </div>
    </div>
  );
}

export default App