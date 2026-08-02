var _showImageGen = false;
var _localBodyDirty = false;

function renderWritingSidebar() {
  var h = '<div class="sidebar-header">项目<span class="count">' + _projects.length + '</span></div>';
  h += '<div class="sidebar-list' + (_batchSelect ? ' batch-mode' : '') + '">';

  if (_projects.length === 0) {
    h += '<div class="empty-state" style="height:auto;padding:30px 10px"><div class="title" style="font-size:13px">暂无项目</div><div class="desc" style="font-size:12px">点击 + 新建项目开始</div></div>';
  } else {
    _projects.forEach(function(p) {
      var activeClass = _currentProject && _currentProject.id === p.id ? ' active' : '';
      h += '<div class="pj-card' + activeClass + '" onclick="openProject(\'' + p.id + '\')">';
      h += '<div class="pj-name">' + esc(p.name) + '</div>';
      h += '<div class="pj-meta">' + esc(p.type || '') + ' · ' + (p.chapterCount || 0) + '章 · ' + (p.cardCount || 0) + '卡</div>';
      h += '<span class="pj-delete" onclick="event.stopPropagation();deleteProject(\'' + p.id + '\',\'' + esc(p.name) + '\')">✕</span>';
      h += '</div>';
    });
  }

  h += '<button class="btn btn-ghost" style="margin:8px 0 8px 0;width:calc(100% - 16px)" onclick="createProject()">+ 新建项目</button>';
  h += '</div>';
  q('sidebar').innerHTML = h;

  if (_currentProject) {
    renderMainPanel();
  } else {
    q('main-panel').innerHTML = '<div class="empty-state"><div class="icon">📝</div><div class="title">选择一个项目开始写作</div><div class="desc">左侧项目列表中点击项目名进入</div></div>';
  }
}

async function openProject(id) {
  var p = _projects.find(function(x) { return x.id === id; });
  if (!p) return;
  _currentProject = p;
  _currentChapter = null;
  _editing = false;
  _expandedCard = null;
  _expandedVolumes = {};
  _selectedChapters = [];

  q('title-project').textContent = '📁 ' + esc(p.name);
  updateStatusBar();

  try {
    var rc = await fetch(tu(A + '/api/project/' + encodeURIComponent(id) + '/chapters'));
    _chapters = await rc.json();
    var rd = await fetch(tu(A + '/api/project/' + encodeURIComponent(id) + '/cards'));
    _cards = await rd.json();
  } catch(e) { _chapters = []; _cards = []; }

  renderWritingSidebar();
}

function renderMainPanel() {
  if (!_currentProject) return;

  var h = '';
  h += '<div class="panel-header">';
  h += '<span class="badge">📝 ' + esc(_currentProject.name) + '</span>';
  h += '<button class="btn btn-ghost" style="margin-left:8px" onclick="_currentProject=null;renderWritingSidebar();q(\'title-project\').textContent=\'\'">← 返回</button>';
  h += '</div>';
  h += '<div class="panel-body">';

  // 设定卡片
  h += '<div class="section"><div class="section-title">✦ 设定</div>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:2px 8px" onclick="addCard()">+ 新建</button>';
  h += '</div>';
  if (_cards && _cards.length > 0) {
    var cardGroups = { characters: [], world: [], style: [] };
    var cardIcons = { characters: '👤 人物', world: '🌍 世界观', style: '📝 文风' };
    _cards.forEach(function(c) {
      if (cardGroups[c.type]) cardGroups[c.type].push(c);
      else cardGroups.characters.push(c);
    });
    Object.keys(cardGroups).forEach(function(type) {
      var groupCards = cardGroups[type];
      if (!groupCards || !groupCards.length) return;
      h += '<div style="font-size:11px;font-weight:600;color:var(--text-sub);margin:10px 0 6px;padding-left:4px">' + (cardIcons[type] || type) + '</div>';
      groupCards.forEach(function(c) {
        var expanded = _expandedCard === c.id;
        h += '<div class="set-card" data-cardid="' + c.id + '" onclick="toggleCard(\'' + c.id + '\')">';
        h += '<span class="sc-icon">' + (c.type === 'characters' ? '👤' : c.type === 'world' ? '🌍' : '📝') + '</span>';
        h += '<span class="sc-name">' + esc(c.name) + '</span>';
        if (c.subtype) { var stLabel = getSubtypeLabel(c.type, c.subtype); if (stLabel) h += '<span class="tag" style="font-size:9px;padding:0 5px">' + esc(stLabel) + '</span>'; }
        h += '</div>';
        if (expanded && c.content) {
          h += '<div class="card-detail-popup">';
          h += '<div class="cd-header">';
          h += '<div class="cd-icon">' + (c.type === 'characters' ? '👤' : c.type === 'world' ? '🌍' : '📝') + '</div>';
          h += '<div style="flex:1"><div class="cd-name">' + esc(c.name) + '</div><div class="cd-type">' + esc(c.type || '') + (c.subtype ? ' · ' + esc(getSubtypeLabel(c.type, c.subtype)) : '') + '</div></div>';
          h += '<button class="btn btn-ghost" style="font-size:11px;padding:2px 8px" onclick="event.stopPropagation();editCard(\'' + c.id + '\')">✏️ 编辑</button>';
          h += '</div>';
          h += '<div class="cd-fields">';
          var fields = c.content;
          Object.keys(fields).forEach(function(key) {
            if (key === 'tags' || key === 'role') return;
            h += '<div class="cd-field"><span class="cd-key">' + esc(key) + '</span><span class="cd-val">' + esc(fields[key]) + '</span></div>';
          });
          if (fields.tags && fields.tags.length) {
            h += '<div class="cd-field"><span class="cd-key">标签</span><span class="cd-val">' + fields.tags.map(function(t) { return '<span class="tag">' + esc(t) + '</span>'; }).join(' ') + '</span></div>';
          }
          h += '</div>';
          h += '</div>';
        }
      });
    });
  }

  // 章节列表 — 分卷树结构
  h += '<div class="section"><div class="section-title">📜 章节</div>';
  h += '<div style="display:flex;gap:4px;align-items:center">';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:2px 8px" onclick="addChapter()">+ 新建</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:2px 8px" onclick="toggleOutlineView()">' + (_outlineView ? '📋 列表' : '📝 大纲') + '</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:2px 8px" onclick="toggleBatchSelect()">' + (_batchSelect ? '✓ 完成' : '☐ 多选') + '</button>';
  h += '<input type="text" placeholder="🔍 搜索..." style="width:110px;padding:3px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:11px;font-family:var(--font-ui);outline:none" id="chapterSearch" oninput="renderMainPanel()" onkeydown="if(event.key===\'Escape\'){this.value=\'\';renderMainPanel()}">';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="exportProject(\'txt\')" title="导出 TXT">📄 TXT</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="exportProject(\'epub\')" title="导出 EPUB">📖 EPUB</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="showImageGenPanel()" title="为章节生成配图">🎨 生图</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="showCinematicPanel()" title="电影化小说写作">🎬 电影化</button>';
  h += '</div>';
  if (_showImageGen) {
    h += '<div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--rm);padding:12px;margin:8px 0">';
    h += '<div style="font-size:12px;font-weight:600;margin-bottom:8px">🎨 章节配图生成</div>';
    h += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">';
    h += '<select id="imgGenChapter" style="flex:1;padding:4px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:11px;font-family:var(--font-ui)">';
    h += '<option value="">— 选择章节 —</option>';
    _chapters.forEach(function(ch){ h += '<option value="'+ch.id+'">'+esc(ch.title)+' ('+ch.status+')</option>'; });
    h += '</select>';
    h += '<input type="text" id="imgGenStyle" value="cinematic, dark atmosphere, anime style" placeholder="风格描述" style="flex:1;padding:4px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:11px;font-family:var(--font-ui)">';
    h += '</div>';
    h += '<div style="display:flex;gap:6px">';
    h += '<button class="btn btn-primary" style="font-size:11px;padding:4px 12px" onclick="doGenerateCover()">⚡ 生成配图</button>';
    h += '<button class="btn btn-ghost" style="font-size:11px;padding:4px 8px" onclick="_showImageGen=false;renderMainPanel()">取消</button>';
    h += '<span id="imgGenStatus" style="font-size:11px;color:var(--text-muted);margin-left:auto"></span>';
    h += '</div>';
    h += '</div>';
  }
  h += '</div>';
  h += '<div class="batch-actions" style="' + (_batchSelect && _selectedChapters.length > 0 ? '' : 'display:none') + '"><span style="font-size:11px;color:var(--text-muted);margin-right:8px">已选 ' + _selectedChapters.length + ' 章</span><button class="btn btn-primary" style="font-size:11px;padding:4px 10px" onclick="mergeSelectedChapters()">📑 合并选中</button></div>';
  // 搜索过滤
  var searchQ = (function(){var el=document.getElementById('chapterSearch');return el?el.value.toLowerCase().trim():'';})();
  var filteredChapters = searchQ ? _chapters.filter(function(ch){return ch.title.toLowerCase().indexOf(searchQ)>=0||(ch.volume||'').toLowerCase().indexOf(searchQ)>=0;}) : _chapters;
  if (filteredChapters.length === 0) {
    h += '<div class="empty-state" style="height:160px"><div class="title" style="font-size:13px">暂无章节</div></div>';
  } else if (_outlineView) {
    // 独立大纲视图
    h += '<div class="outline-panel" style="max-height:calc(100vh - 220px);overflow-y:auto;padding:4px" id="outline-panel">';
    if (!_outline || !_outline.arcs || _outline.arcs.length === 0) {
      h += '<div class="empty-state" style="height:120px"><div class="title" style="font-size:13px">暂无大纲</div><div class="desc" style="font-size:11px;margin-top:4px">点击下方按钮创建第一条弧线</div></div>';
    } else {
      _outline.arcs.forEach(function(arc, arcIdx) {
        var arcExp = !_outlineCollapsed || !_outlineCollapsed['arc_'+arcIdx];
        h += '<div style="margin-bottom:6px;border:1px solid var(--border);border-radius:var(--rm);overflow:hidden">';
        h += '<div style="display:flex;align-items:center;gap:4px;padding:6px 10px;background:var(--bg-panel)" onclick="event.stopPropagation()">';
        h += '<button class="btn btn-ghost" style="font-size:10px;padding:2px 4px" onclick="_outlineCollapsed=_outlineCollapsed||{};_outlineCollapsed[\'arc_\'+'+arcIdx+']=!_outlineCollapsed[\'arc_\'+'+arcIdx+'];renderOutlinePanel()" title="展开/收起">' + (arcExp ? '▼' : '▶') + '</button>';
        h += '<span style="font-size:14px">📘</span>';
        h += '<span class="ol-edit" style="font-weight:600;font-size:13px;flex:1;cursor:text;padding:2px 4px;border:1px solid transparent;border-radius:3px" onclick="event.stopPropagation();startOutlineEdit(this,\'arc\','+arcIdx+')">' + esc(arc.title || '新弧线') + '</span>';
        h += '<button class="btn btn-ghost" style="font-size:9px;padding:2px 4px" onclick="addOutlineItem(\'act\','+arcIdx+')">+ 📙</button>';
        h += '<button class="btn btn-ghost" style="font-size:9px;padding:2px 4px;color:#B91C1C" onclick="deleteOutlineArc('+arcIdx+')">🗑</button>';
        h += '</div>';
        h += '<div style="padding:4px 10px 6px 32px;display:'+(arcExp?'':'none')+'">';
        h += '<textarea class="ol-desc" style="width:100%;padding:4px 8px;border:1px solid var(--border-light);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:11px;font-family:var(--font-ui);resize:vertical;min-height:32px" onchange="_outline.arcs['+arcIdx+'].description=this.value" oninput="_outline.arcs['+arcIdx+'].description=this.value" placeholder="弧线描述...">' + esc(arc.description || '') + '</textarea>';
        h += '</div>';
        (arc.items||[]).forEach(function(act, actIdx) {
          var actExp = !_outlineCollapsed || !_outlineCollapsed['act_'+arcIdx+'_'+actIdx];
          h += '<div style="margin:2px 0 2px 14px;border-left:2px solid var(--border);border-bottom:1px solid var(--border-light);border-radius:0 0 0 4px">';
          h += '<div style="display:flex;align-items:center;gap:3px;padding:5px 10px" onclick="event.stopPropagation()">';
          h += '<button class="btn btn-ghost" style="font-size:9px;padding:1px 3px" onclick="_outlineCollapsed=_outlineCollapsed||{};_outlineCollapsed[\'act_\'+'+arcIdx+'+\'_\'+'+actIdx+']=!_outlineCollapsed[\'act_\'+'+arcIdx+'+\'_\'+'+actIdx+'];renderOutlinePanel()">' + (actExp ? '▼' : '▶') + '</button>';
          h += '<span style="font-size:13px">📙</span>';
          h += '<span class="ol-edit" style="font-weight:500;font-size:12px;flex:1;cursor:text;padding:2px 4px;border:1px solid transparent;border-radius:3px" onclick="event.stopPropagation();startOutlineEdit(this,\'act\','+arcIdx+','+actIdx+')">' + esc(act.title || '新幕') + '</span>';
          h += '<button class="btn btn-ghost" style="font-size:9px;padding:1px 3px" onclick="addOutlineItem(\'beat\','+arcIdx+','+actIdx+')">+ 📄</button>';
          h += '<button class="btn btn-ghost" style="font-size:9px;padding:1px 3px;color:#B91C1C" onclick="deleteOutlineItem('+arcIdx+','+actIdx+')">🗑</button>';
          h += '</div>';
          h += '<div style="padding:2px 10px 4px 28px;display:'+(actExp?'':'none')+'">';
          h += '<textarea class="ol-desc" style="width:100%;padding:3px 6px;border:1px solid var(--border-light);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:10px;font-family:var(--font-ui);resize:vertical;min-height:28px" onchange="_outline.arcs['+arcIdx+'].items['+actIdx+'].description=this.value" oninput="_outline.arcs['+arcIdx+'].items['+actIdx+'].description=this.value" placeholder="幕描述...">' + esc(act.description || '') + '</textarea>';
          h += '</div>';
          (act.items||[]).forEach(function(beat, beatIdx) {
            var linkedCh = beat.linkedChapterId ? _chapters.find(function(c){return c.id===beat.linkedChapterId}) : null;
            h += '<div style="margin:1px 0 1px 10px;display:flex;align-items:center;gap:3px;padding:2px 8px;font-size:11px;border-left:1px solid var(--border-light)" onclick="event.stopPropagation()">';
            h += '<span style="font-size:11px">📄</span>';
            h += '<span class="ol-edit" style="flex:1;cursor:text;padding:1px 4px;border:1px solid transparent;border-radius:3px" onclick="event.stopPropagation();startOutlineEdit(this,\'beat\','+arcIdx+','+actIdx+','+beatIdx+')">' + esc(beat.title || '新节拍') + '</span>';
            h += '<button class="btn btn-ghost" style="font-size:8px;padding:1px 3px" onclick="pickChapterForBeat('+arcIdx+','+actIdx+','+beatIdx+')" title="选择关联章节">' + (linkedCh ? '🔗 '+esc(linkedCh.title) : '🔗 无') + '</button>';
            h += '<button class="btn btn-ghost" style="font-size:8px;padding:1px 3px;color:#B91C1C" onclick="deleteOutlineItem('+arcIdx+','+actIdx+','+beatIdx+')">🗑</button>';
            h += '</div>';
          });
          h += '</div>';
        });
        h += '</div>';
      });
    }
    h += '<div style="margin-top:6px;display:flex;gap:6px">';
    h += '<button class="btn btn-ghost" style="font-size:11px;padding:3px 10px;flex:1" onclick="addOutlineItem(\'arc\')">+ 📘 新弧线</button>';
    h += '<button class="btn btn-ghost" style="font-size:11px;padding:3px 10px;flex:1" onclick="saveOutline()">💾 保存大纲</button>';
    h += '</div>';
    h += '</div>';
  } else {
    // 布局：卷+章节

    var allVols = {};
    filteredChapters.forEach(function(ch) { if (ch.volume) allVols[ch.volume] = true; });
    var volOptions = Object.keys(allVols);

    // 按卷分组
    var volumes = {};
    var noVolume = [];
    filteredChapters.forEach(function(ch) {
      if (ch.volume) {
        if (!volumes[ch.volume]) volumes[ch.volume] = [];
        volumes[ch.volume].push(ch);
      } else {
        noVolume.push(ch);
      }
    });

    // 渲染卷
    var volKeys = Object.keys(volumes);
    volKeys.forEach(function(volName) {
      var chapters = volumes[volName];
      var expanded = _expandedVolumes[volName] !== false; // 默认展开
      h += '<div style="margin-bottom:6px">';
      h += '<div class="volume-header" onclick="toggleVolume(\'' + esc(volName) + '\')" style="display:flex;align-items:center;gap:6px;padding:6px 8px;cursor:pointer;border-radius:var(--radius);transition:background .15s" onmouseover="this.style.background=\'var(--bg-hover)\'" onmouseout="this.style.background=\'\'">';
      h += '<span style="font-size:12px;color:var(--text-muted);transition:transform .2s" class="vol-arrow">' + (expanded ? '▼' : '▶') + '</span>';
      h += '<span style="font-size:12px;font-weight:600;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.5px">📂 ' + esc(volName) + '</span>';
      h += '<span style="font-size:10px;color:var(--text-muted);margin-left:4px">(' + chapters.length + '章)</span>';
      h += '</div>';
      h += '<div class="vol-chapters" style="padding-left:16px;overflow:hidden;max-height:' + (expanded ? '2000px' : '0') + ';transition:max-height .25s ease" ondragover="dragOver(event)" ondrop="dropChapter(event,\'' + volName + '\')">';
        chapters.forEach(function(ch) {
          var activeClass = _currentChapter && _currentChapter.id === ch.id ? ' active' : '';
          h += '<div class="ch-item' + activeClass + '" data-chid="' + ch.id + '" draggable="true" ondragstart="dragStart(event,\'' + ch.id + '\')" ondragend="dragEnd(event)" onclick="openChapter(\'' + ch.id + '\')" onmousedown="event.stopPropagation()">';
          h += '<span class="drag-handle" title="拖动排序" style="cursor:grab;font-size:10px;margin-right:4px;color:var(--text-muted);user-select:none" onmousedown="event.stopPropagation()">⋮⋮</span><input type="checkbox" class="ch-check" style="display:' + (_batchSelect ? '' : 'none') + '" onclick="event.stopPropagation()" onchange="window._chk(event,\'' + ch.id + '\',this.checked)">';
          h += '<span class="ch-icon">📄</span>';
          h += '<div class="ch-info">';
          h += '<div class="ch-title" ondblclick="editChapterTitle(\'' + ch.id + '\',this)">' + esc(ch.title) + '</div>';
          h += '<div class="ch-meta">' + (ch.wordCount || 0) + '字</div>';
          var st = ch.status || 'draft';
          var stColor = st === 'complete' ? '#10B981' : st === 'revising' ? '#6366F1' : '#94A3B8';
          var stLabel = st === 'complete' ? '✅' : st === 'revising' ? '🔧' : '✏️';
          h += ' <span style="color:' + stColor + ';font-size:10px">' + stLabel + '</span>';
          h += '</div>';
          h += '<select class="vol-select" title="更改分卷" onclick="event.stopPropagation()" onchange="changeChapterVolume(\'' + ch.id + '\',this.value)">';
          h += '<option value="">未分卷</option>';
          volOptions.forEach(function(v) { h += '<option value="' + esc(v) + '"' + (ch.volume === v ? ' selected' : '') + '>' + esc(v) + '</option>'; });
          h += '<option value="__new__">+ 新建卷...</option>';
          h += '</select>';
          h += '</div>';
        });
        h += '</div>';
      h += '</div>';
    });

    // 未分卷章节
    if (noVolume.length > 0) {
      h += '<div style="margin-bottom:6px">';
      var expanded = _expandedVolumes[''] !== false;
      h += '<div class="volume-header" onclick="toggleVolume(\'\')" style="display:flex;align-items:center;gap:6px;padding:6px 8px;cursor:pointer;border-radius:var(--radius);transition:background .15s" onmouseover="this.style.background=\'var(--bg-hover)\'" onmouseout="this.style.background=\'\'">';
      h += '<span style="font-size:12px;color:var(--text-muted);transition:transform .2s">' + (expanded ? '▼' : '▶') + '</span>';
      h += '<span style="font-size:12px;font-weight:600;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.5px">📂 未分卷</span>';
      h += '<span style="font-size:10px;color:var(--text-muted);margin-left:4px">(' + noVolume.length + '章)</span>';
      h += '</div>';
      h += '<div class="vol-chapters" style="padding-left:16px;overflow:hidden;max-height:' + (expanded ? '2000px' : '0') + ';transition:max-height .25s ease" ondragover="dragOver(event)" ondrop="dropChapter(event,\'\')">';
        noVolume.forEach(function(ch) {
          var activeClass = _currentChapter && _currentChapter.id === ch.id ? ' active' : '';
          h += '<div class="ch-item' + activeClass + '" data-chid="' + ch.id + '" draggable="true" ondragstart="dragStart(event,\'' + ch.id + '\')" ondragend="dragEnd(event)" onclick="openChapter(\'' + ch.id + '\')" onmousedown="event.stopPropagation()">';
          h += '<span class="drag-handle" title="拖动排序" style="cursor:grab;font-size:10px;margin-right:4px;color:var(--text-muted);user-select:none" onmousedown="event.stopPropagation()">⋮⋮</span><input type="checkbox" class="ch-check" style="display:' + (_batchSelect ? '' : 'none') + '" onclick="event.stopPropagation()" onchange="window._chk(event,\'' + ch.id + '\',this.checked)">';
          h += '<span class="ch-icon">📄</span>';
          h += '<div class="ch-info">';
          h += '<div class="ch-title" ondblclick="editChapterTitle(\'' + ch.id + '\',this)">' + esc(ch.title) + '</div>';
          h += '<div class="ch-meta">' + (ch.wordCount || 0) + '字</div>';
          var st = ch.status || 'draft';
          var stColor = st === 'complete' ? '#10B981' : st === 'revising' ? '#6366F1' : '#94A3B8';
          var stLabel = st === 'complete' ? '✅' : st === 'revising' ? '🔧' : '✏️';
          h += ' <span style="color:' + stColor + ';font-size:10px">' + stLabel + '</span>';
          h += '</div>';
          h += '<select class="vol-select" title="更改分卷" onclick="event.stopPropagation()" onchange="changeChapterVolume(\'' + ch.id + '\',this.value)">';
          h += '<option value="">未分卷</option>';
          volOptions.forEach(function(v) { h += '<option value="' + esc(v) + '"' + (ch.volume === v ? ' selected' : '') + '>' + esc(v) + '</option>'; });
          h += '<option value="__new__">+ 新建卷...</option>';
          h += '</select>';
          h += '</div>';
        });
        h += '</div>';
      h += '</div>';
    }
    h += '</div>';
  }
  h += '</div>';
  q('main-panel').innerHTML = h;
}

