/* ============================================================
   言い訳寺 — 大仏裁定エンジン
   やる気は要求しない。ただ聴き、裁き、2分だけ動かす。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 安全なストレージ（サンドボックス内では黙って諦める） ---------- */
  var store = {
    get: function (key) {
      try { return window.localStorage.getItem(key); } catch (e) { return null; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(key, value); } catch (e) { /* 諸行無常 */ }
    }
  };

  /* ---------- 功徳システム ---------- */
  var RANKS = [
    { min: 0, name: '童子' },
    { min: 30, name: '沙弥' },
    { min: 100, name: '行者' },
    { min: 250, name: '和尚' },
    { min: 500, name: '座主' },
    { min: 1000, name: '大仏' }
  ];

  var state = {
    karma: parseInt(store.get('iiwake_karma') || '0', 10) || 0,
    mokugyo: parseInt(store.get('iiwake_mokugyo') || '0', 10) || 0,
    timerId: null,
    timerRunning: false,
    timerElapsed: 0
  };

  function addKarma(points) {
    state.karma += points;
    store.set('iiwake_karma', String(state.karma));
    renderKarma();
  }

  function rankFor(karma) {
    var current = RANKS[0].name;
    for (var i = 0; i < RANKS.length; i++) {
      if (karma >= RANKS[i].min) current = RANKS[i].name;
    }
    return current;
  }

  function renderKarma() {
    document.getElementById('karmaValue').textContent = state.karma;
    document.getElementById('karmaRank').textContent = rankFor(state.karma);
  }

  /* ---------- 功徳トースト ---------- */
  var toastTimer = null;
  function toast(message) {
    var el = document.getElementById('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }
  document.getElementById('toast').addEventListener('click', function () {
    this.classList.remove('show');
    clearTimeout(toastTimer);
  });

  /* ============================================================
     裁定エンジン：カテゴリ × 言い訳パターン
     ============================================================ */

  var CATEGORIES = [
    {
      id: 'work',
      keywords: ['仕事', '資料', '会議', '残業', '上司', '納期', 'プレゼン', 'ppt', 'excel', '報告', '出社', 'office'],
      steps: [
        'パソコンを開き、その資料のファイル名だけを打つ。それで今日は合格。書くのは明日の自分に任せていい。明日の自分は意外と書く。たまに。',
        '資料を開いて、見出しだけ3つ書く。中身は「仏の導き」の欄に任せて空欄でよい。',
        'メールの宛名だけ書いて下書き保存。送信はしなくていい。仏も送信しない日のことを知っている。'
      ]
    },
    {
      id: 'study',
      keywords: ['試験', '勉強', '課題', 'レポート', '単位', '宿題', '論文', '試験勉強', '参考書', 'テスト'],
      steps: [
        '教科書を開いて、今日やるページにしおりを挟む。それだけ。挟めた者は既に道半ばである。',
        'ノートを開いて、日付と「やること」を1行だけ書く。2行書いたら仏に叱られる。謙虚に1行。',
        '参考書の目次を声に出して読む。読み終わったら、それで今日の勉強は終了。仏が「よくやった」と言っている。'
      ]
    },
    {
      id: 'exercise',
      keywords: ['筋トレ', '運動', 'ジム', 'ダイエット', '体重', 'ランニング', '走る', 'ストレッチ', '腹筋'],
      steps: [
        '履くだけの服に着替える。着替えた瞬間に「やる気」の8割は確保される。残り2割は仏が保証する。',
        'スクワットを3回だけやる。3回で「あとやる気が出たら続ける」状態に入る。人間、不思議。',
        '玄関まで歩いて外の空気を3秒吸う。今日の運動は完了。明日は5秒吸える。'
      ]
    },
    {
      id: 'cleanup',
      keywords: ['掃除', '片付け', '部屋', '洗濯', '皿', '皿洗い', 'ゴミ', '散らか', '収納', '断捨離'],
      steps: [
        '床のものを一つだけ、元の場所に戻す。一つ。それが無理なら、蹴らない。蹴らない功徳も認める。',
        '洗濯機の前に立って、蓋を開ける。開けたら勝ったも同然。あとは機械が働く。お前は仏のように見ているだけでいい。',
        'ゴミを一袋まとめて玄関に置く。置くだけでいい。運ぶのは後でいい。玄関の通行は妨げない程度に。'
      ]
    },
    {
      id: 'reply',
      keywords: ['返信', '返事', 'line', 'メール', '連絡', '既読', 'スルー', '見て見ぬふり', '電話'],
      steps: [
        'スタンプを一つ送る。「了解のポメ」であれ、最初の一歩はポメでいい。仏もポメを送る。悟りの境地である。',
        '「ちょっと今からいい？」とだけ送る。これで連絡の責任の半分は相手に移る。巧みである。',
        '返信したい人の名前だけメモに書く。名前を書かれた人と縁が結ばれる。返信はそのうち。'
      ]
    },
    {
      id: 'morning',
      keywords: ['早起き', '二度寝', '目覚まし', '朝弱い', '寝坊', '夜更かし', '昼夜逆転'],
      steps: [
        'アラームの音量を一段階だけ上げる。明日の自分への無言の圧力。優しい圧力。仏の圧力。',
        '目覚ましを部屋の遠くに置く。置いたらベッドに戻っていい。準備は立派な修行である。',
        '布団の中で足首を10回回す。それだけで「起きた」ことにする。当寺では認める。'
      ]
    },
    {
      id: 'money',
      keywords: ['貯金', '買い物', '無駄遣い', '収入', '出費', 'サブスク', '課金', '財布'],
      steps: [
        '欲しいものをメモに書いて「3日待つ」と横に書く。3日後も欲しかったら、それは縁。仏も仕方ないと思っている。',
        '家計簿アプリを開いて昨日の分だけ入力する。1日分でいい。完璧な家計簿は仏にも作れない。',
        'サブスク一覧を見て、使っていないものの名前を声に出して読む。読んだだけでも契約解除の功徳が3割入る。'
      ]
    },
    {
      id: 'general',
      keywords: [],
      steps: [
        'そのやるべきことを、紙に1行だけ書く。書けたら紙を閉じる。閉じた紙は、開かれる運命にある。',
        'タイマーで2分だけやると決める。2分で「意外といける」と思えたら人間の勝ち。思えなくても仏の勝ち。誰も損をしない仕組み。',
        'やるべきことの「一番簡単な部分」だけを切り出して、それだけやる。例えばこの文章を読み終えることも、立派な一歩である。'
      ]
    }
  ];

  /* 言い訳パターン → 大仏の前置き（辛口だが根は慈悲） */
  var PATTERNS = [
    { test: /明日|あした|翌日/, lines: [
      '「明日」という言葉は、仏の暦には存在せぬ。あるのは「今日」と「言い訳」のみである。',
      '施主よ。その「明日」、何回目であろうか。仏は数えるのが得意ではないが、施主の「明日」は数えきれぬ。',
      '明日やる、は仏教用語で「やらない」と訳される。古い経典にそう書いてあった。当寺調べ。'
    ] },
    { test: /疲れ|つかれ|疲れた|しんど|眠い|ねむい|眠気/, lines: [
      '疲れている、は真実であろう。仏も座り続けて2500年、腰の限界を知っている。ならば、休む言い訳として使うのはやめ、休む時間として申し込むがよい。',
      '眠いのは罪ではない。仏も説法中にうたた寝をした弟子を叱らなかった。ただし、うたた寝の回数だけ人生が縮むことだけはお伝えしておく。'
    ] },
    { test: /やる気| motivation|モチベ|気力|意欲/, lines: [
      'やる気とは、天気のようなものである。晴れを待って畑に出ぬ農家に、稲は実らぬ。雨でも田んぼに入れる者が勝つ。',
      'やる気がないのではない。やる気の前の「2分」がないのである。2分だけやれ。やる気は後から勝手についてくる。順番が逆なのである。'
    ] },
    { test: /無理|むり|できない|出来ない|才能|向いて/, lines: [
      '「向いていない」は、仏の耳には「練習したくない」と聞こえる。乱暴で申し訳ない。仏もたまに正直である。',
      '無理、という言葉を最初から使う者に、仏は「どこまでが可能か」を問う。可能の境界は、施主が思うより、たいてい3倍遠くにある。'
    ] },
    { test: /忙|いそが|時間がない|時間がなく|働き過ぎ|やることが多すぎ/, lines: [
      '忙しいの「忙」は、心が亡ぶと書く。字の成り立ちは仏の発明ではないが、仏は字を覚えるのが得意である。',
      '時間がないのではなく、時間が言い訳に占領されているのである。時間を言い訳から奪還せよ。2分でよい。'
    ] },
    { test: /猫|ねこ|犬|いぬ|ペット|膝/, lines: [
      '猫が膝に来たので断念、は当寺の歴史において最も功徳の高い言い訳である。仏はこれを咎めぬ。猫は仏の使いである可能性がある。ただし猫が退いた後の言い訳を、仏は厳しく裁く。'
    ] },
    { test: /天気|雨|あめ|寒い|暑い|気温|台風/, lines: [
      '天気は言い訳界の常連である。仏の住む世界に天気はないが、雨の日は屋内の祭事が増えることも、仏は知っている。'
    ] }
  ];

  var GENERIC_COMMENTS = [
    '施主よ。その言い訳、仏には筒抜けである。しかし、告白したことだけは認める。言い訳を言い訳のまま隠す者より、遥かに仏に近い。',
    'ふむ。悪くない言い訳である。だが仏の前で言い訳の腕を磨くな。磨くべきはタスクの方である。',
    'その言い訳、お前が思うほど他人は気にしていない。みんな自分の言い訳で手一杯である。だから堂々と、そして速くやるがよい。',
    '仏は一切を赦すが、締め切りは赦さぬ。仏の裁量の範囲外である。申し訳ない。',
    'よい目の付けだ。その観察力を言い訳ではなくタスクに向けた者、すなわち阿羅漢である。'
  ];

  var SCORE_LINES = [
    '言い訳芸術点：{n}点 — {verdict}',
    '言い訳芸術点：{n}点 — {verdict}',
    '言い訳芸術点：{n}点 — {verdict}'
  ];

  function verdictWord(n) {
    if (n >= 90) return '円熟の域。もはや言い訳ではなく詩である。';
    if (n >= 75) return '堂に入る。言い訳寺の講堂に名を刻んでよい。';
    if (n >= 60) return '佳品。だが仏の前では白紙である。';
    if (n >= 40) return '凡作なり。無難であるが、記憶にも残らぬ。';
    if (n >= 25) return '駆け出しの筆。精進を待つ。';
    return '言い訳として未完成。言い訳の才能すら申請せよ。';
  }

  function pick(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  function judge(text) {
    var category = null;
    var lower = text.toLowerCase();
    for (var i = 0; i < CATEGORIES.length; i++) {
      var cat = CATEGORIES[i];
      var hit = false;
      for (var k = 0; k < cat.keywords.length; k++) {
        if (lower.indexOf(cat.keywords[k]) !== -1) { hit = true; break; }
      }
      if (hit) { category = cat; break; }
    }
    if (!category) category = CATEGORIES[CATEGORIES.length - 1];

    var preface = null;
    for (var p = 0; p < PATTERNS.length; p++) {
      if (PATTERNS[p].test.test(text)) { preface = pick(PATTERNS[p].lines); break; }
    }

    var body = pick(GENERIC_COMMENTS);
    var score = 20 + Math.floor(Math.random() * 75);
    var comment = (preface ? preface + '\n' : '') + body;
    var step = pick(category.steps);

    return { score: score, comment: comment, step: step };
  }

  /* ---------- 裁定の表示（タイプ演出） ---------- */
  function typeInto(element, text, done) {
    element.textContent = '';
    var i = 0;
    (function tick() {
      if (i < text.length) {
        element.textContent += text.charAt(i);
        i++;
        setTimeout(tick, 18);
      } else if (done) {
        done();
      }
    })();
  }

  /* ---------- WebAudio: 木魚と鐘 ---------- */
  var audioCtx = null;
  function ctx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    return audioCtx;
  }

  function playPoku() {
    var c = ctx();
    if (!c) return;
    var now = c.currentTime;
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain).connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  function playBell() {
    var c = ctx();
    if (!c) return;
    var now = c.currentTime;
    [220, 330, 445, 660].forEach(function (freq, idx) {
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      var vol = 0.22 / (idx + 1);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
      osc.connect(gain).connect(c.destination);
      osc.start(now);
      osc.stop(now + 2.4);
    });
  }

  /* ---------- DOM ---------- */
  var $ = function (id) { return document.getElementById(id); };

  var input = $('excuseInput');
  var verdictCard = $('verdictCard');
  var timerCard = $('timerCard');
  var buddhaCaption = $('buddhaCaption');

  var CAPTIONS = [
    '「…施主よ。遠慮せず、その言い訳を聞かせてもらおうか」',
    '「仏は座って聞くのが仕事である。話してみよ」',
    '「言い訳に巧拙なし。ただし締め切りに慈悲なし」',
    '「よい。その調子で心の垢を落とすがよい」'
  ];

  function showVerdict(result) {
    $('verdictScore').textContent = '';
    $('verdictComment').textContent = '';
    $('verdictStep').textContent = '';
    verdictCard.hidden = false;
    timerCard.hidden = true;

    var line = SCORE_LINES[0]
      .replace('{n}', String(result.score))
      .replace('{verdict}', verdictWord(result.score));
    $('verdictScore').textContent = line;
    typeInto($('verdictComment'), result.comment, function () {
      typeInto($('verdictStep'), result.step, null);
    });
    verdictCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function onConfess() {
    var text = input.value.trim();
    if (!text) {
      toast('無言も立派な悟りですが、当寺では文字での告白をお願いしております。');
      input.focus();
      return;
    }
    buddhaCaption.textContent = pick(CAPTIONS);
    var result = judge(text);
    showVerdict(result);
    addKarma(5);
    toast('告白の功徳 +5。仏に話せば話すほど、少しだけ軽くなる。');
    input.value = '';
  }

  /* ---------- ランダム言い訳（思いつかない人用） ---------- */
  var SAMPLE_EXCUSES = [
    'レポートは明日から本気を出す。今日は下調べとして、ベッドでYouTubeの「勉強法」の動画を見た。それはそれで勉強である。',
    '筋トレはやる気が出たら始める。やる気が出るのはたいてい夜23時で、その時間はジムが閉まっている。ゆえに私は筋トレできない。',
    '部屋の片付けは、ものが増える前の状態に戻す行為であり、エントロピー増大の法則に逆らう行為なので、宇宙の流れに従っただけである。',
    '返信は書こうと思えばいつでも書ける。だから緊急性がない。緊急性がないものをやるのは、効率が悪い。私は効率を大切にしている。',
    '早起きはしている。ただし基準が「昼より前」なので、11時起床も早起きに分類される。分類は自由である。',
    '貯金ができないのは、私がお金を「経験」に換えているからである。投資である。リターンは追って確認する。'
  ];

  /* ---------- 2分タイマー ---------- */
  var TOTAL_SECONDS = 120;

  function startTimer() {
    stopTimer(true);
    state.timerElapsed = 0;
    state.timerRunning = true;
    verdictCard.hidden = false;
    timerCard.hidden = false;
    $('timerDisplay').textContent = '2:00';
    $('timerBar').style.width = '0%';
    $('timerNote').textContent = 'やる気は要りません。手を動かすだけです。仏が見ています。';
    timerCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    playPoku();

    state.timerId = setInterval(function () {
      state.timerElapsed += 1;
      var remaining = TOTAL_SECONDS - state.timerElapsed;
      var mm = Math.floor(remaining / 60);
      var ss = remaining % 60;
      $('timerDisplay').textContent = mm + ':' + (ss < 10 ? '0' : '') + ss;
      $('timerBar').style.width = Math.min(100, (state.timerElapsed / TOTAL_SECONDS) * 100) + '%';
      if (state.timerElapsed === 60) {
        playPoku();
        $('timerNote').textContent = '折り返しである。ここまで来た者を、仏は「やる気がある」と認定する。';
      }
      if (remaining <= 0) {
        finishTimer(true);
      }
    }, 1000);
  }

  function stopTimer(silent) {
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
    state.timerRunning = false;
    if (!silent) { /* 呼び出し側で処理 */ }
  }

  function finishTimer(completed) {
    var wasRunning = state.timerRunning;
    stopTimer(true);
    if (!wasRunning && completed) return;
    if (completed) {
      playBell();
      $('timerDisplay').textContent = '南無';
      $('timerNote').textContent = '2分間の修行、お見事。この調子でやめたい時にやめてよい。仏に無理はさせぬ。';
      addKarma(20);
      toast('修行完遂の功徳 +20。仏より: 続けるもよし、今日は寝るもよし。');
    } else {
      $('timerNote').textContent = 'やめるのもまた縁。仏も休日に説法はしない。ただし2分は短い。それだけは申しておく。';
      toast('中断の功徵…ではなく、功徳はなし。またいつでも。');
    }
  }

  /* ---------- 木魚 ---------- */
  function onMokugyo() {
    state.mokugyo += 1;
    store.set('iiwake_mokugyo', String(state.mokugyo));
    $('mokugyoCount').textContent = 'ポク × ' + state.mokugyo;
    playPoku();
    if (state.mokugyo % 33 === 0) {
      toast(state.mokugyo + '回。木魚の音は足りない者に届くという。施主、誰かに届いた。');
    }
  }

  /* ---------- 御詠歌 ---------- */
  var MANTRAS = [
    'やる気 出ずとも 手は動く\nそれすなわち 仏のみち',
    '明日やるは 明日聞かば 仏笑わん\n今日二分 動くが勝ち',
    '片付かぬ 部屋を見るのは 過去の我\n片付く部屋は 未来の我',
    '言い訳は 魂の川原の 小石なり\n転がして 道を埋めるが 仏のみち',
    '返信を 待つ人はいない\n待つのは 書く前の 我のみ',
    '猫が来て 仕事を捨てし その罪を\n仏は問わぬ 次の二分を 問うのみ',
    '大仏は 動かずして 全部見てる\nだから正直に やっておこう',
    '一円を 貯めし者の 財布は軽し\nされどその心 仏より重し',
    '目覚まし 三つ置けば 朝は来る\n来るけれど 起きるのは 結局我',
    '完璧を 待つ者に 完璧来ず\n不完全の 今日を歩め それでいい'
  ];

  function renderMantra() {
    var el = $('mantraText');
    el.textContent = '';
    var text = pick(MANTRAS);
    var i = 0;
    (function tick() {
      if (i < text.length) {
        el.textContent += text.charAt(i);
        i++;
        setTimeout(tick, 26);
      }
    })();
  }

  /* ---------- イベントバインド ---------- */
  $('confessBtn').addEventListener('click', onConfess);
  $('surpriseBtn').addEventListener('click', function () {
    input.value = pick(SAMPLE_EXCUSES);
    input.focus();
    toast('見本の言い訳をお借りしました。これを自分のものとして告白するのも、立派な一歩である。');
  });
  $('anotherConfessionBtn').addEventListener('click', function () {
    verdictCard.hidden = true;
    timerCard.hidden = true;
    input.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('startTimerBtn').addEventListener('click', startTimer);
  $('finishTimerBtn').addEventListener('click', function () { finishTimer(true); });
  $('quitTimerBtn').addEventListener('click', function () { finishTimer(false); });
  $('mokugyoBtn').addEventListener('click', onMokugyo);
  $('mantraBtn').addEventListener('click', function () {
    renderMantra();
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onConfess();
    }
  });

  /* ---------- 初期化 ---------- */
  renderKarma();
  $('mokugyoCount').textContent = 'ポク × ' + state.mokugyo;
  renderMantra();
})();
