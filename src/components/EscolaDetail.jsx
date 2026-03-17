import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts'

export default function EscolaDetail({ dados, cargo, apelidos }) {
  const [res, setRes] = useState(null);

  const analEsc = (esc) => {
    const proc = (ano) => {
      let tot = 0; const cs = {}; const filtro = new Set();
      dados[ano].forEach(l => {
        if (l.DS_CARGO?.toUpperCase() === cargo && l.NM_LOCAL_VOTACAO?.trim() === esc) {
          const id = `${l.NR_ZONA}-${l.NR_SECAO}-${l.NR_VOTAVEL}`;
          if (filtro.has(id)) return;
          const v = parseInt(l.QT_VOTOS) || 0; tot += v; filtro.add(id);
          const nv = l.NM_VOTAVEL?.toUpperCase();
          let ap = (nv?.includes('BRANCO') || nv?.includes('NULO')) ? 'BRANCOS E NULOS' : (apelidos[ano][l.NR_VOTAVEL]?.apelido || nv);
          cs[ap] = (cs[ap] || 0) + v;
        }
      });
      if (tot === 0) return null;
      const r = Object.entries(cs).map(([n,v])=>({n, v, p: ((v/tot)*100).toFixed(1)})).sort((a,b)=>b.v - a.v);
      const opos = tot - r[0].v - (cs['BRANCOS E NULOS'] || 0);
      return { tot, rnk: r, status: r[0].p > 50 ? "DOMINADO" : (opos > r[0].v ? "CRÍTICO" : "DISPUTADO") };
    };
    setRes({ esc, d20: proc('2020'), d24: proc('2024') });
  };

  const listaEscolas = Array.from(new Set([...dados['2020'].map(l=>l.NM_LOCAL_VOTACAO), ...dados['2024'].map(l=>l.NM_LOCAL_VOTACAO)]))
    .filter(Boolean).sort();

  return (
    <div className="space-y-8 animate-fade-in">
      {!res ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {listaEscolas.map((e, i) => (
            <button key={i} onClick={() => analEsc(e)} className="p-5 bg-white border border-slate-100 text-slate-500 rounded-3xl text-[10px] font-black uppercase hover:bg-blue-700 hover:text-white transition-all text-left shadow-sm truncate">{e}</button>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex justify-between items-center"><h2 className="text-4xl font-black text-slate-800 uppercase">{res.esc}</h2><button onClick={()=>setRes(null)} className="bg-slate-200 px-4 py-2 rounded-xl font-black text-[10px] uppercase">← Voltar</button></div>
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
            <h3 className="text-xs font-black text-slate-400 uppercase mb-8 text-center">Votos Totais da Unidade: Azul (2020) vs Laranja (2024)</h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{a:'2020', v:res.d20?.tot||0}, {a:'2024', v:res.d24?.tot||0}]}>
                  <XAxis dataKey="a" hide /><YAxis hide /><Tooltip />
                  <Bar dataKey="v" barSize={60} radius={[10,10,0,0]}><Cell fill="#3b82f6" /><Cell fill="#f97316" /></Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          {['d20', 'd24'].map(ano => (
            res[ano] && (
              <div key={ano} className="bg-white p-10 rounded-[40px] shadow-sm border relative">
                <div className={`absolute top-0 right-0 px-10 py-3 font-black text-xs text-white rounded-bl-[30px] ${res[ano].status === 'DOMINADO' ? 'bg-blue-600' : 'bg-amber-500'}`}>{res[ano].status}</div>
                <p className={`text-[10px] font-black uppercase mb-2 ${ano==='d20'?'text-blue-500':'text-orange-500'}`}>{ano.replace('d', 'Eleição ')}</p>
                <p className="text-7xl font-black text-slate-800 mb-6">{res[ano].tot}v</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {res[ano].rnk.map((c, i) => (
                    <div key={i} className="flex justify-between p-4 bg-slate-50 rounded-2xl border shadow-sm"><span className="text-xs font-black text-slate-600 truncate mr-4">{i+1}. {c.n}</span><span className="text-xs font-black text-blue-700 whitespace-nowrap">{c.v}v ({c.p}%)</span></div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}