<div align="center">
  <img src="public/icons/icon.svg" alt="Ícone do EnhanceGPT" width="96" height="96">
  <h1>EnhanceGPT</h1>
</div>

<p align="center">
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19.0.0-149eca?logo=react&logoColor=white" alt="React 19.0.0"></a>
  <a href="https://www.radix-ui.com/"><img src="https://img.shields.io/badge/Radix%20UI-1.3.2%20%2F%201.2.8-161618?logo=radixui&logoColor=white" alt="Radix UI 1.3.2 / 1.2.8"></a>
  <a href="https://www.npmjs.com/"><img src="https://img.shields.io/badge/npm-%3E%3D10-cb3837?logo=npm&logoColor=white" alt="npm >=10"></a>
  <a href="https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3"><img src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285f4?logo=googlechrome&logoColor=white" alt="Chrome Manifest V3"></a>
</p>
<p align="center">
  <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.ja.md">日本語</a> · <b>Português</b>
</p>

EnhanceGPT é uma extensão do Chrome que adiciona gerenciamento de chats em lote, gerenciamento de prompts e um sumário de navegação ao aplicativo web do ChatGPT. Ela é implementada como uma camada leve de aprimoramento nativo, evitando modais em tela cheia, interfaces pesadas e alterações no DOM que causem desvios de layout.

<p align="center">
  Acesso rápido: <a href="#instalação">Instalação</a> • <a href="#desenvolvimento">Desenvolvimento</a> • <a href="#demonstração-de-recursos">Demonstração de recursos</a> • <a href="#notas-de-implementação">Notas de implementação</a>
</p>

## Recursos principais

- Seleção em lote de conversas na barra lateral esquerda para acelerar seu fluxo de trabalho de múltiplos chats.
- Arquivar ou excluir conversas selecionadas a partir de um painel de ações em lote focado.
- Salvar, editar e reutilizar prompts a partir de um menu suspenso compacto acima da área de entrada.
- Gerar um sumário leve de conversas no espaço em branco à direita para uma navegação rápida em tópicos longos.
- Manter uma experiência do usuário leve, fluida, não intrusiva e integrada de forma nativa.

## Demonstração de recursos

<table>
  <tr>
    <th>Ações em lote</th>
  </tr>
  <tr>
    <td><img src="assets/bulk%20manager.gif" alt="Demo de gerenciamento em lote" width="100%"></td>
  </tr>
  <tr>
    <th>Gerenciador de prompts</th>
  </tr>
  <tr>
    <td><img src="assets/prompt%20manager.gif" alt="Demo de gerenciador de prompts" width="100%"></td>
  </tr>
  <tr>
    <th>Sumário da conversa</th>
  </tr>
  <tr>
    <td><img src="assets/outline.gif" alt="Demo de sumário da conversa" width="100%"></td>
  </tr>
</table>

## Instalação

Instale o EnhanceGPT a partir da loja de extensões do seu navegador:

- [Chrome Web Store](https://chromewebstore.google.com/detail/enhancegpt/lmldndbkafhldohcojnifbgcodmmbnjg)
- [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/aaanmffndkllpimlfoomliognpnocbnf)

## Requisitos

- Node.js 20 ou posterior
- npm 10 ou posterior
- Chrome ou navegador baseado em Chromium compatível com Manifest V3

## Desenvolvimento

```bash
npm install
```

Compilar o projeto e carregar no Chrome:

```bash
npm run build
```

Depois, carregue a pasta `dist` no Chrome:

1. Abra `chrome://extensions`.
2. Ative o "Modo do desenvolvedor".
3. Clique em "Ler descompactada".
4. Selecione a pasta `dist` deste repositório.

## Estrutura do projeto

```text
public/manifest.json        Manifesto de extensão no formato Manifest V3
src/content/                Script de conteúdo e interface do usuário injetada no ChatGPT
src/shared/                 Constantes compartilhadas e tipos de prompts
vite.content.config.ts      Configuração de compilação IIFE para o script de conteúdo do manifesto
```

## Notas de implementação

- O script de conteúdo é limitado aos domínios `https://chatgpt.com/*` e `https://chat.openai.com/*`.
- Os prompts são armazenados no `chrome.storage.local`, com fallback automático para `localStorage` em contextos de desenvolvimento fora da extensão.
- Os botões de exclusão/arquivamento em lote emitem eventos de navegador `ecg:bulk-conversation-action` em vez de chamar APIs privadas do ChatGPT diretamente. Isso mantém a primeira versão segura até que um adaptador nativo estável e explícito seja desenvolvido.
- O CSS usa o prefixo `ecg-` e é carregado como uma folha de estilo estática para o script de conteúdo.
- Os sumários de conversa priorizam o endpoint JSON de conversas do ChatGPT, permitindo indexar threads longas antes que as mensagens sejam renderizadas no DOM.

## Validação

```bash
npm run typecheck
npm run lint
npm run build
```

## Referências

- Chrome Manifest V3 e estrutura do manifesto: https://developer.chrome.com/docs/extensions/reference/manifest
- Scripts de conteúdo estáticos: https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
- Armazenamento da extensão: https://developer.chrome.com/docs/extensions/reference/api/storage
- Ícones da extensão: https://developer.chrome.com/docs/extensions/reference/manifest/icons
