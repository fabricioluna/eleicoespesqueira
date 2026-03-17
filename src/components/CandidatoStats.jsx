import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'

export default function CandidatoStats({ dados, cargo, apelidos }) {
  const [res, setRes] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'v24', direction: 'desc' });

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
      // REGRA: Sebastião não disputou 2020
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
  };

  const dadosOrdenados = useMemo(() => {
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
      
      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [res, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
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
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span> Métricas de Controle
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button onClick={() => processar('BN', 'BRANCOS E NULOS')} className="flex items-center justify-between p-5 bg-slate-900 text-white rounded-3xl hover:bg-black transition-all shadow-md group">
                  <span className="font-black text-xs uppercase">Brancos e Nulos</span>
                  <span className="opacity-30 group-hover:opacity-100 transition-opacity">⚪</span>
                </button>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> Candidatos Registrados
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {listaCands.filter(c => !c.includes('BN|')).map((item, i) => {
                  const [num, nome] = item.split('|');
                  return (
                    <button key={i} onClick={() => processar(num, nome)} className="flex flex-col items-start p-5 bg-slate-50 border border-slate-100 rounded-3xl hover:border-blue-500 hover:bg-white hover:shadow-xl transition-all group">
                      <span className="text-[9px] font-black text-slate-400 uppercase mb-1">Nº {num}</span>
                      <span className="font-black text-xs text-slate-700 uppercase group-hover:text-blue-600 truncate w-full text-left">{nome}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          <div className="flex justify-between items-center bg-white p-6 rounded-3xl border shadow-sm">
            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">{res.nome}</h2>
            <button onClick={()=>setRes(null)} className="bg-slate-100 text-slate-500 px-6 py-2 rounded-xl font-black text-[10px] uppercase border hover:bg-slate-200 transition-all">← Voltar ao Menu</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="bg-blue-600 p-10 rounded-[45px] text-white shadow-xl relative overflow-hidden">
              <p className="text-[11px] uppercase opacity-80 mb-2 font-black">Total 2020</p>
              <p className="text-6xl font-black">{res.d20.tot.toLocaleString('pt-PT')}</p>
              <div className="absolute -right-4 -bottom-6 text-white opacity-10 font-black text-[120px]">20</div>
            </div>
            <div className="bg-orange-500 p-10 rounded-[45px] text-white shadow-xl relative overflow-hidden">
              <p className="text-[11px] uppercase opacity-80 mb-2 font-black">Total 2024</p>
              <p className="text-6xl font-black">{res.d24.tot.toLocaleString('pt-PT')}</p>
              <div className="absolute -right-4 -bottom-6 text-white opacity-10 font-black text-[120px]">24</div>
            </div>
            <div className={`p-10 rounded-[45px] text-white shadow-xl relative overflow-hidden ${res.d24.tot >= res.d20.tot ? 'bg-emerald-500' : 'bg-rose-500'}`}>
              <p className="text-[11px] uppercase opacity-80 mb-2 font-black">Variação Real</p>
              <p className="text-6xl font-black">{(res.d24.tot - res.d20.tot).toLocaleString('pt-PT')}</p>
            </div>
          </div>

          <div className="bg-white p-12 rounded-[60px] shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-400 uppercase mb-12 text-center tracking-[0.2em]">Evolução Visual: 2020 vs 2024</h3>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{a:'2020', v:res.d20.tot}, {a:'2024', v:res.d24.tot}]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="a" axisLine={false} tickLine={false} tick={{fill:'#64748b', fontWeight:'bold', fontSize:14}} dy={15} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill:'#94a3b8'}} />
                  <Tooltip cursor={{fill:'#f8fafc'}} contentStyle={{borderRadius:'25px', border:'none', boxShadow:'0 20px 50px rgba(0,0,0,0.1)', fontWeight:'bold'}} />
                  <Bar dataKey="v" radius={[20, 20, 0, 0]} barSize={140}>
                    <LabelList dataKey="v" position="top" offset={15} style={{fill:'#1e293b', fontWeight:'900', fontSize:'18px'}} formatter={(v) => v.toLocaleString('pt-PT')} />
                    <Cell fill="#2563eb" />
                    <Cell fill="#f97316" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-8 mt-10">
               <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full"><div className="w-3 h-3 rounded-full bg-blue-600"></div><span className="text-[10px] font-black text-blue-600 uppercase">Ano 2020</span></div>
               <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-full"><div className="w-3 h-3 rounded-full bg-orange-500"></div><span className="text-[10px] font-black text-orange-600 uppercase">Ano 2024</span></div>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-12 rounded-[60px] shadow-2xl">
            <h3 className="text-2xl font-black mb-10 uppercase tracking-tighter">📊 Relatório por Local de Votação</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-0">
                <thead className="text-[10px] font-black text-slate-500 uppercase border-b border-slate-800">
                  <tr>
                    <th className="pb-6 px-4 cursor-pointer hover:text-blue-400 transition-colors select-none" onClick={()=>handleSort('escola')}>Local {renderSortIcon('escola')}</th>
                    <th className="text-center pb-6 px-4 cursor-pointer hover:text-blue-400 transition-colors select-none" onClick={()=>handleSort('v20')}>2020 {renderSortIcon('v20')}</th>
                    <th className="text-center pb-6 px-4 cursor-pointer hover:text-blue-400 transition-colors select-none" onClick={()=>handleSort('v24')}>2024 {renderSortIcon('v24')}</th>
                    <th className="text-center pb-6 px-4 cursor-pointer hover:text-blue-400 transition-colors select-none" onClick={()=>handleSort('delta')}>Saldo {renderSortIcon('delta')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {dadosOrdenados.map((d, i) => (
                    <tr key={i} className="hover:bg-slate-800/40 transition-all group">
                      <td className="py-5 px-4 text-xs font-bold text-slate-300 group-hover:text-white">{d.escola}</td>
                      <td className="text-center px-4 font-mono text-blue-400 font-bold">{d.v20.toLocaleString('pt-PT')}</td>
                      <td className="text-center px-4 font-mono text-orange-400 font-bold">{d.v24.toLocaleString('pt-PT')}</td>
                      <td className="text-center px-4">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black ${d.delta > 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : d.delta < 0 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-slate-600'}`}>
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