import fs from 'fs';
import readline from 'readline';

// Lista dos arquivos que vamos processar
const arquivosParaProcessar = [
  {
    entrada: 'votacao_secao_2020_PE.csv',
    saida: 'eleicoespesqueira2020.csv',
    ano: '2020'
  },
  {
    entrada: 'votacao_secao_2024_PE.csv',
    saida: 'eleicoespesqueira2024.csv',
    ano: '2024'
  }
];

async function extrairPesqueira(entrada, saida, ano) {
  console.log(`\n🚀 Iniciando a extração de Pesqueira para o ano ${ano}...`);
  
  // Verifica se você realmente colocou o arquivo na pasta certa
  if (!fs.existsSync(entrada)) {
    console.error(`❌ ERRO: O arquivo ${entrada} não foi encontrado na pasta principal!`);
    return;
  }

  // O TSE costuma usar a codificação 'latin1' nestes arquivos antigos
  const fileStream = fs.createReadStream(entrada, { encoding: 'latin1' }); 
  
  // Vamos gerar um arquivo moderno em 'utf8' para os acentos não quebrarem no React
  const outStream = fs.createWriteStream(saida, { encoding: 'utf8' });

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let isPrimeiraLinha = true;
  let linhasSalvas = 0;
  let linhasLidas = 0;

  for await (const line of rl) {
    linhasLidas++;
    
    // Salva o cabeçalho (a primeira linha) obrigatoriamente
    if (isPrimeiraLinha) {
      outStream.write(line + '\n');
      isPrimeiraLinha = false;
      continue;
    }

    // Procura por Pesqueira (O delimitador do TSE é o ponto e vírgula)
    if (line.includes('"PESQUEIRA"') || line.includes(';PESQUEIRA;')) {
      outStream.write(line + '\n');
      linhasSalvas++;
    }

    // Mostra o progresso no terminal a cada 1 milhão de linhas para você ver que não travou
    if (linhasLidas % 1000000 === 0) {
      console.log(`⏳ [${ano}] Já varreu ${linhasLidas.toLocaleString('pt-BR')} linhas do estado...`);
    }
  }

  console.log('====================================');
  console.log(`✅ EXTRAÇÃO ${ano} CONCLUÍDA!`);
  console.log(`Total de linhas lidas no estado: ${linhasLidas.toLocaleString('pt-BR')}`);
  console.log(`Total de registros salvos para PESQUEIRA: ${linhasSalvas.toLocaleString('pt-BR')}`);
  console.log(`O novo arquivo "${saida}" está pronto!`);
  console.log('====================================');
}

// Roda o processo para os dois arquivos em sequência
async function executarTudo() {
  for (const arquivo of arquivosParaProcessar) {
    await extrairPesqueira(arquivo.entrada, arquivo.saida, arquivo.ano);
  }
  console.log('\n🎉 TODOS OS ARQUIVOS FORAM PROCESSADOS COM SUCESSO!');
  console.log('⚠️ PRÓXIMO PASSO: Mova os arquivos "eleicoespesqueira2020.csv" e "eleicoespesqueira2024.csv" gerados agora para dentro da pasta "public" do seu projeto.');
}

executarTudo();