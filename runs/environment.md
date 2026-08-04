# 実験環境

2026年8月4日に取得したPhase 1の基準環境です。モデルごとの試行で環境が変わった場合は、各Run Recordへ差分を記録します。

| 項目 | 実測値 |
| --- | --- |
| 取得日時 | 2026-08-04 10:07:53 JST |
| タイムゾーン | Tokyo Standard Time（UTC+09:00） |
| OS | Microsoft Windows 11 Pro 10.0.26200 |
| CPU | 12th Gen Intel Core i7-1265U |
| メモリ | 31.8 GB |
| VS Code | 1.131.0 |
| GitHub Copilot | 0.59.0（VS Code同梱版） |
| Node.js | v20.17.0 |
| npm | 11.9.0 |
| Copilotモード | Agent |

## 実験開始時に追記する項目

- モデルピッカーに表示される正式名称
- モデルごとのコスト表示
- Copilotプラン種別
- 開始時点のAI Credit残高
- 有効なツールとカスタム指示の一覧
- ブラウザー名とバージョン

## 取得根拠

- VS Code: 実行中の`Code.exe`の製品バージョン
- GitHub Copilot: VS Code同梱`copilot-chat`パッケージのマニフェスト
- OS、CPU、メモリ: Windows CIM
- Node.js、npm: 各CLIの`--version`
