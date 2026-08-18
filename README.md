# 360° インテリアパースビューア

Matterport 風の 360 度パノラマビューア。フロアプラン上のカメラアイコンから各視点のパノラマ（インテリアパースの A/B/C 案）を切り替えて閲覧できます。

## 機能

- 360 度パノラマ表示（ドラッグで視点回転、ホイールでズーム）。WebGL を直接使用しており、three.js 等の外部ライブラリには依存していません（`lib/panoramaEngine.js`）。
- パノラマ内に「次の視点への床マーカー」を配置。クリックでそのカメラへ移動。
- 左上に平面図、左下に A案/B案/C案 の切替ボタン（背景は白）。
- 案を切り替えても、パノラマの視点（向き・ズーム）はリセットされません。
- 平面図上のカメラアイコンをクリックすると、そのカメラのパノラマを右側に表示。編集モードではアイコンをドラッグして位置調整可能。
- カメラは「カメラ1」「カメラ2」…という初期名で始まり、編集モードで名称変更・削除（×ボタン）が可能。
- パノラマ内マーカーも編集モードでドラッグして位置調整可能。
- 編集内容（カメラの位置・名前・マーカーの位置や移動先など）は誰か1人が保存すると、他の人が後からサイトにアクセスしたときにも反映されます（Vercel Blob に共有保存。要設定、下記参照）。どの案を見ているか・どのカメラを見ているかという閲覧中の状態は各自のブラウザだけに保存されます。

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

- 平面図のカメラアイコンをドラッグして位置調整できます。
- 左下のカメラリストで名前を変更したり、× で削除できます（カメラの追加は UI からはできません。増やしたい場合は `data/defaultData.js` の `DEFAULT_CAMERAS` に直接追加してください）。
- パノラマ右上の「+ マーカーを追加」を押してから画像内をクリックすると、次の視点への床マーカーを配置できます。マーカーはドラッグで位置調整、クリックすると移動先の変更・削除ができます。

**編集内容の保存について:** カメラの位置・名前・マーカーはページを開いた人なら誰でも編集モードから変更でき、変更は自動的に共有ストレージ（Vercel Blob）に保存されます。ログインや権限管理は付けていないため、リンクを知っている人は誰でも編集できる状態です。社外にも公開する場合はご注意ください。

### 共有保存の設定（Vercel Blob）

初回デプロイ時に 1 回だけ、Vercel 側で Blob ストレージを有効にする必要があります。

1. Vercel のプロジェクト画面 →「Storage」タブ →「Create Database」→ **Blob** を選択して作成
2. 作成したストアをこのプロジェクトに Connect（`BLOB_READ_WRITE_TOKEN` という環境変数が自動で追加されます）
3. 一度 Redeploy する（環境変数を反映させるため）

これを行わない間は、編集内容がその場では反映されますが保存されず、ページを再読み込みすると初期状態（`data/defaultData.js`）に戻ります。

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
- 状態管理: `data/defaultData.js`（初期データ）+ `lib/store.js`（React Context）。カメラ・マーカーなどの編集内容は `app/api/state/route.js` 経由で Vercel Blob に共有保存。閲覧中の案・カメラ選択のみ各自のブラウザの localStorage に保存。
- パノラマ描画: `lib/panoramaEngine.js`（生 WebGL、外部依存なし）
- 主要コンポーネント: `components/PanoramaViewer.js`, `components/FloorPlan.js`, `components/Sidebar.js`
