# dataset-ui-app


音声ファイルを聴きながらフラグを付けていき、後からまとめて削除できるアプリです。Windows用です。

## インストール

[リリースページ](https://github.com/hetima/dataset-ui-app/releases)からダウンロードするか[Scoop](https://scoop.sh/)で入れてください

```
scoop bucket add hetima https://github.com/hetima/scoop-bucket
scoop install hetima/dataset-ui-app

#launch
dataset-ui-app
```

## 使い方

再生したいフォルダをウィンドウにドラッグ・アンド・ドロップします。スペースバーで再生・停止します。上下キーで選択を変更すると自動で再生開始します。

ファイルには Good と Bad のフラグを付けることができます。「←」「G」「F」キーなどで Good フラグを付けます。「→」「B」キーで Bad フラグを付けます。\
「←」「→」キーは設定で挙動を変更できます。両方試して使いやすい方を設定して、最初から慣れておくことをお勧めします。

サイドバーでフラグを付けたファイルをサブフォルダに移動させることができます。

Ctrl+Sを押したときやフォルダを閉じるときに、フラグの状態を `mtdt.json` というファイルに保存します。これはフォルダごとにひとつ作成されます。[dataset-ui](https://github.com/hetima/dataset-ui) でも使われている独自のファイルです。

再生モードは3つあります「L」キーかボタンで切り替えます。
- 通常再生：普通に再生します
- 連続再生：再生が終わったら次のファイルを自動再生します
- 一曲リピート：同じファイルをループ再生します

`ファイル名.txt` や `mtdt.json` のtranscriptを読み込んで表示します。


## Open AI互換APIサーバで書き起こし

音声入力に対応したLLMサーバでtransctiptの書き起こしを行えます。Gemma 4が一応動きますが、[dataset-ui](https://github.com/hetima/dataset-ui)に搭載された`cli/lfm_server.py`を使えばASR専用モデルLFM2.5-Audio-1.5B-JPを利用できるのでお勧めです。


![Screenshot](https://raw.githubusercontent.com/hetima/dataset-ui-app/main/assets/ss01.jpg)

![Screenshot](https://raw.githubusercontent.com/hetima/dataset-ui-app/main/assets/ss02.jpg)


## ライセンス
MIT
