# Ship & Sustain 初心者チュートリアル

最終更新: 2026-02-18

## 1. このチュートリアルのゴール
- 1ゲームを完走して、勝敗が決まるまでの流れを理解する。
- `DP`、`CC`、`CH`、`Cap`、`Budget` の関係を体感する。
- 最低限の操作ルール（Deliver / Sustain / Invest / Pass）を習得する。

想定時間: 10〜15分

## 2. ゲーム内要素と実際の会社での対応
以下は理解補助の読み替えであり、実際の会計・人事制度と1対1で一致するものではない。

- `Player` / `AI`
  - 同じ会社内で優先順位や戦略が異なる2チーム（例: 事業機能チーム同士）。
- `Node`（Frontend / Backend など）
  - プロダクト機能領域、または担当組織ユニット。
- `Edge`
  - チーム間・システム間の依存関係、インタフェース連携。
- `demand`
  - 事業からの要求量・案件需要。
- `risk`
  - 障害、運用、セキュリティ、コンプライアンスの潜在リスク。
- `maturity`
  - 開発運用プロセスの成熟度（標準化、自動化、運用品質）。
- `backlog`
  - 未処理課題・改善待ちタスク・先送り負債。
- `debt`（integration debt）
  - 連携仕様のゆがみ、暫定実装、調整コストの累積。
- `owner`
  - 当該領域の一次責任チーム。
- `assets`
  - 共通基盤・再利用資産（例: CI/CD、監視、セキュリティスキャン、テンプレート）。
- `Cap`
  - スプリント内で使える実行工数枠。
- `Budget`
  - 改善投資や資産利用に充当する予算枠。
- `DP`
  - 納品・リリース由来の短期成果指標。
- `CC`
  - 全体最適や安定運用への貢献指標。
- `CH`
  - 会社全体の健全性・持続可能性の指標。
- `Work Deliver`
  - 機能開発を進めて成果を出す行為（短期価値の獲得）。
- `Work Sustain`
  - 保守改善や品質改善を進める行為（負債・リスク低減）。
- `Invest Maturity`
  - 開発プロセスや運用能力への投資。
- `Invest Asset` / `Invest Edge Asset`
  - 自チーム資産、または連携境界の共通基盤への投資。
- `Accident`
  - 障害・インシデント・想定外対応に相当するイベント。
- `CH Drivers`（backlog/debt/owner/accident）
  - CHを下げた主要因の分類。

## 3. 事前準備
```bash
pnpm install
pnpm dev
```

ブラウザで `http://localhost:5173` を開く。

## 4. 最初の設定
1. `Seed` を `42` にする。
2. `AI` を `easy` にする。
3. `Depth` と `TopK` は `Preset` のままにする。
4. `New Game` を押す。

開始時の基準値（デフォルト設定）:
- スプリント: `4`
- `CH`: `80`
- `Cap`: Player/AI ともに `6`
- `Budget`: Player/AI ともに `4`

## 5. 操作しながら学ぶ（スプリント1）
### Step 1: Deliverで得点する
1. 盤面で `Frontend` ノードを選ぶ。
2. `Work Deliver` を1回押す。

確認ポイント:
- `Player DP` が増える。
- `Cap` が `-1` される。
- `Selected Node` の `backlog` が増える。

### Step 2: Sustainで負債を減らす
1. 盤面で `Backend` ノードを選ぶ。
2. `Work Sustain` を1回押す。

確認ポイント:
- `backlog` と接続エッジの `debt` が下がる。
- 条件を満たすと `CC +1` される。
- `Cap` が `-1` される。

### Step 3: Investで将来効率を上げる
1. `Frontend` を選んで `Invest Asset` を押す。
2. `Selected Edge` で `e1 (fe-be)` を選び、`Invest Edge Asset` を押す。

確認ポイント:
- `Budget` は投資1回ごとに `-1`。
- `Cap` は投資1回ごとに `-2`。
- `CC` が投資1回ごとに `+1`。
- `assets` に `asset:player` が追加される。

### Step 4: 手番の終了を確認する
1. `Cap` が `0` になると、Playerはそれ以上行動できない。
2. AIが自動で行動する。
3. 両チームの `Cap` が `0` になるとスプリント終了。
4. `CH Drivers` が更新され、`CH` が減少する。

## 6. スプリント2〜4の進め方（簡易ルール）
- 基本の優先順:
  1. `CH` が下がってきたら `Work Sustain` を増やす。
  2. 余裕があるときに `Invest` で `CC` と将来効率を確保する。
  3. 残り `Cap` は `Work Deliver` で `DP` を積む。
- `Pass` は「もう有効な行動がない」または「早めに手番を終えたい」ときだけ使う。

目安:
- `CH` が `40` 未満になると、ゲーム終了時に `Final` が `0.5` 倍になる。
- `DP` だけで押し切ろうとすると `backlog/debt` が増えやすく、後半に失速しやすい。

## 7. 結果画面の読み方
ゲーム終了後、`Result` で次を確認する。
- `Winner`: 勝者
- `Player Final / AI Final`: 最終得点
- `Share Player / Share AI`: CHとCCに基づく配分
- `Primary CH driver`: CH悪化の主因
- `Sprint Metrics`: 各スプリントの行動内訳とDP/CC増分

最終得点の考え方:
- `Final = DP + Share + Rev - Penalty`
- `CH < 40` の場合は `Final` が `0.5` 倍

## 8. つまずきやすい点
- `Invest` は強力だが、`Cap` を2使うため連打するとDeliver回数が減る。
- `Deliver` は即効性があるが、`backlog/debt` が増えてCH悪化につながる。
- `CH Drivers` を見ずに進めると、終盤に `Company Failed (CH < 40)` になりやすい。

## 9. 次に読むドキュメント
- 詳細マニュアル: `docs/manuals/test-play-manual.md`
- MVP仕様（式・パラメータ）: `docs/specs/mvp-v0.md`

## 10. 参考画面
初期画面:
![初期画面](./images/e2e-01-initial.png)

Edge資産投資後:
![Edge資産投資後](./images/e2e-02-edge-invest.png)

結果画面:
![結果画面](./images/e2e-03-result.png)