function openChapter(id) {
  var ch = _chapters.find(function(x) { return x.id === id; });
  if (!ch) return;
  _currentChapter = ch;
  _editing = false;
  stopDraftTimer();
  renderMainPanel();
  renderChapterContent();
  // 检查草稿
  var draft = checkDraft();
  if (draft) {
    var ago = Math.round((Date.now() - draft.time) / 60000);
    var agoStr = ago < 1 ? '刚刚' : ago < 60 ? ago + '分钟前' : Math.round(ago/60) + '小时前';
    if (confirm('发现未保存的草稿（' + agoStr + '），要恢复吗？')) {
      setTimeout(function() {
        enterEditMode();
        var ta = q('chb');
        var fullEl = q('chb_full');
        if (ta && draft.body) {
          // 先设 hidden input 为完整草稿，再 strip 后填入 textarea
          if (fullEl) fullEl.value = draft.body;
          ta.value = stripFrontmatter(draft.body);
          _draftLastBody = ta.value;
        }
      }, 100);
    } else {
      clearDraft();
    }
  }
}

async function renderChapterContent() {
  var ch = _currentChapter;
  if (!ch) return;
  var body = ch.body || '';
  console.log('[renderCh] ch.body length:', body.length, 'editing:', _editing);

  // Non-editing mode: fetch fresh body with all images inlined as base64
  // BUT: only if body hasn't been locally modified (e.g. image delete in progress)
  if (!_editing && !_localBodyDirty) {
    try {
      var rc = await fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/chapter/' + encodeURIComponent(ch.id)));
      var rd = await rc.json();
      if (rd.body) body = rd.body;
      console.log('[renderCh] fetched body length:', body.length);
    } catch(e) {}
  } else if (!_editing) {
    console.log('[renderCh] skipping fetch — local body dirty');
  }

  var h = '';
  h += '<div class="panel-header">';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:2px 8px" onclick="_editing=false;renderMainPanel()">← 返回</button>';
  h += '<span class="badge">📖 ' + (ch.status || '草稿') + '</span>';
  h += '<span style="font-size:15px;font-weight:600;color:var(--text)">' + esc(ch.title) + '</span>';
  h += '<span style="font-size:11px;color:var(--text-muted);margin-left:8px">' + (ch.wordCount || 0) + '字</span>';
  h += '<div style="margin-left:auto;display:flex;gap:6px">';
  // 工具栏
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:4px 10px" onclick="toggleFindBar()" title="查找替换 (Ctrl+H)">🔍 查找</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:4px 10px" onclick="searchInAllChapters()" title="全书搜索">📚 全书</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:4px 10px" onclick="autoFormatEditor()" title="自动排版">✦ 排版</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:4px 10px" onclick="proofreadEditor()" title="校对常见错误">✓ 校对</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:4px 10px" onclick="splitChapter()" title="拆分章节">✂️ 拆分</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:4px 10px" onclick="insertImageToChapter()" title="插入图片到光标位置">📷 插入图片</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:4px 10px" onclick="showVersionHistory(\'' + ch.id + '\')" title="版本历史">🌳 历史</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:4px 10px" onclick="suggestDirections(\'' + ch.id + '\')" title="AI 方向建议">💡 建议</button>';
  if (_editing) {
    h += '<span id="draft-indicator" style="font-size:10px;color:var(--text-muted);margin-right:8px;opacity:0.5"></span>';
    h += '<button class="btn btn-primary" onclick="saveChapter()">💾 保存</button>';
    h += '<button class="btn" onclick="stopDraftTimer();_editing=false;renderChapterContent()">取消</button>';
    h += '<button class="btn btn-ghost" style="font-size:11px;padding:2px 8px" onclick="stopDraftTimer();_editing=false;renderChapterContent()">取消</button>';
  } else {
    h += '<button class="btn" onclick="enterEditMode()">✎ 编辑</button>';
  }
  h += '<button class="btn" onclick="runAnalysis()">🔍 分析</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:4px 10px" onclick="toggleGraphPanel()" title="关系图">🕸 关系图</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:4px 10px" onclick="togglePlotPanel()" title="伏笔管理">🔫 伏笔</button>';
  h += '</div>';
  h += '</div>';

  h += '<div class="panel-body">';
  h += '<div class="editor-wrap fade-in">';
  // 上下文命中信息条
  h += '<div id="ctx-bar" style="display:flex;align-items:center;gap:10px;padding:6px 10px;margin-bottom:12px;border:1px solid var(--border);border-radius:var(--r);background:var(--bg-panel);font-size:11px;color:var(--text-muted);transition:opacity .3s">';
  h += '<span style="color:var(--text-sub);font-weight:600">上下文</span>';
  h += '<span id="ctx-cards">📋 -</span>';
  h += '<span id="ctx-facts">📌 -</span>';
  h += '<span id="ctx-prev">📝 -</span>';
  h += '<span id="ctx-graph">🔗 -</span>';
  h += '<span id="ctx-detail" style="margin-left:auto;cursor:pointer;color:var(--accent);display:none" onclick="toggleCtxDetail()">展开</span>';
  h += '</div>';
  h += '<div id="ctx-detail-panel" style="display:none;margin-bottom:12px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r);background:var(--bg-panel);font-size:11px;max-height:200px;overflow-y:auto"></div>';
  // 伏笔面板
  h += '<div id="plot-panel" style="display:none;margin-bottom:12px">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><span style="font-size:12px;font-weight:600;color:var(--text-sub)">🔫 伏笔管理</span><button class="btn btn-ghost" style="font-size:10px;padding:2px 8px" onclick="togglePlotPanel()">✕ 关闭</button></div>';
  h += '<div id="plotContent" style="font-size:11px;color:var(--text-muted);padding:10px;text-align:center">加载中...</div>';
  h += '</div>';
  // 关系图面板
  h += '<div id="graph-panel" style="display:none;margin-bottom:12px">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><span style="font-size:12px;font-weight:600;color:var(--text-sub)">🕸 人物关系图</span><button class="btn btn-ghost" style="font-size:10px;padding:2px 8px" onclick="toggleGraphPanel()">✕ 关闭</button></div>';
  h += '<div id="writingGraphContainer" style="width:100%;height:300px;background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--r);overflow:hidden"></div>';
  h += '</div>';
  // 查找替换栏
  h += '<div id="findBar" style="display:none;background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:8px 12px;margin-bottom:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">';
  h += '<input id="findInput" type="text" placeholder="查找..." style="width:160px;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:12px;font-family:var(--font-ui);outline:none">';
  h += '<input id="replaceInput" type="text" placeholder="替换为..." style="width:140px;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:12px;font-family:var(--font-ui);outline:none">';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="findNext()">下一个</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="findPrev()">上一个</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="replaceCurrent()">替换</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="replaceAll()">全部替换</button>';
  h += '<span id="findStatus" style="font-size:10px;color:var(--text-muted);margin-left:4px"></span>';
  h += '<button style="background:none;border:none;font-size:14px;color:var(--text-muted);cursor:pointer" onclick="toggleFindBar()" title="关闭">✕</button>';
  h += '</div>';

  if (_editing) {
    h += '<input class="editor-title-input" id="cht" value="' + esc(ch.title) + '" placeholder="章节标题">';
    // 编辑模式下剥离 frontmatter，只放正文到 textarea，避免 base64 等元数据膨胀
    var displayBody = stripFrontmatter(body);
    h += '<textarea class="editor-textarea" id="chb" placeholder="开始写作..." oninput="_draftDirty=true" oncontextmenu="handleTextareaContext(event)">' + esc(displayBody) + '</textarea>';
    // 缓存完整原文（含 frontmatter）到 hidden div，供草稿恢复和保存时使用
    h += '<input type="hidden" id="chb_full" value="' + esc(body) + '">';
  } else {
    if (body) {
      h += '<div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:20px;font-size:14px;line-height:1.8;white-space:pre-wrap;font-family:var(--font)">' + renderMarkdown(body) + '</div>';
    } else {
      h += '<div class="empty-state" style="height:200px"><div class="icon">🖊</div><div class="title">章节为空</div><div class="desc">点击编辑按钮开始写作</div></div>';
    }
  }

  h += '</div></div>';

  q('main-panel').innerHTML = h;
  // 异步加载上下文命中信息
  setTimeout(loadContextBar, 100);
}

// ── Frontmatter 剥离/还原工具 ──
// stripFrontmatter: 从完整内容中剥离 frontmatter 块，返回纯正文
function stripFrontmatter(content) {
  if (!content) return content;
  var body = content;
  // 循环剥离所有 frontmatter 块（---...---）
  var fmRegex = /^---[\s\S]*?---\s*/;
  var match;
  var count = 0;
  while ((match = body.match(fmRegex)) !== null) {
    body = body.substring(match[0].length);
    count++;
    if (count > 10) break;
  }
  return body;
}

// restoreFrontmatter: 将正文内容重建为完整 markdown（加回 frontmatter）
function restoreFrontmatter(bodyText, originalContent) {
  if (!bodyText) return originalContent || '';
  // 从原内容中提取 frontmatter 块（所有 ---...--- 块）
  var fmRegex = /^---[\s\S]*?---\s*/;
  var fmBlocks = [];
  var work = originalContent || '';
  var match;
  var count = 0;
  while ((match = work.match(fmRegex)) !== null) {
    fmBlocks.push(match[0]);
    work = work.substring(match[0].length);
    count++;
    if (count > 10) break;
  }
  // 重建：frontmatter + 正文
  return fmBlocks.join('\n\n') + (fmBlocks.length > 0 ? '\n\n' : '') + bodyText;
}

function toggleCard(id) {
  _expandedCard = _expandedCard === id ? null : id;
  renderMainPanel();
}

function toggleVolume(volName) {
  _expandedVolumes[volName] = _expandedVolumes[volName] === false ? true : false;
  // CSS 过渡：找到对应 vol-chapters 元素切换 max-height
  var targetVol = volName ? volName : '';
  var allChapters = document.querySelectorAll('.vol-chapters');
  allChapters.forEach(function(el) {
    var dataVol = el.getAttribute('data-vol') || el.dataset.vol || '';
    // 找到对应的箭头
    var arrow = el.previousElementSibling ? el.previousElementSibling.querySelector('.vol-arrow') : null;
    // 简单重渲染保持一致性
  });
  renderMainPanel();
}

// ═══════════════════════════════════
//  工具栏：查找替换 + 全书搜索 + 排版 + 校对
// ═══════════════════════════════════
var _findIndex = -1;
var _findMatches = [];

function toggleFindBar() {
  enterEditMode();
  setTimeout(function() {
    var bar = q('findBar'); var inp = q('findInput');
    if (!bar) return;
    bar.style.display = 'flex';
    if (inp) inp.focus();
  }, 100);
}

function getEditorText() { var ta = q('chb'); return ta ? ta.value : ''; }

function findMatches() {
  var inp = q('findInput'); var text = getEditorText();
  if (!inp || !text) { _findMatches = []; _findIndex = -1; return; }
  var kw = inp.value; if (!kw) { _findMatches = []; _findIndex = -1; return; }
  _findMatches = []; var idx = 0;
  while ((idx = text.indexOf(kw, idx)) !== -1) { _findMatches.push(idx); idx += kw.length; }
  if (_findMatches.length > 0 && _findIndex < 0) _findIndex = 0;
}

function updateFindStatus() {
  var st = q('findStatus'); if (!st) return;
  if (_findMatches.length === 0) { st.textContent = '无匹配'; st.style.color = 'var(--text-muted)'; }
  else { st.textContent = (_findIndex + 1) + '/' + _findMatches.length; st.style.color = 'var(--accent)'; }
}

function findNext() { findMatches(); if (_findMatches.length === 0) return; _findIndex = (_findIndex + 1) % _findMatches.length; updateFindStatus(); scrollToMatch(); }
function findPrev() { findMatches(); if (_findMatches.length === 0) return; _findIndex = _findIndex - 1; if (_findIndex < 0) _findIndex = _findMatches.length - 1; updateFindStatus(); scrollToMatch(); }

function scrollToMatch() {
  var ta = q('chb'); var inp = q('findInput');
  if (!ta || !inp || _findIndex < 0) return;
  var kw = inp.value; var pos = _findMatches[_findIndex];
  ta.focus(); ta.setSelectionRange(pos, pos + kw.length);
  updateFindStatus();
}

function replaceCurrent() {
  var ta = q('chb'); var fInp = q('findInput'); var rInp = q('replaceInput');
  if (!ta || !fInp || !rInp) return;
  var kw = fInp.value; var rep = rInp.value;
  if (!kw) return;
  if (_findIndex >= 0 && _findIndex < _findMatches.length) {
    var pos = _findMatches[_findIndex];
    ta.value = ta.value.substring(0, pos) + rep + ta.value.substring(pos + kw.length);
    _findIndex--; findNext();
  } else { findNext(); if (_findIndex >= 0) replaceCurrent(); }
}

function replaceAll() {
  var ta = q('chb'); var fInp = q('findInput'); var rInp = q('replaceInput');
  if (!ta || !fInp || !rInp) return;
  var kw = fInp.value;
  if (!kw) return;
  var count = (ta.value.split(kw).length - 1);
  ta.value = ta.value.split(kw).join(rInp.value);
  _findMatches = []; _findIndex = -1; updateFindStatus();
  toast('✓ 替换了 ' + count + ' 处');
}

function autoFormatEditor() {
  enterEditMode();
  var ta = q('chb'); if (!ta) return;
  var text = ta.value;
  ta.value = text.replace(/([。！？；…])(?=\S)/g, '$1\n\n').replace(/\n{3,}/g, '\n\n').trim();
  toast('✦ 排版完成');
}

function proofreadEditor() {
  enterEditMode();
  var ta = q('chb'); if (!ta) return;
  var text = ta.value;
  var errors = [['的的','的'],['了了','了'],['，，','，'],['。。','。'],['！！','！'],['？？','？']];
  var changed = false;
  errors.forEach(function(e) { if (text.indexOf(e[0]) !== -1) { text = text.split(e[0]).join(e[1]); changed = true; } });
  if (changed) { ta.value = text; toast('✓ 已修复常见错误'); }
  else toast('未发现明显错误');
}

function enterEditMode() {
  if (!_editing) {
    _editing = true;
    _draftDirty = false;
    startDraftTimer();
    renderChapterContent();
  }
}

var _draftTimer = null;
var _draftDirty = false;
var _draftLastBody = '';

function startDraftTimer() {
  stopDraftTimer();
  _draftLastBody = (q('chb')||{}).value || '';
  _draftTimer = setInterval(saveDraft, 15000);
}

function stopDraftTimer() {
  if (_draftTimer) { clearInterval(_draftTimer); _draftTimer = null; }
  _draftDirty = false;
}

function draftKey() {
  return 'ms-draft-' + (_currentProject?._id || _currentProject?.id || '') + '-' + (_currentChapter?.id || '');
}

function saveDraft() {
  var ta = q('chb');
  if (!ta) { stopDraftTimer(); return; }
  var body = ta.value;
  if (body === _draftLastBody) return;
  _draftLastBody = body;
  _draftDirty = false;
  try {
    // 草稿也存完整 body（含 frontmatter），以便恢复后正确渲染
    var fullEl = q('chb_full');
    var fullContent = fullEl ? fullEl.value : '';
    var fullDraft = restoreFrontmatter(body, fullContent);
    var dk = draftKey();
    localStorage.setItem(dk, JSON.stringify({ body: fullDraft, time: Date.now() }));
    showDraftIndicator();
  } catch(e) { /* storage full */ }
}

function showDraftIndicator() {
  var el = q('draft-indicator');
  if (!el) return;
  el.textContent = '💾 草稿已保存 ' + new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(function() { el.style.opacity = '0.5'; }, 3000);
}

function clearDraft() {
  try { localStorage.removeItem(draftKey()); } catch(e) {}
}

function checkDraft() {
  if (!_currentProject || !_currentChapter) return null;
  var dk = draftKey();
  var raw = localStorage.getItem(dk);
  if (!raw) return null;
  try {
    var d = JSON.parse(raw);
    if (!d.body || d.body === (_currentChapter.body || '')) { clearDraft(); return null; }
    return d;
  } catch(e) { clearDraft(); return null; }
}

async function searchInAllChapters() {
  var ta = q('chb');
  var selection = ta ? (ta.value.substring(ta.selectionStart, ta.selectionEnd) || '') : '';
  if (selection) { doSearchAllChapters(selection); return; }
  showInlinePrompt('全书搜索关键词', '', function(val) { if (val) doSearchAllChapters(val); });
}

async function doSearchAllChapters(kw) {
  if (!_currentProject || !_chapters) return;
  var results = [];
  var projId = _currentProject.id;
  for (var i = 0; i < _chapters.length; i++) {
    var ch = _chapters[i];
    var content = ch.body || ch.content || '';
    if (!content) {
      try {
        var r = await fetch(tu(A + '/api/project/' + encodeURIComponent(projId) + '/chapters'));
        var all = await r.json();
        var found = all.find(function(x) { return x.id === ch.id; });
        if (found) { content = found.body || found.content || ''; ch.body = content; }
      } catch(e) {}
    }
    var idx = content.indexOf(kw);
    if (idx !== -1) {
      var ctx = content.substring(Math.max(0, idx - 20), idx + kw.length + 30);
      results.push({ chapter: ch, context: ctx });
    }
  }
  var h = '<div style="font-weight:600;margin-bottom:8px;font-size:13px">📚 「' + esc(kw) + '」出现于 ' + results.length + ' 个章节</div>';
  if (results.length === 0) h += '<div style="font-size:12px;color:var(--text-muted)">未找到匹配</div>';
  else results.forEach(function(r) {
    h += '<div style="padding:6px 0;border-bottom:1px solid var(--border-light);cursor:pointer" onclick="searchChapterResult(\'' + r.chapter.id + '\',\'' + esc(kw) + '\')">';
    h += '<div style="font-size:12px;font-weight:600;color:var(--text)">📄 ' + esc(r.chapter.title) + '</div>';
    h += '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">…' + esc(r.context.replace(/\n/g,' ')) + '…</div></div>';
  });
  var target = q('main-panel');
  if (target) {
    var exist = target.querySelector('.search-results-popup');
    if (exist) exist.remove();
    var div = document.createElement('div');
    div.className = 'search-results-popup fade-in';
    div.style.cssText = 'background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin:8px 0;max-height:400px;overflow-y:auto';
    div.innerHTML = h;
    target.appendChild(div);
  }
}

function searchChapterResult(chId, kw) {
  _currentChapter = _chapters.find(function(c) { return c.id === chId; });
  if (_currentChapter) {
    _editing = true;
    renderChapterContent();
    setTimeout(function() {
      var ta = q('chb');
      if (ta && kw) { var idx = ta.value.indexOf(kw); if (idx !== -1) ta.setSelectionRange(idx, idx + kw.length); }
    }, 300);
  }
}

// ── Markdown 渲染（预览模式）──
function renderMarkdown(body) {
  if (!body) return '';
  console.log('[renderMarkdown] bodyStart:', body.substring(0, 100), 'proj:', _currentProject ? _currentProject.id : 'NULL');
  
  // 提取并渲染 YAML front matter 里的 cover 图片
  var coverPath = null;
  var bodyText = body;
  // 剥离所有前导的 front matter 块（---...---），取最后一个有 cover.image 的
  var fmRegex = /^---[\s\S]*?---\s*/;
  var match;
  var fmCount = 0;
  while ((match = bodyText.match(fmRegex)) !== null) {
    fmCount++;
    var allFm = match[0];
    var imgMatch = allFm.match(/image:\s*["']?([^\n'"]+)["']?/);
    if (imgMatch) coverPath = imgMatch[1].trim();
    bodyText = bodyText.substring(match[0].length);
    if (fmCount > 10) break;
  }
  console.log('[renderMarkdown] fmBlocks:', fmCount, 'coverPath:', coverPath, 'remainingStart:', bodyText.substring(0, 50));
  
  var coverImgHtml = '';
  if (coverPath && _currentProject) {
    // If already a data URL (inline from backend), use directly
    var coverUrl = coverPath;
    if (!coverPath.startsWith('data:')) {
      coverUrl = tu(A + "/api/project/" + encodeURIComponent(_currentProject.id) + "/asset/" + encodeURIComponent(coverPath));
    }
    coverImgHtml = '<img src="' + coverUrl + '" style="max-width:100%;height:auto;border-radius:var(--radius);margin:8px 0;display:block;cursor:pointer" data-imgpath="' + esc(coverPath) + '" data-imgtype="' + (coverPath.startsWith('data:') ? 'inline' : 'server') + '" data-cover="true" alt="封面">\n';
    console.log('[renderMarkdown] coverImg built');
  }
  
  html = esc(bodyText);
  // comments: /* text */ → gray italic
  html = html.replace(/\/\*\s+(.+?)\s+\*\//g, '<span style="color:#999;font-style:italic">$1</span>');
  // highlight: ===text===
  html = html.replace(/===([^=]+)===/g, '<mark style="background:#FFF3B0;padding:1px 4px;border-radius:3px">$1</mark>');
  // bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // italic: *text*
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // images: ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(match, alt, p1) {
    // If it's a data URL, use directly; otherwise build full asset URL
    var imgSrc = p1;
    var isRemote = false;
    if (_currentProject && !p1.startsWith('data:')) {
      imgSrc = tu(A + "/api/project/" + encodeURIComponent(_currentProject.id) + "/asset/" + encodeURIComponent(p1));
      isRemote = true;
    }
    var imgId = 'img_' + Math.random().toString(36).substr(2, 9);
    // data-imgpath always set (for both remote and inline data URL images)
    return '<div style="position:relative;display:inline-block"><img id="' + imgId + '" data-imgpath="' + p1 + '" data-imgtype="' + (p1.startsWith('data:') ? 'inline' : 'server') + '" data-img-alt="' + esc(alt) + '" src="' + imgSrc + '" style="max-width:100%;height:auto;border-radius:var(--radius);margin:8px 0;display:block;cursor:pointer" alt="' + esc(alt) + '"></div>';
  });
  // links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#AA5E43;text-decoration:underline">$1</a>');
  // headings: # ... at start of line
  html = html.replace(/^### (.+)$/gm, '<h4 style="font-size:15px;margin:12px 0 6px;color:var(--text)">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 style="font-size:17px;margin:16px 0 8px;color:var(--text)">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2 style="font-size:19px;margin:20px 0 10px;color:var(--text);border-bottom:1px solid var(--border);padding-bottom:4px">$1</h2>');
  // auto-link names
  html = autoLinkMarkdown(html);
  
  // 返回：封面图 + 正文
  return coverImgHtml + html;
}

function autoLinkMarkdown(html) {
  var names = [], dedup = {};
  if (_cards) _cards.forEach(function(c) {
    if (c.name && !dedup[c.name] && c.name.length >= 2) {
      dedup[c.name] = { type: c.type || 'world', id: c.id || c.name };
      names.push(c.name);
    }
  });
  if (_markers) _markers.forEach(function(m) {
    if (m.name && !dedup[m.name] && m.name.length >= 2) {
      dedup[m.name] = { type: 'location', id: m.id || m.name };
      names.push(m.name);
    }
  });
  names.sort(function(a, b) { return b.length - a.length; });
  names.forEach(function(name) {
    var escName = esc(name);
    if (html.indexOf(escName) === -1) return;
    var color = '#AA5E43';
    if (dedup[name].type === 'location') color = '#059669';
    var repl = '<span class="auto-link" style="border-bottom:1.5px dashed ' + color + ';cursor:pointer;color:' + color + '" onclick="event.stopPropagation();openCardDetail(\'' + esc(name) + '\')" title="点击查看">' + escName + '</span>';
    html = html.split(escName).join(repl);
  });
  return html;
}

function openCardDetail(name) {
  if (!_cards) return;
  var card = _cards.find(function(c) { return c.name === name; });
  if (!card) return;
  var target = q('main-panel');
  if (!target) return;
  var exist = target.querySelector('.card-detail-inline');
  if (exist) exist.remove();
  var h = '<div class="card-detail-inline fade-in" style="background:var(--bg-panel);border:1px solid var(--accent);border-radius:var(--rm);padding:12px 16px;margin:8px 0">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:600;color:var(--accent)">' + esc(card.name) + '</span><button style="background:none;border:none;font-size:14px;color:var(--text-muted);cursor:pointer" onclick="this.parentElement.parentElement.remove()">✕</button></div>';
  h += '<div style="font-size:11px;color:var(--text-muted);margin:4px 0">' + (card.type === 'characters' ? '👤 人物' : '📝 设定') + '</div>';
  if (card.content) {
    if (typeof card.content === 'object') {
      Object.keys(card.content).forEach(function(k) {
        if (k === 'name') return;
        h += '<div style="font-size:11px;margin-top:4px"><span style="color:var(--text-sub)">' + esc(k) + ':</span> <span style="color:var(--text)">' + esc(String(card.content[k])) + '</span></div>';
      });
    } else {
      h += '<div style="font-size:12px;color:var(--text);margin-top:4px;line-height:1.6">' + esc(String(card.content)) + '</div>';
    }
  }
  h += '</div>';
  var div = document.createElement('div');
  div.innerHTML = h;
  target.appendChild(div.firstElementChild);
}

function addCard() {
  // 模板引导：新建人物/世界观/文风卡片
  showCardForm(null);
}

function editCard(cardId) {
  if (!_cards) return;
  var card = _cards.find(function(c) { return c.id === cardId; });
  if (card) showCardForm(card);
}

function showCardForm(card) {
  var isNew = !card;
  var type = card ? card.type : 'characters';
  var subtype = card ? (card.subtype || '') : '';
  var name = card ? card.name : '';

  // 建议字段模板
  var templateFields = {
    characters: ['姓名', '性别', '年龄', '外貌', '性格', '身份', '背景'],
    world: ['名称', '类别', '描述', '规则'],
    style: ['名称', '风格描述', '关键词']
  };

  var h = '<div class="card-form-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.3);backdrop-filter:blur(2px);z-index:200;display:flex;align-items:center;justify-content:center" onclick="event.target===this&&closeCardForm()">';
  h += '<div class="card-form-panel" style="background:var(--bg);border:1px solid var(--border);border-radius:var(--rm);width:420px;max-height:80vh;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,.15)" onclick="event.stopPropagation()">';
  h += '<div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">';
  h += '<span style="font-weight:600;font-size:15px">' + (isNew ? '✦ 新建卡片' : '✏️ 编辑卡片') + '</span>';
  h += '<button style="background:none;border:none;font-size:18px;color:var(--text-muted);cursor:pointer" onclick="closeCardForm()">✕</button>';
  h += '</div>';

  h += '<div style="padding:16px 20px">';
  // 类型选择 — chips，先选类型再填内容
  h += '<div style="margin-bottom:12px"><label style="font-size:11px;color:var(--text-sub);display:block;margin-bottom:6px">类型</label>';
  h += '<div class="card-type-grid type-grid">';
  h += '<label class="type-chip"><input type="radio" name="cfType" value="characters" onchange="onCardTypeChange()"' + (type === 'characters' ? ' checked' : '') + '><span>👤 人物</span></label>';
  h += '<label class="type-chip"><input type="radio" name="cfType" value="world" onchange="onCardTypeChange()"' + (type === 'world' ? ' checked' : '') + '><span>🌍 世界观</span></label>';
  h += '<label class="type-chip"><input type="radio" name="cfType" value="style" onchange="onCardTypeChange()"' + (type === 'style' ? ' checked' : '') + '><span>📝 文风</span></label>';
  h += '</div></div>';

  // 子类型选择（人物/世界观有子类型）
  h += '<div id="cfSubtypeRow" style="margin-bottom:12px' + (CARD_SUBTYPES[type] ? '' : ';display:none') + '"><label style="font-size:11px;color:var(--text-sub);display:block;margin-bottom:6px">子类型</label>';
  h += '<div class="type-grid">';
  if (CARD_SUBTYPES[type]) {
    Object.keys(CARD_SUBTYPES[type]).forEach(function(st) {
      var info = CARD_SUBTYPES[type][st];
      h += '<label class="type-chip"><input type="radio" name="cfSubtype" value="' + st + '" onchange="refreshCardFields()"' + (subtype === st ? ' checked' : '') + '><span>' + info.label + '</span></label>';
    });
  }
  h += '</div></div>';

  // 名称
  h += '<div style="margin-bottom:12px"><label style="font-size:11px;color:var(--text-sub);display:block;margin-bottom:4px">名称</label>';
  h += '<input id="cfName" value="' + esc(name) + '" style="width:100%;padding:6px 12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-panel);color:var(--text);font-size:13px;font-family:var(--font-ui);outline:none" placeholder="输入' + (type === 'characters' ? '人物' : '') + '名称"></div>';

  // 模板字段
  var fields = getFieldsForType(type, subtype);
  h += '<div id="cfFields" style="max-height:300px;overflow-y:auto">';
  var existing = card && card.content ? card.content : {};
  fields.forEach(function(f) {
    h += '<div style="margin-bottom:8px"><label style="font-size:11px;color:var(--text-sub);display:block;margin-bottom:3px">' + f + '</label>';
    h += '<input class="cf-field" data-key="' + esc(f) + '" value="' + esc(existing[f] || '') + '" style="width:100%;padding:5px 10px;border:1px solid var(--border-light);border-radius:var(--radius);background:var(--bg-panel);color:var(--text);font-size:12px;font-family:var(--font-ui);outline:none" placeholder="' + esc(f) + '..."></div>';
  });
  // 额外字段
  Object.keys(existing).forEach(function(k) {
    if (fields.indexOf(k) > -1) return;
    h += '<div style="margin-bottom:8px"><label style="font-size:11px;color:var(--text-sub);display:block;margin-bottom:3px">' + esc(k) + '</label>';
    h += '<input class="cf-field" data-key="' + esc(k) + '" value="' + esc(existing[k] || '') + '" style="width:100%;padding:5px 10px;border:1px solid var(--border-light);border-radius:var(--radius);background:var(--bg-panel);color:var(--text);font-size:12px;font-family:var(--font-ui);outline:none"></div>';
  });
  h += '<button style="width:100%;padding:5px;border:1px dashed var(--border);border-radius:var(--radius);background:transparent;color:var(--text-muted);font-size:11px;cursor:pointer" onclick="addCardField()">+ 添加字段</button>';
  h += '</div>';

  // 人物卡片：relationships 编辑入口
  if (type === 'characters') {
    var existingRels = (card && card.relationships) ? card.relationships : [];
    h += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    h += '<label style="font-size:11px;font-weight:600;color:var(--text)">🕸 人物关系</label>';
    h += '<button style="font-size:11px;padding:3px 8px;border:1px dashed var(--border);border-radius:var(--radius);background:transparent;color:var(--text-muted);cursor:pointer" onclick="openRelEditor()">+ 添加关系</button>';
    h += '</div>';
    h += '<div id="cfRelList"></div>';
    // 渲染现有关系（保存前暂存）
    _tempRels = existingRels.slice();
    renderTempRels();
    h += '</div>';
  }

  // 按钮
  h += '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">';
  h += '<button class="btn" onclick="closeCardForm()">取消</button>';
  h += '<button class="btn btn-primary" onclick="saveCardForm(' + (isNew ? 'null' : '\'' + card.id + '\'') + ')">' + (isNew ? '创建' : '保存') + '</button>';
  h += '</div>';

  h += '</div></div></div>';

  var div = document.createElement('div');
  div.id = 'cardFormRoot';
  div.innerHTML = h;
  document.body.appendChild(div.firstElementChild);
}

function addCardField() {
  var container = q('cfFields');
  if (!container) return;
  var div = document.createElement('div');
  div.style.cssText = 'margin-bottom:8px';
  div.innerHTML = '<input class="cf-field" data-key="" placeholder="字段名..." style="width:45%;padding:5px 10px;border:1px solid var(--border-light);border-radius:var(--radius);background:var(--bg-panel);color:var(--text);font-size:12px;font-family:var(--font-ui);outline:none;margin-right:4px"><input class="cf-field" data-val="" placeholder="值..." style="width:50%;padding:5px 10px;border:1px solid var(--border-light);border-radius:var(--radius);background:var(--bg-panel);color:var(--text);font-size:12px;font-family:var(--font-ui);outline:none">';
  container.appendChild(div);
}

function closeCardForm() {
  var el = document.querySelector('.card-form-overlay');
  if (el) el.remove();
}

var _cardTemplateFields = {
  characters: ['姓名', '性别', '年龄', '外貌', '性格', '身份', '背景'],
  world: ['名称', '类别', '描述', '规则'],
  style: ['名称', '风格描述', '关键词']
};

// ── 卡片子类型定义 ──
var CARD_SUBTYPES = {
  characters: {
    'protagonist': { label: '主角', fields: ['姓名', '性别', '年龄', '外貌', '性格', '身份', '动机', '缺陷', '成长弧', '背景'] },
    'supporting': { label: '配角', fields: ['姓名', '性别', '年龄', '外貌', '性格', '身份', '与主角关系', '功能角色'] },
    'antagonist': { label: '反派', fields: ['姓名', '性别', '年龄', '外貌', '性格', '目标', '手段', '弱点', '背景'] },
    'mentor': { label: '导师', fields: ['姓名', '性别', '年龄', '外貌', '性格', '专长', '教导方式', '与主角关系'] },
    'neutral': { label: '中立', fields: ['姓名', '性别', '年龄', '外貌', '性格', '立场', '作用'] }
  },
  world: {
    'geography': { label: '地理', fields: ['名称', '类别', '描述', '气候', '地形', '资源'] },
    'faction': { label: '势力', fields: ['名称', '类别', '描述', '目标', '资源', '领地', '关键人物'] },
    'culture': { label: '文化', fields: ['名称', '类别', '描述', '习俗', '信仰', '语言'] },
    'history': { label: '历史', fields: ['名称', '类别', '描述', '时间', '影响', '关键事件'] },
    'rule': { label: '规则', fields: ['名称', '类别', '描述', '规则', '限制', '代价'] }
  },
  style: null
};

function getSubtypeLabel(type, subtype) {
  if (!subtype || !CARD_SUBTYPES[type] || !CARD_SUBTYPES[type][subtype]) return '';
  return CARD_SUBTYPES[type][subtype].label;
}

function getFieldsForType(type, subtype) {
  if (subtype && CARD_SUBTYPES[type] && CARD_SUBTYPES[type][subtype]) {
    return CARD_SUBTYPES[type][subtype].fields;
  }
  return _cardTemplateFields[type] || [];
}

function onCardTypeChange() {
  var radio = document.querySelector('input[name="cfType"]:checked');
  var type = radio ? radio.value : 'characters';
  var subtypeRow = document.getElementById('cfSubtypeRow');
  if (subtypeRow) {
    subtypeRow.style.display = CARD_SUBTYPES[type] ? '' : 'none';
    if (CARD_SUBTYPES[type]) {
      // 重建子类型 chips
      var h = '<div class="type-grid">';
      Object.keys(CARD_SUBTYPES[type]).forEach(function(st, i) {
        var info = CARD_SUBTYPES[type][st];
        h += '<label class="type-chip"><input type="radio" name="cfSubtype" value="' + st + '" onchange="refreshCardFields()"' + (i === 0 ? ' checked' : '') + '><span>' + info.label + '</span></label>';
      });
      h += '</div>';
      var labelEl = subtypeRow.querySelector('label');
      subtypeRow.innerHTML = '<label style="font-size:11px;color:var(--text-sub);display:block;margin-bottom:6px">子类型</label>' + h;
    }
  }
  refreshCardFields();
}

function refreshCardFields() {
  var radio = document.querySelector('input[name="cfType"]:checked');
  var type = radio ? radio.value : 'characters';
  // 切换类型时清空关系
  _tempRels = [];
  var relContainer = q('cfRelList');
  if (!relContainer) return;
  relContainer.innerHTML = '';
  var saved = {};
  var el = q('cfFields');
  if (!el) return;
  var existingFields = el.querySelectorAll('.cf-field');
  existingFields.forEach(function(f) {
    var k = f.getAttribute('data-key');
    if (k) saved[k] = f.value;
  });
  // 获取当前选中的子类型
  var subRadio = document.querySelector('input[name="cfSubtype"]:checked');
  var subtype = subRadio ? subRadio.value : '';
  // 重建字段
  var fields = getFieldsForType(type, subtype);
  var h = '';
  fields.forEach(function(f) {
    h += '<div style="margin-bottom:8px"><label style="font-size:11px;color:var(--text-sub);display:block;margin-bottom:3px">' + esc(f) + '</label>';
    h += '<input class="cf-field" data-key="' + esc(f) + '" value="' + esc(saved[f] || '') + '" style="width:100%;padding:5px 10px;border:1px solid var(--border-light);border-radius:var(--radius);background:var(--bg-panel);color:var(--text);font-size:12px;font-family:var(--font-ui);outline:none" placeholder="' + esc(f) + '..."></div>';
  });
  // 保留模板外的手填字段
  Object.keys(saved).forEach(function(k) {
    if (fields.indexOf(k) > -1) return;
    h += '<div style="margin-bottom:8px"><label style="font-size:11px;color:var(--text-sub);display:block;margin-bottom:3px">' + esc(k) + '</label>';
    h += '<input class="cf-field" data-key="' + esc(k) + '" value="' + esc(saved[k] || '') + '" style="width:100%;padding:5px 10px;border:1px solid var(--border-light);border-radius:var(--radius);background:var(--bg-panel);color:var(--text);font-size:12px;font-family:var(--font-ui);outline:none"></div>';
  });
  h += '<button style="width:100%;padding:5px;border:1px dashed var(--border);border-radius:var(--radius);background:transparent;color:var(--text-muted);font-size:11px;cursor:pointer" onclick="addCardField()">+ 添加字段</button>';
  var el = q('cfFields');
  if (el) el.innerHTML = h;
}

async function saveCardForm(cardId) {
  var typeRadio = document.querySelector('input[name="cfType"]:checked');
  var type = typeRadio ? typeRadio.value : 'characters';
  var subRadio = document.querySelector('input[name="cfSubtype"]:checked');
  var subtype = subRadio ? subRadio.value : null;
  var name = q('cfName').value.trim();
  if (!name) { toast('请输入名称'); return; }

  var content = {};
  var fields = document.querySelectorAll('.cf-field');
  fields.forEach(function(f) {
    var key = f.getAttribute('data-key') || '';
    var val = f.value.trim();
    if (key && val) content[key] = val;
  });

  var body = { type: type, name: name, content: content };
  if (subtype) body.subtype = subtype;
  if (cardId) body.id = cardId;

  // 人物卡片：写入 relationships
  if (type === 'characters' && _tempRels && _tempRels.length > 0) {
    body.relationships = _tempRels;
  }

  try {
    var r = await fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/cards'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    var data = await r.json();
    if (!data.ok && data.error) throw new Error(data.error);
    closeCardForm();
    // 刷新卡片列表
    var rc = await fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/cards'));
    _cards = await rc.json();
    renderMainPanel();
    toast(cardId ? '✓ 已保存' : '✓ 已创建');
  } catch(e) { toast('❌ 保存失败: ' + (e.message || '未知错误')); }
}

// ═══════════════════════════════════
//  人物关系编辑
// ═══════════════════════════════════
var _tempRels = [];
var REL_PRESETS = [
  { type: 'friend', label: '朋友', icon: '🤝', color: '#059669' },
  { type: 'rival', label: '对手', icon: '⚔️', color: '#dc2626' },
  { type: 'enemy', label: '敌人', icon: '💀', color: '#991b1b' },
  { type: 'romance', label: '恋人', icon: '💕', color: '#db2777' },
  { type: 'alliance', label: '盟友', icon: '🤝', color: '#2563eb' },
  { type: 'rivalry', label: '竞争', icon: '🏆', color: '#d97706' },
  { type: 'family', label: '亲属', icon: '👨‍👩‍👧', color: '#7c3aed' },
  { type: 'mentor', label: '师徒', icon: '📖', color: '#0891b2' },
  { type: 'unknown', label: '未知', icon: '❓', color: '#6b7280' },
];
var _selectedRelType = 'unknown';

function renderTempRels() {
  var container = q('cfRelList');
  if (!container) return;
  if (_tempRels.length === 0) {
    container.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:4px 0">暂无关系，点击「+ 添加关系」开始</div>';
    return;
  }
  var h = '';
  _tempRels.forEach(function(rel, i) {
    var preset = REL_PRESETS.find(function(p) { return p.type === rel.type; });
    var icon = preset ? preset.icon : '🔗';
    var color = preset ? preset.color : '#6b7280';
    h += '<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;margin-bottom:4px;background:var(--bg-panel);border-radius:var(--radius);font-size:12px">';
    h += '<span style="min-width:20px">' + icon + '</span>';
    h += '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:' + color + '">' + esc(rel.targetName) + '</span>';
    h += '<span style="color:var(--text-muted);font-size:11px">' + esc(rel.description || rel.type) + '</span>';
    h += '<button style="font-size:10px;padding:1px 6px;border:none;background:transparent;color:var(--text-muted);cursor:pointer" onclick="removeRel(' + i + ')">✕</button>';
    h += '</div>';
  });
  container.innerHTML = h;
}

function openRelEditor() {
  if (!_cards || !_cards.length) { toast('暂无其他角色可添加关系'); return; }
  var charCards = _cards.filter(function(c) { return c.type === 'characters'; });
  var h = '<div class="card-form-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.3);backdrop-filter:blur(2px);z-index:210;display:flex;align-items:center;justify-content:center" onclick="event.target===this&&closeRelEditor()">';
  h += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--rm);width:340px;max-height:70vh;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,.15)">';
  h += '<div style="padding:12px 16px;border-bottom:1px solid var(--border);font-weight:600;font-size:14px">添加人物关系</div>';
  h += '<div style="padding:12px 16px">';
  h += '<div style="margin-bottom:10px"><label style="font-size:11px;color:var(--text-sub);display:block;margin-bottom:4px">目标角色</label>';
  h += '<select id="relTarget" style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-panel);color:var(--text);font-size:12px">';
  charCards.forEach(function(c) { h += '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>'; });
  h += '</select></div>';
  h += '<div style="margin-bottom:10px"><label style="font-size:11px;color:var(--text-sub);display:block;margin-bottom:4px">关系类型</label>';
  h += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
  REL_PRESETS.forEach(function(p) {
    h += '<button class="rel-preset-btn" data-type="' + esc(p.type) + '" onclick="selectRelPreset(this)" style="padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-panel);color:var(--text);font-size:11px;cursor:pointer;display:flex;align-items:center;gap:3px">' + p.icon + ' ' + p.label + '</button>';
  });
  h += '</div></div>';
  h += '<div style="margin-bottom:10px"><label style="font-size:11px;color:var(--text-sub);display:block;margin-bottom:4px">描述（可选）</label>';
  h += '<input id="relDesc" placeholder="如：同窗、救命恩人..." style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-panel);color:var(--text);font-size:12px"></div>';
  h += '<div style="display:flex;gap:8px;justify-content:flex-end;padding-top:8px">';
  h += '<button class="btn" onclick="closeRelEditor()" style="font-size:12px">取消</button>';
  h += '<button class="btn btn-primary" onclick="addTempRel()" style="font-size:12px">添加</button>';
  h += '</div></div></div></div>';
  var div = document.createElement('div');
  div.innerHTML = h;
  document.body.appendChild(div.firstElementChild);
  _selectedRelType = 'unknown';
}

