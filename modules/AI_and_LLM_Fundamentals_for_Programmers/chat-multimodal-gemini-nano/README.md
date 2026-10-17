# Chat Multimodal Gemini Nano

Chat que roda **direto no navegador** usando o **Gemini Nano**, o modelo de IA embutido no Google Chrome. Você envia uma pergunta, opcionalmente com uma **imagem** ou um **áudio**, recebe a resposta em tempo real (streaming) e ela é **traduzida automaticamente para português**.

Nada é enviado para servidores externos: o modelo, o tradutor e o detector de idioma rodam localmente, no seu computador.

> Projeto desenvolvido a partir do Módulo 01 da pós-graduação **Engenharia de Software com IA Aplicada** (UNIPDS), ministrado por Erick Wendel.

## Funcionalidades

- 💬 Conversa com o Gemini Nano, com resposta exibida em streaming
- 🖼️ Entrada multimodal: texto + imagem (e áudio, em dispositivos compatíveis)
- 🌐 Tradução automática da resposta de inglês para português
- 🔍 Detecção de idioma: se a resposta já vier em português, a tradução é pulada
- ⏹️ Botão para interromper a geração, mantendo a resposta parcial
- 🎛️ Controles de Temperature e Top K (veja [Limitações conhecidas](#limitações-conhecidas))

## Tecnologias

- HTML, CSS e JavaScript puro (ES Modules, sem framework e sem bundler)
- [Chrome Built-in AI](https://developer.chrome.com/docs/ai/built-in):
  - **Prompt API** (`LanguageModel`), para conversar com o Gemini Nano
  - **Translator API** (`Translator`), para traduzir de inglês para português
  - **Language Detector API** (`LanguageDetector`), para detectar o idioma da resposta
- [http-server](https://www.npmjs.com/package/http-server), servidor estático para desenvolvimento

## Estrutura do projeto

```
chat-multimodal-gemini-nano/
├── index.html                    # Estrutura da interface
├── index.js                      # Ponto de entrada: inicializa e conecta as camadas
├── style.css                     # Estilos (tema escuro, cor principal roxa)
├── controllers/
│   └── formController.js         # Coordena eventos da tela, IA e tradução
├── services/
│   ├── aiService.js              # Verifica requisitos e conversa com o Gemini Nano
│   └── translationService.js     # Detecta idioma e traduz a resposta
└── views/
    └── view.js                   # Única camada que acessa o DOM
```

A organização separa responsabilidades:

- a **View** só lê e escreve na tela;
- os **Services** só falam com as APIs do Chrome;
- o **Controller** coordena os dois;
- o **`index.js`** cria as peças e injeta as dependências.

## Requisitos

### Navegador

- **Google Chrome** (testado na versão **155**). Outros navegadores baseados em Chromium, como Opera e Edge, **não** trazem o Gemini Nano.

### Hardware

Segundo a [documentação oficial](https://developer.chrome.com/docs/ai/prompt-api):

- pelo menos **22 GB livres** no disco onde fica o perfil do Chrome;
- e uma destas opções:
  - **GPU** com mais de **4 GB de VRAM**; ou
  - **CPU** com **16 GB de RAM** e **4 núcleos** ou mais.

O status do modelo e a elegibilidade do dispositivo podem ser conferidos em `chrome://on-device-internals`.

### Flags do Chrome

Em `chrome://flags`, ative (**Enabled**) e reinicie o navegador:

| Flag | Para quê |
|---|---|
| `#prompt-api` | Habilita o `LanguageModel` (obrigatória) |
| `#prompt-api-multimodal-input` | Habilita entrada de imagem e áudio |

> ⚠️ Em versões mais antigas do Chrome, a flag se chamava `#prompt-api-for-gemini-nano`. As APIs de tradução e de detecção de idioma já vêm ativas por padrão nas versões recentes.

Não é necessário ativar `#prompt-api-sampling-mode`, `#gemma4-for-built-in-ai` nem `#on-device-model-speculative-decoding`. A última, inclusive, exige `temperature: 0` ou `topK: 1` e pode quebrar a aplicação.

## Como executar

```bash
npm install
npm start
```

Abra **http://localhost:8080** (ou http://127.0.0.1:8080).

> ⚠️ **Use `localhost` ou `127.0.0.1`.** O `http-server` também lista IPs de rede, como `http://192.168.x.x:8080` ou `http://172.x.x.x:8080`. Esses endereços não são considerados *contexto seguro* pelo Chrome, e nele **todas as APIs de IA ficam ocultas**, mesmo com as flags ativas. Para conferir, rode `isSecureContext` no console: o resultado precisa ser `true`.

## Primeiro uso: download do modelo

Na primeira execução, o Gemini Nano precisa ser baixado (alguns GB). O Chrome atual **só permite iniciar esse download a partir de uma ação do usuário**, como um clique ou uma tecla. Por isso, o download automático feito ao abrir a página falha com:

```
NotAllowedError: Requires a user gesture when availability is "downloading" or "downloadable"
```

Enquanto o download por clique não é implementado na interface, faça o download uma vez pelo console do DevTools (F12):

```javascript
document.addEventListener('click', () => {
    LanguageModel.create({
        expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }],
        monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
                console.log(`Gemini Nano: ${Math.round(e.loaded * 100)}%`);
            });
        },
    })
        .then((session) => {
            session.destroy();
            console.log('✅ Download concluído. Recarregue a página.');
        })
        .catch((error) => console.error('Erro no download:', error));
}, { once: true });
```

Depois, **clique em qualquer lugar da página**. Clicar no DevTools não conta. Quando aparecer o `✅`, recarregue a página.

Para descobrir quais tipos de entrada o seu dispositivo suporta:

```javascript
await LanguageModel.availability({ expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }], expectedOutputs: [{ type: 'text', languages: ['en'] }] })
await LanguageModel.availability({ expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'audio' }], expectedOutputs: [{ type: 'text', languages: ['en'] }] })
```

## Limitações conhecidas

- **Temperature e Top K são ignorados (Chrome 155).** O `LanguageModel.params()` não existe mais para páginas web. A aplicação usa valores padrão (Top K 3 de no máximo 8, Temperature 1 de no máximo 2), e o Chrome aceita os parâmetros no `LanguageModel.create`, mas não os aplica. Teste: com Temperature 0 e Top K 1, a mesma pergunta gera respostas diferentes.
- **Áudio depende do dispositivo.** Em alguns computadores, `availability` retorna `unavailable` para áudio. A sessão declara apenas os tipos usados em cada pergunta, então texto e imagem continuam funcionando, e anexar áudio exibe `Erro: Model capability is not available`.
- **A resposta pode vir com markdown** (por exemplo, `*` em listas), mesmo com a instrução de sistema pedindo texto puro. Modelos pequenos nem sempre seguem instruções à risca.
- **Perguntas em inglês têm melhor qualidade.** A sessão é configurada para inglês. Perguntas em português funcionam, mas sem garantia de qualidade. Nesse caso, a resposta já costuma vir em português e a tradução é pulada.

## Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| "As APIs nativas de IA não estão ativas" | Flag desativada ou contexto inseguro | Ative `#prompt-api` e abra pelo `localhost` |
| `'LanguageModel' in self` retorna `false` | Página aberta por IP de rede | Use `http://localhost:8080` |
| `NotAllowedError: Requires a user gesture` | Modelo ainda não baixado | Veja [Primeiro uso](#primeiro-uso-download-do-modelo) |
| `NotSupportedError: Model capability is not available` | Tipo de entrada não suportado (geralmente áudio) | Use texto ou imagem |
| `The translation service count exceeded the limitation` | Muitos tradutores criados ao mesmo tempo | Recarregue a página |
| Alterações no CSS não aparecem | Cache do navegador | `Ctrl + Shift + R` ou use `http-server -c-1` |

## Próximas melhorias

- [ ] Botão para baixar o modelo a partir de um clique
- [ ] Atualizar `LanguageModel.availability` para o formato com `expectedInputs` e `expectedOutputs`
- [ ] Corrigir a checagem do tradutor (`'no'` → `'unavailable'`)
- [ ] Atualizar os nomes das flags nas mensagens de erro
- [ ] Avisar na interface quando Temperature e Top K não forem suportados
- [ ] Testar a flag `#prompt-api-sampling-mode` como alternativa aos parâmetros

## Créditos

Baseado no material do curso **Engenharia de Software com IA Aplicada** (UNIPDS), de [Erick Wendel](https://github.com/ErickWendel). Adaptado e atualizado para a versão atual da Chrome Built-in AI.