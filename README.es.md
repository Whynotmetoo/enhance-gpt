<div align="center">
  <img src="public/icons/icon.svg" alt="Icono de EnhanceGPT" width="96" height="96">
  <h1>EnhanceGPT</h1>
</div>

<p align="center">
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19.0.0-149eca?logo=react&logoColor=white" alt="React 19.0.0"></a>
  <a href="https://www.radix-ui.com/"><img src="https://img.shields.io/badge/Radix%20UI-1.3.2%20%2F%201.2.8-161618?logo=radixui&logoColor=white" alt="Radix UI 1.3.2 / 1.2.8"></a>
  <a href="https://www.npmjs.com/"><img src="https://img.shields.io/badge/npm-%3E%3D10-cb3837?logo=npm&logoColor=white" alt="npm >=10"></a>
  <a href="https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3"><img src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285f4?logo=googlechrome&logoColor=white" alt="Chrome Manifest V3"></a>
</p>
<p align="center">
  <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.fr.md">Français</a> · <b>Español</b> · <a href="README.ja.md">日本語</a> · <a href="README.pt.md">Português</a>
</p>

EnhanceGPT es una extensión de Chrome que añade gestión masiva de chats, gestión de prompts y un esquema de navegación a la aplicación web de ChatGPT. Se implementa como una capa de mejora ligera y nativa, evitando ventanas modales a pantalla completa, interfaces pesadas y cambios en el diseño del DOM.

<p align="center">
  Acceso rápido: <a href="#instalación">Instalación</a> • <a href="#desarrollo">Desarrollo</a> • <a href="#demostración-de-funciones">Demostración de funciones</a> • <a href="#notas-de-implementación">Notas de implementación</a>
</p>

## Características clave

- Selección masiva de conversaciones en la barra lateral izquierda para un flujo de trabajo más rápido.
- Archivar o eliminar las conversaciones seleccionadas desde un panel de acciones masivas enfocado.
- Guardar, editar y reutilizar prompts desde un menú desplegable compacto encima del cuadro de entrada.
- Generar un esquema de conversación ligero en el espacio en blanco de la derecha para una navegación rápida en hilos largos.
- Mantener una experiencia de usuario fluida, ligera y no intrusiva con apariencia nativa.

## Demostración de funciones

<table>
  <tr>
    <th>Acciones masivas</th>
  </tr>
  <tr>
    <td><img src="assets/bulk%20manager.gif" alt="Demo de gestión masiva" width="100%"></td>
  </tr>
  <tr>
    <th>Gestor de prompts</th>
  </tr>
  <tr>
    <td><img src="assets/prompt%20manager.gif" alt="Demo de gestor de prompts" width="100%"></td>
  </tr>
  <tr>
    <th>Esquema de conversación</th>
  </tr>
  <tr>
    <td><img src="assets/outline.gif" alt="Demo de esquema de conversación" width="100%"></td>
  </tr>
</table>

## Instalación

Instalar EnhanceGPT desde la tienda de extensiones de tu navegador:

- [Chrome Web Store](https://chromewebstore.google.com/detail/enhancegpt/lmldndbkafhldohcojnifbgcodmmbnjg)
- [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/aaanmffndkllpimlfoomliognpnocbnf)

## Requisitos

- Node.js 20 o posterior
- npm 10 o posterior
- Chrome o un navegador basado en Chromium compatible con Manifest V3

## Desarrollo

```bash
npm install
```

Compilar el proyecto y cargarlo en Chrome:

```bash
npm run build
```

Luego, carga la carpeta `dist` en Chrome:

1. Abre `chrome://extensions`.
2. Activa el "Modo de desarrollador".
3. Haz clic en "Cargar descomprimida".
4. Selecciona la carpeta `dist` de este repositorio.

## Estructura del proyecto

```text
public/manifest.json        Manifiesto de extensión en formato Manifest V3
src/content/                Script de contenido e interfaz de usuario inyectada para ChatGPT
src/shared/                 Constantes compartidas y tipos de prompts
vite.content.config.ts      Configuración de compilación IIFE para el script de contenido del manifiesto
```

## Notas de implementación

- El script de contenido está limitado a `https://chatgpt.com/*` y `https://chat.openai.com/*`.
- Los prompts se almacenan en `chrome.storage.local`, con un plan de respaldo en `localStorage` para contextos de desarrollo fuera de la extensión.
- Los botones de eliminación y archivo masivo emiten eventos de navegador `ecg:bulk-conversation-action` en lugar de llamar a las API privadas de ChatGPT. Esto mantiene la primera versión segura hasta que se implemente un adaptador de acciones nativas estable y explícito.
- El CSS tiene el prefijo `ecg-` y se carga como una hoja de estilo estática para el script de contenido.
- Los esquemas de conversación prefieren el punto de acceso JSON de conversación de ChatGPT para indexar hilos largos antes de que cada mensaje se monte en el DOM.

## Validación

```bash
npm run typecheck
npm run lint
npm run build
```

## Referencias

- Chrome Manifest V3 y estructura del manifiesto: https://developer.chrome.com/docs/extensions/reference/manifest
- Scripts de contenido estáticos: https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
- Almacenamiento de la extensión: https://developer.chrome.com/docs/extensions/reference/api/storage
- Iconos de la extensión: https://developer.chrome.com/docs/extensions/reference/manifest/icons