function selectRelPreset(btn) {
  _selectedRelType = btn.getAttribute('data-type');
  var allBtns = document.querySelectorAll('.rel-preset-btn');
  allBtns.forEach(function(b) { b.style.borderColor = 'var(--border)'; b.style.background = 'var(--bg-panel)'; });
  btn.style.borderColor = 'var(--accent)';
  btn.style.background = 'var(--accent-bg)';
}

function addTempRel() {
  var target = q('relTarget')?.value;
  if (!target) { toast('请选择目标角色'); return; }
  var desc = (q('relDesc')?.value || '').trim();
  for (var i = 0; i < _tempRels.length; i++) {
    if (_tempRels[i].targetName === target) {
      _tempRels[i].type = _selectedRelType;
      _tempRels[i].description = desc;
      renderTempRels();
      closeRelEditor();
      toast('✓ 已更新关系');
      return;
    }
  }
  _tempRels.push({
    targetName: target,
    type: _selectedRelType,
    description: desc,
    dynamic: '',
  });
  renderTempRels();
  closeRelEditor();
  toast('✓ 已添加关系');
}

function removeRel(i) {
  _tempRels.splice(i, 1);
  renderTempRels();
}

function closeRelEditor() {
  var overlays = document.querySelectorAll('.card-form-overlay');
  for (var i = overlays.length - 1; i >= 0; i--) {
    var o = overlays[i];
    if (o.style.zIndex === '210' || o.getAttribute('style').indexOf('zIndex: 210') >= 0 || o.querySelector('[style*="z-index: 210"]')) {
      o.remove();
      break;
    }
  }
}

