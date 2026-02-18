# Ship & Sustain 初心者チュートリアル

最終更新: 2026-02-18

## 1. このチュートリアルのゴール
- 1ゲームを完走して、勝敗が決まるまでの流れを理解する。
- `DP`、`CC`、`CH`、`Cap`、`Budget` の関係を体感する。
- 最低限の操作ルール（Deliver / Sustain / Invest / Pass）を習得する。

想定時間: 10〜15分

## 2. 事前準備
```bash
pnpm install
pnpm dev
```

ブラウザで `http://localhost:5173` を開く。

## 3. 最初の設定
1. `Seed` を `42` にする。
2. `AI` を `easy` にする。
3. `Depth` と `TopK` は `Preset` のままにする。
4. `New Game` を押す。

開始時の基準値（デフォルト設定）:
- スプリント: `4`
- `CH`: `80`
- `Cap`: Player/AI ともに `6`
- `Budget`: Player/AI ともに `4`

## 4. 操作しながら学ぶ（スプリント1）
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

## 5. スプリント2〜4の進め方（簡易ルール）
- 基本の優先順:
  1. `CH` が下がってきたら `Work Sustain` を増やす。
  2. 余裕があるときに `Invest` で `CC` と将来効率を確保する。
  3. 残り `Cap` は `Work Deliver` で `DP` を積む。
- `Pass` は「もう有効な行動がない」または「早めに手番を終えたい」ときだけ使う。

目安:
- `CH` が `40` 未満になると、ゲーム終了時に `Final` が `0.5` 倍になる。
- `DP` だけで押し切ろうとすると `backlog/debt` が増えやすく、後半に失速しやすい。

## 6. 結果画面の読み方
ゲーム終了後、`Result` で次を確認する。
- `Winner`: 勝者
- `Player Final / AI Final`: 最終得点
- `Share Player / Share AI`: CHとCCに基づく配分
- `Primary CH driver`: CH悪化の主因
- `Sprint Metrics`: 各スプリントの行動内訳とDP/CC増分

最終得点の考え方:
- `Final = DP + Share + Rev - Penalty`
- `CH < 40` の場合は `Final` が `0.5` 倍

## 7. つまずきやすい点
- `Invest` は強力だが、`Cap` を2使うため連打するとDeliver回数が減る。
- `Deliver` は即効性があるが、`backlog/debt` が増えてCH悪化につながる。
- `CH Drivers` を見ずに進めると、終盤に `Company Failed (CH < 40)` になりやすい。

## 8. 次に読むドキュメント
- 詳細マニュアル: `docs/manuals/test-play-manual.md`
- MVP仕様（式・パラメータ）: `docs/specs/mvp-v0.md`

## 9. 参考画面
初期画面:
![初期画面](./images/e2e-01-initial.png)

Edge資産投資後:
![Edge資産投資後](./images/e2e-02-edge-invest.png)

結果画面:
![結果画面](./images/e2e-03-result.png)
