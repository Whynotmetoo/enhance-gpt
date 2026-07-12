<div align="center">
  <img src="public/icons/icon.svg" alt="Icône EnhanceGPT" width="96" height="96">
  <h1>EnhanceGPT</h1>
</div>

<p align="center">
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19.0.0-149eca?logo=react&logoColor=white" alt="React 19.0.0"></a>
  <a href="https://www.radix-ui.com/"><img src="https://img.shields.io/badge/Radix%20UI-1.3.2%20%2F%201.2.8-161618?logo=radixui&logoColor=white" alt="Radix UI 1.3.2 / 1.2.8"></a>
  <a href="https://www.npmjs.com/"><img src="https://img.shields.io/badge/npm-%3E%3D10-cb3837?logo=npm&logoColor=white" alt="npm >=10"></a>
  <a href="https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3"><img src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285f4?logo=googlechrome&logoColor=white" alt="Chrome Manifest V3"></a>
</p>
<p align="center">
  <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <b>Français</b> · <a href="README.es.md">Español</a> · <a href="README.ja.md">日本語</a> · <a href="README.pt.md">Português</a>
</p>

EnhanceGPT est une extension Chrome qui ajoute une gestion groupée des conversations, un gestionnaire de prompts et un sommaire de navigation à l'application web ChatGPT. L'intégration se fait sous forme d'une couche d'amélioration légère et native, évitant les fenêtres modales plein écran, les interfaces lourdes et les décalages de mise en page.

<p align="center">
  Accès rapide : <a href="#installation">Installation</a> • <a href="#développement">Développement</a> • <a href="#aperçu-des-fonctionnalités">Aperçu des fonctionnalités</a> • <a href="#notes-dimplémentation">Notes d'implémentation</a>
</p>

## Fonctionnalités clés

- Sélection groupée des conversations dans la barre latérale pour accélérer le traitement de plusieurs chats.
- Archivage ou suppression des conversations sélectionnées depuis une interface dédiée aux actions groupées.
- Enregistrement, édition et réutilisation de prompts depuis un menu déroulant compact au-dessus du champ de saisie.
- Génération d'un sommaire de conversation léger dans l'espace vide de droite pour une navigation rapide dans les longs échanges.
- Expérience utilisateur fluide, légère et non intrusive, proche de l'interface native.

## Aperçu des fonctionnalités

<table>
  <tr>
    <th>Actions groupées</th>
  </tr>
  <tr>
    <td><img src="assets/bulk%20manager.gif" alt="Démo du gestionnaire groupé" width="100%"></td>
  </tr>
  <tr>
    <th>Gestionnaire de prompts</th>
  </tr>
  <tr>
    <td><img src="assets/prompt%20manager.gif" alt="Démo du gestionnaire de prompts" width="100%"></td>
  </tr>
  <tr>
    <th>Sommaire de conversation</th>
  </tr>
  <tr>
    <td><img src="assets/outline.gif" alt="Démo du sommaire de conversation" width="100%"></td>
  </tr>
</table>

## Installation

Installer EnhanceGPT depuis le store d'extensions de votre navigateur :

- [Chrome Web Store](https://chromewebstore.google.com/detail/enhancegpt/lmldndbkafhldohcojnifbgcodmmbnjg)
- [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/aaanmffndkllpimlfoomliognpnocbnf)

## Prérequis

- Node.js 20 ou supérieur
- npm 10 ou supérieur
- Chrome ou un navigateur basé sur Chromium compatible avec Manifest V3

## Développement

```bash
npm install
```

Construire le projet et le charger dans Chrome :

```bash
npm run build
```

Ensuite, chargez le répertoire `dist` dans Chrome :

1. Ouvrez `chrome://extensions`.
2. Activez le "Mode développeur".
3. Cliquez sur "Charger l'extension non empaquetée".
4. Sélectionnez le dossier `dist` de ce projet.

## Structure du projet

```text
public/manifest.json        Manifest de l'extension au format Manifest V3
src/content/                Script de contenu et interface utilisateur injectée pour ChatGPT
src/shared/                 Constantes partagées et types de prompts
vite.content.config.ts      Configuration de build IIFE pour le script de contenu du manifest
```

## Notes d'implémentation

- Le script de contenu est limité aux domaines `https://chatgpt.com/*` et `https://chat.openai.com/*`.
- Les prompts sont stockés dans `chrome.storage.local`, avec une solution de secours sur `localStorage` dans les contextes de développement hors extension.
- Les boutons de suppression/archivage groupés émettent des événements de navigation `ecg:bulk-conversation-action` au lieu d'appeler des API privées de ChatGPT. Cela garantit la sécurité de la première version en attendant la mise en place d'un adaptateur d'actions natives stable et explicite.
- Le code CSS est préfixé par `ecg-` et chargé comme une feuille de style statique pour le script de contenu.
- Le sommaire de conversation utilise de préférence le point de terminaison JSON de la conversation ChatGPT pour indexer les longs fils avant que chaque message ne soit monté dans le DOM.

## Validation

```bash
npm run typecheck
npm run lint
npm run build
```

## Références

- Chrome Manifest V3 et structure du manifest : https://developer.chrome.com/docs/extensions/reference/manifest
- Scripts de contenu statiques : https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
- Stockage de l'extension : https://developer.chrome.com/docs/extensions/reference/api/storage
- Icônes de l'extension : https://developer.chrome.com/docs/extensions/reference/manifest/icons