function showInlinePrompt(label, defaultValue, callback) {
  var existing = q('inline-prompt');
  if (existing) existing.remove();
  var h = '<div id="inline-prompt" class="card-detail-popup fade-in" style="max-width:360px;margin:16px auto;padding:16px">';
  h += '<div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:8px">' + esc(label) + '</div>';
  h += '<div style="display:flex;gap:6px">';
  h += '<input id="inline-prompt-input" type="text" value="' + esc(defaultValue || '') + '" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-panel);color:var(--text);font-size:12px;font-family:var(--font-ui);outline:none">';
  h += '<button class="btn btn-primary" style="font-size:11px" onclick="confirmInlinePrompt()">确定</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px" onclick="cancelInlinePrompt()">取消</button>';
  h += '</div></div>';
  document.querySelector('.panel-body').insertAdjacentHTML('afterbegin', h);
  __inlinePromptCb = callback;
  setTimeout(function() { var i = q('inline-prompt-input'); if (i) i.focus(); }, 50);
}

function confirmInlinePrompt() {
  var inp = q('inline-prompt-input');
  var cb = __inlinePromptCb;
  q('inline-prompt').remove();
  if (inp && inp.value.trim() && cb) { cb(inp.value.trim()); }
}

function cancelInlinePrompt() {
  q('inline-prompt').remove();
}

function changeChapterVolume(chId, vol) {
  if (vol === '__new__') {
    showInlinePrompt('新卷名称：', '', function(newVol) {
      saveChapterVolume(chId, newVol);
    });
    return;
  }
  saveChapterVolume(chId, vol || null);
}

function addFact() {
  if (!_currentProject) return;
  showInlinePrompt('事实内容（如：雾港是自由贸易港）：', '', function(content) {
    if (!content) return;
    // 第二次弹窗：选择类型
    var typeLabels = ['👤 人物=character_trait', '🌍 世界=world_lore', '📖 情节=plot_event', '🔗 关系=relationship', '⏱ 时间=timeline', '📋 规则=rule'];
    var typeInput = '类型（输入任意一个）：\n' + typeLabels.join('\n');
    showInlinePrompt(typeInput, 'world_lore', function(type) {
      var validTypes = ['character_trait','world_lore','plot_event','relationship','timeline','rule'];
      if (validTypes.indexOf(type) === -1) type = 'world_lore';
      var p = _currentProject;
      fetch(tu(A + '/api/project/' + encodeURIComponent(p.id) + '/facts'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: type, content: content })
      }).then(function(r) { return r.json(); }).then(function() {
        toast('✅ 事实已添加');
        openDashboard(p.id);
      }).catch(function(e) { toast('❌ 添加失败: ' + (e.message || '')); });
    });
  });
}

function saveChapterVolume(chId, vol) {
  if (!_currentProject) return;
  var ch = _chapters.find(function(c) { return c.id === chId; });
  if (!ch) return;
  ch.volume = vol || null;
  fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/chapters'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: chId, title: ch.title, content: ch.body, volume: vol })
  }).then(function(r) { return r.json(); }).then(function() {
    renderMainPanel();
    toast('✅ 已移至' + (vol ? '「' + vol + '」' : '未分卷'));
  }).catch(function() { toast('❌ 设置失败'); });
}

async function addChapter() {
  if (!_currentProject) return;
  showInlinePrompt('章节标题：', '新章节', function(name) {
    var p = _currentProject;
    fetch(tu(A + '/api/project/' + encodeURIComponent(p.id) + '/chapters'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: name, content: '' })
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (!data.ok && data.error) throw new Error(data.error);
      return fetch(tu(A + '/api/project/' + encodeURIComponent(p.id) + '/chapters')).then(function(r) { return r.json(); });
    }).then(function(chapters) {
      _chapters = chapters;
      renderMainPanel();
      toast('✅ ' + name + ' 已创建');
    }).catch(function(e) { toast('❌ 创建失败: ' + (e.message || '未知错误')); });
  });
}

function runAnalysis() {
  var ch = _currentChapter;
  if (!ch || !ch.body) { toast('⚠️ 章节无内容'); return; }
  var body = ch.body;

  // Hook 检测
  var hooksFound = [];
  HOOKS.forEach(function(h) {
    if (h[1].test(body)) hooksFound.push(h[0]);
  });

  // AI 味检测
  var aiFound = [];
  var totalAiHits = 0;
  AI_BAD.forEach(function(a) {
    var m = body.match(a[1]);
    if (m) { aiFound.push({ type: a[0], count: m.length, eg: m[0] }); totalAiHits += m.length; }
  });
  var words = body.replace(/\s/g, '').length;
  var density = words > 0 ? (totalAiHits / words * 1000).toFixed(1) : '0';

  // 渲染结果面板
  var existing = q('analysis-panel');
  if (existing) existing.remove();

  var h = '<div id="analysis-panel" class="card-detail-popup fade-in" style="max-width:720px;margin:16px auto">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  h += '<span style="font-weight:600;color:var(--text)">🔍 篇章分析</span>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:2px 8px" onclick="q(\'analysis-panel\').remove()">✕ 关闭</button>';
  h += '</div>';
  // Tab 切换
  h += '<div style="display:flex;gap:4px;margin-bottom:12px" id="analysis-tabs">';
  h += '<button class="btn btn-sm active" onclick="switchAnalysisTab(\'overview\',this)" style="font-size:11px;padding:3px 10px">📊 概览</button>';
  h += '<button class="btn btn-sm" onclick="switchAnalysisTab(\'hook\',this)" style="font-size:11px;padding:3px 10px">📎 钩子</button>';
  h += '<button class="btn btn-sm" onclick="switchAnalysisTab(\'ai\',this)" style="font-size:11px;padding:3px 10px">⚠️ AI味</button>';
  h += '<button class="btn btn-sm" onclick="switchAnalysisTab(\'style\',this)" style="font-size:11px;padding:3px 10px">🎨 文风</button>';
  h += '<button class="btn btn-sm" onclick="switchAnalysisTab(\'cross\',this)" style="font-size:11px;padding:3px 10px">🔗 交叉验证</button>';
  h += '</div>';
  h += '<div id="analysis-content">';
  h += '</div>';

  // 统计
  h += '<div style="display:flex;gap:16px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border-light)" id="tab-overview">';
  h += '<span style="font-size:12px">总字数 <b>' + words + '</b></span>';
  h += '<span style="font-size:12px;color:' + (hooksFound.length > 0 ? 'var(--success)' : 'var(--text-muted)') + '">悬念钩子 <b>' + hooksFound.length + '</b></span>';
  h += '<span style="font-size:12px;color:' + (parseFloat(density) > 2 ? 'var(--danger)' : 'var(--success)') + '">AI味密度 <b>' + density + '‰</b></span>';
  h += '</div>';

  // 悬念
  h += '<div id="tab-hook" style="display:none">';
  if (hooksFound.length > 0) {
    h += '<div style="margin-bottom:10px"><span style="font-size:11px;font-weight:600;color:var(--success)">📎 检测到悬念钩子</span></div>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">';
    hooksFound.forEach(function(hk) { h += '<span class="tag" style="border-color:#059669;color:#059669;font-size:11px">' + esc(hk) + '</span>'; });
    h += '</div>';
  } else {
    h += '<div style="margin-bottom:12px;font-size:11px;color:var(--text-muted)">📎 未检测到明显悬念钩子</div>';
  }
  h += '</div>';

  // AI味
  h += '<div id="tab-ai" style="display:none">';
  if (aiFound.length > 0) {
    h += '<div style="margin-bottom:10px"><span style="font-size:11px;font-weight:600;color:var(--danger)">⚠️ AI写作痕迹</span></div>';
    aiFound.forEach(function(a) {
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:11px">';
      h += '<span style="color:var(--text);min-width:70px">' + esc(a.type) + '</span>';
      h += '<span style="color:var(--text-muted)">×' + a.count + '</span>';
      h += '<span style="color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(a.eg) + '</span>';
      h += '</div>';
    });
  } else {
    h += '<div style="font-size:11px;color:var(--success)">✅ 未检测到明显AI写作痕迹</div>';
  }
  h += '</div>';

  // 文风
  h += '<div id="tab-style" style="display:none">';
  h += '<div style="font-size:11px;color:var(--text-muted);padding:20px;text-align:center">加载中...</div>';
  h += '</div>';

  // 交叉验证
  h += '<div id="tab-cross" style="display:none">';
  h += '<div style="font-size:11px;color:var(--text-muted);padding:20px;text-align:center">点击此页加载交叉验证...</div>';
  h += '</div>';

  h += '</div>'; // close analysis-content

  // 插入到编辑器后面
  var wrap = document.querySelector('.editor-wrap');
  if (wrap) { wrap.insertAdjacentHTML('afterend', h); }

  // 默认显示概览 tab
  switchAnalysisTab('overview', document.querySelector('#analysis-tabs .btn.active'));

  toast('🔍 分析完成');
}

function switchAnalysisTab(tab, btn) {
  // Tab 按钮切换
  var btns = document.querySelectorAll('#analysis-tabs .btn');
  btns.forEach(function(b) { b.style.background = 'transparent'; b.style.color = 'var(--text-muted)'; b.classList.remove('active'); });
  if (btn) { btn.style.background = 'var(--accent)'; btn.style.color = '#fff'; btn.classList.add('active'); }
  // 内容切换
  var contents = ['tab-overview', 'tab-hook', 'tab-ai', 'tab-style', 'tab-cross'];
  contents.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = (id === 'tab-' + tab) ? '' : 'none';
  });
  // 文风 tab 懒加载
  if (tab === 'style' && !document.getElementById('tab-style').getAttribute('data-loaded')) {
    loadStyleAnalysis();
  }
  // 交叉验证 tab 懒加载
  if (tab === 'cross' && !document.getElementById('tab-cross').getAttribute('data-loaded')) {
    loadCrossValidate();
  }
}

