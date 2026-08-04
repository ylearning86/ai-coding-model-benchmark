# Phase 1 実測結果

> 2026年8月4日時点の単一試行です。モデル一般の優劣ではなく、同一プロンプトをGitHub Copilot Agentで実行した結果を示します。

## 速度・AI Credit・技術選定

| ID | モデル | 所要時間 | AI Credit | 言語／UI | 自作ファイル | 自作行数 | テスト |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: |
| R1 | MAI-Code-1-Flash | 約4分1秒 | 69.9 | JavaScript／DOM Grid | 7 | 671 | 8/8成功 |
| R2 | GPT-5.6 Sol | 約5分50秒 | 267.9 | JavaScript／Canvas | 9 | 817 | 12/12成功 |
| R3 | Claude Opus 5 | 約12分40秒 | 58.9 | TypeScript／Canvas、Vite | 8 | 1,281 | 18/18成功 |
| R4 | Gemini 3.6 Flash | 約6分18秒 | 126.6 | React＋TypeScript／Canvas | 11 | 1,074 | 9/10成功 |

AI Creditは各試行直前・直後のCopilot Usage APIの`entitlement - quota_remaining`差分です。モデル呼び出しを仲介するエージェント処理も含むため、モデルAPI単体のトークン料金ではありません。Usage反映遅延の影響もあり得ます。

## 客観品質ゲート

| ゲート | R1 | R2 | R3 | R4 |
| --- | --- | --- | --- | --- |
| Production build | 未定義／不合格 | 成功 | 成功 | TypeScriptエラー |
| Lint | 未定義／不合格 | 構文チェック成功 | ESLint成功 | 未定義／不合格 |
| 自動テスト | 8/8成功 | 12/12成功 | 18/18成功 | 9/10成功 |
| 依存関係監査 | 依存0、lockfileなし | 依存0、lockfileなし | High 11 | Critical 1、High 1、Moderate 2 |
| 通常操作で開始 | 自動開始 | 成功 | 外部Edgeで成功 | 外部Edgeで成功 |
| レスポンシブ | 全高9,519pxで不合格 | 合格 | 横はみ出しなし、全高1,341px | 横はみ出しなし、全高1,134px |
| 破損保存データ | 要素の型検証なし | 合格 | 合格 | 非配列で画面全体がクラッシュ |
| XSS入力 | 不発 | 不発 | 不発 | 不発 |

VS Codeの追加診断では、R2に`theme-color`のブラウザー互換性警告1件、R3にファイル名大小文字オプションとCSS互換性の警告4件がありました。R4のTypeScriptエラーはProduction build欄へ計上済みです。比較対象を改変しないため、警告は修正せず証跡として残しています。

## 現時点の順位

客観品質ゲートだけを見ると、R2が最も安定しています。R3は静的品質とテストが強い一方、開発依存監査に問題があります。R1は最速ですが、プレビュー生成の1行の設計ミスでページ全体が数千pxに伸びました。R4は短時間でReact構成を作ったものの、完了報告に反してbuildとtestが失敗しています。

比較対象外のClaude Sonnet 5によるブラインド画像評価は、R2 27/30、R3 21/30、R1 17/30、R4 15/30でした。実測品質70点と合わせた総合点は、R2 93、R3 82、R1 59、R4 54です。CodeQLでは重大なセキュリティアラートがなく、既知の未使用変数だけだったため点数は変更していません。

## 制限なしパイロットから得たこと

旧AのClaude Opus 5は74分25秒、4,155行、89テストまで拡張しました。必須外のSRS、DAS/ARR、Tスピン、Back-to-Back、コンボも実装しており、速度比較ではなく成果物量の比較になっていました。

正式試行では20分目標に加え、12ツール呼び出し、15ファイル、20テスト、検証1回を上限に変更しました。同じOpusでもR3は12分40秒、8ファイル、18テストに収まり、作業量制限が有効だったことを確認できました。

## GitHubサービスの適用状況

| サービス | 状態 | 備考 |
| --- | --- | --- |
| GitHub Actions | 成功 | 4試行をmatrixでbuild／Lint／test／audit。既知ベースラインと一致 |
| Dependabot | 有効 | 正式比較R4にCritical 1、High 1、Medium 3を検出 |
| Dependency graph／SBOM | 有効 | 公開GitHubリポジトリへ配置済み |
| CodeQL | 成功 | Security重大度付き0件、Note 3件 |
| GitHub Code Quality | 利用不可 | 個人Free所有ではAPIが404。Team／GHEC Organizationと別ライセンスが必要 |
| Secret scanning | 有効 | Push protection有効、open alert 0件 |
| SonarQube Cloud | 代替候補 | 4作品を同じProfileで分析可能 |

公開リポジトリ[ylearning86/ai-coding-model-benchmark](https://github.com/ylearning86/ai-coding-model-benchmark)で実行しました。Code Quality setup APIは`404 Code quality is not available for this repository.`を返しました。所属GitHubアカウントがEnterprise組織にも参加しているだけでは足りず、対象リポジトリがTeam／GHEC Organization配下にあり、Code Qualityが許可・ライセンス付与されている必要があります。

## GitHub上の検出結果

### CodeQL

`security-and-quality` query suiteでJavaScript／TypeScriptを分析しました。ワークフローは成功し、Security重大度付きアラートは0件です。Noteとして未使用ローカル変数を3件検出しました。

| Alert | ID | 場所 | 判定 |
| --- | --- | --- | --- |
| [#1](https://github.com/ylearning86/ai-coding-model-benchmark/security/code-scanning/1) | `js/unused-local-variable` | `trials/R1/src/game.js:46` | Note、既存コード点に含む |
| [#2](https://github.com/ylearning86/ai-coding-model-benchmark/security/code-scanning/2) | `js/unused-local-variable` | `trials/R1/src/game.js:47` | Note、既存コード点に含む |
| [#3](https://github.com/ylearning86/ai-coding-model-benchmark/security/code-scanning/3) | `js/unused-local-variable` | `trials/R4/src/App.tsx:99` | build失敗と同一原因、重複減点なし |

### Dependabot

正式比較ではR4に5件を検出しました。ローカル`npm audit`で計上済みのため、総合点は変更していません。

| Severity | 件数 | 主な内容 |
| --- | ---: | --- |
| Critical | 1 | Vitest UIサーバーの任意ファイル読み取り・実行 |
| High | 1 | ViteのWindows alternate pathによる`server.fs.deny`回避 |
| Medium | 3 | NTLMv2ハッシュ漏えい、path traversal、esbuild開発サーバー |

比較対象外のPilot Aにも同じ内訳の5件があり、リポジトリ全体では10件です。

### Actions

- [Benchmark quality gates](https://github.com/ylearning86/ai-coding-model-benchmark/actions/runs/30882499795): R1〜R4の4ジョブ成功
- [CodeQL](https://github.com/ylearning86/ai-coding-model-benchmark/actions/runs/30882499908): JavaScript／TypeScript分析成功

## 証跡

- [R1記録](../runs/R1.md)
- [R2記録](../runs/R2.md)
- [R3記録](../runs/R3.md)
- [R4記録](../runs/R4.md)
- [共通品質ゲート](quality-gates.md)
- [ブラインドデザイン評価](design-review.md)
- [暫定100点評価](preliminary-scores.md)

検証日: 2026年8月4日
