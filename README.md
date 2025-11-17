# My Stack TODO (Electron + React + TS)

極限までシンプルな「積み上げ式」TODO デスクトップアプリ（Windows 11 / Electron）。

## できること
- タスク作成（Enter で即追加、常にリスト最上部に積む）
- タスク完了（行クリックで完了・非表示化。JSON には保持）
- 並び替え（ドラッグ＆ドロップ / Undo 対象外）
- Undo（Ctrl+Z で直前の作成・完了のみ巻き戻し）

## セットアップ
```bash
npm install
npm run dev          # Vite + tsup ウォッチ + Electron 起動
```

## ビルド
```bash
npm run build        # main/preload を tsup、renderer を Vite でビルド
npm start            # dist 出力を使って Electron 起動
```

## データ保存
- `app.getPath("userData")/todos.json` に自動保存・読み込み
- JSON が壊れても空配列で再スタート（コンソールに警告）

## ファイル構成（主なもの）
- `src/main/main.ts` … Electron メインプロセス。IPC で ToDo を読み書き
- `src/main/preload.ts` … `window.todoApi` を公開
- `src/renderer/App.tsx` … React UI 本体（追加 / 完了 / 並び替え / Undo）
- `src/renderer/index.css` … Tailwind エントリ
- `tailwind.config.cjs` … Tailwind 設定
- `vite.config.ts` … Vite 設定（出力先 `dist/renderer`）

## 操作ガイド
- 追加: 入力 → Enter。空文字は無視。
- 完了: タイトル行をクリック（リストから消える）。
- 並び替え: 行をドラッグしてドロップ。
- Undo: Ctrl+Z（直前の「追加」または「完了」のみ。並び替えは対象外）。

## 注意・トレードオフ
- Ctrl+Z をグローバルにハンドリングするため、入力欄の標準 Undo は効かなくなります。
- 完了済みタスクはリストに表示しませんが、JSON には保存し、Undo で復元できます。
