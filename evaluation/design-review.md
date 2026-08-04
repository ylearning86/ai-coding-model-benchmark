# ブラインドデザイン評価

比較対象外のClaude Sonnet 5へ、モデル名、時間、Credit、コードを伏せて画面だけを評価させました。これは単一AIモデルによる主観評価であり、実際の操作性やコード品質の代わりにはなりません。

## 撮影条件

- デスクトップ: 実幅1440×900
- モバイル: 実幅390×844
- 初期表示
- ブラウザー保存データを消去して撮影
- スクリーンショットは画面内だけを撮影
- ページ全体の`scrollWidth`と`scrollHeight`を補助情報として評価者へ提示

## 結果

| 順位 | ID | Design /20 | 視覚UX /10 | 合計 /30 | 強み | 主な欠点 |
| ---: | --- | ---: | ---: | ---: | --- | --- |
| 1 | R2 | 18 | 9 | 27 | 背景、タイトル、NEXT、タッチ操作まで一貫した情報設計 | モバイルの右端ボタンが画面端に近い |
| 2 | R3 | 15 | 6 | 21 | ロゴとキャッチコピーに個性があり、NEXT表示も視覚的に楽しい | モバイル全高1,341pxで説明文が長く、要素が下へ押し出される |
| 3 | R1 | 13 | 4 | 17 | ネイビーとミントの配色、3カラム、遊び方パネルが明快 | デスクトップ4,414px、モバイル9,519pxの極端なページ長 |
| 4 | R4 | 10 | 5 | 15 | モバイルの単一カラムがシンプル | タイトル重複、デスクトップの余白過多、独自性の弱さ |

## 評価AI Credit

| 項目 | 値 |
| --- | ---: |
| 評価開始前の累計 | 11,275.9 |
| 評価フェーズ終了時の累計 | 13,200.7 |
| 評価フェーズ全体で増えたCredit | 1,924.8 |

最初の画像セットで撮影幅が不正確と判明したため、システムEdgeで再撮影・再評価しました。上記Creditには無効とした評価、撮影修正、外部Edge検証、記録作業が含まれ、デザイン評価モデル単体の消費量ではありません。生成モデルのCredit比較には加算しません。

## 証跡画像

- [R1 desktop](../evidence/capture-R1-desktop.png) / [R1 mobile](../evidence/capture-R1-mobile.png)
- [R2 desktop](../evidence/capture-R2-desktop.png) / [R2 mobile](../evidence/capture-R2-mobile.png)
- [R3 desktop](../evidence/capture-R3-desktop.png) / [R3 mobile](../evidence/capture-R3-mobile.png)
- [R4 desktop](../evidence/capture-R4-desktop.png) / [R4 mobile](../evidence/capture-R4-mobile.png)
