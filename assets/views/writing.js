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
        h += '</div>';
        if (expanded && c.content) {
          h += '<div class="card-detail-popup">';
          h += '<div class="cd-header">';
          h += '<div class="cd-icon">' + (c.type === 'characters' ? '👤' : c.type === 'world' ? '🌍' : '📝') + '</div>';
          h += '<div style="flex:1"><div class="cd-name">' + esc(c.name) + '</div><div class="cd-type">' + esc(c.type || '') + '</div></div>';
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
  h += '</div>';
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
        if (ta) { ta.value = draft.body; _draftLastBody = draft.body; }
      }, 100);
    } else {
      clearDraft();
    }
  }
}

function renderChapterContent() {
  var ch = _currentChapter;
  if (!ch) return;
  var body = ch.body || '';

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
  h += '</div>';
  h += '</div>';

  h += '<div class="panel-body">';
  h += '<div class="editor-wrap fade-in">';
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
    h += '<textarea class="editor-textarea" id="chb" placeholder="开始写作..." oninput="_draftDirty=true">' + esc(body) + '</textarea>';
  } else {
    if (body) {
      h += '<div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:20px;font-size:14px;line-height:1.8;white-space:pre-wrap;font-family:var(--font)">' + renderMarkdown(body) + '</div>';
    } else {
      h += '<div class="empty-state" style="height:200px"><div class="icon">🖊</div><div class="title">章节为空</div><div class="desc">点击编辑按钮开始写作</div></div>';
    }
  }

  h += '</div></div>';

  q('main-panel').innerHTML = h;
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
    var dk = draftKey();
    localStorage.setItem(dk, JSON.stringify({ body: body, time: Date.now() }));
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
  var html = esc(body);
  // comments: /* text */ → gray italic
  html = html.replace(/\/\*\s+(.+?)\s+\*\//g, '<span style="color:#999;font-style:italic">$1</span>');
  // highlight: ===text===
  html = html.replace(/===([^=]+)===/g, '<mark style="background:#FFF3B0;padding:1px 4px;border-radius:3px">$1</mark>');
  // bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // italic: *text*
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#2F6FDB;text-decoration:underline">$1</a>');
  // headings: # ... at start of line
  html = html.replace(/^### (.+)$/gm, '<h4 style="font-size:15px;margin:12px 0 6px;color:var(--text)">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 style="font-size:17px;margin:16px 0 8px;color:var(--text)">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2 style="font-size:19px;margin:20px 0 10px;color:var(--text);border-bottom:1px solid var(--border);padding-bottom:4px">$1</h2>');
  // auto-link names
  html = autoLinkMarkdown(html);
  return html;
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
    var color = '#2F6FDB';
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
  h += '<label class="type-chip"><input type="radio" name="cfType" value="characters" onchange="refreshCardFields()"' + (type === 'characters' ? ' checked' : '') + '><span>👤 人物</span></label>';
  h += '<label class="type-chip"><input type="radio" name="cfType" value="world" onchange="refreshCardFields()"' + (type === 'world' ? ' checked' : '') + '><span>🌍 世界观</span></label>';
  h += '<label class="type-chip"><input type="radio" name="cfType" value="style" onchange="refreshCardFields()"' + (type === 'style' ? ' checked' : '') + '><span>📝 文风</span></label>';
  h += '</div></div>';

  // 名称
  h += '<div style="margin-bottom:12px"><label style="font-size:11px;color:var(--text-sub);display:block;margin-bottom:4px">名称</label>';
  h += '<input id="cfName" value="' + esc(name) + '" style="width:100%;padding:6px 12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-panel);color:var(--text);font-size:13px;font-family:var(--font-ui);outline:none" placeholder="输入' + (type === 'characters' ? '人物' : '') + '名称"></div>';

  // 模板字段
  var fields = templateFields[type] || [];
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

function refreshCardFields() {
  var radio = document.querySelector('input[name="cfType"]:checked');
  var type = radio ? radio.value : 'characters';
  // 切换类型时清空关系
  _tempRels = [];
  var relContainer = q('cfRelList');
  if (!relContainer) return;
  relContainer.innerHTML = '';
  var saved = {};
  var existingFields = el.querySelectorAll('.cf-field');
  existingFields.forEach(function(f) {
    var k = f.getAttribute('data-key');
    if (k) saved[k] = f.value;
  });
  // 重建字段
  var fields = _cardTemplateFields[type] || [];
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
  var contents = ['tab-overview', 'tab-hook', 'tab-ai', 'tab-style'];
  contents.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = (id === 'tab-' + tab) ? '' : 'none';
  });
  // 文风 tab 懒加载
  if (tab === 'style' && !document.getElementById('tab-style').getAttribute('data-loaded')) {
    loadStyleAnalysis();
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

async function saveChapter() {
  var title = q('cht').value;
  var body = q('chb').value;

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


function exportProject(format) {
  if (!_currentProject) return;
  var id = _currentProject.id;
  var url = tu(A + '/api/project/' + encodeURIComponent(id) + '/export/' + format);
  toast('⏳ 导出中...');
  fetch(url).then(function(r) { return r.json(); }).then(function(d) {
    if (d.ok) {
      toast('✅ 已保存到 ' + d.path);
    } else {
      toast('❌ ' + (d.error || '导出失败'));
    }
  }).catch(function() { toast('❌ 导出失败'); });
}
