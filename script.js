// GASデプロイ後のWebアプリURLをここに貼り付けてください
const GAS_URL = "https://script.google.com/macros/s/AKfycbzM0tofiTg9HDuJREdUBY1uxPRXMOv1-lz0-41Y6lS2Tn4ZiYvfnsnaITujOfFqXpYfOg/exec";

// グローバル変数
let currentLevel = 1;
let currentQuestion = 1;
let targetQuestions = 5; // 何問コースか
let studentId = "";      // 出席番号
let currentProblem = { num1: 0, num2: 0, partial1: 0, partial2: 0, sum: 0 };
let activeElementId = null; // 例: 'val-r3-100', 'carry-mul-r3-100'

// DOM読み込み完了時
window.addEventListener('load', () => {
    showScreen('screen-start');
    setupCellListeners();
});

// 画面切り替え
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// 画面の階層フロー
// 1. 出席番号入力 -> 2. レベル選択
function goToLevelSelect() {
    const idInput = document.getElementById('student-id').value.trim();
    if (!idInput) {
        alert("出席番号（しゅっせきばんごう）を入力してね！");
        return;
    }
    studentId = idInput;
    showScreen('screen-level');
}

// 2. レベル選択 -> 3. 問題数選択
function selectLevel(level) {
    currentLevel = level;
    showScreen('screen-questions');
}

// 3. 問題数選択 -> ゲーム開始
function startAppWithSettings(count) {
    targetQuestions = count;
    currentQuestion = 1;
    document.getElementById('question-count').textContent = `${currentQuestion}問目`;
    showScreen('screen-game');
    generateQuestion();
}

// 繰り上がり回数計算ロジック
function countCarries(n1, n2) {
    let carries = 0;
    const n1_1 = n1 % 10, n1_10 = Math.floor(n1 / 10);
    const n2_1 = n2 % 10, n2_10 = Math.floor(n2 / 10);

    // 1段目 (n1 * n2_1)
    if (n1_1 * n2_1 >= 10) carries++;
    let c1 = Math.floor((n1_1 * n2_1) / 10);
    if (n1_10 * n2_1 + c1 >= 10) carries++;

    // 2段目 (n1 * n2_10)
    if (n1_1 * n2_10 >= 10) carries++;
    let c2 = Math.floor((n1_1 * n2_10) / 10);
    if (n1_10 * n2_10 + c2 >= 10) carries++;

    // 足し算
    let p1 = n1 * n2_1;
    let p2 = n1 * n2_10 * 10;

    let sumCarries = 0;
    let sumStr1 = p1.toString().padStart(4, '0');
    let sumStr2 = p2.toString().padStart(4, '0');
    let addCarry = 0;
    for (let i = 3; i >= 0; i--) {
        let v = parseInt(sumStr1[i]) + parseInt(sumStr2[i]) + addCarry;
        if (v >= 10) { sumCarries++; addCarry = 1; }
        else addCarry = 0;
    }
    return carries + sumCarries;
}

// 問題生成
function generateQuestion() {
    clearAllInputs();

    let found = false;
    let n1, n2;
    while (!found) {
        n1 = Math.floor(Math.random() * 90) + 10; // 10~99
        n2 = Math.floor(Math.random() * 90) + 10;

        const carries = countCarries(n1, n2);

        if (currentLevel === 1 && carries <= 1) found = true; // 繰り上がり0~1回
        else if (currentLevel === 2 && carries >= 2 && carries <= 3) found = true; // 繰り上がり2~3回
        else if (currentLevel === 3 && carries >= 4) found = true; // 繰り上がり4回以上
    }

    currentProblem = {
        num1: n1,
        num2: n2,
        partial1: n1 * (n2 % 10),
        partial2: n1 * Math.floor(n2 / 10),
        sum: n1 * n2
    };

    // UIにセット
    document.getElementById('val-r1-10').textContent = Math.floor(n1 / 10);
    document.getElementById('val-r1-1').textContent = n1 % 10;
    document.getElementById('val-r2-10').textContent = Math.floor(n2 / 10);
    document.getElementById('val-r2-1').textContent = n2 % 10;

    document.getElementById('message-box').textContent = "まずは スワイプして 定規（じょうぎ）で線を引こう！";

    // 状態リセット
    gameState = 0; // 0:Wait Swipe1, 1:Row1, 2:Row2, 3:Wait Swipe2, 4:Sum, 5:Done
    wrongCountRow1 = 0;
    wrongCountRow2 = 0;
    wrongCountSum = 0;

    // 定規とスワイプ線のリセット
    document.getElementById('swipe-container-1').classList.add('active'); // 1本目の定規を表示
    document.getElementById('swipe-container-2').classList.remove('active');
    document.getElementById('swipe-line-1').style.width = '0%';
    document.getElementById('swipe-line-2').style.width = '0%';
    document.getElementById('ruler-1').style.left = '0';
    document.getElementById('ruler-2').style.left = '0';
    document.querySelectorAll('.hanamaru').forEach(el => el.classList.remove('show'));

    // 繰り上がりマスの表示出し分け
    setupCarries(n1, n2);

    // 選択解除（まだ入力できない）
    document.querySelectorAll('.val, .carry, .input-cell').forEach(el => el.classList.remove('active'));
    activeElementId = null;
    updateOkButtonGlow();
}