function loadStyleAnalysis() {
  var el = document.getElementById('tab-style');
  if (!el || !_currentChapter) return;
  fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/analyze'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'style_analysis', projectId: _currentProject.id })
  })
    .then(function(r) { return r.json(); })
    .then(function(j) {
      el.removeAttribute('data-loaded');
      if (j.ok && j.results && j.results.length > 0) {
        var sa = j.results[0].styleAnalysis;
        if (!sa) { el.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:10px">暂无文风数据</div>'; return; }
        var scoreColor = sa.styleScore >= 60 ? 'var(--success)' : sa.styleScore >= 35 ? 'var(--accent)' : 'var(--danger)';
        var h = '<div style="font-size:12px">';
        // 风格分数
        h += '<div style="margin-bottom:12px"><span style="font-size:11px;color:var(--text-sub);display:block;margin-bottom:4px">个人风格指数</span>';
        h += '<div style="display:flex;align-items:center;gap:8px">';
        h += '<div style="flex:1;height:8px;background:var(--bg-panel);border-radius:4px;overflow:hidden">';
        h += '<div style="width:' + sa.styleScore + '%;height:100%;background:' + scoreColor + ';border-radius:4px"></div>';
        h += '</div><span style="font-size:18px;font-weight:700;color:' + scoreColor + '">' + sa.styleScore + '</span></div></div>';
        // 句子
        h += '<div style="display:flex;gap:12px;margin-bottom:10px"><span style="font-size:11px">句均 <b>' + sa.avgSentenceLength + '</b> 字</span>';
        h += '<span style="font-size:11px">短句 <b>' + sa.shortSentenceRatio + '</b></span>';
        h += '<span style="font-size:11px">长句 <b>' + sa.longSentenceRatio + '</b></span></div>';
        // 词汇多样性
        h += '<div style="font-size:11px;margin-bottom:10px">词汇多样性（TTR）<b style="color:var(--accent)";>' + sa.typeTokenRatio + '</b></div>';
        // 高频词
        if (sa.topWords && sa.topWords.length > 0) {
          h += '<div style="margin-bottom:8px"><span style="font-size:11px;font-weight:600">高频词</span></div>';
          h += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
          sa.topWords.forEach(function(w) { h += '<span class="tag" style="font-size:11px">' + esc(w.word) + ' ×' + w.count + '</span>'; });
          h += '</div>';
        }
        // 修辞和连接词
        h += '<div style="font-size:11px;margin-top:8px;color:var(--text-muted)">比喻密度 <b>' + sa.metaphorDensity + '</b> | 连接词密度 <b>' + sa.connectorDensity + '</b></div>';
        h += '</div>';
        el.innerHTML = h;
      } else {
        el.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:10px">暂无文风数据</div>';
      }
    })
    .catch(function(e) { el.innerHTML = '<div style="font-size:11px;color:var(--danger);padding:10px">❌ 加载失败: ' + (e.message || '') + '</div>'; });
}

function loadCrossValidate() {
  var el = document.getElementById('tab-cross');
  if (!el || !_currentProject) return;
  el.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:20px;text-align:center">⏳ 交叉验证中...</div>';
  fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/cross-validate'))
    .then(function(r) { return r.json(); })
    .then(function(cv) {
      el.setAttribute('data-loaded', '1');
      if (cv.error) { el.innerHTML = '<div style="font-size:11px;color:var(--danger);padding:10px">❌ ' + esc(cv.error) + '</div>'; return; }
      var total = cv.totalIssues || 0;
      var h = '<div style="font-size:12px">';
      // 总览
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:8px 12px;background:var(--bg-panel);border-radius:var(--r)">';
      h += '<span style="font-size:18px;font-weight:700;color:' + (total > 0 ? 'var(--accent)' : 'var(--success)') + '">' + total + '</span>';
      h += '<span style="font-size:11px;color:var(--text-muted)">个问题</span>';
      h += '</div>';
      // 人物设定冲突
      if (cv.characterConflicts && cv.characterConflicts.length > 0) {
        h += '<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:600;color:var(--danger);margin-bottom:6px">👤 人物设定冲突 (' + cv.characterConflicts.length + ')</div>';
        cv.characterConflicts.forEach(function(c) {
          h += '<div style="padding:6px 8px;border-left:2px solid var(--danger);margin-bottom:4px;font-size:11px">';
          h += '<b>' + esc(c.character) + '</b> — ' + esc(c.trait) + ': ' + esc(c.expected);
          h += '<div style="color:var(--text-muted);margin-top:2px">→ ' + esc(c.found) + '</div>';
          h += '</div>';
        });
        h += '</div>';
      }
      // 时间线断层
      if (cv.timelineGaps && cv.timelineGaps.length > 0) {
        h += '<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:600;color:var(--warm);margin-bottom:6px">⏱ 时间线断层 (' + cv.timelineGaps.length + ')</div>';
        cv.timelineGaps.forEach(function(g) {
          h += '<div style="padding:6px 8px;border-left:2px solid var(--warm);margin-bottom:4px;font-size:11px">';
          h += esc(g.from) + ' → ' + esc(g.to);
          h += '<span style="color:var(--text-muted);margin-left:6px">间隔 ' + esc(g.gap) + '</span>';
          h += '</div>';
        });
        h += '</div>';
      }
      // 伏笔未回收
      if (cv.unrecoveredChekhovs && cv.unrecoveredChekhovs.length > 0) {
        h += '<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:600;color:var(--accent);margin-bottom:6px">🔫 伏笔未回收 (' + cv.unrecoveredChekhovs.length + ')</div>';
        cv.unrecoveredChekhovs.forEach(function(c) {
          h += '<div style="padding:6px 8px;border-left:2px solid var(--accent);margin-bottom:4px;font-size:11px">';
          h += esc(c.event);
          h += '<span style="color:var(--text-muted);margin-left:6px">@ ' + esc(c.chapter) + '</span>';
          h += '</div>';
        });
        h += '</div>';
      }
      // 设定矛盾
      if (cv.settingConflicts && cv.settingConflicts.length > 0) {
        h += '<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:600;color:var(--danger);margin-bottom:6px">🌍 设定矛盾 (' + cv.settingConflicts.length + ')</div>';
        cv.settingConflicts.forEach(function(c) {
          h += '<div style="padding:6px 8px;border-left:2px solid var(--danger);margin-bottom:4px;font-size:11px">';
          h += '<b>' + esc(c.card1) + '</b> vs <b>' + esc(c.card2) + '</b> (' + esc(c.field) + ')';
          h += '<div style="color:var(--text-muted);margin-top:2px">' + esc(c.val1) + ' ≠ ' + esc(c.val2) + '</div>';
          h += '</div>';
        });
        h += '</div>';
      }
      // 信息泄露
      if (cv.infoLeakage && cv.infoLeakage.length > 0) {
        h += '<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:600;color:var(--warm);margin-bottom:6px">💬 信息泄露 (' + cv.infoLeakage.length + ')</div>';
        cv.infoLeakage.forEach(function(l) {
          h += '<div style="padding:6px 8px;border-left:2px solid var(--warm);margin-bottom:4px;font-size:11px">';
          h += '<b>' + esc(l.character) + '</b> @ ' + esc(l.chapterTitle || l.chapter);
          h += '<div style="color:var(--text-muted);margin-top:2px">“' + esc(l.speech) + '”</div>';
          h += '<div style="color:var(--accent);margin-top:1px">泄露: ' + esc(l.leakedInfo) + '</div>';
          h += '</div>';
        });
        h += '</div>';
      }
      // 道具状态
      if (cv.propertyStateGaps && cv.propertyStateGaps.length > 0) {
        h += '<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:600;color:var(--warm);margin-bottom:6px">inventory 道具状态异常 (' + cv.propertyStateGaps.length + ')</div>';
        cv.propertyStateGaps.forEach(function(g) {
          h += '<div style="padding:6px 8px;border-left:2px solid var(--warm);margin-bottom:4px;font-size:11px">';
          h += '<b>' + esc(g.item) + '</b> (' + esc(g.status) + ')';
          h += '<div style="color:var(--text-muted);margin-top:2px">在 ' + esc(g.chapterTitle || g.foundIn) + ' 中出现但未回收</div>';
          h += '</div>';
        });
        h += '</div>';
      }
      // 无问题
      if (total === 0) {
        h += '<div style="text-align:center;padding:20px;font-size:12px;color:var(--success)">✅ 未发现问题</div>';
      }
      h += '</div>';
      el.innerHTML = h;
    })
    .catch(function(e) { el.innerHTML = '<div style="font-size:11px;color:var(--danger);padding:10px">❌ 加载失败: ' + (e.message || '') + '</div>'; });
}

var _plotThreads = null;

function togglePlotPanel() {
  var panel = document.getElementById('plot-panel');
  if (!panel) return;
  if (panel.style.display === 'none') {
    panel.style.display = '';
    loadPlotThreads();
  } else {
    panel.style.display = 'none';
  }
}

var PLOT_TYPES = {
  chekhovs_gun: '契诃夫之枪', prophecy: '预言', symbol: '象征', character_thread: '角色伏线',
  dialogue_hint: '对话暗示', mcguffin: '麦格芬', foreshadow: '前兆', red_herring: '红鲱鱼',
  cliffhanger: '悬念钩', mystery: '谜团'
};
var PLOT_STATUS = { planned: '计划', planted: '埋设', echoed: '呼应', resolved: '回收' };
var PLOT_STATUS_COLORS = { planned: 'var(--text-muted)', planted: 'var(--accent)', echoed: 'var(--warm)', resolved: 'var(--success)' };
var PLOT_FLOW = ['planned', 'planted', 'echoed', 'resolved'];

function loadPlotThreads() {
  if (!_currentProject) return;
  fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/plot-threads'))
    .then(function(r) { return r.json(); })
    .then(function(threads) {
      _plotThreads = threads || [];
      renderPlotPanel();
    })
    .catch(function() {
      document.getElementById('plotContent').innerHTML = '<div style="color:var(--danger)">❌ 加载失败</div>';
    });
}

function renderPlotPanel() {
  var el = document.getElementById('plotContent');
  if (!el) return;
  var threads = _plotThreads || [];
  var h = '';
  // 统计
  var stats = {};
  PLOT_FLOW.forEach(function(s) { stats[s] = 0; });
  threads.forEach(function(t) { if (stats[t.status] !== undefined) stats[t.status]++; });
  h += '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">';
  PLOT_FLOW.forEach(function(s) {
    h += '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:var(--bg-panel);color:' + (PLOT_STATUS_COLORS[s] || '') + '">' + PLOT_STATUS[s] + ' ×' + (stats[s]||0) + '</span>';
  });
  h += '<button class="btn btn-ghost" style="font-size:10px;padding:2px 8px;margin-left:auto;color:var(--accent)" onclick="addPlotThread()">+ 新伏笔</button>';
  h += '</div>';
  // 列表
  if (threads.length === 0) {
    h += '<div style="text-align:center;padding:16px;color:var(--text-muted)">暂无伏笔，点击「新伏笔」创建</div>';
  } else {
    threads.forEach(function(t) {
      var sColor = PLOT_STATUS_COLORS[t.status] || 'var(--text-muted)';
      var sIdx = PLOT_FLOW.indexOf(t.status);
      var canAdvance = sIdx >= 0 && sIdx < PLOT_FLOW.length - 1;
      h += '<div style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--r);margin-bottom:4px;background:var(--bg-panel);border-left:2px solid ' + sColor + '">';
      h += '<div style="display:flex;align-items:center;gap:6px">';
      h += '<span style="font-weight:500;font-size:12px;color:var(--text)">' + esc(t.title) + '</span>';
      h += '<span style="font-size:9px;color:var(--text-muted)">' + (PLOT_TYPES[t.type] || t.type) + '</span>';
      h += '<span style="font-size:9px;font-weight:600;color:' + sColor + ';margin-left:auto">' + PLOT_STATUS[t.status] + '</span>';
      if (canAdvance) h += '<button class="btn btn-ghost" style="font-size:9px;padding:1px 6px;color:var(--accent)" onclick="advancePlot(\'' + t.id + '\')" title="推进状态">→</button>';
      h += '<button class="btn btn-ghost" style="font-size:9px;padding:1px 4px" onclick="editPlotThread(\'' + t.id + '\')" title="编辑">✏️</button>';
      h += '<button class="btn btn-ghost" style="font-size:9px;padding:1px 4px;color:var(--danger)" onclick="deletePlotThread(\'' + t.id + '\')" title="删除">🗑</button>';
      h += '</div>';
      if (t.description) h += '<div style="font-size:10px;color:var(--text-sub);margin-top:3px">' + esc(t.description) + '</div>';
      if (t.plantedChapter) h += '<div style="font-size:9px;color:var(--text-muted);margin-top:2px">埋设 @ ' + esc(t.plantedChapter) + '</div>';
      h += '</div>';
    });
  }
  el.innerHTML = h;
}

function addPlotThread() {
  if (!_currentProject) return;
  var body = { title: '新伏笔', type: 'chekhovs_gun', status: 'planned', description: '' };
  fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/plot-threads'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.ok && d.thread) { _plotThreads.push(d.thread); renderPlotPanel(); toast('✓ 伏笔已创建'); }
  });
}

function advancePlot(id) {
  fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/plot-threads'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _advance: true, id: id })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.ok && d.thread) {
      var idx = _plotThreads.findIndex(function(t) { return t.id === id; });
      if (idx >= 0) _plotThreads[idx] = d.thread;
      renderPlotPanel();
      toast('→ ' + PLOT_STATUS[d.thread.status]);
    }
  });
}

function editPlotThread(id) {
  var t = _plotThreads.find(function(x) { return x.id === id; });
  if (!t) return;
  var overlay = document.createElement('div');
  overlay.className = 'card-form-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.3);backdrop-filter:blur(2px);z-index:200;display:flex;align-items:center;justify-content:center';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  var panel = document.createElement('div');
  panel.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:var(--rm);width:400px;max-height:80vh;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,.15);padding:16px';
  panel.onclick = function(e) { e.stopPropagation(); };
  var h = '<div style="font-weight:600;font-size:14px;margin-bottom:10px">✏️ 编辑伏笔</div>';
  h += '<input id="ptTitle" value="' + esc(t.title||'') + '" placeholder="伏笔标题" style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:var(--r);margin-bottom:8px;font-size:13px;background:var(--bg-panel)">';
  // 类型选择
  h += '<label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:4px">类型</label>';
  h += '<select id="ptType" style="width:100%;padding:5px 10px;border:1px solid var(--border);border-radius:var(--r);margin-bottom:8px;font-size:12px;background:var(--bg-panel)">';
  Object.keys(PLOT_TYPES).forEach(function(k) { h += '<option value="' + k + '"' + (t.type===k?' selected':'') + '>' + PLOT_TYPES[k] + '</option>'; });
  h += '</select>';
  // 状态选择
  h += '<label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:4px">状态</label>';
  h += '<select id="ptStatus" style="width:100%;padding:5px 10px;border:1px solid var(--border);border-radius:var(--r);margin-bottom:8px;font-size:12px;background:var(--bg-panel)">';
  Object.keys(PLOT_STATUS).forEach(function(k) { h += '<option value="' + k + '"' + (t.status===k?' selected':'') + '>' + PLOT_STATUS[k] + '</option>'; });
  h += '</select>';
  h += '<textarea id="ptDesc" placeholder="描述..." style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:var(--r);margin-bottom:8px;font-size:12px;min-height:50px;resize:vertical;background:var(--bg-panel)">' + esc(t.description||'') + '</textarea>';
  h += '<input id="ptPlanted" value="' + esc(t.plantedChapter||'') + '" placeholder="埋设章节 ID" style="width:100%;padding:5px 10px;border:1px solid var(--border);border-radius:var(--r);margin-bottom:10px;font-size:11px;background:var(--bg-panel)">';
  h += '<div style="display:flex;gap:8px;justify-content:flex-end">';
  h += '<button class="btn" onclick="this.closest(\'.card-form-overlay\').remove()">取消</button>';
  h += '<button class="btn btn-primary" onclick="var id=\'' + t.id + '\';var body={id:id,title:document.getElementById(\'ptTitle\').value,type:document.getElementById(\'ptType\').value,status:document.getElementById(\'ptStatus\').value,description:document.getElementById(\'ptDesc\').value,plantedChapter:document.getElementById(\'ptPlanted\').value};fetch(tu(A+\'/api/project/\'+encodeURIComponent(_currentProject.id)+\'/plot-threads\'),{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify(body)}).then(function(r){return r.json()}).then(function(d){if(d.ok){var i=_plotThreads.findIndex(function(t){return t.id===id});if(i>=0)_plotThreads[i]=d.thread;renderPlotPanel();toast(\'✓ 已保存\')}});this.closest(\'.card-form-overlay\').remove()">保存</button>';
  h += '</div>';
  panel.innerHTML = h;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

