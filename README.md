# Simple Stack TODO (Electron + React + TypeScript)

超シンプルな「積み上げ式」TODO デスクトップアプリ（Windows 11 / Electron）。

## できること
- タスク追加（Enter で最上段に積む、空白は無視）
- タスク完了（行クリックで完了 → リストから消えるが JSON に保持）
- 並び替え（ドラッグ＆ドロップ）
- Undo（Ctrl+Z で直前の追加 or 完了を取り消し）

## セットアップ & 開発起動
```bash
npm install
npm run dev   # tsup + Vite + Electron を同時ウォッチ起動
```

## 本番ビルド & 通常起動
```bash
npm run build   # dist/main + dist/renderer を生成
npm start       # dist を用いて Electron を起動
```

## インストーラー作成（タスクバーにピン留めしたい場合）
```bash
npm run dist            # release/ に NSIS インストーラーを生成
# 例) release/Simple Stack TODO Setup 1.0.0.exe
```
1. 生成されたセットアップ exe を実行してインストール
2. スタートメニュー（またはインストール先）でアプリを右クリック → 「タスクバーにピン留め」
- アイコンは `build/icon.png` が埋め込まれ、タスクバーでも専用アイコンになります

## データ保存
- `app.getPath("userData")/todos.json` に自動保存・読み込み
- JSON が壊れていても空配列からリカバリ（コンソールに警告）

## 操作ガイド
- 追加: 入力 → Enter（空文字は無視、常に一番上へ）
- 完了: 行をクリック（一覧から消えるが JSON には残る）
- 並び替え: 行をドラッグ＆ドロップ
- Undo: Ctrl+Z（直前の「追加」「完了」のみ、並び替えは対象外）

## 主なファイル
- `src/main/main.ts` … Electron メインプロセス（IPC で JSON 読み書き、メニュー非表示、アイコン設定）
- `src/main/preload.ts` … `window.todoApi` を公開
- `src/renderer/App.tsx` … React UI 本体（追加/完了/並び替え/Undo、ドラッグ演出/完了フェード）
- `src/renderer/index.css` … Tailwind エントリ
- `tailwind.config.cjs` … Tailwind 設定
- `vite.config.ts` … Vite 設定（出力先 `dist/renderer`）
- `electron-builder.yml` … Windows NSIS インストーラー設定

## 注意・トレードオフ
- Ctrl+Z をグローバルに捕捉するため、入力欄の OS 標準 Undo は効きません
- 完了済みタスクは画面には出ませんが JSON に保持され、Undo で復元できます
- 並び替えは Undo 対象外です