// 繰り上がりマスの表示制御ロジック
function setupCarries(n1, n2) {
    // 全ての繰り上がりマスを非表示
    document.querySelectorAll('.carry').forEach(el => el.style.display = 'none');

    const n1_1 = n1 % 10, n1_10 = Math.floor(n1 / 10);
    const n2_1 = n2 % 10, n2_10 = Math.floor(n2 / 10);

    // 1段目 (n1 * n2_1)
    const carry1 = Math.floor((n1_1 * n2_1) / 10);
    if (carry1 > 0) document.getElementById('carry-mul-r3-10').style.display = 'flex';

    // 2段目 (n1 * n2_10)
    const carry2 = Math.floor((n1_1 * n2_10) / 10);
    if (carry2 > 0) document.getElementById('carry-mul-r4-100').style.display = 'flex';

    // 足し算
    let p1 = n1 * n2_1;
    let p2 = n1 * n2_10 * 10;
    let sumStr1 = p1.toString().padStart(4, '0');
    let sumStr2 = p2.toString().padStart(4, '0');

    let addCarry = 0;
    // 一の位
    if (parseInt(sumStr1[3]) + parseInt(sumStr2[3]) >= 10) {
        addCarry = 1; document.getElementById('carry-add-r4-10').style.display = 'flex';
    } else addCarry = 0;

    // 十の位
    if (parseInt(sumStr1[2]) + parseInt(sumStr2[2]) + addCarry >= 10) {
        addCarry = 1; document.getElementById('carry-add-r4-100').style.display = 'flex';
    } else addCarry = 0;

    // 百の位
    if (parseInt(sumStr1[1]) + parseInt(sumStr2[1]) + addCarry >= 10) {
        addCarry = 1; document.getElementById('carry-add-r4-1000').style.display = 'flex';
    } else addCarry = 0;
}

// セル・繰り上がりクリックイベントリスナー設定
function setupCellListeners() {
    // セルクリックを処理する（onclickはHTMLに直接書いてあるものと両立させる）
    document.querySelectorAll('.val, .carry').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation(); // 親の onclick(selectCell) の発火を防ぐ
            if (el.id) selectElement(el.id);
        });
    });
}

// 親セル（グリッドのマス）がクリックされたときのフォールバック
function selectCell(cellId) {
    // セル自体がクリックされたら、その中のvalを優先選択
    selectElement(`val-${cellId}`);
}

function selectElement(id) {
    if (!document.getElementById(id)) return;

    // gameStateに応じて入力可能なセルを制限
    if (gameState === 0 || gameState === 3) {
        // スワイプ待ち状態ではどこも選択できない
        return;
    } else if (gameState === 1) {
        // 1段目計算中: r3のセルとcarry-mul-r3のみ許可
        if (!id.includes('r3')) return;
    } else if (gameState === 2) {
        // 2段目計算中: r4のセルとcarry-mul-r4のみ許可
        if (!id.includes('r4')) return;
    } else if (gameState === 4) {
        // 足し算中: r5のセルとcarry-add-r4のみ許可
        if (!id.includes('r5') && !id.startsWith('carry-add')) return;
    } else if (gameState === 5) {
        // 完了: 入力不可
        return;
    }

    // 既存の選択やエラー表示を解除
    document.querySelectorAll('.val, .carry, .input-cell').forEach(el => {
        el.classList.remove('active');
        el.classList.remove('error');
        if (el.parentElement && el.parentElement.classList.contains('input-cell')) {
            el.parentElement.classList.remove('active');
            el.parentElement.classList.remove('error');
        }
    });

    activeElementId = id;
    const el = document.getElementById(id);
    el.classList.add('active');

    // 親セルにもactiveをつける
    if (el.parentElement.classList.contains('input-cell')) {
        el.parentElement.classList.add('active');
    }
}