function deletePlotThread(id) {
  showConfirmDialog('确定删除此伏笔？', function() {
    fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/plot-threads'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _delete: true, id: id })
    }).then(function(r) { return r.json(); }).then(function(d) {
      if (d.ok) { _plotThreads = _plotThreads.filter(function(t) { return t.id !== id; }); renderPlotPanel(); toast('✓ 已删除'); }
    });
  });
}

function exportProject(format) {
  if (!_currentProject) { toast('请先选择项目'); return; }
  if (format === 'txt') {
    // 导出 TXT：拼接所有章节
    fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/chapters'))
      .then(function(r) { return r.json(); })
      .then(function(chapters) {
        var txt = (_currentProject.name || '墨述') + '\n\n';
        chapters.forEach(function(ch, i) {
          txt += '第' + (i + 1) + '章 ' + (ch.title || '') + '\n\n';
          var body = ch.body || ch.content || '';
          // 剥离 frontmatter
          body = body.replace(/^---[\s\S]*?---\s*/g, '');
          txt += body + '\n\n';
        });
        var blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (_currentProject.name || 'export') + '.txt';
        a.click();
        URL.revokeObjectURL(a.href);
        toast('📄 TXT 已下载');
      })
      .catch(function() { toast('❌ 导出失败'); });
  } else if (format === 'epub') {
    // 导出 HTML（EPUB 按钮实际调用沉浸式档案导出）
    var url = tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/export/epub');
    toast('⏳ 导出中...');
    fetch(url).then(function(r) { return r.json(); }).then(function(d) {
      if (d.ok) toast('✅ 已导出到 ' + d.file);
      else toast('❌ ' + (d.error || '导出失败'));
    }).catch(function() { toast('❌ 导出失败'); });
  }
}

var _writingGraphLoaded = false;

function toggleGraphPanel() {
  var panel = document.getElementById('graph-panel');
  if (!panel) return;
  if (panel.style.display === 'none') {
    panel.style.display = '';
    renderWritingGraph();
  } else {
    panel.style.display = 'none';
    var c = document.getElementById('writingGraphContainer');
    if (c && c._graph) { c._graph.destroy(); c._graph = null; }
  }
}

function renderWritingGraph() {
  var container = document.getElementById('writingGraphContainer');
  if (!container || !_currentProject) return;

  // 构建图谱元素
  var els = [];
  var charNames = {};
  var charPalette = ['#AA5E43', '#8B6914', '#7A9B6D', '#B91C1C', '#6F6A60', '#7C3AED', '#DB8F2F', '#2FDB6F'];
  var charIdx = 0;

  // 人物节点
  if (_cards) _cards.forEach(function(c) {
    if (c.type === 'characters' && c.name) {
      charNames[c.name] = true;
      var color = charPalette[charIdx++ % charPalette.length];
      els.push({ data: { id: 'ch_' + c.name, label: c.name, type: 'character', _color: color } });
    }
  });

  // 地点节点
  if (_markers) _markers.forEach(function(m) {
    if (m.name) els.push({ data: { id: 'loc_' + m.name, label: m.name, type: 'location' } });
  });

  // 设定节点
  if (_cards) _cards.forEach(function(c) {
    if (c.type === 'world' && c.name) {
      els.push({ data: { id: 'set_' + c.name, label: c.name, type: 'setting' } });
    }
  });

  // 关系边：从人物卡 relationships
  if (_cards) _cards.forEach(function(c) {
    if (c.type === 'characters' && c.relationships) {
      c.relationships.forEach(function(rel) {
        if (rel.target && charNames[rel.target]) {
          els.push({ data: { id: 'rel_' + c.name + '_' + rel.target, source: 'ch_' + c.name, target: 'ch_' + rel.target, label: rel.type || '关系', count: 1 } });
        }
      });
    }
  });

  // 关系边：从 facts
  if (_facts) _facts.forEach(function(f) {
    if (f.type === 'relationship' && f.content && !f.deprecated_at) {
      var found = [];
      Object.keys(charNames).forEach(function(name) {
        if (f.content.indexOf(name) > -1) found.push(name);
      });
      if (found.length >= 2) {
        els.push({ data: { id: 'rel_' + f.id, source: 'ch_' + found[0], target: 'ch_' + found[1], label: '关系', count: 1 } });
      }
    }
  });

  if (els.length === 0) {
    container.innerHTML = '<div class="empty-state" style="height:200px"><div class="title" style="font-size:12px">暂无关系数据</div><div class="desc" style="font-size:11px">添加人物卡和关系后自动生成</div></div>';
    return;
  }

  // 加载 Cytoscape 并渲染
  if (!window.cytoscape) {
    var script = document.createElement('script');
    script.src = 'https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js';
    script.onload = function() { _writingGraphLoaded = true; doRenderWritingGraph(els); };
    document.head.appendChild(script);
  } else {
    _writingGraphLoaded = true;
    doRenderWritingGraph(els);
  }
}

function doRenderWritingGraph(els) {
  var container = document.getElementById('writingGraphContainer');
  if (!container || !window.cytoscape) return;
  if (container._graph) container._graph.destroy();

  var cy = cytoscape({
    container: container,
    elements: els,
    style: [
      { selector: 'node', style: { 'label': 'data(label)', 'font-size': '10px', 'font-family': 'var(--font-ui)', 'color': 'var(--text)', 'text-valign': 'bottom', 'text-halign': 'center', 'text-margin-y': 6 } },
      { selector: 'node[type="character"]', style: { 'background-color': 'data(_color)', 'width': 28, 'height': 28 } },
      { selector: 'node[type="location"]', style: { 'background-color': '#8B6914', 'width': 20, 'height': 20 } },
      { selector: 'node[type="setting"]', style: { 'background-color': '#6F6A60', 'width': 18, 'height': 18 } },
      { selector: 'edge', style: { 'width': 1.5, 'line-color': 'rgba(170,94,67,0.25)', 'curve-style': 'bezier', 'label': 'data(label)', 'font-size': '9px', 'color': '#615B54', 'text-opacity': 1, 'text-background-opacity': 1, 'text-background-color': '#F5F0E6', 'text-background-padding': '2px 4px', 'text-background-shape': 'roundrectangle', 'text-valign': 'center', 'text-halign': 'center', 'overlay-padding': 0, 'overlay-opacity': 0 } }
    ],
    layout: { name: 'cose', animate: false, fit: true, padding: 30 },
    zoomingEnabled: true, userZoomingEnabled: true
  });
  container._graph = cy;

  // 点击高亮
  cy.on('tap', 'node', function(evt) {
    var node = evt.target;
    cy.elements().removeClass('dimmed');
    cy.elements().difference(node.neighborhood().add(node)).addClass('dimmed');
  });
  cy.on('tap', function(evt) {
    if (evt.target === cy) cy.elements().removeClass('dimmed');
  });
}

var _ctxBarData = null;

function loadContextBar() {
  if (!_currentProject || !_currentChapter) return;
  var ch = _currentChapter;
  var url = tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/context-preview?chapterId=' + encodeURIComponent(ch.id) + '&title=' + encodeURIComponent(ch.title || ''));
  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.error) return;
      _ctxBarData = d;
      var cardsEl = document.getElementById('ctx-cards');
      var factsEl = document.getElementById('ctx-facts');
      var prevEl = document.getElementById('ctx-prev');
      var graphEl = document.getElementById('ctx-graph');
      var detailEl = document.getElementById('ctx-detail');
      if (cardsEl) cardsEl.innerHTML = '📋 ' + d.cards.matched + '/' + d.cards.total + ' 卡片';
      if (factsEl) factsEl.innerHTML = '📌 ' + (d.facts.constant + d.facts.keywordMatched) + '/' + d.facts.total + ' 事实';
      if (prevEl) prevEl.innerHTML = '📝 ' + d.previousChapters + ' 前文';
      if (graphEl) graphEl.innerHTML = '🔗 ' + d.graphEdges + ' 关系';
      if (detailEl) detailEl.style.display = '';
    })
    .catch(function() {});
}

function toggleCtxDetail() {
  var panel = document.getElementById('ctx-detail-panel');
  var btn = document.getElementById('ctx-detail');
  if (!panel || !_ctxBarData) return;
  if (panel.style.display === 'none') {
    var d = _ctxBarData;
    var h = '';
    // 卡片
    h += '<div style="margin-bottom:8px"><span style="font-weight:600;color:var(--text-sub)">📋 卡片 (' + d.cards.matched + '/' + d.cards.total + ')</span></div>';
    if (d.cards.matchedItems && d.cards.matchedItems.length > 0) {
      h += '<div style="margin-bottom:4px"><span style="color:var(--success)">已命中:</span> ';
      d.cards.matchedItems.forEach(function(c) { h += '<span class="tag" style="font-size:10px;border-color:var(--success);color:var(--success)">' + esc(c.name) + '</span> '; });
      h += '</div>';
    }
    if (d.cards.unmatchedItems && d.cards.unmatchedItems.length > 0) {
      h += '<div><span style="color:var(--text-muted)">未命中:</span> ';
      d.cards.unmatchedItems.forEach(function(c) { h += '<span class="tag" style="font-size:10px">' + esc(c.name) + '</span> '; });
      h += '</div>';
    }
    // 事实
    h += '<div style="margin-top:10px;margin-bottom:4px"><span style="font-weight:600;color:var(--text-sub)">📌 事实 (' + (d.facts.constant + d.facts.keywordMatched) + '/' + d.facts.total + ')</span></div>';
    if (d.facts.constant > 0) {
      h += '<div style="margin-bottom:2px"><span style="color:var(--accent)">⚓ 常驻 ×' + d.facts.constant + '</span></div>';
    }
    if (d.facts.matchedItems && d.facts.matchedItems.length > 0) {
      h += '<div style="margin-bottom:2px"><span style="color:var(--success)">关键词命中 ×' + d.facts.keywordMatched + ':</span></div>';
      d.facts.matchedItems.slice(0, 5).forEach(function(f) { h += '<div style="color:var(--text-muted);padding-left:12px">• ' + esc(f.content.substring(0, 50)) + '</div>'; });
      if (d.facts.matchedItems.length > 5) h += '<div style="color:var(--text-muted);padding-left:12px">... +' + (d.facts.matchedItems.length - 5) + ' 条</div>';
    }
    if (d.facts.unmatched > 0) {
      h += '<div style="color:var(--text-muted)">未匹配 ×' + d.facts.unmatched + '</div>';
    }
    panel.innerHTML = h;
    panel.style.display = '';
    btn.textContent = '收起';
  } else {
    panel.style.display = 'none';
    btn.textContent = '展开';
  }
}

async function saveChapter() {
  var title = q('cht').value;
  var editorBody = q('chb').value;
  // 获取完整原文（含 frontmatter）以重建
  var fullOriginal = q('chb_full');
  var fullContent = fullOriginal ? fullOriginal.value : '';
  // 正文内容 + 自动还原 frontmatter
  var body = restoreFrontmatter(editorBody, fullContent);

  // 保存版本历史（通过 facts API）
  var wasBody = _currentChapter.body || '';
  if (wasBody && wasBody !== body) {
    fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/facts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'chapter_history',
        content: JSON.stringify({
          chId: _currentChapter.id,
          ts: new Date().toISOString(),
          size: wasBody.length,
          preview: wasBody.substring(0, 80)
        }),
        tags: ['chapter_history', _currentChapter.id]
      })
    }).catch(function() {});
  }

  try {
    var r = await fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/chapters'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: _currentChapter.id, title: title, content: body })
    });
    var j = await r.json();

    if (j.ok) {
      var rc = await fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/chapters'));
      _chapters = await rc.json();
      _currentChapter = _chapters.find(function(c) { return c.id === _currentChapter.id; }) || _chapters[_chapters.length - 1];
      _editing = false;
      stopDraftTimer();
      clearDraft();
      renderChapterContent();
      toast('💾 已保存（版本历史已记录）');
    } else {
      toast('❌ 保存失败: ' + (j.error || '未知错误'));
    }
  } catch(e) {
    toast('❌ 保存失败: ' + e.message);
  }
}

// Save in preview mode (no textarea available — posts body directly)
async function saveChapterPreview(body) {
  try {
    var r = await fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/chapters'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: _currentChapter.id, title: _currentChapter.title, content: body })
    });
    var j = await r.json();
    if (j.ok) {
      _currentChapter.body = body;
      toast('💾 已保存');
    } else {
      toast('❌ 保存失败: ' + (j.error || '未知错误'));
    }
  } catch(e) {
    toast('❌ 保存失败: ' + e.message);
  }
}

// ====== 拖拽排序 ======
var _dragChId = null;

function dragStart(e, chId) {
  _dragChId = chId;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', chId);
  var el = e.target.closest('.ch-item');
  if (el) { el.classList.add('dragging'); }
  e.stopPropagation();
}

function dragEnd(e) {
  var el = e.target.closest('.ch-item');
  if (el) { el.classList.remove('dragging'); }
  document.querySelectorAll('.drag-over').forEach(function(el) { el.classList.remove('drag-over'); });
}

function dragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  var el = e.target.closest('.ch-item');
  if (el && el.dataset.chid !== _dragChId) {
    document.querySelectorAll('.drag-over').forEach(function(el) { el.classList.remove('drag-over'); });
    el.classList.add('drag-over');
  }
}

async function dropChapter(e, targetVolume) {
  e.preventDefault();
  var targetEl = e.target.closest('.ch-item');
  if (!targetEl || !_dragChId || targetEl.dataset.chid === _dragChId) {
    dragEnd(e);
    return;
  }
  var targetChId = targetEl.dataset.chid;
  dragEnd(e);

  // 重新排序 _chapters
  var newOrder = [];
  _chapters.forEach(function(ch) { if (ch.volume === targetVolume || (ch.id === _dragChId && targetVolume !== undefined)) newOrder.push(ch.id); });
  var dragIdx = newOrder.indexOf(_dragChId);
  var targetIdx = newOrder.indexOf(targetChId);
  if (dragIdx === -1 || targetIdx === -1) return;
  newOrder.splice(dragIdx, 1);
  newOrder.splice(targetIdx, 0, _dragChId);

  // 更新本地顺序
  var orderMap = {};
  newOrder.forEach(function(id, i) { orderMap[id] = i + 1; });
  _chapters.forEach(function(ch) { if (orderMap[ch.id] !== undefined) ch.order = orderMap[ch.id]; });
  _chapters.sort(function(a, b) { return (a.order || 0) - (b.order || 0); });

  // 更新分卷
  if (targetVolume !== undefined) {
    var dch = _chapters.find(function(c) { return c.id === _dragChId; });
    if (dch) dch.volume = targetVolume || null;
  }

  // 发送排序 + 分卷更新到后端
  try {
    var orderedIds = _chapters.map(function(c) { return c.id; });
    var r = await fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/reorder'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: orderedIds })
    });
    var data = await r.json();
    if (!data.ok) throw new Error(data.error || 'reorder failed');

    // 如果跨卷拖拽，同步更新章节 volume
    if (targetVolume !== undefined) {
      await fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/chapters'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: _dragChId, volume: targetVolume })
      });
    }

    renderMainPanel();
  } catch(e) { toast('❌ 排序失败: ' + e.message); }
}

async function editChapterTitle(chId, el) {
  var ch = _chapters.find(function(c) { return c.id === chId; });
  if (!ch) return;
  var oldTitle = ch.title;
  // 原地替换为 input
  var input = document.createElement('input');
  input.type = 'text';
  input.value = oldTitle;
  input.style.cssText = 'flex:1;padding:2px 4px;border:1px solid var(--accent);border-radius:var(--radius);background:var(--bg-panel);color:var(--text);font-size:12px;font-family:var(--font-ui);outline:none;width:100%';
  el.textContent = '';
  el.appendChild(input);
  input.focus();
  input.select();

  function finish(save) {
    if (save && input.value.trim() && input.value.trim() !== oldTitle) {
      ch.title = input.value.trim();
      el.textContent = esc(ch.title);
      // 发送到后端
      fetch(tu(A + '/tools/novel_chapter'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', projectId: _currentProject.id, chapterId: chId, title: ch.title })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.content) data = JSON.parse(data.content[0].text);
        if (data.ok) toast('✓ 已重命名');
        else { ch.title = oldTitle; el.textContent = esc(oldTitle); toast('❌ 重命名失败: ' + (data.error || '')); }
      }).catch(function(e) { ch.title = oldTitle; el.textContent = esc(oldTitle); toast('❌ ' + e.message); });
    } else {
      el.textContent = esc(oldTitle);
    }
  }

  input.addEventListener('blur', function() { finish(true); });
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { finish(false); }
  });
}

async function toggleOutlineView() {
  _outlineView = !_outlineView;
  if (_outlineView && _currentProject) {
    try {
      var r = await fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/outline'));
      _outline = await r.json();
    } catch(e) { _outline = { arcs: [] }; }
    _outlineCollapsed = {};
  }
  renderMainPanel();
}

function addOutlineItem(type, arcIdx, actIdx) {
  if (!_outline || !_outline.arcs) _outline = { arcs: [] };
  if (type === 'arc') {
    _outline.arcs.push({ id: 'arc_'+Date.now().toString(36), title: '新弧线', description: '', items: [] });
  } else if (type === 'act' && arcIdx !== undefined) {
    if (!_outline.arcs[arcIdx].items) _outline.arcs[arcIdx].items = [];
    _outline.arcs[arcIdx].items.push({ id: 'act_'+Date.now().toString(36), type:'act', title:'新幕', description:'', items:[] });
  } else if (type === 'beat' && arcIdx !== undefined && actIdx !== undefined) {
    if (!_outline.arcs[arcIdx].items[actIdx].items) _outline.arcs[arcIdx].items[actIdx].items = [];
    _outline.arcs[arcIdx].items[actIdx].items.push({ id:'beat_'+Date.now().toString(36), type:'beat', title:'新节拍', description:'', linkedChapterId:null });
  }
  renderOutlinePanel();
}

function deleteOutlineArc(arcIdx) {
  if (!_outline || !_outline.arcs) return;
  _outline.arcs.splice(arcIdx, 1);
  renderOutlinePanel();
}

function deleteOutlineItem(arcIdx, actIdx, beatIdx) {
  if (!_outline || !_outline.arcs[arcIdx]) return;
  if (beatIdx !== undefined) {
    _outline.arcs[arcIdx].items[actIdx].items.splice(beatIdx, 1);
  } else {
    _outline.arcs[arcIdx].items.splice(actIdx, 1);
  }
  renderOutlinePanel();
}

