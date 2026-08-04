# 共通品質ゲート

モデルの自己申告に依存せず、全成果物へ同じ順序で適用します。外部評価の時間とAI Creditは、モデル生成の値に加算しません。

## 実行順

1. ロックファイルを使ったクリーンインストール
2. 成果物が定義したLint、テスト、型チェック、Production build
3. パッケージマネージャー標準の依存関係監査
4. デスクトップとモバイルのE2E操作、XSS入力、破損した保存データ
5. GitHub Dependency graph、Dependabot alerts、SBOM
6. CodeQL code scanning
7. GitHub Code QualityまたはSonarQube Cloud
8. 人によるブラインドコードレビューとデザイン評価

## GitHubサービスの適用範囲

| サービス | 主な評価 | 非公開リポジトリでの条件 | 今回の扱い |
| --- | --- | --- | --- |
| GitHub Actions | ビルド、Lint、テストの再現 | GitHubプラン内。利用量上限は契約による | 必須 |
| Dependency graph／SBOM | 依存関係の可視化 | 全プラン | 必須 |
| Dependabot alerts／更新 | 既知の脆弱性、更新候補 | 全プラン | 必須 |
| Repository rulesets | 品質チェックの必須化 | 全プラン。利用可能範囲はリポジトリ種別による | 公開時に設定 |
| CodeQL code scanning | 脆弱性と既知のコーディングエラー | 公開は無料。非公開はGitHub Code Securityが必要 | ライセンス確認後に必須 |
| GitHub Code Quality | 保守性、信頼性、カバレッジ、Autofix | 別ライセンスとActions実行量。AI機能はAI Creditも消費 | 全生成終了後に実施 |
| GitHub Secret Protection | シークレット検出、Push Protection | 公開は一部無料。非公開は別ライセンス | リポジトリ公開前に確認 |

GitHub Enterprise契約だけで、非公開リポジトリのCodeQLやCode Qualityが自動的に含まれるわけではありません。CodeQLにはGitHub Code Security、Code QualityにはCode Qualityの利用権が必要です。

## 判定基準

| ゲート | 合格条件 |
| --- | --- |
| Build／Lint／Test | エラー0。警告は件数と内容を記録 |
| 依存関係 | Critical／High 0。Medium以下は根拠付きで記録 |
| CodeQL | Critical／High 0。Medium以下は誤検知を含め個別確認 |
| Code Quality | Quality gate合格。新規コードの重大なReliability／Maintainability issue 0 |
| XSS | 指定文字列がコード実行されず、DOMへ文字列として表示される |
| 保存データ | 不正JSON、型不正、過大値でクラッシュしない |
| E2E | 必須操作がデスクトップとモバイルで完走する |

## 可読性評価

CodeQLはセキュリティ分析が中心で、命名、責務分離、理解しやすさを単独では評価できません。次を併用します。

- GitHub Code QualityまたはSonarQube CloudのCode Smell、重複、複雑度、カバレッジ
- Lintと型チェックの結果
- ファイル数、ソース行数、依存数、テスト数
- モデル名を伏せた人手レビュー

SonarQube CloudはGitHub Code Qualityを利用できない場合の代替です。同じ比較内でサービスを混在させず、4成果物すべてを同じサービスとQuality Profileで分析します。

## AI Creditの分離

GitHub Code QualityのAI検出とCopilot AutofixはAI Creditを消費します。次の順序を固定します。

1. 4モデルの生成と開始・終了Credit記録をすべて完了する。
2. 生成モデル比較のCredit値を確定する。
3. Code Quality開始前のCreditを別途記録する。
4. 4成果物を同じ設定で分析する。
5. Code QualityのCreditを「外部評価コスト」として別表へ記録する。

## 公式情報

- [GitHub security features](https://docs.github.com/code-security/getting-started/github-security-features)
- [Code scanning with CodeQL](https://docs.github.com/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning-with-codeql)
- [GitHub Code Quality](https://docs.github.com/code-security/code-quality)
- [Dependabot alerts](https://docs.github.com/code-security/dependabot/dependabot-alerts/about-dependabot-alerts)
- [SonarQube Cloud](https://docs.sonarsource.com/sonarqube-cloud/)
