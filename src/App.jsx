import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet'

// --- FUNÇÕES AUXILIARES DE INTELIGÊNCIA ---
const removerAcentos = (str) => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

const calcularDistancia = (a, b) => {
  const matriz = [];
  for (let i = 0; i <= b.length; i++) matriz[i] = [i];
  for (let j = 0; j <= a.length; j++) matriz[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) matriz[i][j] = matriz[i - 1][j - 1];
      else matriz[i][j] = Math.min(matriz[i - 1][j - 1] + 1, Math.min(matriz[i][j - 1] + 1, matriz[i - 1][j] + 1));
    }
  }
  return matriz[b.length][a.length];
};

const gerarCoordenadaEscola = (nomeEscola) => {
  let hash = 0;
  for (let i = 0; i < nomeEscola.length; i++) {
    hash = nomeEscola.charCodeAt(i) + ((hash << 5) - hash);
  }
  const offsetLat = (hash % 100) / 3000; 
  const offsetLng = ((hash >> 2) % 100) / 3000;
  return [-8.3578 + offsetLat, -36.6961 + offsetLng];
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

  const [dados2020, setDados2020] = useState([]);
  const [dados2024, setDados2024] = useState([]);
  const [carregando, setCarregando] = useState(false);

  const [abaAtiva, setAbaAtiva] = useState('candidato'); 
  
  const [listaCandidatos, setListaCandidatos] = useState([]);
  const [listaEscolas, setListaEscolas] = useState([]);

  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [sugestaoCorrecao, setSugestaoCorrecao] = useState(null);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  
  const [resultadoCandidato, setResultadoCandidato] = useState(null);
  const [resultadoEscola, setResultadoEscola] = useState(null);

  const handleLogin = (e) => {
    e.preventDefault();
    if (usuario === 'pesqueira' && senha === 'pesqueira10') {
      setLogado(true); setErro('');
    } else {
      setErro('Credenciais incorretas. Acesso negado.');
    }
  };

  useEffect(() => {
    if (logado) {
      setCarregando(true);
      Papa.parse('/eleicoespesqueira2020.csv', {
        download: true, header: true, delimiter: ';', skipEmptyLines: true,
        complete: (resultado20) => {
          setDados2020(resultado20.data);
          Papa.parse('/eleicoespesqueira2024.csv', {
            download: true, header: true, delimiter: ';', skipEmptyLines: true,
            complete: (resultado24) => { setDados2024(resultado24.data); setCarregando(false); }
          });
        }
      });
    }
  }, [logado]);

  // --- FILTRO DE EXTRAÇÃO BLINDADO (LIMPEZA TOTAL) ---
  useEffect(() => {
    const nomesCandidatos = new Set();
    const nomesEscolas = new Set();
    
    const processarLinha = (linha, ano) => {
      // 1. TRAVA MUNICÍPIO: Ignora tudo que não for de Pesqueira
      const municipio = linha.NM_MUNICIPIO ? linha.NM_MUNICIPIO.trim().toUpperCase() : '';
      if (municipio !== 'PESQUEIRA') return;

      // 2. Limpeza de espaços invisíveis e maiúsculas
      const cargo = linha.DS_CARGO ? linha.DS_CARGO.trim().toUpperCase() : '';
      const nomeUrna = linha.NM_VOTAVEL ? linha.NM_VOTAVEL.trim() : '';
      const numero = linha.NR_VOTAVEL ? linha.NR_VOTAVEL.trim() : '';
      const escola = linha.NM_LOCAL_VOTACAO ? linha.NM_LOCAL_VOTACAO.trim() : '';

      if (cargo === 'VEREADOR' && nomeUrna && numero) {
        nomesCandidatos.add(`(${ano}) ${nomeUrna} - ${numero}`);
      }
      if (escola) {
        nomesEscolas.add(escola);
      }
    };

    dados2020.forEach(linha => processarLinha(linha, '2020'));
    dados2024.forEach(linha => processarLinha(linha, '2024'));

    setListaCandidatos(Array.from(nomesCandidatos).sort());
    setListaEscolas(Array.from(nomesEscolas).sort());
    
    setTermoPesquisa(''); setResultadoCandidato(null); setResultadoEscola(null); setSugestaoCorrecao(null);
  }, [abaAtiva, dados2020, dados2024]);

  const handleDigitacao = (e) => {
    const valor = e.target.value;
    setTermoPesquisa(valor);
    const listaAlvo = (abaAtiva === 'candidato' || abaAtiva === 'mapa') ? listaCandidatos : listaEscolas;
    
    if (valor.length > 0) {
      const termoLimpo = removerAcentos(valor);
      const filtro = listaAlvo.filter(item => removerAcentos(item).includes(termoLimpo));
      
      if (filtro.length > 0) {
        setSugestoes(filtro); setMostrarSugestoes(true); setSugestaoCorrecao(null);
      } else {
        setSugestoes([]); setMostrarSugestoes(false);
        if (termoLimpo.length > 3) {
          let melhorMatch = ''; let menorDistancia = Infinity;
          listaAlvo.forEach(item => {
            let textoComparacao = item;
            if (abaAtiva === 'candidato' || abaAtiva === 'mapa') {
               const ultimoTraco = item.lastIndexOf(' - ');
               textoComparacao = item.substring(7, ultimoTraco).trim();
            }
            const distancia = calcularDistancia(termoLimpo, removerAcentos(textoComparacao));
            if (distancia < menorDistancia) { menorDistancia = distancia; melhorMatch = item; }
          });
          if (menorDistancia <= 4) setSugestaoCorrecao(melhorMatch);
          else setSugestaoCorrecao(null);
        }
      }
    } else {
      setMostrarSugestoes(false); setSugestaoCorrecao(null);
    }
  };

  const selecionarItem = (item) => {
    setTermoPesquisa(item); setMostrarSugestoes(false); setSugestaoCorrecao(null);
    
    if (abaAtiva === 'candidato' || abaAtiva === 'mapa') {
      const ultimoTracoIndex = item.lastIndexOf(' - ');
      const nomeExato = item.substring(7, ultimoTracoIndex).trim();
      analisarCandidato(nomeExato);
    } else {
      analisarLocal(item.trim());
    }
  };

  // --- MATEMÁTICA DE VOTOS BLINDADA ---
  const analisarCandidato = (nomeBusca) => {
    const processarAno = (dados) => {
      let totalVotos = 0; const locais = {};
      let maxVotosNumaEscola = 0; 

      dados.forEach(linha => {
        const municipio = linha.NM_MUNICIPIO ? linha.NM_MUNICIPIO.trim().toUpperCase() : '';
        if (municipio !== 'PESQUEIRA') return;

        const cargo = linha.DS_CARGO ? linha.DS_CARGO.trim().toUpperCase() : '';
        const nomeUrna = linha.NM_VOTAVEL ? linha.NM_VOTAVEL.trim() : '';
        
        if (cargo === 'VEREADOR' && nomeUrna === nomeBusca) {
          const votos = parseInt(linha.QT_VOTOS, 10) || 0;
          totalVotos += votos;
          
          const escola = linha.NM_LOCAL_VOTACAO ? linha.NM_LOCAL_VOTACAO.trim() : '';
          const secao = linha.NR_SECAO ? linha.NR_SECAO.trim() : '';
          
          if (escola) {
            if (!locais[escola]) locais[escola] = { totalEscola: 0, secoesDetalhe: {}, coord: gerarCoordenadaEscola(escola) };
            locais[escola].totalEscola += votos;
            if (secao) {
              if (!locais[escola].secoesDetalhe[secao]) locais[escola].secoesDetalhe[secao] = 0;
              locais[escola].secoesDetalhe[secao] += votos;
            }
            if (locais[escola].totalEscola > maxVotosNumaEscola) maxVotosNumaEscola = locais[escola].totalEscola;
          }
        }
      });

      if (totalVotos === 0) return null;

      const rankingLocais = Object.entries(locais)
        .map(([escolaNome, dadosLocal]) => {
          const secoesTexto = Object.entries(dadosLocal.secoesDetalhe)
            .sort((a, b) => b[1] - a[1])
            .map(([sec, vts]) => `Seção ${sec}: ${vts}v`)
            .join(' | ');
          return { escola: escolaNome, votos: dadosLocal.totalEscola, coord: dadosLocal.coord, secoesTexto };
        })
        .sort((a, b) => b.votos - a.votos);

      return { total: totalVotos, rankingLocais, maxVotosNumaEscola };
    };

    setResultadoCandidato({ nomeExato: nomeBusca, ano2020: processarAno(dados2020), ano2024: processarAno(dados2024) });
  };

  const analisarLocal = (escolaBusca) => {
    const processarAno = (dados) => {
      let totalVotosEscola = 0; const candidatos = {};
      
      dados.forEach(linha => {
        const municipio = linha.NM_MUNICIPIO ? linha.NM_MUNICIPIO.trim().toUpperCase() : '';
        if (municipio !== 'PESQUEIRA') return;

        const cargo = linha.DS_CARGO ? linha.DS_CARGO.trim().toUpperCase() : '';
        const local = linha.NM_LOCAL_VOTACAO ? linha.NM_LOCAL_VOTACAO.trim() : '';
        
        if (cargo === 'VEREADOR' && local === escolaBusca) {
          const votos = parseInt(linha.QT_VOTOS, 10) || 0;
          totalVotosEscola += votos;
          
          const candidato = linha.NM_VOTAVEL ? linha.NM_VOTAVEL.trim() : 'NÃO IDENTIFICADO';
          if (!candidatos[candidato]) candidatos[candidato] = 0;
          candidatos[candidato] += votos;
        }
      });

      if (totalVotosEscola === 0) return null;
      const rankingCandidatos = Object.entries(candidatos)
        .map(([nome, votos]) => ({ nome, votos, percentual: ((votos / totalVotosEscola) * 100).toFixed(1) }))
        .sort((a, b) => b.votos - a.votos);

      return { total: totalVotosEscola, rankingCandidatos };
    };
    setResultadoEscola({ nomeExato: escolaBusca, ano2020: processarAno(dados2020), ano2024: processarAno(dados2024) });
  };

  if (logado) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col p-4 md:p-8 font-sans pb-20">
        <style>{`
          .map-label { background: transparent !important; border: none !important; box-shadow: none !important; color: #ffffff !important; font-weight: 900 !important; font-size: 14px !important; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000 !important; }
          .map-label::before { display: none !important; }
        `}</style>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 flex justify-between items-center border-l-4 border-blue-700">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Eleição Inteligente</h1>
            <p className="text-sm md:text-base text-slate-500 font-medium mt-1">Painel de Inteligência - Pesqueira/PE</p>
          </div>
          <button onClick={() => setLogado(false)} className="px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">Sair</button>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-wrap border-b border-gray-200 mb-6 gap-y-2">
            <button onClick={() => setAbaAtiva('candidato')} className={`pb-4 px-4 md:px-6 font-bold text-sm md:text-lg transition-colors border-b-4 ${abaAtiva === 'candidato' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              1. Analisar Vereador
            </button>
            <button onClick={() => setAbaAtiva('escola')} className={`pb-4 px-4 md:px-6 font-bold text-sm md:text-lg transition-colors border-b-4 ${abaAtiva === 'escola' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              2. Analisar Escola / Reduto
            </button>
            <button onClick={() => setAbaAtiva('mapa')} className={`pb-4 px-4 md:px-6 font-bold text-sm md:text-lg transition-colors border-b-4 ${abaAtiva === 'mapa' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              3. Analisar no Mapa
            </button>
          </div>
          
          <div className="flex flex-col gap-6">
            <div className="relative z-50">
              <label className="block text-sm font-bold text-slate-700 mb-3">
                {(abaAtiva === 'candidato' || abaAtiva === 'mapa') ? `Digite o nome ou número do candidato:` : `Digite o nome do local de votação (Escola):`}
              </label>
              <input type="text" placeholder={(abaAtiva === 'candidato' || abaAtiva === 'mapa') ? `Buscar nos candidatos...` : `Buscar nas escolas...`}
                className={`w-full px-4 py-4 bg-slate-50 border-2 rounded-lg outline-none text-lg font-medium transition-all focus:ring-2 ${(abaAtiva === 'candidato' || abaAtiva === 'mapa') ? 'border-slate-200 focus:ring-blue-600' : 'border-slate-200 focus:ring-emerald-500'}`}
                value={termoPesquisa} onChange={handleDigitacao} disabled={carregando} />
              
              {mostrarSugestoes && sugestoes.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {sugestoes.map((sugestao, index) => (
                    <li key={index} onClick={() => selecionarItem(sugestao)} className="px-4 py-3 hover:bg-slate-100 cursor-pointer border-b border-slate-100 last:border-0 text-slate-700 font-medium">
                      {sugestao}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* MÓDULO: RESULTADO CANDIDATO E MAPA */}
        {(abaAtiva === 'candidato' || abaAtiva === 'mapa') && resultadoCandidato && (
          <div className="bg-slate-900 rounded-xl shadow-lg p-6 md:p-8 text-white border border-slate-800 animate-fade-in">
            <h3 className="text-3xl font-black mb-8 text-center text-blue-400 border-b border-slate-800 pb-4">
              {resultadoCandidato.nomeExato}
            </h3>
            
            <div className={`grid grid-cols-1 ${abaAtiva === 'mapa' ? '' : 'lg:grid-cols-2'} gap-8`}>
              {/* Card 2020 */}
              <div className={`bg-slate-800 p-6 rounded-xl border border-slate-700 relative flex flex-col ${abaAtiva === 'mapa' ? 'h-auto min-h-[700px]' : 'h-[600px]'}`}>
                <div className="absolute top-0 right-0 bg-slate-700 text-xs font-bold px-3 py-1 rounded-bl-lg text-slate-300 z-10">2020</div>
                <h4 className="text-xl font-bold text-slate-300 mb-4 shrink-0">Desempenho 2020</h4>
                
                {resultadoCandidato.ano2020 ? (
                  <div className="flex flex-col h-full">
                    <div className="mb-4 shrink-0">
                      <p className="text-sm text-slate-400 uppercase tracking-wider font-bold mb-1">Total de Votos (Soma das Seções)</p>
                      <p className="text-5xl font-black text-white">{resultadoCandidato.ano2020.total.toLocaleString('pt-PT')}</p>
                    </div>
                    
                    {abaAtiva === 'mapa' && (
                      <div className="h-[500px] mb-6 rounded-lg overflow-hidden border border-slate-600 relative z-0 shrink-0 shadow-inner">
                        <MapContainer center={[-8.3578, -36.6961]} zoom={13} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution="&copy; OpenStreetMap" />
                          {resultadoCandidato.ano2020.rankingLocais.map((local, i) => (
                            <Marker key={i} position={local.coord} icon={criarIconeLeaflet(local.votos, resultadoCandidato.ano2020.maxVotosNumaEscola, 'rgba(16, 185, 129, 0.8)', '#047857')}>
                              <Tooltip direction="top" offset={[0, -15]} opacity={1}>
                                <span className="font-bold text-slate-800">{local.escola}</span><br/>
                                <span className="text-emerald-600 font-black">{local.votos} votos</span>
                              </Tooltip>
                            </Marker>
                          ))}
                        </MapContainer>
                      </div>
                    )}

                    <p className="text-sm text-emerald-400 uppercase tracking-wider font-bold mb-2 border-b border-slate-700 pb-2 shrink-0">Listagem de Escolas</p>
                    <ul className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-2">
                      {resultadoCandidato.ano2020.rankingLocais.map((local, index) => (
                        <li key={index} className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-slate-200 text-sm mr-2">{index + 1}. {local.escola}</span>
                            <span className="font-black text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded text-sm">{local.votos}v</span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono leading-relaxed bg-slate-800 p-2 rounded">{local.secoesTexto}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center"><p className="text-slate-500 font-medium">Sem registros em 2020.</p></div>
                )}
              </div>

              {/* Card 2024 */}
              <div className={`bg-slate-800 p-6 rounded-xl border border-slate-700 relative flex flex-col ${abaAtiva === 'mapa' ? 'h-auto min-h-[700px]' : 'h-[600px]'}`}>
                <div className="absolute top-0 right-0 bg-blue-600 text-xs font-bold px-3 py-1 rounded-bl-lg text-white z-10">2024</div>
                <h4 className="text-xl font-bold text-slate-300 mb-4 shrink-0">Desempenho 2024</h4>
                
                {resultadoCandidato.ano2024 ? (
                  <div className="flex flex-col h-full">
                    <div className="mb-4 shrink-0">
                      <p className="text-sm text-slate-400 uppercase tracking-wider font-bold mb-1">Total de Votos (Soma das Seções)</p>
                      <p className="text-5xl font-black text-white">{resultadoCandidato.ano2024.total.toLocaleString('pt-PT')}</p>
                    </div>
                    
                    {abaAtiva === 'mapa' && (
                      <div className="h-[500px] mb-6 rounded-lg overflow-hidden border border-slate-600 relative z-0 shrink-0 shadow-inner">
                        <MapContainer center={[-8.3578, -36.6961]} zoom={13} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution="&copy; OpenStreetMap" />
                          {resultadoCandidato.ano2024.rankingLocais.map((local, i) => (
                            <Marker key={i} position={local.coord} icon={criarIconeLeaflet(local.votos, resultadoCandidato.ano2024.maxVotosNumaEscola, 'rgba(59, 130, 246, 0.8)', '#1d4ed8')}>
                              <Tooltip direction="top" offset={[0, -15]} opacity={1}>
                                <span className="font-bold text-slate-800">{local.escola}</span><br/>
                                <span className="text-blue-600 font-black">{local.votos} votos</span>
                              </Tooltip>
                            </Marker>
                          ))}
                        </MapContainer>
                      </div>
                    )}

                    <p className="text-sm text-blue-400 uppercase tracking-wider font-bold mb-2 border-b border-slate-700 pb-2 shrink-0">Listagem de Escolas</p>
                    <ul className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-2">
                      {resultadoCandidato.ano2024.rankingLocais.map((local, index) => (
                        <li key={index} className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-slate-200 text-sm mr-2">{index + 1}. {local.escola}</span>
                            <span className="font-black text-blue-400 bg-blue-400/10 px-2 py-1 rounded text-sm">{local.votos}v</span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono leading-relaxed bg-slate-800 p-2 rounded">{local.secoesTexto}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center"><p className="text-slate-500 font-medium">Sem registros em 2024.</p></div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MÓDULO: RESULTADO ESCOLA */}
        {abaAtiva === 'escola' && resultadoEscola && (
          <div className="bg-emerald-950 rounded-xl shadow-lg p-6 md:p-8 text-white border border-emerald-900 animate-fade-in">
            <h3 className="text-2xl md:text-3xl font-black mb-8 text-center text-emerald-400 border-b border-emerald-900 pb-4">
              {resultadoEscola.nomeExato}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-emerald-900/40 p-6 rounded-xl border border-emerald-800 relative flex flex-col h-[600px]">
                 <div className="absolute top-0 right-0 bg-emerald-800 text-xs font-bold px-3 py-1 rounded-bl-lg">2020</div>
                 {resultadoEscola.ano2020 ? (
                   <div className="flex flex-col h-full">
                     <p className="text-3xl font-black mb-4">{resultadoEscola.ano2020.total} votos totais</p>
                     <ul className="space-y-2 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                       {resultadoEscola.ano2020.rankingCandidatos.map((cand, idx) => (
                         <li key={idx} className="flex justify-between bg-emerald-950/50 p-3 rounded">
                           <span>{idx+1}. {cand.nome}</span>
                           <span className="text-amber-400 font-bold">{cand.votos}v ({cand.percentual}%)</span>
                         </li>
                       ))}
                     </ul>
                   </div>
                 ) : <p className="m-auto text-emerald-700">Sem dados.</p>}
              </div>

              <div className="bg-emerald-900/40 p-6 rounded-xl border border-emerald-800 relative flex flex-col h-[600px]">
                 <div className="absolute top-0 right-0 bg-emerald-600 text-xs font-bold px-3 py-1 rounded-bl-lg">2024</div>
                 {resultadoEscola.ano2024 ? (
                   <div className="flex flex-col h-full">
                     <p className="text-3xl font-black mb-4">{resultadoEscola.ano2024.total} votos totais</p>
                     <ul className="space-y-2 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                       {resultadoEscola.ano2024.rankingCandidatos.map((cand, idx) => (
                         <li key={idx} className="flex justify-between bg-emerald-950/50 p-3 rounded">
                           <span>{idx+1}. {cand.nome}</span>
                           <span className="text-amber-400 font-bold">{cand.votos}v ({cand.percentual}%)</span>
                         </li>
                       ))}
                     </ul>
                   </div>
                 ) : <p className="m-auto text-emerald-700">Sem dados.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
     <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
       <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
         <div className="text-center mb-8">
           <h1 className="text-3xl font-black text-slate-800 tracking-tight">Eleição Inteligente</h1>
         </div>
         <form onSubmit={handleLogin} className="space-y-6">
           <input type="text" placeholder="Usuário" className="w-full px-4 py-3 bg-slate-50 border rounded-lg" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
           <input type="password" placeholder="Senha" className="w-full px-4 py-3 bg-slate-50 border rounded-lg" value={senha} onChange={(e) => setSenha(e.target.value)} />
           <button type="submit" className="w-full bg-blue-700 text-white font-black py-4 px-4 rounded-lg">Acessar</button>
         </form>
       </div>
     </div>
  );
}

export default App