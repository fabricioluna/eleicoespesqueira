import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, Legend } from 'recharts'

export default function EscolaDetail({ dados, cargo, apelidos }) {
  const [res, setRes] = useState(null);
  const [filtroEscola, setFiltroEscola] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'votos', direction: 'desc' });

  // Lista de todas as escolas tratadas
  const listaEscolas = useMemo(() => {
    const eSet = new Set();
    ['2020', '2024'].forEach(ano => {
      dados[ano].forEach(l => {
        let esc = l.NM_LOCAL_VOTACAO?.trim();
        if (esc) {
          eSet.add(esc === "#NULO" ? "OUTRAS SEÇÕES / VOTOS GERAIS" : esc);
        }
      });
    });
    return Array.from(eSet).sort();
  }, [dados]);

  // Escolas filtradas pela barra de busca
  const escolasFiltradas = listaEscolas.filter(e => 
    e.toLowerCase().includes(filtroEscola.toLowerCase())
  );

  const analEsc = (escNomeOriginal) => {
    const procAno = (ano) => {
      let tot = 0; const cs = {}; const filtro = new Set();
      
      dados[ano].forEach(l => {
        let localNoCsv = l.NM_LOCAL_VOTACAO?.trim();
        if (localNoCsv === "#NULO") localNoCsv = "OUTRAS SEÇÕES / VOTOS GERAIS";

        if (l.DS_CARGO?.toUpperCase() === cargo && localNoCsv === escNomeOriginal) {
          const id = `${l.NR_ZONA}-${l.NR_SECAO}-${l.NR_VOTAVEL}`;
          if (filtro.has(id)) return;

          const nv = l.NM_VOTAVEL?.toUpperCase();
          const num = l.NR_VOTAVEL?.trim();
          let nomeLimpo = (nv?.includes('BRANCO') || nv?.includes('NULO')) ? 'BRANCOS E NULOS' : (apelidos[ano][num]?.apelido || nv);

          // REGRA: Sebastião não entra em 2020
          if (ano === '2020' && nomeLimpo.includes('SEBASTIAO')) return;

          const v = parseInt(l.QT_VOTOS) || 0; tot += v; filtro.add(id);
          cs[nomeLimpo] = (cs[nomeLimpo] || 0) + v;
        }
      });

      if (tot === 0) return null;

      const ranking = Object.entries(cs).map(([nome, votos]) => ({
        nome,
        votos,
        pct: ((votos / tot) * 100).toFixed(1)
      })).sort((a,b) => b.votos - a.votos);

      return { tot, ranking, vencedor: ranking[0] };
    };

    setRes({ 
      esc: escNomeOriginal, 
      d20: procAno('2020'), 
      d24: procAno('2024') 
    });
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const getRankingOrdenado = (anoData) => {
    if (!anoData) return [];
    return [...anoData.ranking].sort((a, b) => {
      if (sortConfig.key === 'nome') {
        return sortConfig.direction === 'asc' ? a.nome.localeCompare(b.nome) : b.nome.localeCompare(a.nome);
      }
      return sortConfig.direction === 'asc' ? a.votos - b.votos : b.votos - a.votos;
    });
  };

  return (
    <div className="space-y-10 animate-fade-in pb-10">
      {!res ? (
        <div className="bg-white p-10 rounded-[45px] border border-slate-100 shadow-sm">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-widest">Diagnóstico por Unidade</h2>
            <p className="text-slate-400 text-xs font-bold mt-2 uppercase">Auditoria de votos escola a escola</p>
          </div>

          {/* BARRA DE PESQUISA DE ESCOLAS */}
          <div className="mb-8 max-w-md mx-auto">
            <input 
              type="text" 
              placeholder="🔍 Digite o nome da escola..." 
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold transition-all"
              value={filtroEscola}
              onChange={(e) => setFiltroEscola(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {escolasFiltradas.map((e, i) => (
              <button key={i} onClick={() => analEsc(e)} className="p-4 bg-white border border-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white hover:shadow-lg transition-all text-left truncate shadow-sm">
                {e}
              </button>
            ))}
            {escolasFiltradas.length === 0 && (
                <p className="col-span-full text-center py-10 text-slate-400 font-bold">Nenhuma escola encontrada.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* CABEÇALHO DA ESCOLA SELECIONADA */}
          <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[40px] border shadow-sm gap-6">
            <div>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Unidade de Votação</p>
              <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">{res.esc}</h2>
            </div>
            
            {/* CARD DE TRANSFERÊNCIA DE PODER */}
            <div className="flex gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
               <div className="text-center px-4 border-r border-slate-200">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Venceu em 20</p>
                  <p className="text-xs font-black text-blue-600 uppercase">{res.d20?.vencedor?.nome || 'N/A'}</p>
               </div>
               <div className="text-center px-4">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Venceu em 24</p>
                  <p className="text-xs font-black text-orange-600 uppercase">{res.d24?.vencedor?.nome || 'N/A'}</p>
               </div>
            </div>

            <button onClick={()=>setRes(null)} className="bg-slate-800 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase hover:bg-black transition-all shadow-lg">← Voltar à Lista</button>
          </div>

          {/* GRÁFICO DE COMPARECIMENTO */}
          <div className="bg-white p-12 rounded-[50px] shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-10">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Fluxo de Votos Válidos</h3>
                <div className="flex gap-6">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-full"></div><span className="text-[10px] font-black text-slate-500">2020</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-500 rounded-full"></div><span className="text-[10px] font-black text-slate-500">2024</span></div>
                </div>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{a:'Total de Votos', v20:res.d20?.tot||0, v24:res.d24?.tot||0}]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="a" axisLine={false} tickLine={false} tick={{fill:'#64748b', fontWeight:'bold'}} />
                  <YAxis hide />
                  <Tooltip cursor={{fill:'#f8fafc'}} contentStyle={{borderRadius:'20px', border:'none', boxShadow:'0 10px 20px rgba(0,0,0,0.1)'}} />
                  <Bar dataKey="v20" name="Votos 2020" fill="#3b82f6" radius={[10, 10, 0, 0]} barSize={80}>
                    <LabelList dataKey="v20" position="top" style={{fill:'#3b82f6', fontWeight:'900', fontSize:'14px'}} />
                  </Bar>
                  <Bar dataKey="v24" name="Votos 2024" fill="#f97316" radius={[10, 10, 0, 0]} barSize={80}>
                    <LabelList dataKey="v24" position="top" style={{fill:'#f97316', fontWeight:'900', fontSize:'14px'}} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* LISTAGEM DOS CANDIDATOS POR ANO */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {['d20', 'd24'].map(anoKey => {
              const data = res[anoKey];
              const is20 = anoKey === 'd20';
              if (!data) return null;

              return (
                <div key={anoKey} className="bg-slate-900 p-8 rounded-[50px] shadow-2xl flex flex-col">
                  <div className="flex justify-between items-center mb-8">
                    <h4 className={`text-xl font-black uppercase tracking-tighter ${is20 ? 'text-blue-400' : 'text-orange-400'}`}>
                      Ranking {is20 ? '2020' : '2024'}
                    </h4>
                    <div className="flex gap-2">
                        <button onClick={()=>handleSort('nome')} className="text-[8px] font-black uppercase text-slate-500 hover:text-white transition-colors">Nome {sortConfig.key==='nome'?'↕':''}</button>
                        <button onClick={()=>handleSort('votos')} className="text-[8px] font-black uppercase text-slate-500 hover:text-white transition-colors">Votos {sortConfig.key==='votos'?'↕':''}</button>
                    </div>
                  </div>

                  <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                    {getRankingOrdenado(data).map((c, i) => (
                      <div key={i} className={`flex justify-between items-center p-5 rounded-[25px] border transition-all ${i === 0 ? (is20 ? 'bg-blue-500/10 border-blue-500/50' : 'bg-orange-500/10 border-orange-500/50') : 'bg-white/5 border-transparent'}`}>
                        <div className="flex flex-col">
                          <span className={`text-[9px] font-black uppercase ${i===0 ? (is20?'text-blue-400':'text-orange-400') : 'text-slate-500'}`}>
                            {i === 0 ? '🏆 LÍDER NA ESCOLA' : `${i+1}º LUGAR`}
                          </span>
                          <span className="text-xs font-black text-slate-100 uppercase truncate max-w-[180px]">{c.nome}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-white">{c.votos}v</p>
                          <p className={`text-[10px] font-bold ${is20 ? 'text-blue-400' : 'text-orange-400'}`}>{c.pct}%</p>
                        </div>
                      </div>
                    ))}
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