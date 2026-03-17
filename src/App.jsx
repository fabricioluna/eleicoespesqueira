import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import CandidatoStats from './components/CandidatoStats'
import EscolaDetail from './components/EscolaDetail'
import MapaEstrategico from './components/MapaEstrategico'
import ComparativoMataMata from './components/ComparativoMataMata'

function App() {
  const [logado, setLogado] = useState(false);
  const [dados, setDados] = useState({ '2020': [], '2024': [] });
  const [apelidos, setApelidos] = useState({ '2020': {}, '2024': {} });
  const [abaAtiva, setAbaAtiva] = useState('candidato');
  const [cargo, setCargo] = useState('PREFEITO');
  const [u, setU] = useState(''); const [s, setS] = useState('');

  useEffect(() => {
    if (logado) {
      Promise.all([
        new Promise(r => Papa.parse('/eleicoespesqueira2020.csv', { download: true, header: true, delimiter: ';', complete: r })),
        new Promise(r => Papa.parse('/eleicoespesqueira2024.csv', { download: true, header: true, delimiter: ';', complete: r })),
        fetch('/apelidos_2020.json').then(res => res.json()).catch(() => ({})),
        fetch('/apelidos_2024.json').then(res => res.json()).catch(() => ({}))
      ]).then(([d20, d24, a20, a24]) => {
        setDados({ '2020': d20.data, '2024': d24.data });
        setApelidos({ '2020': a20, '2024': a24 });
      });
    }
  }, [logado]);

  if (!logado) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md text-center">
        <h1 className="text-3xl font-black text-slate-800 mb-8 uppercase">Eleição Inteligente</h1>
        <div className="space-y-4">
          <input type="text" placeholder="Usuário" className="w-full p-4 bg-slate-50 border-2 rounded-2xl font-bold outline-none focus:border-blue-600" onChange={e=>setU(e.target.value)} />
          <input type="password" placeholder="Senha" className="w-full p-4 bg-slate-50 border-2 rounded-2xl font-bold outline-none focus:border-blue-600" onChange={e=>setS(e.target.value)} />
          <button className="w-full bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-800 transition-all uppercase" onClick={()=>{if(u==='pesqueira'&&s==='pesqueira10') setLogado(true)}}>Entrar</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans pb-20">
      <div className="bg-white border-b sticky top-0 z-[1001] shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-black text-slate-800">PESQUEIRA ESTRATÉGICA</h1>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setCargo('PREFEITO')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${cargo === 'PREFEITO' ? 'bg-blue-700 text-white shadow-md' : 'text-slate-400'}`}>PREFEITO</button>
            <button onClick={() => setCargo('VEREADOR')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${cargo === 'VEREADOR' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400'}`}>VEREADOR</button>
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
        {abaAtiva === 'candidato' && <CandidatoStats dados={dados} cargo={cargo} apelidos={apelidos} />}
        {abaAtiva === 'escola' && <EscolaDetail dados={dados} cargo={cargo} apelidos={apelidos} />}
        {abaAtiva === 'mapa' && <MapaEstrategico dados={dados} cargo={cargo} apelidos={apelidos} />}
        {abaAtiva === 'comparativo' && <ComparativoMataMata dados={dados} cargo={cargo} />}
      </div>
    </div>
  );
}

export default App