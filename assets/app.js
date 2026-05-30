/* global API, TOKEN */
// ═══════════════════════════════════
//  墨述 · 暖纸色 IDE
//  活动栏 + 侧栏 + 主面板 + 状态栏
// ═══════════════════════════════════

// ── State ──
var _projects = [];
var _currentProject = null;
var _chapters = [];
var _cards = [];
var _currentChapter = null;
var _editing = false;
var _markers = [];
var _mapProject = null;
var _mapLoaded = 0;
var _activeView = 'writing';
var _expandedCard = null;
var _expandedVolumes = {};
var _facts = [];
var _factFilter = '';
var _factTableView = false;
var _graphLoaded = 0;
var _outlineView = false;
var _batchSelect = false;
var _selectedChapters = [];

// ── 分析模式库 ──
var HOOKS = [
  ["未解答的疑问",/为什么|到底|难道|究竟|怎么回事|什么原因/],
  ["中断的行动",/还没说完|话音未落|就在这时|突然/],
  ["部分揭露的秘密",/其实|真相是|事实上/],
  ["章末悬念",/门开了|身后传来|枪声/],
  ["不祥预感",/不详的预感|总觉得|好像要出事|不安/],
  ["隐藏身份",/不像是.*的人|身份可疑|另有隐情/],
  ["倒计时",/只剩下.*时间|必须在.*之前|倒计时|来不及了/],
  ["神秘物品",/不知名的|来历不明|看不懂的|奇怪的.*东西/],
  ["未解的谜团",/未解之谜|仍然是一个谜|没有答案|查不清/],
  ["破裂的关系",/不再信任|怀疑|背叛|隐瞒/],
  ["力量的代价",/代价|副作用|反噬|消耗.*生命/],
  ["虚假的安全",/看似安全|暂时安全|松了一口气|应该没事/],
  ["不可靠的叙述",/也许是这样|大概是|听人说|据说/]
];
var AI_BAD = [
  ["对称排比",/既.*又.*既.*又|不仅.*而且.*更|是.*也是.*更是/],
  ["过渡模板",/值得一提的是|值得注意的是|不可忽视的是|需要指出的是/],
  ["陈词滥调",/在这个.*的.*中|对于.*而言|可以说/],
  ["冗余修饰",/毫无疑问|毋庸置疑|显而易见|不可否认/],
  ["总结句式",/总的来说|综上所述|总而言之|从.*角度来看/],
  ["极致表述",/极致|绝佳|无以伦比|令人叹为观止/],
  // humanizer-zh 扩充模式
  ["夸大意义",/标志着|见证了|是.*的体现|凸显.*重要性|关键转折点/],
  ["宣传语言",/充满活力|令人叹为观止|迷人的|必游之地|开创性的/],
  ["肤浅分析",/突出.*|强调.*|确保.*|反映.*|象征.*|为.*做出贡献/],
  ["模糊归因",/专家表示|研究表明|观察者指出|多个来源/],
  ["AI词汇",/此外|与此同时|持久的|关键的|展示|宝贵的/],
  ["否定式排比",/不仅.*而且|这不仅仅是.*而是/],
  ["破折号滥用",/——|—/],
  ["列表标题",/\*\s*\*\*[\u4e00-\u9fa5]+[：:]/],
  ["协作痕迹",/希望这对您有帮助|当然！|您说得完全正确|请告诉我/],
  ["知识截止",/截至.*|根据我最后的训练|虽然具体细节有限/]
];

// ── Helpers ──
function q(id) { return document.getElementById(id); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/`/g,'&#96;'); }
function tu(url) { return url + (url.indexOf('?') > -1 ? '&' : '?') + 'token=' + encodeURIComponent(T); }

function toast(msg) {
  var el = q('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(function() { el.classList.remove('show'); }, 2000);
}

// ═══════════════════════════════════
//  INIT
// ═══════════════════════════════════
function init() {
  var root = q('root');
  root.innerHTML =
    '<div class="title-bar">' +
      '<div class="logo">墨<span>述</span></div>' +
      '<div class="project-name" id="title-project"></div>' +
      '<div class="actions">' +
        '<button onclick="refreshData()" title="刷新">↻ 刷新</button>' +
      '</div>' +
    '</div>' +
    '<div class="main-area">' +
      '<div class="activity-bar">' +
        '<button class="act-btn active" data-view="writing" onclick="switchView(\'writing\')" title="写作">📝</button>' +
        '<button class="act-btn" data-view="dashboard" onclick="switchView(\'dashboard\')" title="概况">📊</button>' +
        '<button class="act-btn" data-view="map" onclick="switchView(\'map\')" title="地图">🗺</button>' +
        '<button class="act-btn" data-view="world" onclick="switchView(\'world\')" title="世界地图">🌍</button>' +
      '</div>' +
      '<div class="content-area" id="content-area">' +
        '<div class="sidebar" id="sidebar"></div>' +
        '<div class="main-panel" id="main-panel"></div>' +
      '</div>' +
    '</div>' +
    '<div class="status-bar">' +
      '<div class="status-left">' +
        '<span id="status-project">墨述 · Ink Narrative</span>' +
      '</div>' +
      '<div class="status-right">' +
        '<span id="status-chars"></span>' +
      '</div>' +
    '</div>' +
    '<div class="toast" id="toast"></div>';

  // Resize
  function rf() { try { parent.postMessage({ type: 'resize-request', payload: { height: document.body.scrollHeight } }, '*'); } catch(e) {} }
  if (window.ResizeObserver) { new ResizeObserver(rf).observe(document.body); }
  setTimeout(rf, 300);

  refreshData();
  try { parent.postMessage({ type: 'ready' }, '*'); } catch(e) {}
}

// ═══════════════════════════════════
//  VIEW SWITCHING
// ═══════════════════════════════════
function switchView(view) {
  _activeView = view;
  _currentProject = null;
  _currentChapter = null;
  _chapters = [];
  _cards = [];
  _expandedCard = null;
  _expandedVolumes = {};
  _facts = [];
  _factFilter = '';

  document.querySelectorAll('.act-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.view === view);
  });

  q('sidebar').innerHTML = '';
  q('main-panel').innerHTML = '';
  q('title-project').textContent = '';

  switch (view) {
    case 'writing': renderWritingSidebar(); break;
    case 'map': _mapProject = null; _markers = []; renderMapSidebar(); break;
    case 'dashboard': renderDashboardSidebar(); break;
    case 'world': 
      var search = window.location.search || '';
      window.location.href = 'world' + search;
      break;
  }
}

// ═══════════════════════════════════
//  DATA
// ═══════════════════════════════════
async function refreshData() {
  try {
    var r = await fetch(tu(A + '/api/projects'));
    _projects = await r.json();
    updateStatusBar();
    switchView(_activeView);
  } catch(e) { console.error('refreshData:', e); }
}

function updateStatusBar() {
  q('status-project').textContent = _currentProject ? '📁 ' + esc(_currentProject.name) : '墨述 · Ink Narrative';
  var total = 0;
  _projects.forEach(function(p) { total += (p.chapterCount || 0); });
  q('status-chars').textContent = '📜 ' + _projects.length + ' 项目 · ' + total + ' 章';
}

// ═══════════════════════════════════
//  WRITING VIEW
// ═══════════════════════════════════

init();