// ゲーム本体のテンキー入力処理
function inputNum(num) {
    if (!activeElementId) return;
    const el = document.getElementById(activeElementId);
    el.textContent = num;
    updateOkButtonGlow();
}

function clearInput() {
    if (!activeElementId) return;
    document.getElementById(activeElementId).textContent = "";
    updateOkButtonGlow();
}

// 全入力クリア
function clearAllInputs() {
    document.querySelectorAll('.input-cell .val, .carry').forEach(el => {
        el.textContent = "";
        el.classList.remove('active');
    });
    document.querySelectorAll('.input-cell').forEach(el => el.classList.remove('active'));
    activeElementId = null;
    updateOkButtonGlow();
}

function checkAnswer() {
    // とりあえず単なるデバッグ用
    console.log("Current Problem:", currentProblem);
}

// スワイプ（線引き）処理の設定
function setupSwipeListeners() {
    setupSwipe('swipe-container-1', 'swipe-line-1', 'ruler-1', () => handleSwipe1());
    setupSwipe('swipe-container-2', 'swipe-line-2', 'ruler-2', () => handleSwipe2());
}

function setupSwipe(containerId, lineId, rulerId, onComplete) {
    const container = document.getElementById(containerId);
    const line = document.getElementById(lineId);
    const ruler = document.getElementById(rulerId);
    if (!container || !line || !ruler) return;

    let isDrawing = false;

    const startDraw = () => {
        isDrawing = true;
        line.style.width = '5%';
        ruler.style.left = '0';
    };

    const moveDraw = (x) => {
        if (!isDrawing) return;
        const rect = container.getBoundingClientRect();
        let progress = ((x - rect.left) / rect.width) * 100;
        if (progress > 100) progress = 100;
        if (progress > 5) {
            line.style.width = `${progress}%`;
            ruler.style.left = `calc(${progress}% - 30px)`;
        }

        if (progress > 90) { // 90%以上引けたら完了
            isDrawing = false;
            line.style.width = '100%';
            ruler.style.left = 'calc(100% - 60px)';
            onComplete();
        }
    };

    const endDraw = () => {
        if (!isDrawing) return;
        isDrawing = false;
        if (line.style.width !== '100%') {
            line.style.width = '0%'; // 引ききらなかったら元に戻す
            ruler.style.left = '0';
        }
    };

    container.addEventListener('mousedown', (e) => startDraw());
    window.addEventListener('mousemove', (e) => { if (isDrawing) moveDraw(e.clientX); });
    window.addEventListener('mouseup', endDraw);

    container.addEventListener('touchstart', (e) => startDraw());
    window.addEventListener('touchmove', (e) => { if (isDrawing) moveDraw(e.touches[0].clientX); });
    window.addEventListener('touchend', endDraw);
}

// 判定ロジックと状態推移
let wrongCountRow1 = 0;
let wrongCountRow2 = 0;
let wrongCountSum = 0;
let gameState = 0; // 0:Wait S1, 1:Row1, 2:Row2, 3:Wait S2, 4:Sum, 5:Done

function getVal(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const txt = el.textContent;
    return txt ? parseInt(txt) : null;
}

function setHint(msg) {
    document.getElementById('message-box').textContent = msg;
}

function handleSwipe1() {
    if (gameState !== 0) return;
    setHint("1だんめ の けいさん を して「OK」をおそう！");
    gameState = 1;
    document.getElementById('swipe-container-1').classList.remove('active'); // 定規を消す
    selectElement('val-r3-1');
    updateOkButtonGlow();
}