function renderOutlinePanel() {
  // 只刷新大纲面板，不重新渲染整个页面
  if (!_outlineView) { renderMainPanel(); return; }
  var panel = document.getElementById('outline-panel');
  if (!panel) { renderMainPanel(); return; }
  var h = '';
  if (!_outline || !_outline.arcs || _outline.arcs.length === 0) {
    h += '<div class="empty-state" style="height:120px"><div class="title" style="font-size:13px">暂无大纲</div><div class="desc" style="font-size:11px;margin-top:4px">点击下方按钮创建第一条弧线</div></div>';
  } else {
    _outline.arcs.forEach(function(arc, arcIdx) {
      var arcExp = !_outlineCollapsed || !_outlineCollapsed['arc_'+arcIdx];
      h += '<div style="margin-bottom:6px;border:1px solid var(--border);border-radius:var(--rm);overflow:hidden">';
      h += '<div style="display:flex;align-items:center;gap:4px;padding:6px 10px;background:var(--bg-panel)" onclick="event.stopPropagation()">';
      h += '<button class="btn btn-ghost" style="font-size:10px;padding:2px 4px" onclick="_outlineCollapsed=_outlineCollapsed||{};_outlineCollapsed[\'arc_\'+'+arcIdx+']=!_outlineCollapsed[\'arc_\'+'+arcIdx+'];renderOutlinePanel()">' + (arcExp ? '▼' : '▶') + '</button>';
      h += '<span style="font-size:14px">📘</span>';
      h += '<span class="ol-edit" style="font-weight:600;font-size:13px;flex:1;cursor:text;padding:2px 4px;border:1px solid transparent;border-radius:3px" onclick="event.stopPropagation();startOutlineEdit(this,\'arc\','+arcIdx+')">' + esc(arc.title || '新弧线') + '</span>';
      h += '<button class="btn btn-ghost" style="font-size:9px;padding:2px 4px" onclick="addOutlineItem(\'act\','+arcIdx+')">+ 📙</button>';
      h += '<button class="btn btn-ghost" style="font-size:9px;padding:2px 4px;color:#B91C1C" onclick="deleteOutlineArc('+arcIdx+')">🗑</button>';
      h += '</div>';
      h += '<div style="padding:4px 10px 6px 32px;display:'+(arcExp?'':'none')+'">';
      h += '<textarea class="ol-desc" style="width:100%;padding:4px 8px;border:1px solid var(--border-light);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:11px;font-family:var(--font-ui);resize:vertical;min-height:32px" onchange="_outline.arcs['+arcIdx+'].description=this.value" oninput="_outline.arcs['+arcIdx+'].description=this.value" placeholder="弧线描述...">' + esc(arc.description || '') + '</textarea>';
      h += '</div>';
      (arc.items||[]).forEach(function(act, actIdx) {
        var actExp = !_outlineCollapsed || !_outlineCollapsed['act_'+arcIdx+'_'+actIdx];
        h += '<div style="margin:2px 0 2px 14px;border-left:2px solid var(--border);border-bottom:1px solid var(--border-light);border-radius:0 0 0 4px">';
        h += '<div style="display:flex;align-items:center;gap:3px;padding:5px 10px" onclick="event.stopPropagation()">';
        h += '<button class="btn btn-ghost" style="font-size:9px;padding:1px 3px" onclick="_outlineCollapsed=_outlineCollapsed||{};_outlineCollapsed[\'act_\'+'+arcIdx+'+\'_\'+'+actIdx+']=!_outlineCollapsed[\'act_\'+'+arcIdx+'+\'_\'+'+actIdx+'];renderOutlinePanel()">' + (actExp ? '▼' : '▶') + '</button>';
        h += '<span style="font-size:13px">📙</span>';
        h += '<span class="ol-edit" style="font-weight:500;font-size:12px;flex:1;cursor:text;padding:2px 4px;border:1px solid transparent;border-radius:3px" onclick="event.stopPropagation();startOutlineEdit(this,\'act\','+arcIdx+','+actIdx+')">' + esc(act.title || '新幕') + '</span>';
        h += '<button class="btn btn-ghost" style="font-size:9px;padding:1px 3px" onclick="addOutlineItem(\'beat\','+arcIdx+','+actIdx+')">+ 📄</button>';
        h += '<button class="btn btn-ghost" style="font-size:9px;padding:1px 3px;color:#B91C1C" onclick="deleteOutlineItem('+arcIdx+','+actIdx+')">🗑</button>';
        h += '</div>';
        h += '<div style="padding:2px 10px 4px 28px;display:'+(actExp?'':'none')+'">';
        h += '<textarea class="ol-desc" style="width:100%;padding:3px 6px;border:1px solid var(--border-light);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:10px;font-family:var(--font-ui);resize:vertical;min-height:28px" onchange="_outline.arcs['+arcIdx+'].items['+actIdx+'].description=this.value" oninput="_outline.arcs['+arcIdx+'].items['+actIdx+'].description=this.value" placeholder="幕描述...">' + esc(act.description || '') + '</textarea>';
        h += '</div>';
        (act.items||[]).forEach(function(beat, beatIdx) {
          var linkedCh = beat.linkedChapterId ? _chapters.find(function(c){return c.id===beat.linkedChapterId}) : null;
          h += '<div style="margin:1px 0 1px 10px;display:flex;align-items:center;gap:3px;padding:2px 8px;font-size:11px;border-left:1px solid var(--border-light)" onclick="event.stopPropagation()">';
          h += '<span style="font-size:11px">📄</span>';
          h += '<span class="ol-edit" style="flex:1;cursor:text;padding:1px 4px;border:1px solid transparent;border-radius:3px" onclick="event.stopPropagation();startOutlineEdit(this,\'beat\','+arcIdx+','+actIdx+','+beatIdx+')">' + esc(beat.title || '新节拍') + '</span>';
          h += '<button class="btn btn-ghost" style="font-size:8px;padding:1px 3px" onclick="pickChapterForBeat('+arcIdx+','+actIdx+','+beatIdx+')" title="选择关联章节">' + (linkedCh ? '🔗 '+esc(linkedCh.title) : '🔗 无') + '</button>';
          h += '<button class="btn btn-ghost" style="font-size:8px;padding:1px 3px;color:#B91C1C" onclick="deleteOutlineItem('+arcIdx+','+actIdx+','+beatIdx+')">🗑</button>';
          h += '</div>';
          // 场景列表
          var scenes = beat.scenes || [];
          h += '<div style="margin-left:20px;padding:2px 0 4px 8px;border-left:1px dashed var(--border-light)">';
          scenes.forEach(function(scene, sceneIdx) {
            h += '<div style="padding:2px 8px;font-size:10px;cursor:pointer;color:var(--text-sub);transition:color var(--dur)" onmouseover="this.style.color=\'var(--accent)\'" onmouseout="this.style.color=\'var(--text-sub)\'" onclick="editScene('+arcIdx+','+actIdx+','+beatIdx+','+sceneIdx+')">';
            h += '🎬 ' + esc(scene.title || '场景');
            if (scene.estimatedWords) h += ' <span style="color:var(--text-muted)">~' + scene.estimatedWords + '字</span>';
            if (scene.conflict) h += ' <span style="color:var(--accent);font-size:9px">⚔️</span>';
            h += '</div>';
          });
          h += '<button class="btn btn-ghost" style="font-size:9px;padding:1px 4px;color:var(--accent)" onclick="addScene('+arcIdx+','+actIdx+','+beatIdx+')">+ 🎬 场景</button>';
          h += '</div>';
        });
        h += '</div>';
      });
      h += '</div>';
    });
  }
  h += '<div style="margin-top:6px;display:flex;gap:6px">';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:3px 10px;flex:1" onclick="addOutlineItem(\'arc\')">+ 📘 新弧线</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:3px 10px;flex:1" onclick="saveOutline()">💾 保存大纲</button>';
  h += '</div>';
  panel.innerHTML = h;
}

function startOutlineEdit(el, level, arcIdx, actIdx, beatIdx) {
  var target;
  if (level === 'arc') target = _outline.arcs[arcIdx];
  else if (level === 'act') target = _outline.arcs[arcIdx].items[actIdx];
  else if (level === 'beat') target = _outline.arcs[arcIdx].items[actIdx].items[beatIdx];
  if (!target) return;
  var old = target.title;
  var inp = document.createElement('input');
  inp.value = old;
  inp.style.cssText = 'flex:1;padding:2px 6px;border:1px solid var(--accent);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:'+(level==='arc'?'13px':'12px')+';font-family:var(--font-ui);outline:none;min-width:80px';
  inp.onblur = function() {
    var v = inp.value.trim();
    if (v) target.title = v;
    renderOutlinePanel();
  };
  inp.onkeydown = function(e) {
    if (e.key === 'Enter') inp.blur();
    if (e.key === 'Escape') { inp.value = old; inp.blur(); }
  };
  el.replaceChildren(inp);
  inp.focus(); inp.select();
}

function pickChapterForBeat(arcIdx, actIdx, beatIdx) {
  var beat = _outline.arcs[arcIdx].items[actIdx].items[beatIdx];
  var overlay = document.createElement('div');
  overlay.className = 'card-form-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.3);backdrop-filter:blur(2px);z-index:200;display:flex;align-items:center;justify-content:center';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  var panel = document.createElement('div');
  panel.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:var(--rm);width:360px;max-height:70vh;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,.15)';
  panel.onclick = function(e) { e.stopPropagation(); };
  var h = '<div style="padding:14px 18px;border-bottom:1px solid var(--border);font-weight:600;font-size:14px">🔗 选择关联章节</div>';
  h += '<div style="padding:8px 0">';
  h += '<div style="padding:8px 18px;cursor:pointer;font-size:12px;color:var(--text-muted)" onmouseover="this.style.background=\'var(--bg-hover)\'" onmouseout="this.style.background=\'\'" onclick="this.closest(\'.card-form-overlay\').remove()">✕ 取消关联</div>';
  _chapters.forEach(function(c) {
    h += '<div style="padding:8px 18px;cursor:pointer;font-size:13px;'+(beat.linkedChapterId===c.id?'background:var(--bg-hover);font-weight:600':'')+'" onmouseover="this.style.background=\'var(--bg-hover)\'" onmouseout="this.style.background=\''+(beat.linkedChapterId===c.id?'var(--bg-hover)':'')+'\'" onclick="_outline.arcs['+arcIdx+'].items['+actIdx+'].items['+beatIdx+'].linkedChapterId=\''+c.id+'\';this.closest(\'.card-form-overlay\').remove();renderOutlinePanel()">📄 '+esc(c.title)+'</div>';
  });
  h += '</div>';
  panel.innerHTML = h;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

function addScene(arcIdx, actIdx, beatIdx) {
  var beat = _outline.arcs[arcIdx].items[actIdx].items[beatIdx];
  if (!beat.scenes) beat.scenes = [];
  beat.scenes.push({
    id: 'scene_' + Date.now().toString(36),
    title: '新场景',
    summary: '',
    characters: [],
    location: '',
    conflict: '',
    emotion: '',
    estimatedWords: 0
  });
  renderOutlinePanel();
}

function editScene(arcIdx, actIdx, beatIdx, sceneIdx) {
  var scene = _outline.arcs[arcIdx].items[actIdx].items[beatIdx].scenes[sceneIdx];
  if (!scene) return;
  var overlay = document.createElement('div');
  overlay.className = 'card-form-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.3);backdrop-filter:blur(2px);z-index:200;display:flex;align-items:center;justify-content:center';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  var panel = document.createElement('div');
  panel.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:var(--rm);width:420px;max-height:80vh;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,.15);padding:16px';
  panel.onclick = function(e) { e.stopPropagation(); };
  var h = '<div style="font-weight:600;font-size:14px;margin-bottom:12px">🎬 场景编辑</div>';
  h += '<input id="scTitle" value="' + esc(scene.title||'') + '" placeholder="场景标题" style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:var(--r);margin-bottom:8px;font-size:13px;background:var(--bg-panel)">';
  h += '<textarea id="scSummary" placeholder="内容概要..." style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:var(--r);margin-bottom:8px;font-size:12px;min-height:50px;resize:vertical;background:var(--bg-panel)">' + esc(scene.summary||'') + '</textarea>';
  h += '<div style="display:flex;gap:8px;margin-bottom:8px">';
  h += '<div style="flex:1"><label style="font-size:10px;color:var(--text-muted)">出场人物</label><input id="scChars" value="' + esc((scene.characters||[]).join(', ')) + '" placeholder="逗号分隔" style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:var(--r);font-size:11px;background:var(--bg-panel)"></div>';
  h += '<div style="flex:1"><label style="font-size:10px;color:var(--text-muted)">地点</label><input id="scLoc" value="' + esc(scene.location||'') + '" style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:var(--r);font-size:11px;background:var(--bg-panel)"></div>';
  h += '</div>';
  h += '<div style="display:flex;gap:8px;margin-bottom:8px">';
  h += '<div style="flex:1"><label style="font-size:10px;color:var(--text-muted)">核心冲突</label><input id="scConflict" value="' + esc(scene.conflict||'') + '" style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:var(--r);font-size:11px;background:var(--bg-panel)"></div>';
  h += '<div style="flex:1"><label style="font-size:10px;color:var(--text-muted)">情绪节奏</label><input id="scEmotion" value="' + esc(scene.emotion||'') + '" placeholder="如：紧张→爆发→平静" style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:var(--r);font-size:11px;background:var(--bg-panel)"></div>';
  h += '</div>';
  h += '<div style="margin-bottom:12px"><label style="font-size:10px;color:var(--text-muted)">预估字数</label><input id="scWords" type="number" value="' + (scene.estimatedWords||0) + '" style="width:100px;padding:4px 8px;border:1px solid var(--border);border-radius:var(--r);font-size:11px;background:var(--bg-panel)"></div>';
  h += '<div style="display:flex;gap:8px;justify-content:flex-end">';
  h += '<button class="btn btn-ghost" style="color:var(--danger)" onclick="_outline.arcs['+arcIdx+'].items['+actIdx+'].items['+beatIdx+'].scenes.splice('+sceneIdx+',1);this.closest(\'.card-form-overlay\').remove();renderOutlinePanel()">删除</button>';
  h += '<button class="btn" onclick="this.closest(\'.card-form-overlay\').remove()">取消</button>';
  h += '<button class="btn btn-primary" onclick="var s=_outline.arcs['+arcIdx+'].items['+actIdx+'].items['+beatIdx+'].scenes['+sceneIdx+'];s.title=document.getElementById(\'scTitle\').value;s.summary=document.getElementById(\'scSummary\').value;s.characters=document.getElementById(\'scChars\').value.split(/[,，]/).map(function(x){return x.trim()}).filter(Boolean);s.location=document.getElementById(\'scLoc\').value;s.conflict=document.getElementById(\'scConflict\').value;s.emotion=document.getElementById(\'scEmotion\').value;s.estimatedWords=parseInt(document.getElementById(\'scWords\').value)||0;this.closest(\'.card-form-overlay\').remove();renderOutlinePanel();toast(\'✓ 场景已保存\')">保存</button>';
  h += '</div>';
  panel.innerHTML = h;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

async function saveOutline() {
  if (!_currentProject) return;
  try {
    var r = await fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/outline'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_outline)
    });
    var d = await r.json();
    if (!d.ok) throw new Error(d.error);
    toast('✅ 大纲已保存');
  } catch(e) { toast('❌ 保存失败: ' + e.message); }
}

function toggleBatchSelect() {
  _batchSelect = !_batchSelect;
  if (!_batchSelect) { _selectedChapters = []; }
  renderMainPanel();
}

window._chk = function(e, chId, checked) {
  if (checked) {
    if (_selectedChapters.indexOf(chId) === -1) _selectedChapters.push(chId);
  } else {
    _selectedChapters = _selectedChapters.filter(function(id) { return id !== chId; });
  }
};

async function mergeSelectedChapters() {
  if (_selectedChapters.length < 2) { toast('⚠️ 请至少选择两个章节'); return; }
  showInlinePrompt('合并后的新标题:', '合并章节', function(name) {
    if (!name) return;
    doMerge(name);
  });
}

async function doMerge(name) {
  try {
    var r = await fetch(tu(A + '/tools/merge_chapters'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: _currentProject.id, chapterIds: _selectedChapters, newTitle: name })
    });
    var data = await r.json();
    if (data.content) data = JSON.parse(data.content[0].text);
    if (!data.ok) throw new Error(data.error || 'merge failed');
    _batchSelect = false; _selectedChapters = [];
    var rc = await fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/chapters'));
    _chapters = await rc.json();
    renderMainPanel();
    toast('✅ 已合并为 ' + name);
  } catch(e) { toast('❌ 合并失败: ' + e.message); }
}

async function loadOutlineSummary(chId, btn) {
  var summaryEl = q('outline-summary-' + chId);
  if (!summaryEl) return;
  if (summaryEl.style.display === 'block') {
    summaryEl.style.display = 'none';
    btn.textContent = '📋';
    return;
  }
  try {
    var r = await fetch(tu(A + '/tools/novel_chapter'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get', projectId: _currentProject.id, chapterId: chId })
    });
    var data = await r.json();
    if (data.content) data = JSON.parse(data.content[0].text);
    if (data.ok && data.chapter && data.chapter.body) {
      var body = data.chapter.body;
      var preview = body.length > 300 ? body.substring(0, 300) + '...' : body;
      summaryEl.textContent = preview;
      summaryEl.style.display = 'block';
      btn.textContent = '📖';
    } else {
      summaryEl.textContent = '（章节内容为空）';
      summaryEl.style.display = 'block';
    }
  } catch(e) {
    summaryEl.textContent = '❌ 加载失败: ' + e.message;
    summaryEl.style.display = 'block';
  }
}

async function splitChapter() {
  var ch = _currentChapter;
  if (!ch) return;
  var body = ch.body || '';
  var cursorPos = body.length / 2;
  var ta = q('editor-textarea');
  if (ta && ta.selectionStart !== undefined) { cursorPos = ta.selectionStart; }
  var nextPara = body.indexOf('\n\n', cursorPos);
  if (nextPara === -1) nextPara = body.indexOf('\n', cursorPos);
  if (nextPara > cursorPos && nextPara < cursorPos + 500) { cursorPos = nextPara; }
  var preview = body.substring(Math.max(0, cursorPos - 50), Math.min(body.length, cursorPos + 50));
  showInlinePrompt('拆分位置预览: ' + esc(preview) + '\n\n第一半标题:', ch.title + '(上)', function(title1) {
    if (!title1) return;
    showInlinePrompt('第二半标题:', ch.title + '(下)', function(title2) {
      if (!title2) return;
      doSplitChapter(ch.id, cursorPos, title1, title2);
    });
  });
}

