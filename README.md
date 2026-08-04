# Copilot Model Game Benchmark

GitHub Copilotの複数モデルに同一プロンプトで落ちものブロックパズルを実装させ、速度、AI Credit、デザイン、実装品質、技術選定を比較するための実験ワークスペースです。

Repository: [ylearning86/ai-coding-model-benchmark](https://github.com/ylearning86/ai-coding-model-benchmark)

## 現在の状態

Phase 1の4モデル実行、独立build／test／audit、外部Edge E2E、ブラインドデザイン評価、GitHub Actions、CodeQL、Dependabotまで完了しました。

- [Phase 1実測結果](evaluation/results.md)
- [100点評価](evaluation/preliminary-scores.md)
- [ブラインドデザイン評価](evaluation/design-review.md)
- [ブログ初稿](article/draft.md)
- [比較ヒーロー画像](evidence/hero-comparison.png)

CodeQLは成功し、Security重大度付きアラート0件、未使用ローカル変数のNote 3件を検出しました。Dependabotは正式比較R4にCritical 1、High 1、Medium 3を検出しています。

GitHub Code Qualityは個人アカウント所有の公開リポジトリでは利用できませんでした。GitHub TeamまたはEnterprise Cloud配下のOrganizationと、Code Qualityの利用権が必要です。Secret scanningとPush protectionは有効で、Secret alertは0件です。

## ローカル再検証

試行ごとの生成物は意図的に修正していません。R1〜R3の成功とR4の既知の失敗を再現します。

```powershell
node .\scripts\capture-benchmark.mjs
node .\scripts\validate-browser.mjs
```

GitHub Actionsの`Benchmark quality gates`は、各試行の成功・失敗をベースラインと照合します。既知の失敗を検出しただけでは赤にならず、記録済みの結果から変化した場合に失敗します。

## 比較対象

実験開始時にモデルピッカーの正式な表示名を転記します。略称や記憶上の名称は結果表に使いません。

| 呼称 | モデルピッカーの正式名称 | モデルID | 提供状態 | 価格カテゴリ |
| --- | --- | --- | --- | --- |
| GPT | GPT-5.6 Sol | `gpt-5.6-sol` | GA | High |
| Opus | Claude Opus 5 | `claude-opus-5` | GA | High |
| Gemini | Gemini 3.6 Flash | `gemini-3.6-flash` | GA | Medium |
| MAI | MAI-Code-1-Flash | `mai-code-1-flash` | GA | Low |

## 実験方式

### Pilot 0: 制限なし（正式比較から除外）

Claude Opus 5で最初の試行を行ったところ、74分25秒、4,155行、89テストまで拡張しました。必須外の高度なゲーム仕様と大量のテストが含まれ、速度比較が成果物量の比較になったため、この結果は正式ランキングに含めません。過剰生成を発見したパイロットとして別枠で記事に掲載します。

### Phase 1: 自由制作

改訂版プロンプトで4モデルを各1回実行します。言語とフレームワークはモデル自身に選ばせ、技術選定を含めて評価します。20分の目標時間に加え、ツール呼び出し、ファイル数、テスト数、検証回数に共通上限を設けます。

### Phase 2: 条件固定

Phase 1で実装方式の差が大きく、コード品質を直接比較できない場合だけ実施します。全モデルを同じスタックに固定し、各3回の中央値を採用します。

## 公平性のルール

1. [benchmark-prompt.md](benchmark-prompt.md)の本文を一字一句変えずに送信する。
2. モデルごとに空の独立フォルダーと新規チャットを使う。
3. Agentモード、VS Code、Copilot拡張機能、利用可能ツール、ネットワーク条件を統一する。
4. `Auto`を使わず、対象モデルを明示的に選択する。
5. 追加指示、回答への誘導、手動修正を行わない。質問された場合も回答せず、質問の発生を記録する。
6. 20分以内の完了を目標とし、ツール12回、作成15ファイル、20テスト、最終検証1回を上限とする。超過はプロトコル違反として記録する。
7. 実験中は別のCopilot操作を止め、利用量の混入を防ぐ。
8. 実行順は事前にランダム化し、モデル名を伏せたIDでデザインを評価する。
9. 前試行のソース、会話、スクリーンショットを後続モデルから参照できない状態にする。

## 1試行の手順

1. VS CodeとCopilot拡張機能のバージョン、日時、PC環境を記録する。
2. Copilot Usage画面とモデルピッカーを撮影し、開始時のAI Creditを記録する。
3. 空フォルダーを開き、新規チャットで対象モデルを選択する。
4. [benchmark-prompt.md](benchmark-prompt.md)を送信した時点で計時を開始する。
5. エージェントが完了を報告した時点で計時を終了する。
6. 利用量の反映を確認し、終了時のAI Creditと差分を記録する。
7. 全モデルの生成終了後、モデルの手を加えずに、[共通品質ゲート](evaluation/quality-gates.md)を同じ順序で実行する。
8. 同じブラウザー、ビューポート、ゲーム状態でデスクトップとモバイルを撮影する。
9. [runs/run-template.md](runs/run-template.md)を複製し、ログと証跡を記入する。
10. モデル名を隠した状態で[evaluation/scorecard.md](evaluation/scorecard.md)を採点する。

## 計測上の注意

- 実時間はプロンプト送信から最終応答までの壁時計時間とする。
- AI Creditは開始値と終了値の差で記録し、反映遅延がある場合は確認時刻も残す。
- GitHub Code QualityのAI検出やCopilot AutofixはAI Creditを消費するため、モデル生成中には実行しない。全試行終了後に別枠で計測する。
- `n=1`のPhase 1は傾向確認であり、モデル一般の性能として断定しない。
- 料金体系やモデル倍率は実験日の公式情報を参照し、記事に確認日を明記する。
- デザイン評価用スクリーンショットにはモデル名、チャット、フォルダー名を写さない。

## Pilot 0の結果

| パイロットID | モデル正式名称 | 所要時間 | 扱い |
| --- | --- | ---: | --- |
| P0（旧A） | Claude Opus 5 | 74分25秒 | 正式比較から除外 |

詳細は[runs/A.md](runs/A.md)に記録しています。

## 正式Phase 1の実行順

改訂プロンプト確定後、PowerShellの`Get-Random`で再度無作為化しました。

| ブラインドID | モデル正式名称 |
| --- | --- |
| R1 | MAI-Code-1-Flash |
| R2 | GPT-5.6 Sol |
| R3 | Claude Opus 5 |
| R4 | Gemini 3.6 Flash |

## 公式情報

- [Supported AI models in GitHub Copilot](https://docs.github.com/copilot/reference/ai-models/supported-models)
- [Models and pricing](https://docs.github.com/copilot/reference/copilot-billing/models-and-pricing)
- [Changing the AI model for Copilot Chat](https://docs.github.com/copilot/how-tos/use-ai-models/change-the-chat-model)
- [GitHub security features](https://docs.github.com/code-security/getting-started/github-security-features)
- [GitHub Code Quality](https://docs.github.com/code-security/code-quality)