function handleSwipe2() {
    if (gameState !== 3) return;
    setHint("さいごは たしざんだ。けいさん して「OK」をおそう！");
    gameState = 4;
    document.getElementById('swipe-container-2').classList.remove('active');

    // 足し算は右上から。千の位の繰り上がりがあればそこから、無ければ一の位から
    selectElement('val-r5-1');
    updateOkButtonGlow();
}

function checkRow1() {
    if (gameState !== 1) return;

    const p1 = currentProblem.partial1.toString().padStart(4, '0');
    const u1 = getVal('val-r3-1'), u10 = getVal('val-r3-10'), u100 = getVal('val-r3-100'), u1000 = getVal('val-r3-1000');
    const userAnsStr = `${u1000 || 0}${u100 || 0}${u10 || 0}${u1 || 0}`;

    const n1 = currentProblem.num1;
    const n2_1 = currentProblem.num2 % 10;
    const carry1 = Math.floor((n1 % 10) * n2_1 / 10);
    const carry1_user = getVal('carry-mul-r3-10');

    let isCorrect = true;
    let hintMsg = "";

    // エラー時のハイライト用に関数を用意
    const showError = (parentIds) => {
        parentIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.classList.contains('val')) el.parentElement.classList.add('error');
                else el.classList.add('error');
            }
        });
    };

    if (parseInt(userAnsStr) !== currentProblem.partial1) {
        isCorrect = false;
        hintMsg = "こたえが ちがうみたい。";
        // どのマスが間違っているか厳密には判定しづらいが、全体を赤くする
        showError(['val-r3-1', 'val-r3-10', 'val-r3-100', 'val-r3-1000']);
    }

    if (carry1 > 0 && carry1_user !== carry1) {
        isCorrect = false;
        hintMsg = carry1_user === null ? "くりあがりを わすれていないかな？" : "くりあがりの かずが ちがうみたい。";
        showError(['carry-mul-r3-10']);
    }

    if (isCorrect) {
        setHint("せいかい！ 次は 2だんめ の けいさん を して「OK」をおそう！");
        gameState = 2;
        selectElement('val-r4-10');
    } else {
        wrongCountRow1++;
        if (wrongCountRow1 >= 2) {
            setHint(`ヒント: くりあがりは ${carry1 > 0 ? carry1 : 'なし'}、こたえは ${currentProblem.partial1} だよ。なおしてもういちど！`);
        } else {
            setHint(hintMsg + " もういちど やってみよう！");
        }
    }
}

function checkRow2() {
    if (gameState !== 2) return;

    const p2 = currentProblem.partial2.toString().padStart(4, '0');
    const u10 = getVal('val-r4-10'), u100 = getVal('val-r4-100'), u1000 = getVal('val-r4-1000');
    const userAnsStr = `${u1000 || 0}${u100 || 0}${u10 || 0}0`;

    const n1 = currentProblem.num1;
    const n2_10 = Math.floor(currentProblem.num2 / 10);
    const carry2 = Math.floor((n1 % 10) * n2_10 / 10);
    const carry2_user = getVal('carry-mul-r4-100');

    let isCorrect = true;
    let hintMsg = "";

    const showError = (parentIds) => {
        parentIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.classList.contains('val')) el.parentElement.classList.add('error');
                else el.classList.add('error');
            }
        });
    };

    if (parseInt(userAnsStr) !== currentProblem.partial2 * 10) {
        isCorrect = false;
        hintMsg = "こたえが ちがうみたい。かずを書くばしょに気をつけて！";
        showError(['val-r4-10', 'val-r4-100', 'val-r4-1000']);
    }

    if (carry2 > 0 && carry2_user !== carry2) {
        isCorrect = false;
        hintMsg = carry2_user === null ? "くりあがりを わすれていないかな？" : "くりあがりの かずが ちがうみたい。";
        showError(['carry-mul-r4-100']);
    }

    if (isCorrect) {
        setHint("せいかい！ かけざんが終わったから、定規をスワイプして線を引こう！");
        gameState = 3;
        document.getElementById('swipe-container-2').classList.add('active'); // 定規表示
        activeElementId = null;
        document.querySelectorAll('.val, .carry, .input-cell').forEach(el => el.classList.remove('active'));
    } else {
        wrongCountRow2++;
        if (wrongCountRow2 >= 2) {
            setHint(`ヒント: くりあがりは ${carry2 > 0 ? carry2 : 'なし'}、こたえは ${currentProblem.partial2} だよ。`);
        } else {
            setHint(hintMsg + " もういちど！");
        }
    }
}