async function doSplitChapter(chId, splitPos, title1, title2) {
  try {
    var r = await fetch(tu(A + '/tools/novel_chapter'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'split', projectId: _currentProject.id, chapterId: chId, splitPos: splitPos, title1: title1, title2: title2 })
    });
    var data = await r.json();
    if (data.content) data = JSON.parse(data.content[0].text);
    if (!data.ok) throw new Error(data.error || 'split failed');
    var rc = await fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/chapters'));
    _chapters = await rc.json();
    _currentChapter = _chapters.find(function(c) { return c.id === data.chapter1Id; });
    renderMainPanel();
    renderChapterContent();
    toast('✅ 已拆分为 ' + title1 + ' + ' + title2);
  } catch(e) { toast('❌ 拆分失败: ' + e.message); }
}

// ═══════════════════════════════════
//  MAP VIEW
// ═══════════════════════════════════


// ═══════════════════════════════════
//  生图功能 — 章节配图生成
// ═══════════════════════════════════
function showImageGenPanel() {
  _showImageGen = !_showImageGen;
  renderMainPanel();
}

async function doGenerateCover() {
  if (!_currentProject) return;
  var chapterSelect = document.getElementById('imgGenChapter');
  var styleInput = document.getElementById('imgGenStyle');
  var statusEl = document.getElementById('imgGenStatus');
  if (!chapterSelect) return;
  var chapterId = chapterSelect.value;
  if (!chapterId) { toast('❌ 请先选择章节'); return; }

  toast('⏳ 正在生成配图...');
  statusEl.textContent = '⏳ 请求生图任务...';
  var style = styleInput ? styleInput.value.trim() || 'cinematic, dark atmosphere, anime style' : 'cinematic, dark atmosphere, anime style';

  try {
    var resp = await fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/generate-cover'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterId: chapterId, style: style }),
    });
    var result = await resp.json();
    if (!result.ok) { toast('❌ ' + (result.error || '生图失败')); statusEl.textContent = ''; return; }

    var taskId = result.taskId;
    if (!taskId) { statusEl.textContent = '❌ 后端未返回 taskId'; toast('❌ taskId 为空'); return; }
    statusEl.textContent = '⏳ 生成中（约30秒）...';
    toast('⏳ 图片生成中，请稍后');

    // 轮询检查生成结果
    (async function poll() {
      for (var i = 0; i < 40; i++) {
        await new Promise(function(r) { setTimeout(r, 2000); });
        try {
          var checkResp = await fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/generate-cover/status/' + encodeURIComponent(taskId)));
          var checkResult = await checkResp.json();
          if ((checkResult.status === 'done' || checkResult.status === 'completed') && checkResult.files && checkResult.files.length > 0) {
            statusEl.textContent = '✅ 完成！';
            toast('✅ 配图已生成！请在生图面板查看，或让我写入章节封面');
            _showImageGen = false;
            renderMainPanel();
            return;
          }
          if (checkResult.status === 'failed') {
            statusEl.textContent = '❌ 失败';
            toast('❌ ' + (checkResult.failReason || '生成失败'));
            return;
          }
          if (i % 5 === 0) {
            statusEl.textContent = '⏳ 生成中... (' + (i * 2) + 's)';
          }
        } catch(e) {}
      }
      statusEl.textContent = '⚠️ 超时';
      toast('⚠️ 生成超时，请在生图插件面板查看');
    })();
  } catch(e) {
    toast('❌ 生图请求失败: ' + e.message);
    statusEl.textContent = '';
  }
}


// ═══════════════════════════════════
//  插入图片到章节
// ═══════════════════════════════════

async function insertImageToChapter() {
  if (!_currentProject) { toast("✓ 请先选择项目"); return; }
  if (!_currentChapter) { toast("✓ 请先选择章节"); return; }
  var input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = async function(ev) {
      var base64 = ev.target.result;
      toast("✓ 正在上传并插入图片...");
      try {
        var resp = await fetch(tu(A + "/api/project/" + encodeURIComponent(_currentProject.id) + "/insert-image"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapterId: _currentChapter.id, fileName: file.name, imageData: base64 })
        });
        var data = await resp.json();
        if (!data.ok) throw new Error(data.error || "insert failed");
        var rc = await fetch(tu(A + "/api/project/" + encodeURIComponent(_currentProject.id) + "/chapters"));
        _chapters = await rc.json();
        _currentChapter = _chapters.find(function(c) { return c.id === _currentChapter.id; });
        // Use data URL directly (avoid asset route which is 403 on Bun)
        var imgMd = "\n![封面](" + base64 + ")\n";
        var ta = q("chb");
        if (ta) {
          var pos = ta.selectionStart || ta.value.length;
          var before = ta.value.substring(0, pos);
          var after = ta.value.substring(pos);
          if (before.length > 0 && !before.endsWith("\n\n")) before += "\n";
          ta.value = before + imgMd + after;
          ta.selectionStart = ta.selectionEnd = pos + imgMd.length;
          _draftDirty = true;
        }
        // 同步 body 到 _currentChapter，再退出编辑模式渲染
        var newBody = '';
        if (ta) {
          // 重建完整 body：frontmatter + textarea 内容
          var fullEl = q('chb_full');
          newBody = restoreFrontmatter(ta.value, fullEl ? fullEl.value : '');
          _currentChapter.body = newBody;
        }
        // 立即保存到服务器
        if (newBody) {
          await fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/chapters'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: _currentChapter.id, title: _currentChapter.title, content: newBody })
          });
        }
        stopDraftTimer();
        _editing = false;
        _localBodyDirty = true;
        renderMainPanel();
        renderChapterContent();
        toast("✓ 图片插入成功");
      } catch(ert) { toast("✓ 插入失败: " + ert.message); }
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

//  删除图片
async function deleteImageFromChapter(imgPath, imgType, imgAlt) {
  if (!_currentProject || !_currentChapter) return;
  var isCover = (imgPath === 'cover');

  // 1. 确认删除
  var confirmed = await new Promise(function(resolve) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center';
    var box = document.createElement('div');
    box.style.cssText = 'background:#2a2a2a;color:#eee;padding:20px 28px;border-radius:12px;font-size:14px;box-shadow:0 4px 24px rgba(0,0,0,0.5);text-align:center';
    box.innerHTML = '<div style="margin-bottom:16px">🗑 删除这张图片？</div><div style="display:flex;gap:10px;justify-content:center"><button id="confirm-ok" style="padding:6px 18px;background:#e74c3c;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">删除</button><button id="confirm-cancel" style="padding:6px 18px;background:#555;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">取消</button></div>';
    box.querySelector('#confirm-ok').onclick = function() { overlay.remove(); resolve(true); };
    box.querySelector('#confirm-cancel').onclick = function() { overlay.remove(); resolve(false); };
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
  if (!confirmed) return;

  try {
    // 2. 获取当前 body（优先从 textarea，否则从 _currentChapter.body）
    var ta = q('chb');
    var fullEl = q('chb_full');
    var body = '';
    if (ta) {
      // 编辑模式：从 textarea 取正文，从 hidden 取完整内容
      body = fullEl ? fullEl.value : ta.value;
    } else {
      body = _currentChapter.body || '';
    }

    // 3. 删除图片
    if (isCover) {
      // 封面：移除 frontmatter 中的 cover.image 行
      body = body.replace(/image:\s*["']?[^\n'"]+["']?\s*\n?/g, '');
      body = body.replace(/cover:\s*\n(\s+\w+:)/g, '$1'); // 空 cover 块
    }
    // 移除正文中的 ![xxx](...) 图片行（匹配 alt 或全部 data: 图片）
    var lines = body.split('\n');
    var newLines = [];
    var removed = false;
    for (var i = 0; i < lines.length; i++) {
      if (!removed && lines[i].match(/!\[[^\]]*\]\([^)]+\)/)) {
        // 匹配到了图片行，跳过
        removed = true;
        continue;
      }
      newLines.push(lines[i]);
    }
    body = newLines.join('\n');

    // 4. 保存到服务器
    _currentChapter.body = body;
    _localBodyDirty = true;
    var r = await fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/chapters'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: _currentChapter.id, title: _currentChapter.title, content: body })
    });
    var j = await r.json();
    if (!j.ok) throw new Error(j.error || 'save failed');

    // 5. 刷新章节列表（更新字数）
    var rc = await fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/chapters'));
    _chapters = await rc.json();
    _currentChapter = _chapters.find(function(c) { return c.id === _currentChapter.id; });

    // 6. 更新编辑区
    if (ta) {
      ta.value = stripFrontmatter(body);
      _draftDirty = false;
    }

    // 7. 重新渲染
    _editing = false;
    stopDraftTimer();
    renderMainPanel();
    renderChapterContent();
    toast('✓ 图片已删除');
  } catch(e) { toast('❌ 删除失败: ' + e.message); }
}

// ── 编辑模式：右键 textarea 中的图片行弹出删除菜单 ──
function handleTextareaContext(e) {
  var ta = q('chb');
  if (!ta) return;
  // Get the line under cursor
  var pos = ta.selectionStart;
  var text = ta.value;
  var lineStart = text.lastIndexOf('\n', pos - 1) + 1;
  var lineEnd = text.indexOf('\n', pos);
  if (lineEnd < 0) lineEnd = text.length;
  var line = text.substring(lineStart, lineEnd).trim();
  
  // Check if this line is an image reference: ![...](...)
  var imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
  if (!imgMatch) return; // Not an image line, let default context menu work
  
  e.preventDefault();
  e.stopPropagation();
  
  var alt = imgMatch[1];
  var src = imgMatch[2];
  var isDataUrl = src.startsWith('data:');
  var isServerPath = src.includes('文本附件');
  
  // Build floating menu
  var menu = document.createElement('div');
  menu.id = 'img-context-menu';
  menu.style.cssText = 'position:fixed;background:#2a2a2a;color:#eee;padding:6px 0;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.4);z-index:99999;min-width:120px;font-size:13px';
  
  var x = e.clientX > window.innerWidth - 130 ? e.clientX - 125 : e.clientX + 10;
  var y = e.clientY > window.innerHeight - 50 ? e.clientY - 45 : e.clientY + 10;
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  
  // Image preview (small thumbnail)
  if (isDataUrl || isServerPath) {
    var preview = document.createElement('div');
    preview.style.cssText = 'padding:6px 12px;border-bottom:1px solid #444;text-align:center';
    var img = document.createElement('img');
    img.src = isDataUrl ? src : (tu(A + "/api/project/" + encodeURIComponent(_currentProject.id) + "/asset/" + encodeURIComponent(src)));
    img.style.cssText = 'max-width:120px;max-height:80px;border-radius:4px;display:block;margin:0 auto';
    preview.appendChild(img);
    menu.appendChild(preview);
  }
  
  // Delete button
  var deleteItem = document.createElement('div');
  deleteItem.style.cssText = 'padding:8px 16px;cursor:pointer;color:#ff6b6b;display:flex;align-items:center;gap:8px';
  deleteItem.textContent = '🗑 删除图片';
  deleteItem.onmouseenter = function() { this.style.background = 'rgba(255,107,107,0.15)'; };
  deleteItem.onmouseleave = function() { this.style.background = 'transparent'; };
  deleteItem.onclick = function(ev) {
    ev.stopPropagation();
    // Remove the image line from textarea
    var before = text.substring(0, lineStart);
    var after = text.substring(lineEnd);
    // Clean up extra newlines
    while (before.endsWith('\n\n')) before = before.slice(0, -1);
    ta.value = before + after;
    ta.selectionStart = ta.selectionEnd = lineStart;
    _draftDirty = true;
    removeMenu();
    toast("✓ 图片已删除，保存后生效");
  };
  menu.appendChild(deleteItem);
  
  var removeMenu = function() { if (menu.parentNode) menu.remove(); };
  setTimeout(function() { document.addEventListener('click', removeMenu, { once: true }); }, 0);
  document.body.appendChild(menu);
}

// ── 右键菜单删除图片（预览模式）──
function initImageContextMenu() {
  // main-panel may not exist yet if writing.js loaded before app.js init
  var mainPanel = document.getElementById('main-panel');
  if (!mainPanel) {
    // Retry until main-panel is rendered (Hana creates DOM after JS loads)
    setTimeout(initImageContextMenu, 100);
    return;
  }
  console.log('[img-ctx] bound to main-panel, children:', mainPanel.childElementCount);
  
  mainPanel.addEventListener('contextmenu', function(e) {
    // Prevent Hana's default context menu on images
    if (e.target.tagName === 'IMG') {
      e.preventDefault();
      e.stopPropagation();
      
      // Get image info from src and alt
      var src = e.target.src || '';
      var alt = e.target.alt || '';
      var isDataUrl = src.startsWith('data:');
      var isCover = e.target.dataset.cover === 'true';
      
      console.log('[img-ctx] img clicked:', { src: src.substring(0,80), alt: alt, isDataUrl: isDataUrl, isCover: isCover });
      
      // Build menu
      var menu = document.createElement('div');
      menu.id = 'img-context-menu';
      menu.style.cssText = 'position:fixed;background:#2a2a2a;color:#eee;padding:6px 0;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.4);z-index:9999;min-width:120px;font-size:13px';
      
      var x = e.clientX > window.innerWidth - 130 ? e.clientX - 125 : e.clientX + 10;
      var y = e.clientY > window.innerHeight - 50 ? e.clientY - 45 : e.clientY + 10;
      menu.style.left = x + 'px';
      menu.style.top = y + 'px';
      
      // Show delete
      var deleteItem = document.createElement('div');
      deleteItem.style.cssText = 'padding:8px 16px;cursor:pointer;color:#ff6b6b;display:flex;align-items:center;gap:8px';
      deleteItem.textContent = isCover ? '🗑 删除封面' : '🗑 删除图片';
      deleteItem.onmouseenter = function() { this.style.background = 'rgba(255,107,107,0.15)'; };
      deleteItem.onmouseleave = function() { this.style.background = 'transparent'; };
      deleteItem.onclick = function(ev) {
        ev.stopPropagation(); 
        if (isCover) {
          deleteImageFromChapter('cover', 'cover', alt); 
        } else {
          deleteImageFromChapter(src, isDataUrl ? 'inline' : 'server', alt); 
        }
        removeMenu(); 
      };
      menu.appendChild(deleteItem);
      
      var removeMenu = function() { if (menu.parentNode) menu.remove(); };
      setTimeout(function() { document.addEventListener('click', removeMenu, { once: true }); }, 0);
      document.body.appendChild(menu);
      return;
    }
  });
}

// 初始化
initImageContextMenu();

// ── 电影化小说写作面板 ──
var _cinematicChapters = [];

function showCinematicPanel() {
  if (!_currentProject) { toast('⚠️ 请先选择一个项目'); return; }
  var h = '<div class="card-form-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.3);backdrop-filter:blur(2px);z-index:200;display:flex;align-items:center;justify-content:center" onclick="if(event.target===this)closeCinematicPanel()">';
  h += '<div class="card-form-panel" style="background:var(--bg);border:1px solid var(--border);border-radius:var(--rm);width:480px;max-height:80vh;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,.15)" onclick="event.stopPropagation()">';
  h += '<div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">';
  h += '<span style="font-weight:600;font-size:15px">🎬 电影化小说写作</span>';
  h += '<button style="background:none;border:none;font-size:18px;color:var(--text-muted);cursor:pointer" onclick="closeCinematicPanel()">✕</button>';
  h += '</div>';
  h += '<div style="padding:16px 20px">';
  h += '<div style="font-size:11px;color:var(--text-sub);margin-bottom:12px">用电影镜头语言（全景/特写/蒙太奇）改写章节</div>';
  // 章节选择
  h += '<div style="margin-bottom:12px"><label style="font-size:11px;color:var(--text-sub);display:block;margin-bottom:4px">章节</label>';
  h += '<select id="cinCh" style="width:100%;padding:5px 10px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-panel);color:var(--text);font-size:12px;font-family:var(--font-ui);outline:none">';
  h += '<option value="">— 选择章节 —</option>';
  if (_chapters) _chapters.forEach(function(ch){ h += '<option value="'+ch.id+'">'+esc(ch.title)+' ('+(ch.status||'draft')+', '+(ch.wordCount||0)+'字)</option>'; });
  h += '</select></div>';
  // 改写力度
  h += '<div style="margin-bottom:12px"><label style="font-size:11px;color:var(--text-sub);display:block;margin-bottom:6px">改写力度</label>';
  h += '<div style="display:flex;gap:6px">';
  h += '<label class="type-chip"><input type="radio" name="cinDepth" value="light" checked><span>✏️ 轻度</span></label>';
  h += '<label class="type-chip"><input type="radio" name="cinDepth" value="medium"><span>🖊️ 中度</span></label>';
  h += '<label class="type-chip"><input type="radio" name="cinDepth" value="heavy"><span>🎬 重度</span></label>';
  h += '</div></div>';
  // 说明
  h += '<div style="font-size:10px;color:var(--text-muted);line-height:1.6;margin:8px 0 12px;padding:8px;background:var(--bg-panel);border-radius:var(--radius);border:1px solid var(--border-light)">';
  h += '流程：镜头分析 → 电影化重写 → 逐段对比输出。不改情节、不改变人称，仅转换叙事风格。';
  h += '<br><br><b style="color:var(--text-sub)">⚡ 使用方式：</b>点击「开始改写」后，回到聊天窗口对我说 <b>"继续"</b>，我会自动读取任务并执行。';
  h += '</div>';
  // 按钮
  h += '<div style="display:flex;gap:8px;justify-content:flex-end">';
  h += '<button class="btn" onclick="closeCinematicPanel()">取消</button>';
  h += '<button class="btn btn-primary" id="cinBtn" onclick="doCinematicRewrite()">🎬 开始改写</button>';
  h += '</div>';
  h += '</div></div></div>';
  var div = document.createElement('div');
  div.id = 'cinematicRoot';
  div.innerHTML = h;
  document.body.appendChild(div.firstElementChild);
}

function closeCinematicPanel() {
  var el = document.querySelector('#cinematicRoot');
  if (el) el.remove();
  var btn = document.getElementById('cinBtn');
  if (btn) { btn.textContent = '🎬 开始改写'; btn.disabled = false; }
}

async function doCinematicRewrite() {
  var ch = document.getElementById('cinCh');
  var chId = ch ? ch.value : '';
  if (!chId) { toast('⚠️ 请选择章节'); return; }
  var radios = document.querySelectorAll('input[name="cinDepth"]:checked');
  var depth = radios.length ? radios[0].value : 'light';
  var btn = document.getElementById('cinBtn');
  btn.textContent = '⏳ 发送中...';
  btn.disabled = true;
  try {
      var r = await fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/cinematic'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterId: chId, depth: depth })
    });
    var j = await r.json();
    if (j.ok) {
      toast('✅ 已发送！请在聊天窗口对我说“开始电影化改写”或“继续”，我会读取任务并执行');
      closeCinematicPanel();
    } else {
      toast('❌ 失败: ' + (j.error || '未知错误'));
      btn.textContent = '🎬 开始改写';
      btn.disabled = false;
    }
  } catch(e) {
    toast('❌ 请求失败: ' + e.message);
    btn.textContent = '🎬 开始改写';
    btn.disabled = false;
  }
}
