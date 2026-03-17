import fs from 'fs';
import readline from 'readline';

const arquivos = [
  { entrada: 'consulta_cand_2020_PE.csv', saida: 'apelidos_2020.json', ano: '2020' },
  { entrada: 'consulta_cand_2024_PE.csv', saida: 'apelidos_2024.json', ano: '2024' }
];

async function processarApelidos() {
  for (const arquivo of arquivos) {
    console.log(`\n🕵️‍♂️ A ler o ficheiro ${arquivo.entrada}...`);
    
    if (!fs.existsSync(arquivo.entrada)) {
      console.error(`❌ ERRO: Faltou o ficheiro: ${arquivo.entrada}`);
      continue;
    }

    const fileStream = fs.createReadStream(arquivo.entrada, { encoding: 'latin1' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let cabecalho = [];
    let isPrimeiraLinha = true;
    const dicionario = {};
    let count = 0;

    for await (const line of rl) {
      const colunas = line.split(';').map(c => c.replace(/^"|"$/g, '').trim());

      if (isPrimeiraLinha) {
        cabecalho = colunas;
        isPrimeiraLinha = false;
        continue;
      }

      let idxMunicipio = cabecalho.indexOf('NM_UE');
      if (idxMunicipio === -1) idxMunicipio = cabecalho.indexOf('NM_MUNICIPIO'); 
      
      const idxCargo = cabecalho.indexOf('DS_CARGO');
      const idxNumero = cabecalho.indexOf('NR_CANDIDATO');
      const idxApelido = cabecalho.indexOf('NM_URNA_CANDIDATO');

      if (idxMunicipio === -1 || idxCargo === -1 || idxNumero === -1 || idxApelido === -1) continue;

      const municipio = colunas[idxMunicipio] ? colunas[idxMunicipio].toUpperCase() : '';
      const cargo = colunas[idxCargo] ? colunas[idxCargo].toUpperCase() : '';

      // MUDANÇA AQUI: Agora ele pesca VEREADOR e PREFEITO!
      if (municipio === 'PESQUEIRA' && (cargo === 'VEREADOR' || cargo === 'PREFEITO')) {
        const numero = colunas[idxNumero];
        const apelido = colunas[idxApelido];
        
        if (numero && apelido) {
          dicionario[numero] = { apelido: apelido };
          count++;
        }
      }
    }

    fs.writeFileSync(arquivo.saida, JSON.stringify(dicionario, null, 2), 'utf8');
    console.log(`✅ Sucesso! O dicionário "${arquivo.saida}" foi criado com ${count} apelidos (Prefeitos e Vereadores).`);
  }
  
  console.log('\n🔥 Mova os novos ficheiros JSON para a pasta "public" (substituindo os antigos).');
}

processarApelidos();