function checkSum() {
    if (gameState !== 4) return;

    const u1 = getVal('val-r5-1'), u10 = getVal('val-r5-10'), u100 = getVal('val-r5-100'), u1000 = getVal('val-r5-1000');
    const userSum = parseInt(`${u1000 || 0}${u100 || 0}${u10 || 0}${u1 || 0}`);

    let p1 = currentProblem.partial1;
    let p2 = currentProblem.partial2 * 10;
    let sumStr1 = p1.toString().padStart(4, '0');
    let sumStr2 = p2.toString().padStart(4, '0');
    let c10 = 0, c100 = 0, c1000 = 0;

    if (parseInt(sumStr1[3]) + parseInt(sumStr2[3]) >= 10) c10 = 1;
    if (parseInt(sumStr1[2]) + parseInt(sumStr2[2]) + c10 >= 10) c100 = 1;
    if (parseInt(sumStr1[1]) + parseInt(sumStr2[1]) + c100 >= 10) c1000 = 1;

    let isCorrect = true;
    let hintMsg = "たしざんが ちがうみたい。もういちど！";

    const showError = (parentIds) => {
        parentIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.classList.contains('val')) el.parentElement.classList.add('error');
                else el.classList.add('error');
            }
        });
    };

    if (userSum !== currentProblem.sum) {
        isCorrect = false;
        showError(['val-r5-1', 'val-r5-10', 'val-r5-100', 'val-r5-1000']);
    }

    if (c10 > 0 && getVal('carry-add-r4-10') !== c10) { isCorrect = false; hintMsg = "たし算の くりあがりを 書きわすれてるよ！"; showError(['carry-add-r4-10']); }
    if (c100 > 0 && getVal('carry-add-r4-100') !== c100) { isCorrect = false; hintMsg = "たし算の くりあがりを 書きわすれてるよ！"; showError(['carry-add-r4-100']); }
    if (c1000 > 0 && getVal('carry-add-r4-1000') !== c1000) { isCorrect = false; hintMsg = "たし算の くりあがりを 書きわすれてるよ！"; showError(['carry-add-r4-1000']); }

    if (isCorrect) {
        setHint("だいせいかい！！ よくがんばったね。");
        gameState = 5;

        // 5種類のはなまる画像からランダムに1つ選んで表示する
        const randomId = 'hanamaru-' + (Math.floor(Math.random() * 5) + 1);
        document.getElementById(randomId).classList.add('show');

        // 選択解除
        activeElementId = null;
        document.querySelectorAll('.val, .carry, .input-cell').forEach(el => el.classList.remove('active'));

        setTimeout(() => {
            currentQuestion++;
            if (currentQuestion > targetQuestions) {
                // 全問クリアしたらスプレッドシートへ送信
                sendResultToGAS();
                showScreen('screen-result');
                document.getElementById('result-text').textContent = `${targetQuestions}問クリア！よくがんばりました！`;
            } else {
                document.getElementById('question-count').textContent = `${currentQuestion}問目`;
                generateQuestion();
            }
        }, 3000);
    } else {
        wrongCountSum++;
        if (wrongCountSum >= 2) {
            setHint(`ヒント: こたえは ${currentProblem.sum} だよ！直してみてね`);
        } else {
            setHint("たしざんが ちがうみたい。もういちど！");
        }
    }
}

// ユーザーのアクションディスパッチャ（OKボタン）
function checkAnswer() {
    if (gameState === 1) checkRow1();
    else if (gameState === 2) checkRow2();
    else if (gameState === 4) checkSum();
    else if (gameState === 0) setHint("まずは 定規（じょうぎ）で線を引こう！");
    else if (gameState === 3) setHint("かけざんが終わったから、定規（じょうぎ）で線を引こう！");
    else if (gameState === 5) setHint("つぎの もんだい を じゅんび中だよ...");

    updateOkButtonGlow(); // 状態が変わった後に光る状態を更新
}

