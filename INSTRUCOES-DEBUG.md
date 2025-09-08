# 🔍 Instruções para Debug do PDF

## Problema
O botão "Gerar PDF" não está funcionando em outro navegador.

## ✅ Correções Implementadas

### 1. Campo Horário
- **Corrigido**: Removidos os segundos do campo horário
- **Como**: Adicionado `step="60"` no input time
- **Resultado**: Agora mostra apenas horas e minutos (HH:MM)

### 2. Logs de Debug
- **Adicionados**: Logs detalhados na geração de PDF
- **Localização**: Funções `generatePDF()` e `createPDF()`

## 🧪 Como Testar

### Teste 1: Arquivo de Debug Isolado
1. Abra o arquivo `test-pdf-debug.html` no navegador
2. Pressione F12 para abrir o Console
3. Clique nos botões de teste:
   - "1. Testar PDFLib" - Verifica se a biblioteca está carregada
   - "2. Gerar PDF Simples" - Testa geração básica
   - "3. Testar Voucher PDF" - Simula um voucher
4. Observe os logs na página e no console

### Teste 2: Aplicação Principal
1. Abra o arquivo `index.html` no navegador
2. Pressione F12 para abrir o Console
3. Configure uma agência (se não tiver)
4. Preencha um voucher com dados mínimos:
   - Selecione agência e template
   - Nome do contratante
   - Telefone
   - Pelo menos um destino
5. Clique em "Gerar PDF"
6. **Observe os logs no console**:

## 📋 Logs Esperados

Quando você clicar em "Gerar PDF", deve aparecer no console:

```
🔄 Iniciando geração de PDF...
📋 Dados do voucher: {objeto com os dados}
🏢 Configuração da agência: {objeto com config}
✅ Validação passou, criando PDF...
🔧 Iniciando createPDF...
📚 Verificando PDFLib: {status da biblioteca}
```

## 🚨 Possíveis Problemas e Soluções

### Se não aparecer nenhum log:
- **Problema**: O botão não está conectado à função
- **Solução**: Verificar se há erros JavaScript no console

### Se parar em "Validação falhou":
- **Problema**: Dados obrigatórios não preenchidos
- **Verificar**:
  - ✅ Agência selecionada
  - ✅ Template selecionado  
  - ✅ Nome do contratante
  - ✅ Telefone
  - ✅ Pelo menos um destino

### Se parar em "PDFLib não está carregado":
- **Problema**: Biblioteca não carregou
- **Possíveis causas**:
  - Conexão com internet
  - Bloqueio de CDN
  - Cache do navegador
- **Soluções**:
  - Limpar cache (Ctrl+Shift+R)
  - Verificar conexão
  - Tentar outro navegador

### Se der erro na criação do PDF:
- **Problema**: Erro na biblioteca ou dados
- **Verificar**: Mensagem de erro específica no console

## 🔧 Arquivos Modificados

- `app.js` - Logs de debug adicionados
- `index.html` - Campo horário corrigido (step="60")
- `test-pdf-debug.html` - Arquivo de teste criado

## 📞 Próximos Passos

1. **Execute os testes acima**
2. **Copie os logs do console**
3. **Informe qual teste falhou e onde parou**
4. **Mencione qualquer mensagem de erro**

Com essas informações, poderemos identificar exatamente onde está o problema!