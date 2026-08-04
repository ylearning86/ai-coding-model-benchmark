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

比較対象外のClaude Sonnet 5によるブラインド画像評価は、R2 27/30、R3 21/30、R1 17/30、R4 15/30でした。実測品質70点と合わせた暫定総合点は、R2 93、R3 82、R1 59、R4 54です。CodeQL／GitHub Code Quality実行後に該当項目を再採点します。

## 制限なしパイロットから得たこと

旧AのClaude Opus 5は74分25秒、4,155行、89テストまで拡張しました。必須外のSRS、DAS/ARR、Tスピン、Back-to-Back、コンボも実装しており、速度比較ではなく成果物量の比較になっていました。

正式試行では20分目標に加え、12ツール呼び出し、15ファイル、20テスト、検証1回を上限に変更しました。同じOpusでもR3は12分40秒、8ファイル、18テストに収まり、作業量制限が有効だったことを確認できました。

## GitHubサービスの適用状況

| サービス | 状態 | 備考 |
| --- | --- | --- |
| GitHub Actions | 設定済み | 4試行をmatrixでbuild／Lint／test／audit |
| Dependabot | 設定済み | npmとGitHub Actionsを週次確認 |
| Dependency graph／SBOM | GitHubへpush後に有効化 | 全プランで利用可能 |
| CodeQL | Workflow設定済み、未実行 | 公開リポジトリは無料。非公開はGitHub Code Securityが必要 |
| GitHub Code Quality | 未実行 | Enterprise本体とは別ライセンス。AI検出はAI Creditも消費 |
| SonarQube Cloud | 代替候補 | Code Qualityを利用できない場合、4作品を同じProfileで分析 |

所属GitHubアカウントはEnterpriseプランの組織に参加していますが、それだけでは非公開リポジトリ向けGitHub Code Security／Code Qualityの権利を確定できません。公開または追加ライセンス有効化後に実行します。

## 証跡

- [R1記録](../runs/R1.md)
- [R2記録](../runs/R2.md)
- [R3記録](../runs/R3.md)
- [R4記録](../runs/R4.md)
- [共通品質ゲート](quality-gates.md)
- [ブラインドデザイン評価](design-review.md)
- [暫定100点評価](preliminary-scores.md)

検証日: 2026年8月4日