// OKボタンと定規の光るアニメーション制御
function updateOkButtonGlow() {
    const okBtn = document.getElementById('floating-ok-btn');
    const ruler1 = document.getElementById('ruler-1');
    const ruler2 = document.getElementById('ruler-2');

    if (okBtn) okBtn.classList.remove('glow');
    if (ruler1) ruler1.classList.remove('glow');
    if (ruler2) ruler2.classList.remove('glow');

    // 定規を引くべきタイミング
    if (gameState === 0 && ruler1) {
        ruler1.classList.add('glow');
        return;
    }
    if (gameState === 3 && ruler2) {
        ruler2.classList.add('glow');
        return;
    }

    // それ以外のスワイプ待ち・待機状態は光らせない
    if (gameState === 5) return;

    if (gameState === 1) {
        if (!currentProblem) return;
        const p1Len = currentProblem.partial1.toString().length;
        let count = 0;
        ['val-r3-1', 'val-r3-10', 'val-r3-100', 'val-r3-1000'].forEach(id => {
            if (getVal(id) !== null) count++;
        });
        if (count >= p1Len) okBtn.classList.add('glow');
    } else if (gameState === 2) {
        if (!currentProblem) return;
        const p2Len = currentProblem.partial2.toString().length;
        let count = 0;
        ['val-r4-10', 'val-r4-100', 'val-r4-1000'].forEach(id => {
            if (getVal(id) !== null) count++;
        });
        if (count >= p2Len) okBtn.classList.add('glow');
    } else if (gameState === 4) {
        if (!currentProblem) return;
        const sumLen = currentProblem.sum.toString().length;
        let count = 0;
        ['val-r5-1', 'val-r5-10', 'val-r5-100', 'val-r5-1000'].forEach(id => {
            if (getVal(id) !== null) count++;
        });
        if (count >= sumLen) okBtn.classList.add('glow');
    }
}

// 結果をGASへ送信する関数
function sendResultToGAS() {
    if (!GAS_URL) {
        console.warn("GAS_URLが設定されていないため、結果は送信されません。");
        return;
    }

    const studentIdEl = document.getElementById('student-id');
    const studentId = studentIdEl ? studentIdEl.value.trim() : "";
    if (!studentId) {
        console.log("出席番号が入力されていないため送信しません");
        return;
    }

    const data = {
        studentId: studentId,
        level: currentLevel,
        questions: targetQuestions
    };

    fetch(GAS_URL, {
        method: "POST",
        headers: {
            "Content-Type": "text/plain;charset=utf-8", // GASのCORS制約回避のため text/plain を使用する場合が多い
        },
        body: JSON.stringify(data)
    })
        .then(response => response.json())
        .then(result => {
            console.log("GASへの送信成功:", result);
        })
        .catch(error => {
            console.error("GASへの送信エラー:", error);
        });
}

// 途中で送信して終わる関数を追加
function submitEarly() {
    const solvedCount = currentQuestion - 1;
    if (solvedCount === 0) {
        alert("まだ1問もクリアしていません！\nまずは1問解いてみよう！");
        return;
    }

    if (confirm(`ここまでで ${solvedCount}問 クリアしました。\n先生に結果をおくって終わりにしますか？`)) {
        // GASへ送信するために一時的に目標問題数を上書き（提出量として扱う）
        const originalTarget = targetQuestions;
        targetQuestions = solvedCount;
        sendResultToGAS();
        targetQuestions = originalTarget; // 元に戻しておく

        // 結果画面へ遷移
        showScreen('screen-result');
        document.getElementById('result-text').textContent = `${solvedCount}問クリア！`;

        // メッセージを書き換え
        const resultMsg = document.getElementById('result-message');
        if (resultMsg) {
            resultMsg.innerHTML = "先生に結果をおくりました！<br>よくがんばったね！";
        }
    }
}

// ホームに戻る（オプション）処理の修正
function goHome() {
    showScreen('screen-start');
}

function confirmHome() {
    if (confirm("スタートがめんにもどりますか？")) {
        goHome();
    }
}

// DOM読み込み完了時に関数を更新
window.addEventListener('load', () => {
    showScreen('screen-start');
    setupCellListeners();
    setupSwipeListeners();
});
