// 獲得目標の合計トークン数
const TARGET_TOKEN = 1000;

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  try {
    var data = JSON.parse(e.postData.contents);
    var date = new Date();
    var formattedDate = Utilities.formatDate(date, "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");

    var levelStr, comment, earnedToken;
    var historyRecord = data.history || "";

    if (data.appType === "kuku-plus") {
      levelStr = "九九＋繰り上がり";
      // kuku-plusアプリからの送信時は、アプリ側で計算したトークン数を採用する
      earnedToken = parseInt(data.tokens, 10);
      comment = data.questions + "問正解！（九九+繰り上がり）";
    } else {
      // 従来の筆算アプリからの送信
      var levelNum = parseInt(data.level, 10);
      var questions = parseInt(data.questions, 10);
      earnedToken = levelNum * questions;
      levelStr = "レベル" + data.level;
      comment = data.questions + "問クリアしました！";
    }

    // スプレッドシートに新しい行として追加
    // 順番: [日時, 出席番号, レベル, 出題数, コメント, 獲得トークン, 履歴(kuku-plus用)]
    sheet.appendRow([formattedDate, data.studentId, levelStr, data.questions, comment, earnedToken, historyRecord]);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Data recorded successfully",
      token: earnedToken
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ダッシュボード画面の表示（ブラウザでURLを開いたときの処理）
function doGet(e) {
  return HtmlService.createHtmlOutput(getHtmlContent())
    .setTitle('筆算マスタークラスダッシュボード')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// 現在の合計トークンと、それぞれのトークンを誰が稼いだか（出席番号）の配列を取得する関数
// 画面からの非同期呼び出し用
function getTokenDetails() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();

  // 2列目（インデックス1）が出席番号
  // 3列目（インデックス2）がレベル（例: "レベル1", "レベル2"）
  // 6列目（インデックス5）がトークン数
  var tokens = [];
  for (var i = 1; i < data.length; i++) { // 1行目はヘッダーと仮定（またはデータ開始行）
    var studentId = data[i][1];
    var levelStr = data[i][2];
    var tokenValue = parseInt(data[i][5], 10);

    // "レベル1" の文字列から数字だけを取り出す
    var levelNum = 1; // デフォルト
    if (levelStr && typeof levelStr === 'string' && levelStr.indexOf('レベル') > -1) {
      levelNum = parseInt(levelStr.replace('レベル', ''), 10);
      if (isNaN(levelNum)) levelNum = 1;
    }

    // トークン数が有効な数値の場合、その数だけ出席番号とレベルのオブジェクトを追加
    if (!isNaN(tokenValue) && tokenValue > 0) {
      for (var j = 0; j < tokenValue; j++) {
        tokens.push({ id: studentId, level: levelNum });
      }
    }
  }
  return tokens;
}

// 簡単なダッシュボードのHTMLを生成する関数
function getHtmlContent() {
  var html = `
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Zen Maru Gothic', sans-serif;
      text-align: center;
      background-color: #f0f8ff;
      margin: 0;
      padding: 30px 20px;
    }
    h1 {
      color: #1976d2;
      font-size: 2.5rem;
      margin-bottom: 5px;
    }
    .rules {
      display: flex;
      justify-content: center;
      gap: 15px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .rule-badge {
      background: white;
      border: 2px solid #64b5f6;
      border-radius: 10px;
      padding: 10px 15px;
      font-weight: bold;
      color: #333;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .rule-badge span {
      color: #e91e63;
      font-size: 1.2rem;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
      box-shadow: 0 10px 20px rgba(0,0,0,0.1);
    }
    .status-text {
      font-size: 2rem;
      font-weight: bold;
      color: #333;
      margin-bottom: 20px;
    }
    .token-count {
      color: #fbc02d;
      font-size: 3.5rem;
    }
    
    /* ブロック積み上げエリア */
    .blocks-container {
      width: 100%;
      min-height: 300px;
      max-height: 60vh; /* 画面の約6割まで広がり、それ以上はスクロール */
      background-color: #e3f2fd;
      border-radius: 15px;
      margin: 20px 0;
      position: relative;
      border-bottom: 10px solid #8d6e63; /* 地面 */
      display: flex;
      flex-wrap: wrap-reverse;
      align-content: flex-start;
      gap: 2px;
      padding: 5px;
      overflow-y: auto; /* はみ出たらスクロール可能に */
    }
    
    /* 個別のブロック（出席番号表示用）の基本スタイル */
    .block {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      box-shadow: inset -1px -1px 3px rgba(0,0,0,0.2), 1px 1px 3px rgba(0,0,0,0.3);
      animation: dropBtn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
      opacity: 0;
      
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.6rem;
      font-weight: bold;
      color: #fff;
    }

    /* レベル1: オレンジ */
    .level-1 {
      background: radial-gradient(circle at top left, #ffca28, #f57f17);
      border: 1px solid #ff6f00;
      text-shadow: 1px 1px 1px #d84315;
    }

    /* レベル2: 緑 */
    .level-2 {
      background: radial-gradient(circle at top left, #81c784, #388e3c);
      border: 1px solid #1b5e20;
      text-shadow: 1px 1px 1px #1b5e20;
    }

    /* レベル3: 黒に金縁 */
    .level-3 {
      background: radial-gradient(circle at top left, #616161, #212121);
      border: 1.5px solid #ffca28; /* 金縁 */
      text-shadow: 1px 1px 1px #000000;
      box-shadow: inset -1px -1px 3px rgba(0,0,0,0.5), 0 0 5px rgba(255,202,40,0.8); /* 金色の淡い光沢 */
    }

    /* レベル4: 青 */
    .level-4 {
      background: radial-gradient(circle at top left, #4fc3f7, #0277bd);
      border: 1px solid #005662;
      text-shadow: 1px 1px 1px #01579b;
    }
    
    @keyframes dropBtn {
      0% { transform: translateY(-50px) scale(0.5); opacity: 0; }
      100% { transform: translateY(0) scale(1); opacity: 1; }
    }
  </style>
  <script>
    let currentTokens = [];
    
    // 画面ロード時に初回のデータ取得を行う
    window.onload = function() {
      fetchTokens();
      // 3秒ごとに非同期でデータを取得（ほぼリアルタイム）
      setInterval(fetchTokens, 3000);
    };

    function fetchTokens() {
      // GASのサーバー側関数(getTokenDetails)を呼び出す
      google.script.run.withSuccessHandler(updateUI).getTokenDetails();
    }
    
    // データ取得成功時にUIを更新する
    // tokenArray は [{id: "1番", level: 1}, {id: "2番", level: 2}, ... ] のようなオブジェクトの配列
    function updateUI(tokenArray) {
      if (!tokenArray) return;
      
      const newTokenCount = tokenArray.length;
      
      // 数が増えている場合のみ描画を追加
      if (newTokenCount > currentTokens.length) {
        document.getElementById("token-display").textContent = newTokenCount;
        
        const container = document.getElementById("blocks-area");
        
        // 新しく増えた分だけループでブロック生成
        for (let i = currentTokens.length; i < newTokenCount; i++) {
          // デモ用に見栄えを考慮し、最大500個程度で描画をストップ（ブラウザ負荷軽減）
          if (container.children.length > 500) break; 
          
          let blockData = tokenArray[i] || { id: "", level: 1 };
          
          let block = document.createElement("div");
          // 基本クラス + レベル別カラークラスを付与
          block.className = "block level-" + blockData.level;
          
          // 出席番号をブロックに印字
          block.textContent = blockData.id;
          
          // 少しずつ時間差で落ちてくるアニメーション
          // indexの差分を使って遅延を計算
          let delayIndex = i - currentTokens.length;
          block.style.animationDelay = (delayIndex * 0.05) + "s";
          
          container.appendChild(block);
        }
        currentTokens = tokenArray;
      }
    }
  </script>
</head>
<body>
  <h1>みんなで積もう！トークンタワー</h1>
  
  <div class="rules">
    <div class="rule-badge">レベル1<br><span style="font-size: 0.9rem; color: #666; display: block; margin-top: 3px;">繰り上がりなし</span>1問 = <span>1</span>トークン</div>
    <div class="rule-badge">レベル2<br><span style="font-size: 0.9rem; color: #666; display: block; margin-top: 3px;">繰り上がりあり</span>1問 = <span>2</span>トークン</div>
    <div class="rule-badge">レベル3<br><span style="font-size: 0.9rem; color: #666; display: block; margin-top: 3px;">連続繰り上がり</span>1問 = <span>3</span>トークン</div>
    <div class="rule-badge" style="border-color: #03a9f4;">レベル4<br><span style="font-size: 0.9rem; color: #666; display: block; margin-top: 3px;">3けた×2けた</span>1問 = <span style="color: #03a9f4;">4</span>トークン</div>
  </div>
  
  <div class="container">
    <div class="status-text">
      あつまったトークン： <span id="token-display" class="token-count">0</span>
    </div>
    
    <div id="blocks-area" class="blocks-container">
      <!-- ここにJavascriptでブロック（div）がドサドサと追加されます -->
    </div>
  </div>
</body>
</html>
  `;
  return html;
}

