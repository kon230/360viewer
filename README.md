# 360° インテリアパースビューア

Matterport 風の 360 度パノラマビューア。フロアプラン上のカメラアイコンから各視点のパノラマ（インテリアパースの A/B/C 案）を切り替えて閲覧できます。

## 機能

- 360 度パノラマ表示（ドラッグで視点回転、ホイールでズーム）。WebGL を直接使用しており、three.js 等の外部ライブラリには依存していません（`lib/panoramaEngine.js`）。
- パノラマ内に「次の視点への床マーカー」を配置。クリックでそのカメラへ移動。
- 左上に平面図、左下に A案/B案/C案 の切替ボタン（背景は白）。
- 案を切り替えても、パノラマの視点（向き・ズーム）はリセットされません。
- 平面図上のカメラアイコンをクリックすると、そのカメラのパノラマを右側に表示。
- カメラは「カメラ1」「カメラ2」…という初期名で始まり、編集モードで名称変更・追加・削除（×ボタン）が可能。
- 平面図のカメラアイコン・パノラマ内のマーカーの位置は固定です（ドラッグでの位置調整はできません）。位置を変えたい場合は `data/defaultData.js` の `x`/`y`（平面図アイコン、%指定）や `yaw`/`pitch`（パノラマ内マーカー、ラジアン）を直接編集してください。
- 編集内容（カメラ名・追加削除・マーカーの移動先など）はブラウザの localStorage に保存されます。

## セットアップ

このマシンには Node.js が入っていなかったため、`npm install` や `next build` はこの環境では実行・検証していません。お手元の Node.js 環境（18 系以上を推奨）で以下を実行してください。

```bash
npm install
npm run dev
```

`http://localhost:3000` を開くと確認できます。

## 画像の差し替え・追加

画像は `public/images` 以下に置く静的ファイルです（Web公開可能な通常の Next.js `public` フォルダ）。エンドユーザー向けのアップロード機能は付けていません（要件どおり、差し替えは制作者側のみが行う想定）。

```
public/images/
  floorplans/
    floorplan.webp          … 左上に表示される平面図
  panoramas/
    cam-corridor-a.jpg      … カメラ1 × A案
    cam-corridor-b.jpg      … カメラ1 × B案
    cam-lounge-a.jpg        … カメラ2 × A案
    cam-lounge-b.jpg        … カメラ2 × B案
```

対応関係は `data/defaultData.js` の `DEFAULT_CAMERAS[].images` で定義しています。C案の画像はまだ受け取っていないため `null`（未設定プレースホルダー表示）にしてあります。C案の画像が決まったら、ファイルを `public/images/panoramas/` に追加し、`images.C` にパスを指定してください。

画像は正距円筒図法（equirectangular / 360°×180°）の 1 枚絵を想定しています。

## カメラ・マーカーの編集

右上の「編集モード」をオンにすると：

- 左下のカメラリストで名前を変更したり、× で削除、「+ カメラを追加」で新規カメラを追加できます（新規カメラは A/B/C 画像未設定の状態で作成されるので、`data/defaultData.js` を編集するか、後述のとおりコードで画像パスを割り当ててください）。
- パノラマ右上の「+ マーカーを追加」を押してから画像内をクリックすると、次の視点への床マーカーを配置できます。配置後にクリックすると移動先の変更・削除ができます。
- 平面図のカメラアイコン・パノラマ内マーカーの位置は固定です（意図的にドラッグでの移動はできない仕様です）。

これらの編集はブラウザの localStorage に保存されるため、編集した本人のブラウザ内でのみ保持されます（サーバー側に永続化する DB は付けていません）。全員に共通の初期状態として配布したい場合は、`data/defaultData.js` を直接編集してください。

## Vercel へのデプロイ

このリポジトリは素の Next.js（App Router）構成なので、追加設定なしで Vercel にデプロイできます。

1. GitHub 等にリポジトリを push
2. Vercel で「New Project」→ このリポジトリを選択 → そのまま Deploy

もしくは Vercel CLI で：

```bash
npm i -g vercel
vercel
```

## 技術構成

- Next.js 14 (App Router) / React 18
- 画像・状態管理: `data/defaultData.js`（初期データ）+ `lib/store.js`（React Context, localStorage 永続化）
- パノラマ描画: `lib/panoramaEngine.js`（生 WebGL、外部依存なし）
- 主要コンポーネント: `components/PanoramaViewer.js`, `components/FloorPlan.js`, `components/Sidebar.js`
