# Ship & Sustain テストプレイマニュアル

最終更新: 2026-02-18

## 1. 目的
- ブラウザUIで1ゲームを完走し、主要機能が意図どおり動作することを確認する。
- 同一Seedで結果再現ができることを確認する。
- v2調整で導入した行動傾向（Edge資産投資、Sustain選択、CH推移）を観測する。

## 2. 前提条件
- Node.js 20 以上（推奨）
- pnpm 利用可能
- 依存取得済みであること

```bash
pnpm install
```

## 3. 起動手順
1. 開発サーバを起動する。

```bash
pnpm dev
```

2. ブラウザで `http://localhost:5173` を開く。

## 4. 画面の見方
- `Seed`: 初期乱数シード
- `AI`: 難易度（easy / normal / hard）
- `Depth`, `TopK`: AI探索パラメータ上書き
- `New Game`: 指定Seedで初期化
- `Selected Node`: ノード詳細（demand/risk/maturity/backlog/owner/assets）
- `Selected Edge`: エッジ詳細（coupling/debt/assets）
- `Actions`: プレイヤー操作
  - `Work Deliver`
  - `Work Sustain`
  - `Invest Maturity`
  - `Invest Asset`
  - `Invest Edge Asset`
  - `Pass`
- `Result`: 最終スコア、Style、CH要因、Chargeback集計
- `AI Decision Trace`: AIの意思決定ログ
- `Seed Comparison` / `Difficulty Comparison`: 実行履歴比較

## 4.1 画面キャプチャ（E2E取得）
以下の画像は `pnpm test:e2e` 実行時に自動更新される。

### 初期画面（開始直後）
![初期画面](./images/e2e-01-initial.png)

### Edge資産投資後
![Edge資産投資後](./images/e2e-02-edge-invest.png)

### 結果画面（完走後）
![結果画面](./images/e2e-03-result.png)

## 5. 基本テストプレイ（1ゲーム完走）
1. `Seed` を `42` に設定する。
2. `AI` は `normal`、`Depth/TopK` は `Preset` のままにする。
3. `New Game` を押す。
4. プレイヤーターンで以下を数回実行する。
   - `Work Deliver`
   - `Work Sustain`
   - `Invest Asset`
   - `Invest Edge Asset`
5. AIターンは自動進行するため、ログを見ながら4スプリント完了まで待つ。
6. `Result` が表示されることを確認する。

期待結果:
- ゲーム終了時に `Result` セクションが表示される。
- `Winner`, `Player Final / AI Final`, `Primary CH driver` が表示される。
- `Sprint Metrics`, `Chargeback`, `AI Decision Trace` に値が入る。

## 6. 再現性テスト（同一Seed）
1. 1回目のプレイで `Seed=42`、`AI=normal`、`Depth/TopK=Preset` を使用して完走する。
2. `Player Final`, `AI Final`, `CH` を記録する。
3. 同じ設定で `New Game` を押し、同様に完走する。
4. 結果が一致することを確認する。

期待結果:
- 同一Seed・同一設定なら、最終結果（Final/CH/Winner）が一致する。

## 7. 重点確認項目（v2）
### 7.1 Edge資産投資
1. `Selected Edge` で任意エッジを選択する。
2. プレイヤーターンで `Invest Edge Asset` を実行する。
3. `Selected Edge` の `assets` 表示に `asset:owner` が追加されることを確認する。

### 7.2 Sustain選好の確認
1. 2ゲーム以上連続実行する（Seedは `42, 43` 推奨）。
2. `AI Decision Trace` と `Difficulty Comparison` を確認する。

期待観測:
- AIが `Deliver` のみでなく `Sustain` も選択する。
- `CH Drivers` の悪化が一方向に偏りすぎない。

### 7.3 CHゲート確認
1. 連続で数ゲーム実行し、`Company Failed (CH < 40)` の表示有無を確認する。
2. 必要に応じて `docs/playlogs/v2-chargeback-summary.md` の fail rate と比較する。

## 8. 不具合報告テンプレート
不具合記録時は次を残す。
- 実行日時
- Seed
- AI設定（difficulty/depth/topK）
- 操作手順
- 期待結果
- 実際結果
- ログ抜粋（`Logs`, `AI Decision Trace`）

## 9. 補助コマンド
- 静的検証:

```bash
pnpm lint
pnpm test
pnpm build
```

- E2Eテスト + 画面キャプチャ更新:

```bash
pnpm test:e2e
```

- バランス確認:

```bash
pnpm analyze:v2:chargeback
```
