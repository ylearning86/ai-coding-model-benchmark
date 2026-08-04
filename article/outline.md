# 記事骨子（Phase 1実測反映）

> CodeQL、GitHub Code Quality、デザインのブラインド採点は未実施です。確認済みの数値と挙動だけを記載します。

## タイトル候補

- 同じゲームを4つのフラグシップAIモデルに作らせたら、速度・コスト・品質はどう違うのか
- GPT・Claude・Gemini・MAIを同一プロンプトで比較してみた

## ヒーロー画像案

4作品のプレイ画面を2×2で配置し、モデル名ではなくブラインドIDを付けた比較画像。公開版では結果発表後のモデル名ラベルを重ねる。

## はじめに

- モデル選択肢が増えた一方、コーディング用途で何を選ぶべきか判断しにくい。
- 同じプロンプト、同じAgentモード、同じPC環境で比較する。
- 2026年8月時点のスナップショットであり、各モデルの一般的な優劣を断定するものではない。

## TL;DR（先に結論）

- 最速: MAI-Code-1-Flash、約4分1秒
- 最少Credit: Claude Opus 5、58.9 Credits
- 客観品質ゲートが最も安定: GPT-5.6 Sol
- デザイン最高得点: GPT-5.6 Sol、27/30
- 暫定総合1位: GPT-5.6 Sol、93/100
- 同じ「完成」報告でも、build失敗、保存データクラッシュ、9,519pxの画面など、外部検証で大きな差が出た

## 1. 比較したモデルと実験条件

- モデルピッカーの正式名称と提供状態
- PC、VS Code、Copilot拡張機能、Agentモード
- 1回目は自由制作、必要に応じて条件固定で再試行
- 実行順とブラインド評価方法

## 2. 全モデルに送ったプロンプト

[共通ベンチマークプロンプト](../benchmark-prompt.md)を掲載する。

## 3. 評価方法

- 所要時間とAI Creditの記録方法
- 制限なしパイロットが74分かかったため、正式試行へ作業量上限を導入した経緯
- 100点の品質評価
- 自動テスト、ビルド、Lint、Dependabot、CodeQL、GitHub Code Quality
- GitHub Enterpriseだけで使える機能と、追加ライセンスが必要な機能の区別
- デスクトップ／モバイルのブラインドデザイン評価
- `n=1`であるPhase 1の限界

## 4. できあがった4作品

各作品について、同じ順序で以下を掲載する。

- デスクトップとモバイルのスクリーンショット
- 採用言語、フレームワーク、主要ライブラリ
- モデル自身が述べた技術選定理由
- 目立った機能と未完成点

## 5. 結果比較

| モデル | 時間 | AI Credit | デザイン | 品質 | 総合点 | 言語／フレームワーク |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| GPT-5.6 Sol | 約5分50秒 | 267.9 | 18/20 | 全客観ゲートで最も安定 | 93 | JavaScript／Canvas |
| Claude Opus 5 | 約12分40秒 | 58.9 | 15/20 | build・Lint・18テスト成功、依存監査High 11 | 82 | TypeScript／Canvas、Vite |
| Gemini 3.6 Flash | 約6分18秒 | 126.6 | 10/20 | build・test・監査・保存データで不合格 | 54 | React＋TypeScript／Canvas |
| MAI-Code-1-Flash | 約4分1秒 | 69.9 | 13/20 | 最速だがプレビューが各200セル | 59 | JavaScript／DOM Grid |

## 6. コード品質とセキュリティ

- 設計と責務分離
- 型安全性、命名、重複、状態管理
- ニックネーム表示に対するXSS確認
- localStorageデータ破損時の挙動
- 依存関係監査と不要な外部通信
- テストが実際に不具合を検出できるか
- CodeQLはセキュリティと既知の不具合パターン、Code Qualityは保守性・信頼性・カバレッジを評価する
- Code QualityのAI検出が消費したAI Creditは生成モデルのCreditと分けて掲載する

## 7. モデルごとの向き・不向き

実測結果の範囲内で、速度重視、デザイン重視、保守性重視などの利用場面を整理する。単一試行からモデル全般へ一般化しない。特に「最速」「最少Credit」「品質ゲート合格」は別々のモデルだったことを示す。

## ハマったポイント・実験の限界

- AI Creditの反映遅延
- モデル提供状態や料金体系の変化
- 生成AIの非決定性
- フレームワーク差による単純比較の難しさ
- Agentのツール実行時間を含む壁時計時間であること
- 「高品質に完成」という指示だけでは、品質志向のモデルほど過剰生成して速度比較を壊すこと
- サブエージェントを壁時計で強制停止できないため、作業量上限との二重制約にしたこと
- MAIは8テスト成功でもNEXT／HOLDを各200セル生成する見た目の不具合を検出できなかった
- Geminiは完了報告と異なり、TypeScript buildと1テストが失敗した
- VS Code統合ブラウザーではOpusとGeminiの開始クリックが失敗したが、外部Edgeでは成功し、検証環境差を発見した
- GPTは客観ゲートが安定した一方、今回の4モデル中でAI Credit消費が最大だった

## まとめ

実測後に、用途別の選び方を3点程度に絞って記載する。

## 参考リンク

- [Supported AI models in GitHub Copilot](https://docs.github.com/copilot/reference/ai-models/supported-models)
- [Models and pricing](https://docs.github.com/copilot/reference/copilot-billing/models-and-pricing)
- [Changing the AI model for Copilot Chat](https://docs.github.com/copilot/how-tos/use-ai-models/change-the-chat-model)
- [GitHub security features](https://docs.github.com/code-security/getting-started/github-security-features)
- [GitHub Code Quality](https://docs.github.com/code-security/code-quality)

> 本記事は GitHub Copilot および Microsoft Foundry を活用して作成されています。内容の正確性については各公式ドキュメントをご確認ください。
