import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'

export default function CandidatoStats({ dados, cargo, apelidos }) {
  const [res, setRes] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'v24', direction: 'desc' });
  
  // Novo estado para controlar o que o gráfico exibe
  const [filtroGrafico, setFiltroGrafico] = useState('TODOS');

  const listaCands = useMemo(() => {
    const cSet = new Set();
    ['2020', '2024'].forEach(ano => {
      dados[ano].forEach(l => {
        if (l.DS_CARGO?.toUpperCase() === cargo) {
          const nv = l.NM_VOTAVEL?.toUpperCase();
          if (nv?.includes('BRANCO') || nv?.includes('NULO')) cSet.add(`BN|BRANCOS E NULOS`);
          else if (l.NR_VOTAVEL) {
            const ap = apelidos[ano][l.NR_VOTAVEL]?.apelido || l.NM_VOTAVEL;
            cSet.add(`${l.NR_VOTAVEL}|${ap}`);
          }
        }
      });
    });
    return Array.from(cSet).sort((a, b) => a.split('|')[1].localeCompare(b.split('|')[1]));
  }, [dados, cargo, apelidos]);

  const processar = (num, nome) => {
    const procAno = (ano) => {
      if (ano === '2020' && nome.toUpperCase().includes('SEBASTIAO')) return { tot: 0, rnk: [] };
      let tot = 0; const rnk = {}; const filtro = new Set();
      dados[ano].forEach(l => {
        const id = `${l.NR_ZONA}-${l.NR_SECAO}-${l.NR_VOTAVEL}`;
        if (l.DS_CARGO?.toUpperCase() === cargo && !filtro.has(id)) {
          const match = (num === 'BN') ? (l.NM_VOTAVEL?.includes('BRANCO') || l.NM_VOTAVEL?.includes('NULO')) : (l.NR_VOTAVEL?.trim() === num);
          if (match) {
            const v = parseInt(l.QT_VOTOS) || 0; tot += v; filtro.add(id);
            let esc = l.NM_LOCAL_VOTACAO?.trim() || "OUTRAS SEÇÕES / VOTOS GERAIS";
            const escFinal = (esc === "#NULO" || esc === "") ? "OUTRAS SEÇÕES / VOTOS GERAIS" : esc;
            rnk[escFinal] = (rnk[escFinal] || 0) + v;
          }
        }
      });
      return { tot, rnk: Object.entries(rnk).map(([esc, votos]) => ({ esc, votos })) };
    };
    setRes({ nome, d20: procAno('2020'), d24: procAno('2024') });
    setFiltroGrafico('TODOS'); // Reseta o filtro ao trocar de candidato
  };

  const dadosTabela = useMemo(() => {
    if (!res) return [];
    const allEscolas = Array.from(new Set([...res.d20.rnk.map(x=>x.esc), ...res.d24.rnk.map(x=>x.esc)]));
    const relacao = allEscolas.map(e => {
      const v20 = res.d20.rnk.find(x=>x.esc===e)?.votos || 0;
      const v24 = res.d24.rnk.find(x=>x.esc===e)?.votos || 0;
      return { escola: e, v20, v24, delta: v24 - v20 };
    });
    return relacao.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (typeof aVal === 'string') return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [res, sortConfig]);

  // Lógica para definir os dados do gráfico baseado no clique
  const dadosGrafico = useMemo(() => {
    if (!res) return [];
    if (filtroGrafico === 'TODOS') {
      return [{a:'Eleição 2020', v:res.d20.tot}, {a:'Eleição 2024', v:res.d24.tot}];
    } else {
      const info = dadosTabela.find(x => x.escola === filtroGrafico);
      return [{a:'Eleição 2020', v:info?.v20 || 0}, {a:'Eleição 2024', v:info?.v24 || 0}];
    }
  }, [res, filtroGrafico, dadosTabela]);

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }));
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <span className="ml-1 opacity-20">↕</span>;
    return sortConfig.direction === 'asc' ? <span className="ml-1 text-blue-400">↑</span> : <span className="ml-1 text-blue-400">↓</span>;
  };

  return (
    <div className="space-y-10 animate-fade-in pb-10">
      {!res ? (
        <div className="bg-white p-10 rounded-[45px] border border-slate-100 shadow-sm">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-widest">Painel de Comando</h2>
            <p className="text-slate-400 text-xs font-bold mt-2 uppercase">Análise de Desempenho e Evolução</p>
          </div>
          <div className="space-y-10">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">Métricas de Controle</p>
              <button onClick={() => processar('BN', 'BRANCOS E NULOS')} className="p-5 bg-slate-900 text-white rounded-3xl font-black uppercase text-xs">Brancos e Nulos</button>
            </div>
            <div>
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4">Candidatos Registrados</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {listaCands.filter(c => !c.includes('BN|')).map((item, i) => {
                  const [num, nome] = item.split('|');
                  return (
                    <button key={i} onClick={() => processar(num, nome)} className="p-5 bg-slate-50 border rounded-3xl hover:border-blue-500 hover:bg-white transition-all text-left">
                      <p className="text-[9px] font-black text-slate-400">Nº {num}</p>
                      <p className="font-black text-xs text-slate-700 truncate">{nome}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Cabeçalho */}
          <div className="flex justify-between items-center bg-white p-6 rounded-3xl border shadow-sm">
            <h2 className="text-3xl font-black text-slate-800 uppercase">{res.nome}</h2>
            <div className="flex gap-4">
                {filtroGrafico !== 'TODOS' && (
                    <button onClick={() => setFiltroGrafico('TODOS')} className="bg-emerald-50 text-emerald-600 px-6 py-2 rounded-xl font-black text-[10px] uppercase border border-emerald-100 hover:bg-emerald-100 animate-bounce">📊 Ver Total Geral</button>
                )}
                <button onClick={()=>setRes(null)} className="bg-slate-100 text-slate-500 px-6 py-2 rounded-xl font-black text-[10px] uppercase border hover:bg-slate-200">← Voltar</button>
            </div>
          </div>

          {/* Gráfico Dinâmico */}
          <div className="bg-white p-12 rounded-[60px] shadow-sm border border-slate-100">
            <div className="text-center mb-8">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-2">Visualização de Dados</p>
                <h3 className="text-2xl font-black text-slate-800 uppercase">
                    {filtroGrafico === 'TODOS' ? 'Total Geral na Cidade' : `Dados: ${filtroGrafico}`}
                </h3>
            </div>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosGrafico}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="a" axisLine={false} tickLine={false} tick={{fill:'#64748b', fontWeight:'bold'}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill:'#94a3b8'}} />
                  <Tooltip cursor={{fill:'#f8fafc'}} contentStyle={{borderRadius:'20px', border:'none', boxShadow:'0 10px 30px rgba(0,0,0,0.1)'}} />
                  <Bar dataKey="v" radius={[15, 15, 0, 0]} barSize={120}>
                    <LabelList dataKey="v" position="top" offset={15} style={{fill:'#1e293b', fontWeight:'900', fontSize:'18px'}} formatter={(v) => v.toLocaleString('pt-PT')} />
                    <Cell fill="#2563eb" /><Cell fill="#f97316" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabela com nomes clicáveis */}
          <div className="bg-slate-900 text-white p-10 rounded-[60px] shadow-2xl">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black uppercase tracking-tighter">📊 Relatório por Local (Clique no nome para filtrar o gráfico)</h3>
                {filtroGrafico !== 'TODOS' && (
                     <button onClick={() => setFiltroGrafico('TODOS')} className="text-[10px] font-black text-emerald-400 uppercase underline">Ver Total Geral</button>
                )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[10px] font-black text-slate-500 uppercase border-b border-slate-800">
                  <tr>
                    <th className="pb-6 px-4 cursor-pointer hover:text-blue-400" onClick={()=>handleSort('escola')}>Local {renderSortIcon('escola')}</th>
                    <th className="text-center pb-6 px-4 cursor-pointer hover:text-blue-400" onClick={()=>handleSort('v20')}>2020 {renderSortIcon('v20')}</th>
                    <th className="text-center pb-6 px-4 cursor-pointer hover:text-blue-400" onClick={()=>handleSort('v24')}>2024 {renderSortIcon('v24')}</th>
                    <th className="text-center pb-6 px-4 cursor-pointer hover:text-blue-400" onClick={()=>handleSort('delta')}>Saldo {renderSortIcon('delta')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {dadosTabela.map((d, i) => (
                    <tr key={i} className={`transition-all group ${filtroGrafico === d.escola ? 'bg-blue-600/20' : 'hover:bg-slate-800/40'}`}>
                      <td className="py-5 px-4">
                        <button 
                          onClick={() => setFiltroGrafico(d.escola)}
                          className={`text-xs font-bold uppercase text-left group-hover:text-blue-400 transition-colors ${filtroGrafico === d.escola ? 'text-blue-400 underline' : 'text-slate-300'}`}
                        >
                          {d.escola}
                        </button>
                      </td>
                      <td className="text-center px-4 font-mono text-blue-400 font-bold">{d.v20.toLocaleString('pt-PT')}</td>
                      <td className="text-center px-4 font-mono text-orange-400 font-bold">{d.v24.toLocaleString('pt-PT')}</td>
                      <td className="text-center px-4">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black ${d.delta > 0 ? 'bg-emerald-500/20 text-emerald-400' : d.delta < 0 ? 'bg-rose-500/20 text-rose-400' : 'text-slate-600'}`}>
                          {d.delta > 0 ? '▲ +' : d.delta < 0 ? '▼ ' : ''}{d.delta.toLocaleString('pt-PT')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}