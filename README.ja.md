<div align="center">
  <img src="public/icons/icon.svg" alt="EnhanceGPT アイコン" width="96" height="96">
  <h1>EnhanceGPT</h1>
</div>

<p align="center">
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19.0.0-149eca?logo=react&logoColor=white" alt="React 19.0.0"></a>
  <a href="https://www.radix-ui.com/"><img src="https://img.shields.io/badge/Radix%20UI-1.3.2%20%2F%201.2.8-161618?logo=radixui&logoColor=white" alt="Radix UI 1.3.2 / 1.2.8"></a>
  <a href="https://www.npmjs.com/"><img src="https://img.shields.io/badge/npm-%3E%3D10-cb3837?logo=npm&logoColor=white" alt="npm >=10"></a>
  <a href="https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3"><img src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285f4?logo=googlechrome&logoColor=white" alt="Chrome Manifest V3"></a>
</p>
<p align="center">
  <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <b>日本語</b> · <a href="README.pt.md">Português</a>
</p>

EnhanceGPTは、ChatGPTのウェブ版に複数チャットのまとめ管理、プロンプト管理、会話のアウトライン目次機能を追加するChrome拡張機能です。全画面表示のモーダルや重いUI、レイアウトを崩すDOM操作を避け、軽量でChatGPTのデザインに溶け込む拡張レイヤーとして実装されています。

<p align="center">
  クイックリンク：<a href="#インストール">インストール</a> • <a href="#開発方法">開発方法</a> • <a href="#機能デモ">機能デモ</a> • <a href="#実装に関する補足">実装に関する補足</a>
</p>

## 主な機能

- 左サイドバーの会話リストから複数チャットを一括選択し、効率的に整理可能。
- 専用の一括操作パネルから、選択した会話をアーカイブまたは一括削除。
- 入力エリア上部のコンパクトなドロップダウンから、プロンプトを保存、編集、再利用。
- 右側の余白エリアに軽量な会話のアウトライン（目次）を生成し、長い会話でも目的の場所にすばやくスクロール。
- シンプルかつ軽量で、ChatGPTの使い心地を邪魔しないネイティブに近い操作感。

## 機能デモ

<table>
  <tr>
    <th>まとめて一括操作</th>
  </tr>
  <tr>
    <td><img src="assets/bulk%20manager.gif" alt="一括操作のデモ" width="100%"></td>
  </tr>
  <tr>
    <th>プロンプト管理</th>
  </tr>
  <tr>
    <td><img src="assets/prompt%20manager.gif" alt="プロンプト管理のデモ" width="100%"></td>
  </tr>
  <tr>
    <th>会話アウトライン</th>
  </tr>
  <tr>
    <td><img src="assets/outline.gif" alt="会話アウトラインのデモ" width="100%"></td>
  </tr>
</table>

## インストール

拡張機能ストアからEnhanceGPTをインストール：

- [Chrome ウェブストア](https://chromewebstore.google.com/detail/enhancegpt/lmldndbkafhldohcojnifbgcodmmbnjg)
- [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/aaanmffndkllpimlfoomliognpnocbnf)

## 推奨環境

- Node.js 20 以上
- npm 10 以上
- Manifest V3 をサポートする Chrome または Chromium ベースのブラウザ

## 開発方法

```bash
npm install
```

ビルドして Chrome にロードする：

```bash
npm run build
```

その後、`dist` ディレクトリを Chrome にロードします：

1. `chrome://extensions` を開く。
2. 「デベロッパー モード」を有効にする。
3. 「パッケージ化されていない拡張機能を読み込む」を選択。
4. このリポジトリの `dist` フォルダを選択。

## プロジェクト構成

```text
public/manifest.json        Manifest V3 仕様の拡張機能定義ファイル
src/content/                ChatGPT に注入されるコンテンツスクリプトと UI コンポーネント
src/shared/                 共通の定数およびプロンプトの型定義
vite.content.config.ts      コンテンツスクリプトのビルド設定 (IIFE 形式)
```

## 実装に関する補足

- コンテンツスクリプトは `https://chatgpt.com/*` および `https://chat.openai.com/*` で動作します。
- プロンプトデータは `chrome.storage.local` に保存されます。拡張機能以外での動作テスト時は `localStorage` に自動フォールバックされます。
- 一括削除とアーカイブは、ChatGPT のプライベート API を直接呼ぶのではなく、ブラウザイベント `ecg:bulk-conversation-action` を送信して実行されます。公式のネイティブアクションアダプターが安定するまでの安全設計です。
- CSS は `ecg-` プレフィックスを持ち、静的コンテンツスクリプトスタイルシートとして読み込まれます。
- 会話アウトラインは、DOMにすべてのメッセージがマウントされる前にインデックス化するため、ChatGPTの会話データJSONエンドポイントを優先して利用します。

## 動作検証

```bash
npm run typecheck
npm run lint
npm run build
```

## 参考資料

- Chrome Manifest V3 と構成：https://developer.chrome.com/docs/extensions/reference/manifest
- 静的コンテンツスクリプト：https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
- 拡張機能のストレージ：https://developer.chrome.com/docs/extensions/reference/api/storage
- 拡張機能アイコン：https://developer.chrome.com/docs/extensions/reference/manifest/icons
