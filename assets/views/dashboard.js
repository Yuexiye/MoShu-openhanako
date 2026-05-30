//  DASHBOARD VIEW
// ═══════════════════════════════════
function renderDashboardSidebar() {
  if (_projects.length === 0) {
    q('sidebar').innerHTML = '<div class="sidebar-header">项目</div><div class="empty-state" style="height:auto;padding:30px 10px"><div class="title" style="font-size:13px">暂无项目</div></div>';
    q('main-panel').innerHTML = '<div class="empty-state"><div class="icon">📊</div><div class="title">项目概况</div><div class="desc">选择项目查看写作进度和统计</div></div>';
    return;
  }

  var totalChapters = 0, totalCards = 0, totalWords = 0;
  _projects.forEach(function(p) {
    totalChapters += (p.chapterCount || 0);
    totalCards += (p.cardCount || 0);
  });

  var h = '<div class="sidebar-header">项目<span class="count">' + _projects.length + '</span></div>';
  h += '<div class="sidebar-list">';

  h += '<div style="padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:6px">';
  h += '<div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:10px;text-align:center"><div style="font-size:18px;font-weight:700;color:var(--accent)">' + _projects.length + '</div><div style="font-size:10px;color:var(--text-muted)">项目</div></div>';
  h += '<div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:10px;text-align:center"><div style="font-size:18px;font-weight:700;color:var(--accent)">' + totalChapters + '</div><div style="font-size:10px;color:var(--text-muted)">章节</div></div>';
  h += '</div>';

  h += '<div style="padding:4px 12px 4px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">📁 项目详情</div>';

  _projects.forEach(function(p) {
    h += '<div class="pj-card" onclick="openDashboard(\'' + p.id + '\')">';
    h += '<div class="pj-name">📊 ' + esc(p.name) + '</div>';
    h += '<div class="pj-meta">' + esc(p.type || '') + ' · ' + (p.chapterCount || 0) + '章 · ' + (p.cardCount || 0) + '卡</div>';
    h += '</div>';
  });

  h += '</div>';
  q('sidebar').innerHTML = h;

  renderGlobalDashboard();
}

function renderGlobalDashboard() {
  var totalChapters = 0, totalCards = 0;
  _projects.forEach(function(p) {
    totalChapters += (p.chapterCount || 0);
    totalCards += (p.cardCount || 0);
  });

  var h = '<div class="panel-header"><span class="badge">📊 总览</span><span style="font-size:15px;font-weight:600;color:var(--text)">所有项目</span></div>';
  h += '<div class="panel-body fade-in">';
  h += '<div class="stats-grid">';
  h += '<div class="stat-card"><div class="num">' + _projects.length + '</div><div class="lbl">项目</div></div>';
  h += '<div class="stat-card"><div class="num">' + totalChapters + '</div><div class="lbl">章节</div></div>';
  h += '<div class="stat-card"><div class="num">' + totalCards + '</div><div class="lbl">设定卡</div></div>';
  h += '<div class="stat-card"><div class="num">-</div><div class="lbl">总字数</div></div>';
  h += '</div>';

  if (_projects.length > 0) {
    h += '<div class="section"><div class="section-title">📁 项目列表</div></div>';
    h += '<div class="project-grid">';
    _projects.forEach(function(p) {
      h += '<div class="card" style="cursor:pointer" onclick="openDashboard(\'' + p.id + '\')">';
      h += '<div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px">' + esc(p.name) + '</div>';
      h += '<div style="font-size:11px;color:var(--text-subtle)">' + esc(p.type || '未分类') + '</div>';
      h += '<div style="display:flex;gap:12px;margin-top:8px;font-size:11px;color:var(--text-muted)">';
      h += '<span>📜 ' + (p.chapterCount || 0) + '章</span>';
      h += '<span>👤 ' + (p.cardCount || 0) + '卡</span>';
      h += '</div>';
      h += '</div>';
    });
    h += '</div>';
  }

  h += '</div>';
  q('main-panel').innerHTML = h;
}

async function openDashboard(id) {
  try {
  _currentProject = _projects.find(function(p) { return p.id === id; });
  if (!_currentProject) return;

  q('title-project').textContent = '📊 ' + esc(_currentProject.name);

  var ch = [], cd = [];
  try {
    ch = await (await fetch(tu(A + '/api/project/' + encodeURIComponent(id) + '/chapters'))).json();
    cd = await (await fetch(tu(A + '/api/project/' + encodeURIComponent(id) + '/cards'))).json();
  } catch(e) {}

  // 获取事实
  try {
    var fr = await fetch(tu(A + '/api/project/' + encodeURIComponent(id) + '/facts'));
    _facts = await fr.json();
  } catch(e) { _facts = []; }

  // 获取标记
  try {
    var mr = await fetch(tu(A + '/api/project/' + encodeURIComponent(id) + '/markers'));
    _markers = await mr.json();
  } catch(e) { _markers = []; }

  var tw = ch.reduce(function(s, x) { return s + (x.wordCount || 0); }, 0);

  var h = '<div class="panel-header">';
  h += '<span class="badge">📊 ' + esc(_currentProject.name) + '</span>';
  h += '<button class="btn btn-ghost" style="margin-left:8px" onclick="renderDashboardSidebar();renderGlobalDashboard();q(\'title-project\').textContent=\'\'">← 返回总览</button>';
  h += '</div>';
  h += '<div class="panel-body fade-in">';

  h += '<div class="stats-grid">';
  h += '<div class="stat-card"><div class="num">' + ch.length + '</div><div class="lbl">章节</div></div>';
  h += '<div class="stat-card"><div class="num">' + tw + '</div><div class="lbl">总字数</div></div>';
  h += '<div class="stat-card"><div class="num">' + cd.length + '</div><div class="lbl">设定卡</div></div>';
  h += '<div class="stat-card"><div class="num">' + (cd.filter(function(c) { return c.type === 'characters'; }).length) + '</div><div class="lbl">人物</div></div>';
  h += '</div>';

  // ── 写作进度仪表 ──
  var cDraft = ch.filter(function(x) { return !x.status || x.status === 'draft'; }).length;
  var cRevising = ch.filter(function(x) { return x.status === 'revising'; }).length;
  var cComplete = ch.filter(function(x) { return x.status === 'complete'; }).length;
  h += '<div style="border:1px solid var(--border);border-radius:var(--rm);padding:10px 14px;margin-bottom:16px;background:var(--bg-panel)">';
  h += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">📊 写作进度</div>';
  h += '<div style="display:flex;gap:12px;margin-bottom:8px;flex-wrap:wrap">';
  h += '<div style="flex:1;min-width:80px"><div style="font-size:10px;color:var(--text-muted)">草稿</div><div style="display:flex;align-items:center;gap:6px"><div style="flex:1;height:6px;background:var(--border);border-radius:3px"><div style="height:100%;background:#F59E0B;border-radius:3px;width:' + (ch.length ? Math.round(cDraft / ch.length * 100) : 0) + '%"></div></div><span style="font-size:12px;font-weight:600">' + cDraft + '</span></div></div>';
  h += '<div style="flex:1;min-width:80px"><div style="font-size:10px;color:var(--text-muted)">修订中</div><div style="display:flex;align-items:center;gap:6px"><div style="flex:1;height:6px;background:var(--border);border-radius:3px"><div style="height:100%;background:#6366F1;border-radius:3px;width:' + (ch.length ? Math.round(cRevising / ch.length * 100) : 0) + '%"></div></div><span style="font-size:12px;font-weight:600">' + cRevising + '</span></div></div>';
  h += '<div style="flex:1;min-width:80px"><div style="font-size:10px;color:var(--text-muted)">✅ 完成</div><div style="display:flex;align-items:center;gap:6px"><div style="flex:1;height:6px;background:var(--border);border-radius:3px"><div style="height:100%;background:#10B981;border-radius:3px;width:' + (ch.length ? Math.round(cComplete / ch.length * 100) : 0) + '%"></div></div><span style="font-size:12px;font-weight:600">' + cComplete + '</span></div></div>';
  h += '</div>';
  // 进度条
  if (ch.length > 0) {
    var pct = Math.round((cComplete / ch.length) * 100);
    h += '<div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden"><div style="height:100%;background:linear-gradient(90deg,#F59E0B,#6366F1,#10B981);border-radius:2px;width:' + pct + '%;transition:width 0.5s"></div></div>';
  }
  h += '</div>';

  // 互动文游导出按钮
  h += '<div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap">';
  h += '<button class="btn btn-ghost" onclick="showBranchTree()" style="flex:1;min-width:140px">🌳 分支树</button>';
  h += '<button class="btn btn-ghost" onclick="runCrossValidate()" style="flex:1;min-width:140px">🔍 交叉验证</button>';
  h += '<button class="btn btn-ghost" onclick="exportGamePack()" style="flex:1;min-width:140px">🎮 导出互动文游</button>';
  h += '<button class="btn btn-ghost" onclick="exportLinearReader()" style="flex:1;min-width:140px">📖 导出线性阅读</button>';
  h += '<button class="btn btn-ghost" onclick="exportTwineStory()" style="flex:1;min-width:140px">📜 SugarCube</button>';
  h += '</div>';

  // RPG世界状态面板
  var charCount = cd.filter(function(c) { return c.type === 'characters'; }).length;
  var worldCount = cd.filter(function(c) { return c.type === 'world'; }).length;
  var eventCount = _facts.filter(function(f) { return f.type === 'plot_event' && !f.deprecated_at; }).length;
  var locCount = _markers ? _markers.length : 0;
  h += '<div class="rpg-panel" style="background:linear-gradient(135deg,rgba(47,111,219,0.04),rgba(139,105,20,0.04));border:1px solid var(--border);border-radius:var(--rm);padding:12px 16px;margin-bottom:16px;display:flex;gap:24px;align-items:center;flex-wrap:wrap">';
  h += '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:20px">🗺️</span><div><div style="font-size:10px;color:var(--text-muted)">世界状态</div><div style="font-size:12px;font-weight:600;color:var(--text)">' + esc(_currentProject.name) + '</div></div></div>';
  h += '<div style="width:1px;height:36px;background:var(--border)"></div>';
  h += '<div style="text-align:center"><div style="font-size:11px;color:var(--text-muted)">👤 角色</div><div style="font-size:18px;font-weight:700;color:var(--accent)">' + charCount + '</div></div>';
  h += '<div style="text-align:center"><div style="font-size:11px;color:var(--text-muted)">📜 事件</div><div style="font-size:18px;font-weight:700;color:#B91C1C">' + eventCount + '</div></div>';
  h += '<div style="text-align:center"><div style="font-size:11px;color:var(--text-muted)">📍 地点</div><div style="font-size:18px;font-weight:700;color:#8B6914">' + locCount + '</div></div>';
  h += '<div style="text-align:center"><div style="font-size:11px;color:var(--text-muted)">📚 章节</div><div style="font-size:18px;font-weight:700;color:var(--text)">' + ch.length + '</div></div>';
  h += '</div>';

  // 编年史
  var tlEvents = [];
  ch.forEach(function(c) {
    tlEvents.push({ type:'chapter', id:c.id, title:c.title, date:c.created_at, wordCount:c.wordCount, status:c.status, body:c.body });
  });
  _facts.forEach(function(f) {
    if (f.type === 'timeline' && !f.deprecated_at) {
      tlEvents.push({ type:'event', id:f.id, title:f.content, date:f.created_at });
    }
  });
  tlEvents.sort(function(a,b) { return (a.date||'').localeCompare(b.date||''); });
  if (tlEvents.length > 0) {
    h += '<div class="section"><div class="section-title">📜 编年史 <span style="font-size:11px;font-weight:400;color:var(--text-muted)">' + tlEvents.length + '条</span>';
    h += '<button class="btn btn-ghost" style="float:right;font-size:10px;padding:1px 6px;margin-top:-2px" onclick="_tlExpanded=!_tlExpanded;var ds=document.querySelectorAll(\'.tl-detail\');ds.forEach(function(d){d.style.display=_tlExpanded?\'\':\'none\'});this.textContent=_tlExpanded?\'收起\':\'展开\'">收起</button>';
    h += '</div></div>';
    if (typeof _tlExpanded === 'undefined') _tlExpanded = true;
    h += '<div class="timeline" style="position:relative;padding-left:16px;margin-left:4px">';
    h += '<div style="position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--border)"></div>';
    tlEvents.forEach(function(ev) {
      var isChapter = ev.type === 'chapter';
      var icon = isChapter ? '📄' : '⏱';
      var dotColor = isChapter ? 'var(--accent)' : '#B91C1C';
      var dateLabel = ev.date ? new Date(ev.date).toLocaleDateString('zh-CN',{month:'short',day:'numeric'}) : '';
      var preview = '';
      if (isChapter && ev.body) {
        preview = ev.body.replace(/[#*_\n]/g,' ').substring(0,80).trim();
      }
      h += '<div style="position:relative;padding:4px 0 4px 16px;margin-bottom:2px">';
      h += '<div style="position:absolute;left:-4px;top:10px;width:8px;height:8px;border-radius:50%;background:' + dotColor + ';border:2px solid var(--bg)"></div>';
      h += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:1px">' + dateLabel + '</div>';
      h += '<div style="display:flex;align-items:center;gap:4px">';
      h += '<span>' + icon + '</span>';
      if (isChapter) {
        h += '<a href="javascript:void(0)" onclick="openWritingFromDashboard(\'' + ev.id + '\')" style="font-size:12px;font-weight:500;color:var(--accent);text-decoration:none;cursor:pointer" onmouseover="this.style.textDecoration=\'underline\'" onmouseout="this.style.textDecoration=\'none\'">' + esc(ev.title) + '</a>';
        h += '<span style="font-size:10px;color:var(--text-muted);margin-left:4px">' + (ev.wordCount||0) + '字</span>';
        h += '<span style="font-size:10px;color:var(--text-muted);margin-left:4px" class="tl-detail">' + (ev.status||'') + '</span>';
      } else {
        h += '<span style="font-size:12px;color:var(--text)">' + esc(ev.title) + '</span>';
      }
      h += '</div>';
      if (preview) {
        h += '<div class="tl-detail" style="font-size:10px;color:var(--text-muted);margin-top:2px;line-height:1.4;opacity:0.8">' + esc(preview) + (preview.length>=80?'…':'') + '</div>';
      }
      h += '</div>';
    });
    h += '</div>';
  }

  // 事实全典
  var activeFacts = _facts.filter(function(f) { return !f.deprecated_at; });
  var typeLabels = { character_trait:'👤 人物', world_lore:'🌍 世界', plot_event:'📖 情节', relationship:'🔗 关系', timeline:'⏱ 时间', rule:'📋 规则' };
  var typeColors = { character_trait:'#2F6FDB', world_lore:'#8B6914', plot_event:'#B91C1C', relationship:'#059669', timeline:'#7C3AED', rule:'#6F6A60' };

  var filtered = _factFilter ? activeFacts.filter(function(f) {
    var kw = _factFilter.toLowerCase();
    return (f.content && f.content.toLowerCase().indexOf(kw) > -1) ||
           (f.tags && f.tags.some(function(t) { return t.toLowerCase().indexOf(kw) > -1; }));
  }) : activeFacts;

  var factored = true;
  if (factored) {
    h += '<div class="section"><div class="section-title">🔍 事实全典 <span style="font-size:11px;font-weight:400;color:var(--text-muted)">' + (activeFacts.length || 0) + '条</span><button class="btn btn-ghost" style="font-size:11px;padding:2px 6px" onclick="_factTableView=!_factTableView;openDashboard(\'' + id + '\')" title="切换表格视图">' + (_factTableView ? '📋 卡片' : '📋 表格') + '</button><button class="btn btn-ghost" style="font-size:11px;padding:2px 8px;margin-left:auto" onclick="addFact()">+ 新建</button></div>';

    h += '<div style="margin-bottom:12px"><div style="position:relative;display:inline-block;width:100%;max-width:400px"><span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px;pointer-events:none;z-index:1">🔍</span><input class="fact-search" id="factSearch" type="text" placeholder="搜索事实..." value="' + esc(_factFilter) + '" onkeydown="if(event.key===\'Enter\'){_factFilter=this.value;openDashboard(\'' + id + '\')}" style="width:100%;padding:7px 12px 7px 32px;border:1px solid var(--border);border-radius:20px;background:var(--bg-panel);color:var(--text);font-size:12px;font-family:var(--font-ui);outline:none;transition:border-color .2s,box-shadow .2s" onfocus="this.style.borderColor=\'var(--accent)\';this.style.boxShadow=\'0 0 0 2px var(--accent-bg)\'" onblur="this.style.borderColor=\'var(--border)\';this.style.boxShadow=\'\'"></div>';
    if (_factFilter) h += '<span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:14px;color:var(--text-muted);cursor:pointer;z-index:2" onclick="event.stopPropagation();_factFilter=\'\';openDashboard(\'' + id + '\')" title="清除搜索">✕</span>';
    h += '</div>';

    if (activeFacts.length === 0) {
      h += '<div class="empty-state" style="height:80px;padding:16px"><div class="title" style="font-size:12px">暂无事实数据</div><div class="desc" style="font-size:11px">点上方 + 新建添加第一条事实</div></div>';
    } else if (_factFilter && filtered.length === 0) {
      h += '<div style="padding:16px;text-align:center;font-size:12px;color:var(--text-muted)">未找到包含「' + esc(_factFilter) + '」的事实</div>';
    } else if (_factFilter) {
      // 搜索模式：弹出独立结果面板
      h += '<div class="card-detail-popup fade-in" style="margin:8px 0"><div style="font-weight:600;margin-bottom:8px;font-size:13px">🔎 搜索「' + esc(_factFilter) + '」<span style="font-weight:400;color:var(--text-muted);font-size:11px;margin-left:4px">' + filtered.length + '条结果</span></div>';
      filtered.forEach(function(f) {
        var color = typeColors[f.type] || '#6F6A60';
        var label = typeLabels[f.type] || f.type;
        var highlighted = esc(f.content).replace(new RegExp('(' + _factFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark style="background:#FFF3CD;color:#856404;padding:0 2px;border-radius:2px">$1</mark>');
        h += '<div style="background:var(--bg-panel);border:1px solid var(--border-light);border-radius:var(--radius);padding:8px 12px;margin-bottom:4px;display:flex;gap:10px;align-items:flex-start">';
        h += '<div style="width:3px;height:20px;border-radius:2px;background:' + color + ';flex-shrink:0;margin-top:2px"></div>';
        h += '<div style="flex:1;min-width:0">';
        h += '<div style="font-size:11px;color:' + color + ';font-weight:600;margin-bottom:3px">' + label + '</div>';
        h += '<div style="font-size:12px;color:var(--text);line-height:1.6">' + highlighted + '</div>';
        h += '<div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap">';
        if (f.confidence !== undefined && f.confidence < 1) {
          h += '<span style="font-size:10px;color:var(--text-muted)">置信' + Math.round(f.confidence*100) + '%</span>';
        }
        if (f.tags && f.tags.length) {
          f.tags.forEach(function(tag) { h += '<span class="tag">' + esc(tag) + '</span>'; });
        }
        if (f.source_chapter) { h += '<span style="font-size:10px;color:var(--text-muted)">📎 ' + esc(f.source_chapter) + '</span>'; }
        h += '</div>';
        h += '</div></div>';
      });
      h += '</div>';
    } else if (_factTableView) {
      var sorted = filtered.slice().sort(function(a, b) {
        return (a.type || '').localeCompare(b.type || '');
      });
      h += '<div style="overflow-x:auto;max-height:400px;overflow-y:auto;border:1px solid var(--border-light);border-radius:var(--radius)">';
      h += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
      h += '<thead><tr style="background:var(--bg-alt);text-align:left">';
      h += '<th style="padding:6px 10px;font-weight:600;color:var(--text-sub);border-bottom:1px solid var(--border);min-width:60px">类型</th>';
      h += '<th style="padding:6px 10px;font-weight:600;color:var(--text-sub);border-bottom:1px solid var(--border)">内容</th>';
      h += '<th style="padding:6px 10px;font-weight:600;color:var(--text-sub);border-bottom:1px solid var(--border);min-width:60px">置信度</th>';
      h += '<th style="padding:6px 10px;font-weight:600;color:var(--text-sub);border-bottom:1px solid var(--border);min-width:80px">来源</th>';
      h += '<th style="padding:6px 10px;font-weight:600;color:var(--text-sub);border-bottom:1px solid var(--border);min-width:60px">标签</th>';
      h += '</tr></thead><tbody>';
      sorted.forEach(function(f) {
        var color = typeColors[f.type] || '#6F6A60';
        var label = typeLabels[f.type] || f.type;
        h += '<tr style="border-bottom:1px solid var(--border-light);cursor:default" onmouseover="this.style.background=\'var(--bg-hover)\'" onmouseout="this.style.background=\'\'">';
        h += '<td style="padding:6px 10px;color:' + color + ';font-weight:500">' + label + '</td>';
        h += '<td style="padding:6px 10px;color:var(--text);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(f.content) + '</td>';
        h += '<td style="padding:6px 10px;color:var(--text-muted)">' + (f.confidence !== undefined ? Math.round(f.confidence*100) + '%' : '-') + '</td>';
        h += '<td style="padding:6px 10px;color:var(--text-muted)">' + (f.source_chapter ? esc(f.source_chapter) : '-') + '</td>';
        h += '<td style="padding:6px 10px">' + (f.tags ? f.tags.map(function(t) { return '<span class="tag" style="font-size:10px">' + esc(t) + '</span>'; }).join(' ') : '-') + '</td>';
        h += '</tr>';
      });
      h += '</tbody></table></div>';
    } else {
      var grouped = {};
      filtered.forEach(function(f) {
        if (!grouped[f.type]) grouped[f.type] = [];
        grouped[f.type].push(f);
      });
      var typeOrder = ['character_trait','world_lore','plot_event','relationship','timeline','rule'];
      typeOrder.forEach(function(t) {
        var facts = grouped[t];
        if (!facts || !facts.length) return;
        var color = typeColors[t] || '#6F6A60';
        h += '<div style="margin-bottom:10px">';
        h += '<div style="font-size:12px;font-weight:600;color:' + color + ';margin-bottom:6px">' + (typeLabels[t] || t) + '<span style="color:var(--text-muted);font-weight:400;margin-left:4px">' + facts.length + '</span></div>';
        facts.forEach(function(f) {
          h += '<div class="fact-item" style="background:var(--bg-panel);border:1px solid var(--border-light);border-radius:var(--radius);padding:8px 12px;margin-bottom:4px;display:flex;gap:10px;align-items:flex-start">';
          h += '<div style="width:3px;height:20px;border-radius:2px;background:' + color + ';flex-shrink:0;margin-top:2px"></div>';
          h += '<div style="flex:1;min-width:0">';
          h += '<div style="font-size:12px;color:var(--text);line-height:1.6">' + esc(f.content) + '</div>';
          h += '<div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap">';
          if (f.confidence !== undefined && f.confidence < 1) {
            h += '<span style="font-size:10px;color:var(--text-muted)">置信' + Math.round(f.confidence*100) + '%</span>';
          }
          if (f.tags && f.tags.length) {
            f.tags.forEach(function(tag) { h += '<span class="tag">' + esc(tag) + '</span>'; });
          }
          if (f.source_chapter) { h += '<span style="font-size:10px;color:var(--text-muted)">📎 ' + esc(f.source_chapter) + '</span>'; }
          h += '</div>';
          h += '</div></div>';
        });
        h += '</div>';
      });
    }
  }

  // 设定档案
  if (cd.length > 0) {
    h += '<div class="section"><div class="section-title">👤 设定档案</div></div>';
    h += '<div class="char-grid">';
    cd.forEach(function(c) {
      h += '<div class="char-card">';
      h += '<div class="char-name">' + (c.type === 'characters' ? '👤 ' : '📝 ') + esc(c.name) + '</div>';
      if (c.content && c.content.role) { h += '<div class="char-role">' + esc(c.content.role) + '</div>'; }
      h += '</div>';
    });
    h += '</div>';
  }

  // 知识图谱
  h += '<div class="section"><div class="section-title">🕸 知识图谱</div>';
  h += '<div style="display:flex;gap:4px;margin-bottom:8px">';
  h += '<button class="graph-tab-btn active" onclick="switchGraphTab(\'entity\', this)" style="font-size:11px;padding:3px 10px;border:1px solid var(--border);border-radius:var(--radius);background:var(--accent);color:#fff;cursor:pointer">人物关系</button>';
  h += '<button class="graph-tab-btn" onclick="switchGraphTab(\'plot\', this)" style="font-size:11px;padding:3px 10px;border:1px solid var(--border);border-radius:var(--radius);background:transparent;color:var(--text-muted);cursor:pointer">情节关系</button>';
  h += '<button onclick="openGraphModal()" style="font-size:11px;padding:3px 10px;border:1px solid var(--border);border-radius:var(--radius);background:transparent;color:var(--text-muted);cursor:pointer;margin-left:auto">⛶ 放大</button>';
  h += '</div></div>';
  h += '<div class="graph-wrap" id="graphContainer"></div>';

  h += '</div>';
  q('main-panel').innerHTML = h;
  } catch(e) {
    console.error('openDashboard error:', e);
    q('main-panel').innerHTML = '<div style="padding:16px;color:red">渲染错误: ' + (e.message || '') + '</div>';
  }

  // 加载图谱
  console.log('[graph] renderDashboardSidebar done, functions:', typeof switchGraphTab, typeof openGraphModal, typeof renderGraph);
  if (_graphLoaded === 0) { loadCytoscape(renderGraph); }
  else { setTimeout(renderGraph, 100); }
}

function loadCytoscape(cb) {
  if (_graphLoaded === 2) { cb(); return; }
  if (_graphLoaded === 1) { setTimeout(function() { loadCytoscape(cb); }, 200); return; }
  _graphLoaded = 1;
  var script = document.createElement('script');
  script.onload = function() { _graphLoaded = 2; cb(); };
  script.src = 'https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js';
  document.body.appendChild(script);
}

var _graphTab = 'entity';
var _graphModalContainer = null; // 引用模态框容器
var _graphModalOpen = false;

function switchGraphTab(type, btn) {
  console.log('[graph] switchGraphTab called:', type);
  _graphTab = type;
  var btns = document.querySelectorAll('.graph-tab-btn');
  btns.forEach(function(b) { b.style.background = 'transparent'; b.style.color = 'var(--text-muted)'; b.classList.remove('active'); });
  btn.style.background = 'var(--accent)'; btn.style.color = '#fff'; btn.classList.add('active');
  // 模态框打开时只刷新模态框，不渲染主面板（避免遮挡）
  if (_graphModalOpen && _graphModalContainer) {
    if (_graphModalContainer._graph) {
      _graphModalContainer._graph.destroy();
      _graphModalContainer._graph = null;
    }
    _renderGraphForContainer(_graphModalContainer);
    // 也更新模态框标题
    var modalTitle = document.querySelector('#graphModal span[style*="font-size: 14px"]');
    if (modalTitle) {
      modalTitle.textContent = '🕸 知识图谱 — ' + (_graphTab === 'plot' ? '情节关系' : '人物关系');
    }
    return; // 不继续执行主面板渲染
  }
  // 模态框没打开，正常渲染主面板
  if (q('graphContainer') && q('graphContainer')._graph) {
    q('graphContainer')._graph.destroy();
    q('graphContainer')._graph = null;
  }
  if (window.cytoscape) {
    renderGraph();
  }
}

function openGraphModal() {
  console.log('[graph] openGraphModal called');
  if (_graphModalOpen) return;
  _graphModalOpen = true;

  var overlay = document.createElement('div');
  overlay.id = 'graphModal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:500;display:flex;align-items:center;justify-content:center;';

  var box = document.createElement('div');
  box.style.cssText = 'width:95vw;height:92vh;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);display:flex;flex-direction:column;overflow:hidden;';

  var header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border);gap:8px;';
  var title = document.createElement('span');
  title.style.cssText = 'font-size:14px;font-weight:600;';
  function updateModalTitle() {
    title.textContent = '🕸 知识图谱 — ' + (_graphTab === 'plot' ? '情节关系' : '人物关系');
  }
  updateModalTitle();
  var closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ 关闭';
  closeBtn.style.cssText = 'font-size:12px;padding:4px 12px;border:1px solid var(--border);border-radius:var(--radius);background:transparent;color:var(--text-muted);cursor:pointer;';
  closeBtn.onclick = function() { overlay.remove(); _graphModalOpen = false; _graphModalContainer = null; };
  var exportBtn = document.createElement('button');
  exportBtn.textContent = '📷 导出图片';
  exportBtn.style.cssText = 'font-size:12px;padding:4px 12px;border:1px solid var(--border);border-radius:var(--radius);background:transparent;color:var(--text-muted);cursor:pointer;';
  exportBtn.onclick = function() {
    var modalContainer = document.getElementById('graphModalContainer');
    if (modalContainer && modalContainer._graph) {
      var png = modalContainer._graph.png();
      var a = document.createElement('a');
      a.href = png;
      a.download = 'knowledge-graph-' + (_graphTab || 'entity') + '.png';
      a.click();
    }
  };
  header.appendChild(title);
  header.appendChild(exportBtn);
  header.appendChild(closeBtn);

  // 时间线筛选（仅情节图）
  var filterBar = null;
  if (_graphTab === 'plot') {
    filterBar = document.createElement('div');
    filterBar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 16px;border-bottom:1px solid var(--border);font-size:11px;';
    var filterLabel = document.createElement('span');
    filterLabel.textContent = '按章节筛选：';
    filterLabel.style.cssText = 'color:var(--text-muted);white-space:nowrap;';
    var filterSelect = document.createElement('select');
    filterSelect.style.cssText = 'flex:1;padding:3px 6px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:11px;';
    filterSelect.innerHTML = '<option value="all">全部章节</option>';
    // 从已加载的数据获取章节列表
    filterSelect._pendingRefresh = true; // 标记需要刷新选项
    var filterBtn = document.createElement('button');
    filterBtn.textContent = '刷新';
    filterBtn.style.cssText = 'font-size:11px;padding:3px 8px;border:1px solid var(--border);border-radius:var(--radius);background:transparent;color:var(--text-muted);cursor:pointer;';
    filterBtn.onclick = function() { filterSelect._pendingRefresh = true; _renderGraphForContainer(content); };
    filterBar.appendChild(filterLabel);
    filterBar.appendChild(filterSelect);
    filterBar.appendChild(filterBtn);
  }

  var content = document.createElement('div');
  content.id = 'graphModalContainer';
  content.style.cssText = 'flex:1;width:100%;';

  box.appendChild(header);
  if (filterBar) box.insertBefore(filterBar, content);
  box.appendChild(content);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  _graphModalContainer = content; // 保存容器引用
  if (window.cytoscape) {
    // 复用当前渲染逻辑，传入不同容器
    _renderGraphForContainer(content);
  } else {
    loadCytoscape(function() { _renderGraphForContainer(content); });
  }
}

function _renderGraphForContainer(container) {
  console.log('[graph] _renderGraphForContainer called for:', container ? container.id : 'null', 'tabType:', _graphTab);
  // 临时覆盖 renderGraph 的容器
  var origContainer = q('graphContainer');
  // 直接调用渲染逻辑
  var tabType = _graphTab || 'entity';
  var url = tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/graph?type=' + tabType);
  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(graphData) {
      if (!graphData || (!graphData.nodes.length)) {
        container.innerHTML = '<div class="empty-state" style="height:100%;display:flex;align-items:center;justify-content:center"><div style="text-align:center"><div class="title" style="font-size:14px">暂无关系数据</div></div></div>';
        return;
      }

      // 情节图：填充章节筛选器
      if (tabType === 'plot') {
        var filterSelect = document.querySelector('#graphModalContainer')?.parentElement?.querySelector('select');
        if (filterSelect && filterSelect._pendingRefresh) {
          filterSelect._pendingRefresh = false;
          var chapterSet = new Set();
          (graphData.edges || []).forEach(function(e) {
            if (e.description) chapterSet.add(e.description);
          });
          var chapters = [...chapterSet].sort();
          while (filterSelect.options.length > 1) filterSelect.remove(1);
          chapters.forEach(function(ch) {
            var opt = document.createElement('option');
            opt.value = ch;
            opt.textContent = ch;
            filterSelect.appendChild(opt);
          });
          filterSelect.onchange = function() { _renderGraphForContainer(container); };
        }
      }

      // 情节图：按章节筛选
      var filterSelect2 = document.querySelector('#graphModalContainer')?.parentElement?.querySelector('select');
      var selectedChapter = (filterSelect2 && filterSelect2.value) || 'all';
      var filteredEdges = graphData.edges || [];
      if (tabType === 'plot' && selectedChapter !== 'all') {
        filteredEdges = filteredEdges.filter(function(e) { return e.description === selectedChapter; });
      }

      var els = [];
      var charColorMap = {};
      var charPalette = ['#2F6FDB', '#DB2F6F', '#2FDB6F', '#DB8F2F', '#8F2FDB', '#2FDBDB', '#DB2FDB', '#6FDB2F', '#DBDB2F', '#2F4FDB'];
      var charIdx = 0;
      if (graphData.nodes) graphData.nodes.forEach(function(n) {
        if (n.type === 'character') {
          if (!charColorMap[n.name]) charColorMap[n.name] = charPalette[charIdx++ % charPalette.length];
          n._color = charColorMap[n.name];
        }
        var d = { id: n.id, label: n.name, type: n.type || 'character' };
        if (n._color) d._color = n._color;
        if (n.count) d.count = n.count;
        els.push({ data: d });
      });
      if (filteredEdges) filteredEdges.forEach(function(e) {
        var relMap = { friend: '好友', rival: '对手', enemy: '敌人', co_present: '同框', dialogue: '对话', relationship: '关系' };
        var shortLabel = relMap[e.relation] || e.relation || '关系';
        els.push({ data: { id: 'e_' + e.id, source: e.source, target: e.target, label: shortLabel, detail: e.description || shortLabel, count: e.count || 1, relation: e.relation } });
      });
      if (els.length === 0) {
        container.innerHTML = '<div class="empty-state" style="height:100%;display:flex;align-items:center;justify-content:center"><div style="text-align:center"><div class="title" style="font-size:14px">暂无关系数据</div></div></div>';
        return;
      }
      renderCytoscapeGraph(els, 'graphModalContainer');
    });
}

function renderGraph() {
  if (!window.cytoscape || !q('graphContainer')) return;

  // 角色颜色池
  var charColorMap = {};
  var charPalette = ['#2F6FDB', '#DB2F6F', '#2FDB6F', '#DB8F2F', '#8F2FDB', '#2FDBDB', '#DB2FDB', '#6FDB2F', '#DBDB2F', '#2F4FDB'];
  var charIdx = 0;

  // 先尝试从 API 获取关系图
  var tabType = _graphTab || 'entity';
  fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/graph?type=' + tabType))
    .then(function(r) { return r.json(); })
    .then(function(graphData) {
      if (!graphData || (!graphData.nodes.length && !_cards)) {
        q('graphContainer').innerHTML = '<div class="empty-state" style="height:200px"><div class="title" style="font-size:12px">暂无关系数据</div><div class="desc" style="font-size:11px">请在人物卡中添加 relationships 字段后刷新</div></div>';
        return;
      }
      var els = [];
      if (graphData.nodes) graphData.nodes.forEach(function(n) {
        if (n.type === 'character') {
          if (!charColorMap[n.name]) charColorMap[n.name] = charPalette[charIdx++ % charPalette.length];
          n._color = charColorMap[n.name];
        }
        els.push({ data: { id: n.id, label: n.name, type: n.type || 'character', _color: n._color || '', count: n.count || 1 } });
      });
      if (graphData.edges) graphData.edges.forEach(function(e) {
        var relMap = { friend: '好友', rival: '对手', enemy: '敌人', co_present: '同框', dialogue: '对话' };
        var shortLabel = relMap[e.relation] || e.relation || '';
        els.push({ data: { id: e.id, source: e.source, target: e.target, relation: e.relation, label: shortLabel, detail: e.description || '', count: e.count || 1 } });
      });
      if (els.length === 0) {
        q('graphContainer').innerHTML = '<div class="empty-state" style="height:200px"><div class="title" style="font-size:12px">暂无关系数据</div><div class="desc" style="font-size:11px">请在人物卡中添加 relationships 字段后刷新</div></div>';
        return;
      }
      renderCytoscapeGraph(els);
    }).catch(function() {
      // 降级到旧数据源
      renderGraphLegacy();
    });
}

function renderGraphLegacy() {
  var els = [];
  var charNames = {};
  var charColorMap = {};
  var charPalette = ['#2F6FDB', '#DB2F6F', '#2FDB6F', '#DB8F2F', '#8F2FDB', '#2FDBDB', '#2FDB6F', '#6FDB2F', '#DBDB2F', '#2F4FDB'];
  var charIdx = 0;

  // 节点：人物（分配颜色）
  if (_cards) _cards.forEach(function(c) {
    if (c.type === 'characters' && c.name) {
      charNames[c.name] = true;
      if (!charColorMap[c.name]) charColorMap[c.name] = charPalette[charIdx++ % charPalette.length];
      els.push({ data: { id: 'ch_' + c.name, label: c.name, type: 'character', _color: charColorMap[c.name] } });
    }
  });

  // 节点：地点
  if (_markers) _markers.forEach(function(m) {
    if (m.name) {
      els.push({ data: { id: 'loc_' + m.name, label: m.name, type: 'location' } });
    }
  });

  // 节点：设定
  if (_cards) _cards.forEach(function(c) {
    if (c.type === 'world' && c.name) {
      els.push({ data: { id: 'set_' + c.name, label: c.name, type: 'setting' } });
    }
  });

  // 边：从关系类型事实
  if (_facts) _facts.forEach(function(f) {
    if (f.type === 'relationship' && f.content && !f.deprecated_at) {
      var content = f.content;
      var found = [];
      Object.keys(charNames).forEach(function(name) {
        if (content.indexOf(name) > -1) found.push(name);
      });
      if (found.length >= 2) {
        els.push({ data: { id: 'rel_' + f.id, source: 'ch_' + found[0], target: 'ch_' + found[1], label: '关系', count: 1 } });
      }
    }
  });

  // 边：地点关联章节 → 人物
  if (_markers) _markers.forEach(function(m) {
    if (m.name && m.linkedChapters && m.linkedChapters.length) {
      var chars = els.filter(function(e) { return e.data.type === 'character'; });
      if (chars.length) {
        els.push({ data: { id: 'ml_' + m.name + '_' + chars[0].data.id, source: 'loc_' + m.name, target: chars[0].data.id, type: 'located', label: '位于', count: 1 } });
      }
    }
  });

  if (els.length === 0) {
    q('graphContainer').innerHTML = '<div class="empty-state" style="height:200px"><div class="title" style="font-size:12px">暂无关系数据</div><div class="desc" style="font-size:11px">添加人物卡和关系事实后自动生成图谱</div></div>';
    return;
  }

  renderCytoscapeGraph(els);
}

function renderCytoscapeGraph(els, containerId) {
  // ver: 20260527v4
  containerId = containerId || 'graphContainer';
  var container = q(containerId);
  if (!container) return;
  if (container._graph) container._graph.destroy();

  var isPlot = _graphTab === 'plot';
  var edgeColor = isPlot ? 'rgba(239,68,68,0.25)' : 'rgba(43,42,39,0.25)';
  var edgeLabel = isPlot ? 'rgba(239,68,68,0.7)' : '#6F6A60';
  var height = containerId === 'graphContainer' ? '240px' : '100%';

  var cy = cytoscape({
    container: container,
    elements: els,
    style: [
      { selector: 'node', style: { 'label': 'data(label)', 'font-size': '10px', 'font-family': '"PingFang SC","Microsoft YaHei",sans-serif', 'color': '#2B2A27', 'text-valign': 'bottom', 'text-halign': 'center', 'text-margin-y': 6 } },
      { selector: 'node[type="character"]', style: { 'background-color': 'data(_color)', 'width': 28, 'height': 28 } },
      { selector: 'node[type="location"]', style: { 'background-color': '#8B6914', 'width': 20, 'height': 20 } },
      { selector: 'node[type="fact"]', style: { 'background-color': '#E8734A', 'width': 16, 'height': 16 } },
      { selector: 'node[type="rule"]', style: { 'background-color': '#9B59B6', 'width': 16, 'height': 16 } },
      { selector: 'node[type="setting"]', style: { 'background-color': '#6F6A60', 'width': 18, 'height': 18 } },
      { selector: 'edge', style: { 'width': 1.5, 'line-color': edgeColor, 'curve-style': 'bezier', 'label': 'data(label)', 'font-size': '9px', 'font-weight': '600', 'color': edgeLabel, 'text-opacity': 1, 'text-background-opacity': 1, 'text-background-color': '#FAF6F0', 'text-background-padding': '2px 4px', 'text-background-shape': 'roundrectangle', 'text-border-width': 0.5, 'text-border-color': 'rgba(0,0,0,0.1)', 'text-valign': 'center', 'text-halign': 'center', 'overlay-padding': 0, 'overlay-opacity': 0 } },
      { selector: 'edge[type="located"]', style: { 'line-style': 'dashed', 'line-color': 'rgba(139,105,20,0.3)' } },
      { selector: '.dimmed', style: { 'opacity': 0.15 } }
    ],
    layout: { name: 'cose', animate: false, fit: true, padding: 30 },
    zoomingEnabled: true,
    userZoomingEnabled: true
  });

  container._graph = cy;
  container.style.background = 'var(--bg-panel)';
  container.style.borderRadius = 'var(--radius)';
  container.style.height = height;

  // resizeObserver：图谱节点超过容器高度时自动扩展
  if (containerId === 'graphContainer') {
    container.style.transition = 'height 0.2s';
    if (container._resizeObs) container._resizeObs.disconnect();
    container._resizeObs = new ResizeObserver(function(entries) {
      var maxH = Math.max(...entries.map(e => e.contentRect.height));
      if (maxH > 240) {
        container.style.height = Math.min(maxH + 20, 450) + 'px';
      }
    });
    container._resizeObs.observe(container);
  }

  // 点击高亮 + 双击查路径
  var lastClickedNode = null;
  cy.on('tap', 'node', function(evt) {
    var node = evt.target;
    if (lastClickedNode && lastClickedNode.id() === node.id()) return; // 双击忽略
    lastClickedNode = node;
    cy.elements().removeClass('dimmed');
    cy.elements().difference(node.neighborhood().add(node)).addClass('dimmed');
  });
  cy.on('dbltap', 'node', function(evt) {
    var node = evt.target;
    // 高亮该节点到所有邻居的最短路径
    var neighbors = node.neighborhood('edge');
    if (neighbors.length === 0) return;
    // 高亮所有邻居节点和边
    var highlightSet = cy.elements().intersection(node.neighborhood('node').add(node));
    cy.elements().removeClass('dimmed');
    highlightSet.removeClass('dimmed');
    // 显示关系链信息
    var pathInfo = document.getElementById('graphPathInfo');
    if (pathInfo) pathInfo.remove();
    var div = document.createElement('div');
    div.id = 'graphPathInfo';
    div.style.cssText = 'position:fixed;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px;font-size:11px;color:var(--text);box-shadow:0 4px 16px rgba(0,0,0,.12);z-index:250;max-width:250px;pointer-events:none';
    var relMap = { friend: '好友', rival: '对手', enemy: '敌人', co_present: '同框', dialogue: '对话' };
    var lines = [node.data('label') + ' 的关系链：'];
    node.connectedEdges().forEach(function(e) {
      var other = e.source().id() === node.id() ? e.target() : e.source();
      var relName = relMap[e.data('relation')] || e.data('relation') || '关系';
      var count = e.data('count') ? ' ×' + e.data('count') : '';
      lines.push('  → ' + other.data('label') + ' (' + relName + count + ')');
    });
    div.innerHTML = lines.join('<br>');
    document.body.appendChild(div);
    div.style.left = Math.min(evt.originalEvent.clientX + 12, window.innerWidth - 260) + 'px';
    div.style.top = (evt.originalEvent.clientY - 40) + 'px';
    setTimeout(function() { if (div.parentNode) div.remove(); }, 5000);
  });
  // 悬停边显示详情
  cy.on('mouseover', 'edge', function(evt) {
    var edge = evt.target;
    var data = edge.data();
    var tip = document.getElementById('graphEdgeTip');
    if (tip) tip.remove();
    var div = document.createElement('div');
    div.id = 'graphEdgeTip';
    div.style.cssText = 'position:fixed;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:8px 12px;font-size:11px;color:var(--text);box-shadow:0 4px 16px rgba(0,0,0,.12);z-index:250;max-width:200px;pointer-events:none';
    var relMap = { friend: '好友', rival: '对手', enemy: '敌人', co_present: '同框', dialogue: '对话' };
    var relName = relMap[data.relation] || data.relation || '关系';
    var extra = '';
    if (data.count) extra += '<br><span style="color:var(--text-sub);font-size:10px">共互动 ×' + data.count + '</span>';
    extra += (data.detail && data.detail !== relName ? '<br><span style="color:var(--text-muted);font-size:10px">' + esc(data.detail) + '</span>' : '');
    div.innerHTML = '<b>' + esc(relName) + '</b>' + extra;
    document.body.appendChild(div);
    div.style.left = Math.min(evt.originalEvent.clientX + 12, window.innerWidth - 210) + 'px';
    div.style.top = (evt.originalEvent.clientY - 40) + 'px';
  });
  cy.on('mouseout', 'edge', function() {
    var tip = document.getElementById('graphEdgeTip');
    if (tip) tip.remove();
  });
  cy.on('tap', function(evt) {
    if (evt.target === cy) {
      cy.elements().removeClass('dimmed');
    }
  });

  // ── 图谱右键菜单 ──
  cy.on('contextmenu', 'node', function(evt) {
    showGraphNodeMenu(evt.originalEvent, evt.target, cy);
  });
  cy.on('contextmenu', 'edge', function(evt) {
    showGraphEdgeMenu(evt.originalEvent, evt.target);
  });
  cy.on('contextmenu', function(evt) {
    if (evt.target === cy) closeContextMenu();
  });

  // 保存引用供全局访问
  container._graphInstance = cy;
  window._graphInstance = cy;
}

// ═══════════════════════════════════
//  图谱节点右键操作
// ═══════════════════════════════════

function showGraphNodeMenu(e, node, cy) {
  closeContextMenu();
  var menu = document.createElement('div');
  menu.id = 'graphCtxMenu';
  menu.className = 'ctx-menu fade-in';
  menu.style.cssText = 'position:fixed;left:' + e.clientX + 'px;top:' + e.clientY + 'px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);box-shadow:0 8px 30px rgba(0,0,0,.15);min-width:160px;z-index:300;overflow:hidden;backdrop-filter:blur(8px)';
  var label = node.data('label');
  var nodeType = node.data('type') || 'character';
  var nodeId = node.id();

  var items = [
    { icon: '🔗', label: '添加关联到...', action: 'addEdge' },
    { icon: '🔍', label: '查看详情', action: 'viewNode' },
  ];
  // 如果不是自动生成的节点（如 fact 类型），允许删除
  if (nodeType !== 'character') {
    items.push({ icon: '🗑️', label: '删除节点', action: 'deleteNode', danger: true });
  }

  items.forEach(function(item) {
    var div = document.createElement('div');
    div.style.cssText = 'padding:7px 14px;font-size:12px;color:var(--text);cursor:pointer;display:flex;align-items:center;gap:8px;transition:background .15s' + (item.danger ? ';color:var(--danger)' : '');
    div.innerHTML = '<span>' + item.icon + '</span><span>' + item.label + '</span>';
    div.onmouseover = function() { this.style.background = 'var(--bg-hover)'; };
    div.onmouseout = function() { this.style.background = 'transparent'; };
    div.onclick = function() {
      closeContextMenu();
      if (item.action === 'addEdge') {
        showEdgePicker(node, cy);
      } else if (item.action === 'viewNode') {
        showGraphNodeDetail(node, cy);
      } else if (item.action === 'deleteNode') {
        var nodeType = node.data('type') || 'character';
        deleteNode(nodeId, label, nodeType);
      }
    };
    menu.appendChild(div);
  });

  document.body.appendChild(menu);
  var rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
}

function showGraphEdgeMenu(e, edge) {
  closeContextMenu();
  var menu = document.createElement('div');
  menu.id = 'graphEdgeCtxMenu';
  menu.className = 'ctx-menu fade-in';
  menu.style.cssText = 'position:fixed;left:' + e.clientX + 'px;top:' + e.clientY + 'px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);box-shadow:0 8px 30px rgba(0,0,0,.15);min-width:140px;z-index:300;overflow:hidden;backdrop-filter:blur(8px)';

  var items = [
    { icon: '✏️', label: '编辑关系', action: 'editEdge' },
    { icon: '🗑️', label: '删除边', action: 'deleteEdge', danger: true },
  ];

  items.forEach(function(item) {
    var div = document.createElement('div');
    div.style.cssText = 'padding:7px 14px;font-size:12px;color:var(--text);cursor:pointer;display:flex;align-items:center;gap:8px;transition:background .15s' + (item.danger ? ';color:var(--danger)' : '');
    div.innerHTML = '<span>' + item.icon + '</span><span>' + item.label + '</span>';
    div.onmouseover = function() { this.style.background = 'var(--bg-hover)'; };
    div.onmouseout = function() { this.style.background = 'transparent'; };
    div.onclick = function() {
      closeContextMenu();
      if (item.action === 'deleteEdge') {
        if (confirm('确定删除这条关系？')) {
          removeGraphEdge(edge);
        }
      } else if (item.action === 'editEdge') {
        showEdgeEditor(edge);
      }
    };
    menu.appendChild(div);
  });

  document.body.appendChild(menu);
  var rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
}

// 添加关联弹窗
function showEdgePicker(sourceNode, cy) {
  var sourceId = sourceNode.id();
  var sourceLabel = sourceNode.data('label');

  // 收集所有节点
  var allNodes = cy.nodes().map(function(n) { return { id: n.id(), label: n.data('label'), type: n.data('type') || 'character' }; });
  if (allNodes.length === 0) { toast('⚠️ 图中无节点'); return; }

  // 排除自身
  var targets = allNodes.filter(function(n) { return n.id !== sourceId; });
  if (targets.length === 0) { toast('⚠️ 只能与已有节点关联'); return; }

  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.4);z-index:500;display:flex;align-items:center;justify-content:center';
  var box = document.createElement('div');
  box.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:20px;min-width:320px;max-width:420px;box-shadow:0 8px 40px rgba(0,0,0,.2)';
  box.innerHTML = '<div style="font-weight:600;margin-bottom:12px;font-size:14px">🔗 添加关联</div>';
  box.innerHTML += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:12px"><b>' + esc(sourceLabel) + '</b> → 选择目标节点</div>';

  // 关系类型下拉
  box.innerHTML += '<select id="edgeRelation" style="width:100%;padding:6px 8px;margin-bottom:10px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--bg-input);color:var(--text)">';
  var relOptions = ['friend','rival','enemy','romance','alliance','family','mentor','subordinate','related'];
  var relNames = ['好友','对手','敌人','恋人','盟友','家人','师徒','上下级','关联'];
  relOptions.forEach(function(r, i) {
    box.innerHTML += '<option value="' + r + '">' + relNames[i] + '</option>';
  });
  box.innerHTML += '</select>';

  // 节点列表
  box.innerHTML += '<div style="max-height:200px;overflow-y:auto;margin-bottom:12px">';
  targets.forEach(function(n) {
    box.innerHTML += '<div class="edge-target-btn" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;margin-bottom:4px;cursor:pointer;font-size:12px;display:flex;justify-content:space-between;align-items:center" data-nodeid="' + esc(n.id) + '">';
    box.innerHTML += '<span>' + esc(n.label) + '</span>';
    box.innerHTML += '<span style="font-size:10px;color:var(--text-muted)";>' + n.type + '</span>';
    box.innerHTML += '</div>';
  });
  box.innerHTML += '</div>';

  box.innerHTML += '<div style="display:flex;gap:8px;justify-content:flex-end">';
  box.innerHTML += '<button class="btn btn-ghost" id="edgePickerCancel" style="font-size:11px";>取消</button>';
  box.innerHTML += '</div>';

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // 事件
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  document.getElementById('edgePickerCancel').onclick = function() { overlay.remove(); };

  // 点击目标节点
  document.querySelectorAll('.edge-target-btn').forEach(function(btn) {
    btn.onmouseover = function() { this.style.background = 'var(--bg-hover)'; };
    btn.onmouseout = function() { this.style.background = 'transparent'; };
    btn.onclick = function() {
      var targetId = this.getAttribute('data-nodeid');
      var targetNode = cy.getElementById(targetId);
      if (!targetNode.length) { toast('节点不存在'); overlay.remove(); return; }
      var targetLabel = targetNode.data('label');
      var targetName = targetNode.data('label');
      var targetType = targetNode.data('type') || 'character';
      var relation = document.getElementById('edgeRelation').value;
      var relMap = { friend: '好友', rival: '对手', enemy: '敌人', romance: '恋人', alliance: '盟友', family: '家人', mentor: '师徒', subordinate: '上下级', related: '关联' };

      // 检查边是否已存在
      var exists = sourceNode.connectedEdges().some(function(e) {
        var other = e.source().id() === sourceId ? e.target().id() : (e.target().id() === sourceId ? e.source().id() : null);
        return other === targetId && e.data('relation') === relation;
      });

      if (exists) {
        toast('该关系类型已存在');
        overlay.remove();
        return;
      }

      addGraphEdge(sourceId, sourceLabel, targetType, targetId, targetName, targetType, relation, relMap[relation] || relation);
      overlay.remove();
      toast('✓ 已添加关联');
    };
  });
}

function addGraphEdge(sourceId, sourceName, sourceType, targetId, targetName, targetType, relation, label) {
  fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/graph/edge'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'add',
      source: sourceId,
      sourceName: sourceName,
      sourceType: sourceType,
      target: targetId,
      targetName: targetName,
      targetType: targetType,
      relation: relation,
      description: label,
      graphType: _graphTab || 'entity'
    })
  }).then(function(r) { return r.json(); }).then(function(j) {
    if (j.ok) {
      toast('✓ 关联已添加');
      renderGraph();
    } else {
      toast('❌ 添加失败');
    }
  }).catch(function() { toast('❌ 添加失败'); });
}

function removeGraphEdge(edge) {
  if (!edge || !edge.id()) return;
  fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/graph/edge'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'delete',
      edgeId: edge.id(),
      graphType: _graphTab || 'entity'
    })
  }).then(function(r) { return r.json(); }).then(function(j) {
    if (j.ok) {
      toast('✓ 已删除');
      renderGraph();
    } else {
      toast('❌ 删除失败');
    }
  }).catch(function() { toast('❌ 删除失败'); });
}

function showEdgeEditor(edge) {
  var relMap = { friend: '好友', rival: '对手', enemy: '敌人', romance: '恋人', alliance: '盟友', family: '家人', mentor: '师徒', subordinate: '上下级', related: '关联' };
  var currentRel = edge.data('relation') || 'related';
  showInlinePrompt('编辑关系', '关系类型：', function(newRel) {
    if (!newRel) { toast('关系不能为空'); return; }
    // 暂时只支持改类型，不保存回后端（简化）
    edge.data('relation', newRel);
    edge.data('label', relMap[newRel] || newRel);
    toast('✓ 已更新');
  }, relMap[currentRel] || currentRel);
}

function showGraphNodeDetail(node, cy) {
  var label = node.data('label');
  var type = node.data('type') || 'character';
  var connectedEdges = node.connectedEdges();
  var relMap = { friend: '好友', rival: '对手', enemy: '敌人', romance: '恋人', alliance: '盟友', family: '家人', mentor: '师徒', subordinate: '上下级', related: '关联' };
  var lines = [label + ' 的关系：'];
  if (connectedEdges.length === 0) {
    lines.push('  暂无关联');
  } else {
    connectedEdges.forEach(function(e) {
      var otherId = e.source().id() === node.id() ? e.target().id() : e.source().id();
      var otherLabel = e.source().id() === node.id() ? e.target().data('label') : e.source().data('label');
      var rel = relMap[e.data('relation')] || e.data('relation') || '关联';
      lines.push('  ←→ ' + otherLabel + ' (' + rel + ')');
    });
  }
  // 创建信息面板
  var existing = document.getElementById('nodeDetailPanel');
  if (existing) existing.remove();
  var div = document.createElement('div');
  div.id = 'nodeDetailPanel';
  div.style.cssText = 'position:fixed;right:20px;top:20px;width:260px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:14px;font-size:12px;color:var(--text);box-shadow:0 4px 20px rgba(0,0,0,.15);z-index:400;max-height:400px;overflow-y:auto';
  div.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>' + esc(label) + '</b><button onclick="document.getElementById(\'nodeDetailPanel\').remove()" style="background:none;border:none;cursor:pointer;color:var(--text-muted)";>✕</button></div>';
  div.innerHTML += '<div style="font-size:10px;color:var(--text-muted);margin-bottom:8px">类型: ' + esc(type) + ' | 关联: ' + connectedEdges.length + '</div>';
  div.innerHTML += '<div style="font-size:11px;color:var(--text-sub);margin-bottom:6px">关系链：</div>';
  lines.slice(1).forEach(function(l) {
    div.innerHTML += '<div style="font-size:11px;padding:2px 0">' + esc(l) + '</div>';
  });
  document.body.appendChild(div);
}

function deleteNode(nodeId, label, nodeType) {
  if (!confirm('确定删除节点「' + label + '」？关联该节点的边也会被移除。')) return;
  fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/graph/node'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nodeId: nodeId,
      nodeType: nodeType || 'character',
      graphType: _graphTab || 'entity'
    })
  }).then(function(r) { return r.json(); }).then(function(j) {
    if (j.ok) {
      if (window._graphInstance) {
        window._graphInstance.getElementById(nodeId).remove();
      }
      toast('✓ 节点已删除');
      renderGraph();
    } else {
      toast('❌ 删除失败');
    }
  }).catch(function() { toast('❌ 删除失败'); });
}

var relMap = { friend: '好友', rival: '对手', enemy: '敌人', co_present: '同框', dialogue: '对话' };

// ═══════════════════════════════════
//  右击上下文菜单
// ═══════════════════════════════════
function showContextMenu(e, type, id, data) {
  e.preventDefault();
  closeContextMenu();
  var menu = document.createElement('div');
  menu.id = 'ctxMenu';
  menu.className = 'ctx-menu fade-in';
  menu.style.cssText = 'position:fixed;left:' + e.clientX + 'px;top:' + e.clientY + 'px;background:var(--bg);border:1px solid var(--border);border-radius:var(--rm);box-shadow:0 8px 30px rgba(0,0,0,.15);min-width:150px;z-index:300;overflow:hidden;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
  var items = [];
  if (type === 'chapter') {
    items.push({ icon: '✏️', label: '编辑', action: 'editChapter' });
    items.push({ icon: '✏️', label: '重命名', action: 'renameChapter' });
    items.push({ icon: '📁', label: '移动到分卷…', action: 'moveChapter' });
    items.push({ icon: '📋', label: '复制', action: 'copyChapter' });
    items.push({ icon: '🗑️', label: '删除', action: 'deleteChapter', danger: true });
  } else if (type === 'card') {
    items.push({ icon: '✏️', label: '编辑', action: 'editCard' });
    items.push({ icon: '📋', label: '复制', action: 'copyCard' });
    items.push({ icon: '🗑️', label: '删除', action: 'deleteCard', danger: true });
  } else if (type === 'fact') {
    items.push({ icon: '✏️', label: '编辑', action: 'editFact' });
    items.push({ icon: '🗑️', label: '删除', action: 'deleteFact', danger: true });
  }
  items.forEach(function(item) {
    var div = document.createElement('div');
    div.style.cssText = 'padding:7px 14px;font-size:12px;color:var(--text);cursor:pointer;display:flex;align-items:center;gap:8px;transition:background .15s' + (item.danger ? ';color:var(--danger)' : '');
    div.innerHTML = '<span>' + item.icon + '</span><span>' + item.label + '</span>';
    div.onmouseover = function() { this.style.background = 'var(--bg-hover)'; };
    div.onmouseout = function() { this.style.background = 'transparent'; };
    div.onclick = function() {
      handleContextAction(item.action, type, id, data);
      closeContextMenu();
    };
    menu.appendChild(div);
  });
  document.body.appendChild(menu);
  // 边界检测
  var rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
}

function closeContextMenu() {
  var el = document.getElementById('ctxMenu');
  if (el) el.remove();
}

function handleContextAction(action, type, id, data) {
  switch (action) {
    case 'renameChapter':
      var ch = _chapters.find(function(c) { return c.id === id; });
      if (!ch) return;
      showInlinePrompt('重命名章节', '新标题：', function(newTitle) {
        if (!newTitle || !newTitle.trim()) { toast('标题不能为空'); return; }
        fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/chapters'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: id, title: newTitle.trim(), content: ch.body })
        }).then(function(r) { return r.json(); }).then(function(j) {
          if (j.ok) {
            var rc = _chapters.find(function(c) { return c.id === id; });
            if (rc) rc.title = newTitle.trim();
            if (_currentChapter && _currentChapter.id === id) _currentChapter.title = newTitle.trim();
            // 直接更新 DOM
            var chItem = document.querySelector('[data-chid="' + id + '"]');
            if (chItem) {
              var titleSpan = chItem.querySelector('.ch-title');
              if (titleSpan) titleSpan.textContent = newTitle.trim();
            }
            toast('✓ 已重命名');
          } else { toast('重命名失败'); }
        }).catch(function() { toast('重命名失败'); });
      }, ch.title);
      break;
    case 'editChapter':
      _currentChapter = _chapters.find(function(c) { return c.id === id; });
      if (_currentChapter) { _editing = true; renderChapterContent(); }
      break;
    case 'moveChapter':
      var vols = {};
      _chapters.forEach(function(c) { if (c.volume) vols[c.volume] = true; });
      var volNames = Object.keys(vols);
      if (volNames.length === 0) { toast('暂无分卷，请先创建分卷'); return; }
      showVolumePicker(id, volNames);
      break;
    case 'copyChapter':
      var ch = _chapters.find(function(c) { return c.id === id; });
      if (ch) {
        copyToClipboard(ch.body || '');
      }
      break;
    case 'deleteChapter':
      showInlinePrompt('确认删除', '此操作不可恢复。输入章节标题确认：', function(val) {
        var ch = _chapters.find(function(c) { return c.id === id; });
        if (!ch || val !== ch.title) { toast('标题不匹配，已取消'); return; }
        fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/chapters'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _delete: true, id: id })
        })
          .then(function(r) { return r.json(); })
          .then(function(j) {
            if (j.ok) {
              _chapters = _chapters.filter(function(c) { return c.id !== id; });
              if (_currentChapter && _currentChapter.id === id) _currentChapter = null;
              renderMainPanel();
              toast('✓ 已删除');
            } else { toast('删除失败'); }
          }).catch(function() { toast('删除失败'); });
      });
      break;
    case 'editCard':
      editCard(id);
      break;
    case 'copyCard':
      var card = _cards.find(function(c) { return c.id === id; });
      if (card) {
        var body = typeof card.content === 'string' ? card.content : JSON.stringify(card.content, null, 2);
        copyToClipboard(body);
      }
      break;
    case 'deleteCard':
      showInlinePrompt('确认删除卡片', '输入卡片名称确认：', function(val) {
        var c = _cards.find(function(c2) { return c2.id === id; });
        if (!c || val !== c.name) { toast('名称不匹配，已取消'); return; }
        fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/cards'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _delete: true, id: id })
        })
          .then(function(r) { return r.json(); })
          .then(function(j) {
            if (j.ok) { _cards = _cards.filter(function(c2) { return c2.id !== id; }); renderMainPanel(); toast('✓ 已删除'); }
            else { toast('删除失败'); }
          }).catch(function() { toast('删除失败'); });
      });
      break;
    case 'editFact':
      toast('编辑事实开发中');
      break;
    case 'deleteFact':
      toast('删除事实开发中');
      break;
  }
}

// 编辑器选中文本浮动工具栏
function showFloatToolbar(e) {
  var ta = document.getElementById('chb');
  if (!ta || ta.selectionStart === ta.selectionEnd) { hideFloatToolbar(); return; }
  var start = ta.selectionStart, end = ta.selectionEnd;
  var text = ta.value.substring(start, end).trim();
  if (!text) { hideFloatToolbar(); return; }
  var menu = document.getElementById('floatToolbar');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'floatToolbar';
    menu.style.cssText = 'position:fixed;z-index:250;display:none;background:var(--bg);border:1px solid var(--border);border-radius:var(--rm);box-shadow:0 6px 20px rgba(0,0,0,.12);padding:4px;display:flex;gap:2px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
    [
      { icon: '🖍️', label: '高亮', act: function() { wrapSel('==='); } },
      { icon: '💬', label: '注释', act: function() { wrapSel('/* ',' */'); } },
      { icon: '📝', label: '加粗', act: function() { wrapSel('**'); } },
      { icon: '🔗', label: '链接', act: function() {
        var t = getSelText();
        showInlinePrompt('链接地址', '', function(u) {
          if (u) { wrapSel('[' + t + '](' + u + ')'); }
        });
      }}
    ].forEach(function(b) {
      var btn = document.createElement('button');
      btn.style.cssText = 'background:none;border:none;padding:4px 8px;cursor:pointer;font-size:12px;border-radius:3px;transition:background .15s';
      btn.innerHTML = b.icon;
      btn.title = b.label;
      btn.onmouseover = function() { this.style.background = 'var(--bg-hover)'; };
      btn.onmouseout = function() { this.style.background = 'transparent'; };
      btn.onclick = function() { b.act(); hideFloatToolbar(); };
      menu.appendChild(btn);
    });
    document.body.appendChild(menu);
  }
  menu.style.display = 'flex';
  // 定位在文本上方中间
  var cx = e && e.clientX ? e.clientX : window.innerWidth / 2;
  var cy = e && e.clientY ? e.clientY : 200;
  menu.style.left = Math.min(cx - 40, window.innerWidth - 160) + 'px';
  menu.style.top = Math.max(cy - 50, 8) + 'px';
}

function hideFloatToolbar() {
  var el = document.getElementById('floatToolbar');
  if (el) el.style.display = 'none';
}

function getSelText() {
  var ta = document.getElementById('chb');
  if (!ta) return '';
  return ta.value.substring(ta.selectionStart, ta.selectionEnd);
}

function wrapSel(before, after) {
  var ta = document.getElementById('chb');
  if (!ta) return;
  var s = ta.selectionStart, e = ta.selectionEnd;
  if (s === e) return;
  var text = ta.value.substring(s, e);
  after = after || before;
  ta.value = ta.value.substring(0, s) + before + text + after + ta.value.substring(e);
  ta.focus();
}

// 版本历史树
function showVersionHistory(chapterId) {
  var ch = _chapters.find(function(c) { return c.id === chapterId; });
  if (!ch) return;

  var h = '<div class="version-tree-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.3);backdrop-filter:blur(2px);z-index:200;display:flex;align-items:center;justify-content:center" onclick="event.target===this&&closeVersionHistory()">';
  h += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--rm);width:400px;max-height:80vh;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,.15)">';
  h += '<div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">';
  h += '<span style="font-weight:600;font-size:15px">🌳 版本历史 — ' + esc(ch.title) + '</span>';
  h += '<button style="background:none;border:none;font-size:18px;color:var(--text-muted);cursor:pointer" onclick="closeVersionHistory()">✕</button>';
  h += '</div>';
  h += '<div style="padding:16px 20px" id="versionHistoryBody"><div style="text-align:center;padding:20px;color:var(--text-muted)">加载中...</div></div></div></div>';
  var div = document.createElement('div');
  div.innerHTML = h;
  document.body.appendChild(div.firstElementChild);

  // 异步加载历史（从 facts API）
  fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/facts?tag=chapter_history'))
    .then(function(r) { return r.json(); })
    .then(function(facts) {
      var history = [];
      if (Array.isArray(facts)) {
        history = facts.filter(function(f) {
          return f.type === 'chapter_history' && f.tags && f.tags.indexOf(chapterId) >= 0;
        }).map(function(f) {
          try { return JSON.parse(f.content); } catch(e) { return null; }
        }).filter(Boolean).sort(function(a, b) { return b.ts.localeCompare(a.ts); });
      }
    var bodyEl = document.getElementById('versionHistoryBody');
    if (!bodyEl) return;
    var hh = '';
    // 当前版本
    hh += '<div style="padding:10px 12px;border-left:2px solid var(--accent);background:var(--accent-bg);border-radius:var(--radius);margin-bottom:8px">';
    hh += '<div style="font-size:12px;font-weight:600;color:var(--accent)">当前版本</div>';
    hh += '<div style="font-size:10px;color:var(--text-muted);margin-top:2px">' + (ch.wordCount || 0) + '字 · 更新于 ' + (ch.updated_at || '未知') + '</div>';
    hh += '</div>';
    if (!history || history.length === 0) {
      hh += '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">暂无历史版本<br><span style="font-size:10px">保存章节后自动存档</span></div>';
    } else {
      hh += '<div style="position:relative">';
      hh += '<div style="position:absolute;left:8px;top:0;bottom:0;width:2px;background:var(--border)"></div>';
      history.forEach(function(v, i) {
        hh += '<div style="position:relative;padding:8px 0 8px 24px">';
        hh += '<div style="position:absolute;left:5px;top:16px;width:8px;height:8px;border-radius:50%;background:var(--border);border:2px solid var(--bg)"></div>';
        hh += '<div style="font-size:11px;color:var(--text)">版本 #' + (history.length - i) + '</div>';
        hh += '<div style="font-size:10px;color:var(--text-muted);margin-top:2px">' + v.size + '字 · ' + new Date(v.ts).toLocaleString() + '</div>';
        hh += '<div style="font-size:10px;color:var(--text-sub);margin-top:2px;font-style:italic">「' + esc(v.preview) + (v.preview && v.preview.length >= 60 ? '…' : '') + '」</div>';
        hh += '</div>';
      });
      hh += '</div>';
    }
    bodyEl.innerHTML = hh;
  }).catch(function() {
    var bodyEl = document.getElementById('versionHistoryBody');
    if (bodyEl) bodyEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">加载失败</div>';
  });
}

function closeVersionHistory() {
  var el = document.querySelector('.version-tree-overlay');
  if (el) el.remove();
}

function showVolumePicker(chapterId, volNames) {
  var ov = document.createElement('div');
  ov.className = 'card-form-overlay';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.3);backdrop-filter:blur(2px);z-index:200;display:flex;align-items:center;justify-content:center';
  ov.onclick = function(e) { if (e.target === ov) ov.remove(); };
  var panel = document.createElement('div');
  panel.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:var(--rm);width:320px;box-shadow:0 12px 40px rgba(0,0,0,.15)';
  var h = '<div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">';
  h += '<span style="font-weight:600;font-size:15px">📁 移动到分卷</span>';
  h += '<button style="background:none;border:none;font-size:18px;color:var(--text-muted);cursor:pointer" onclick="this.closest(\'.card-form-overlay\').remove()">✕</button>';
  h += '</div>';
  h += '<div style="padding:16px 20px">';
  h += '<select id="volPickerSelect" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-panel);color:var(--text);font-size:13px;font-family:var(--font-ui)">';
  volNames.forEach(function(v) { h += '<option value="' + esc(v) + '">📂 ' + esc(v) + '</option>'; });
  h += '</select>';
  h += '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">';
  h += '<button class="btn" onclick="this.closest(\'.card-form-overlay\').remove()">取消</button>';
  h += '<button class="btn btn-primary" onclick="_ctxVolPickClick(\'' + chapterId + '\')">移动</button>';
  h += '</div></div>';
  panel.innerHTML = h;
  ov.appendChild(panel);
  document.body.appendChild(ov);
}

function _ctxVolPickClick(chapterId) {
  var s = document.getElementById('volPickerSelect');
  var v = s ? s.value : null;
  var ov = document.querySelector('.card-form-overlay');
  if (ov) ov.remove();
  if (v) saveChapterVolume(chapterId, v);
}

// 全局点击关闭右击菜单
document.addEventListener('click', function(e) {
  var menu = document.getElementById('ctxMenu');
  if (menu && !menu.contains(e.target)) menu.remove();
  var bar = document.getElementById('floatToolbar');
  if (bar && !bar.contains(e.target)) bar.style.display = 'none';
});

// 全局右击检测 — 比内联 oncontextmenu 更稳定
document.addEventListener('contextmenu', function(e) {
  var el = e.target.closest('.ch-item');
  if (el) {
    var chId = el.getAttribute('data-chid');
    e.preventDefault();
    showContextMenu(e, 'chapter', chId, null);
    return;
  }
  el = e.target.closest('.set-card');
  if (el) {
    var cardId = el.getAttribute('data-cardid');
    e.preventDefault();
    showContextMenu(e, 'card', cardId, null);
    return;
  }
});

// 全局文本选中检测 — 编辑器选中文本时弹出浮动工具栏
document.addEventListener('mouseup', function(e) {
  var ta = document.activeElement;
  if (!ta || ta.tagName !== 'TEXTAREA' || ta.id !== 'chb') { hideFloatToolbar(); return; }
  setTimeout(function() {
    if (ta.selectionStart !== ta.selectionEnd) {
      showFloatToolbar(e);
    } else {
      hideFloatToolbar();
    }
  }, 80);
});

function copyToClipboard(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    var ok = document.execCommand('copy');
    toast(ok ? '✓ 已复制到剪贴板' : '复制失败');
  } catch(e) {
    toast('复制失败');
  }
  document.body.removeChild(ta);
}


// ═══════════════════════════════════
//  CREATE PROJECT
// ═══════════════════════════════════
function createProject() {
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = [
    '<div class="modal-dialog" style="max-width:460px">',
    '<div class="modal-header">新建项目</div>',
    '<div class="modal-body">',
    '<label>类型</label>',
    '<div class="type-grid">',
    '<label class="type-chip"><input type="radio" name="cp-type" value="悬疑"><span>悬疑</span></label>',
    '<label class="type-chip"><input type="radio" name="cp-type" value="奇幻"><span>奇幻</span></label>',
    '<label class="type-chip"><input type="radio" name="cp-type" value="科幻"><span>科幻</span></label>',
    '<label class="type-chip"><input type="radio" name="cp-type" value="都市"><span>都市</span></label>',
    '<label class="type-chip"><input type="radio" name="cp-type" value="言情"><span>言情</span></label>',
    '<label class="type-chip"><input type="radio" name="cp-type" value="历史"><span>历史</span></label>',
    '<label class="type-chip"><input type="radio" name="cp-type" value="武侠"><span>武侠</span></label>',
    '<label class="type-chip"><input type="radio" name="cp-type" value=""><span>自定义</span></label>',
    '</div>',
    '<input id="cp-type-custom" class="ipt" placeholder="输入自定义类型" style="display:none;margin-top:6px">',
    '<label style="margin-top:12px">名称</label>',
    '<input id="cp-name" class="ipt" placeholder="请输入项目名称">',
    '<label style="margin-top:12px">一句话世界观（可选）</label>',
    '<input id="cp-summary" class="ipt" placeholder="例如：近未来赛博都市，AI与人类共存">',
    '</div>',
    '<div class="modal-footer">',
    '<button class="btn" onclick="this.closest(\'.modal-overlay\').remove()">取消</button>',
    '<button class="btn btn-primary" id="cp-submit">创建</button>',
    '</div>',
    '</div>'
  ].join('');
  document.body.appendChild(overlay);

  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

  // Show custom type input when "自定义" is selected
  var customInput = overlay.querySelector('#cp-type-custom');
  overlay.querySelectorAll('input[name="cp-type"]').forEach(function(r) {
    r.addEventListener('change', function() {
      customInput.style.display = (r.value === '') ? '' : 'none';
    });
  });

  q('cp-submit').addEventListener('click', function() {
    var typeRadio = overlay.querySelector('input[name="cp-type"]:checked');
    var type = typeRadio ? typeRadio.value : '';
    if (type === '') type = customInput.value.trim() || '未分类';
    var name = q('cp-name').value.trim();
    if (!name) { toast('请输入项目名称'); return; }
    var summary = q('cp-summary').value.trim();

    fetch(tu(A + '/api/project'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, type: type, summary: summary }),
    })
    .then(function(r) { return r.json(); })
    .then(function(j) {
      if (j.ok) {
        toast('✅ 项目已创建');
        overlay.remove();
        refreshData();
      } else {
        toast('❌ 创建失败: ' + (j.error || '未知错误'));
      }
    })
    .catch(function() { toast('❌ 创建失败'); });
  });

  setTimeout(function() { q('cp-name').focus(); }, 100);
}

// ═══════════════════════════════════
//  DELETE PROJECT
// ═══════════════════════════════════
function deleteProject(id, name) {
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = [
    '<div class="modal-dialog" style="max-width:380px">',
    '<div class="modal-header">删除项目</div>',
    '<div class="modal-body">',
    '<p style="margin:0">确认删除项目「' + esc(name) + '」？</p>',
    '<p style="margin:6px 0 0 0;font-size:12px;color:var(--text-muted)">此操作不可撤销，所有章节和卡片将被永久删除。</p>',
    '</div>',
    '<div class="modal-footer">',
    '<button class="btn" onclick="this.closest(\'.modal-overlay\').remove()">取消</button>',
    '<button class="btn btn-danger" id="del-confirm">确认删除</button>',
    '</div>',
    '</div>'
  ].join('');
  document.body.appendChild(overlay);

  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  q('del-confirm').addEventListener('click', function() {
    fetch(tu(A + '/api/project/' + encodeURIComponent(id)), { method: 'DELETE' })
      .then(function(r) { return r.json(); })
      .then(function(j) {
        if (j.ok) {
          toast('✅ 已删除');
          overlay.remove();
          if (_currentProject && _currentProject.id === id) {
            _currentProject = null;
            _currentChapter = null;
            q('main-panel').innerHTML = '';
          }
          refreshData();
        } else {
          toast('❌ 删除失败: ' + (j.error || '未知错误'));
        }
      })
      .catch(function() { toast('❌ 删除失败'); });
  });
}

// ── 互动文游导出 ──
function exportGamePack() {
  toast('🎮 素材包准备中，请对 AI 说：「把这个项目导出为互动文游」');
}

async function exportLinearReader() {
  if (!_currentProject) { toast('请先选择项目'); return; }
  toast('📖 正在生成线性阅读…');
  try {
    var r = await fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/export/linear'));
    var j = await r.json();
    if (j.ok) {
      toast('✅ 线性阅读已导出！文件：' + j.file);
    } else {
      toast('❌ 导出失败：' + j.error);
    }
  } catch(e) {
    toast('❌ 导出失败：' + e.message);
  }
}

async function exportTwineStory() {
  if (!_currentProject) { toast('请先选择项目'); return; }
  toast('📜 正在生成 SugarCube 互动小说…');
  try {
    var r = await fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/export/twine'));
    var j = await r.json();
    if (j.ok) {
      toast('✅ SugarCube 互动小说已导出！文件：' + j.file);
    } else {
      toast('❌ 导出失败：' + j.error);
    }
  } catch(e) {
    toast('❌ 导出失败：' + e.message);
  }
}

// ═══════════════════════════════════
//  BRANCH TREE VISUALIZATION
// ═══════════════════════════════════

function showBranchTree() {
  var overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = '<div class="modal" style="width:90vw;max-width:900px;height:80vh;display:flex;flex-direction:column">' +
    '<div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border)">' +
    '<span style="font-weight:600">🌳 分支树</span>' +
    '<button class="btn btn-ghost" onclick="this.closest(\'.overlay\').remove()" style="padding:4px 8px">✕</button></div>' +
    '<div style="padding:12px 16px;border-bottom:1px solid var(--border)">' +
    '<div style="display:flex;gap:8px;align-items:center">' +
    '<input id="branchTreeInput" type="file" accept=".json" style="flex:1;font-size:12px" />' +
    '<button class="btn btn-primary" onclick="loadBranchTree()" style="white-space:nowrap">加载 JSON</button>' +
    '<button class="btn btn-ghost" onclick="exportRevisions()" style="white-space:nowrap">📥 导出修订</button></div>' +
    '<div id="branchTreeInfo" style="font-size:11px;color:var(--text-muted);margin-top:4px"></div></div>' +
    '<div id="branchTreeContainer" style="flex:1;min-height:0;background:var(--bg)"></div>' +
    '</div>';
  document.body.appendChild(overlay);
}

function loadBranchTree() {
  var input = document.getElementById('branchTreeInput');
  if (!input.files.length) { toast('请选择 JSON 文件'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      renderBranchTree(data);
    } catch (err) {
      toast('JSON 解析失败：' + err.message);
    }
  };
  reader.readAsText(input.files[0]);
}

function renderBranchTree(data) {
  if (!data.nodes || typeof data.nodes !== 'object') {
    toast('无效的 JSON 格式'); return;
  }
  _branchGameData = data;
  var nodeIds = Object.keys(data.nodes);
  var nodeCount = nodeIds.length;
  var choiceCount = 0;
  var endingCount = 0;
  var els = [];

  nodeIds.forEach(function(id) {
    var n = data.nodes[id];
    var isStart = id === 'start';
    var isEnding = n.choices && n.choices.length === 0;
    if (isEnding) endingCount++;
    if (n.choices && n.choices.length) choiceCount += n.choices.length;

    els.push({
      data: {
        id: id,
        label: n.title || id,
        type: isStart ? 'start' : isEnding ? 'ending' : 'branch',
        chapter: n.chapterTitle || '',
        subtitle: isEnding ? '结局' : (n.choices ? n.choices.length + ' 分支' : '')
      }
    });

    if (n.choices) {
      n.choices.forEach(function(ch) {
        if (!ch.next || !data.nodes[ch.next]) return;
        els.push({ data: { id: id + '_to_' + ch.next, source: id, target: ch.next, label: ch.text ? (ch.text.length > 6 ? ch.text.slice(0, 6) + '…' : ch.text) : '' } });
      });
    }
  });

  document.getElementById('branchTreeInfo').textContent =
    nodeCount + ' 节点 · ' + choiceCount + ' 分支 · ' + endingCount + ' 结局';

  var container = document.getElementById('branchTreeContainer');
  container.innerHTML = '';

  if (!window.cytoscape) {
    loadCytoscape(function() { _buildBranchGraph(container, els, data.startNodeId); });
  } else {
    _buildBranchGraph(container, els, data.startNodeId);
  }
}

function _buildBranchGraph(container, els, startNodeId) {
  var cy = cytoscape({
    container: container,
    elements: els,
    wheelSensitivity: 1,
    layout: {
      name: 'breadthfirst',
      directed: true,
      roots: [startNodeId || 'start'],
      padding: 20,
      spacingFactor: 1.2,
      animate: true,
      animationDuration: 500
    },
    style: [
      { selector: 'node[type="start"]', style: { 'background-color': '#10B981', 'label': 'data(label)', 'font-size': '12px', 'text-valign': 'center', 'text-halign': 'center', 'width': 50, 'height': 50 } },
      { selector: 'node[type="ending"]', style: { 'background-color': '#EF4444', 'label': 'data(label)', 'font-size': '10px', 'text-valign': 'center', 'text-halign': 'center', 'width': 40, 'height': 40 } },
      { selector: 'node[type="branch"]', style: { 'background-color': '#6366F1', 'label': 'data(label)', 'font-size': '10px', 'text-valign': 'center', 'text-halign': 'center', 'width': 44, 'height': 44 } },
      { selector: 'edge', style: { 'width': 1.5, 'line-color': '#CBD5E1', 'target-arrow-color': '#CBD5E1', 'target-arrow-shape': 'triangle', 'arrow-scale': 0.8, 'curve-style': 'bezier' } },
      { selector: 'edge[label]', style: { 'edge-text-rotation': 'autorotate', 'font-size': '9px', 'label': 'data(label)', 'color': '#94A3B8', 'text-margin-y': -8 } },
      { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#F59E0B' } }
    ],
    minZoom: 0.2,
    maxZoom: 3,
    wheelSensitivity: 0.2
  });

  cy.on('tap', 'node', function(evt) {
    var n = evt.target;
    if (n.isNode()) { var d = n.data(); showNodeDetail(d); }
  });
}

var _branchGameData = null;
var _branchCurrentNodeId = null;

function showNodeDetail(d) {
  _branchCurrentNodeId = d.id;
  var nodeData = _branchGameData && _branchGameData.nodes ? _branchGameData.nodes[d.id] : null;
  var existingRev = _branchGameData.revisions ? _branchGameData.revisions.filter(function(r) { return r.nodeId === d.id; }) : [];

  var overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = '<div class="modal" style="width:420px;max-height:80vh;overflow-y:auto">' +
    '<div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border)">' +
    '<span style="font-weight:600">📍 节点详情</span>' +
    '<button class="btn btn-ghost" onclick="this.closest(\'.overlay\').remove()" style="padding:4px 8px">✕</button></div>' +
    '<div style="padding:16px">' +
    '<div style="font-size:12px;margin-bottom:6px"><strong>标题：</strong>' + esc(d.label) + '</div>' +
    '<div style="font-size:12px;margin-bottom:6px"><strong>ID：</strong>' + esc(d.id) + '</div>' +
    '<div style="font-size:12px;margin-bottom:6px"><strong>章节：</strong>' + esc(d.chapter || '—') + '</div>' +
    '<div style="font-size:12px;margin-bottom:12px"><strong>类型：</strong>' + (d.type === 'start' ? '🌱 起点' : d.type === 'ending' ? '🏁 结局' : '🌿 分支') + (d.subtitle ? '（' + esc(d.subtitle) + '）' : '') + '</div>';

  if (existingRev.length) {
    overlay.querySelector('.modal div').insertAdjacentHTML('beforeend',
      '<div style="margin-bottom:12px"><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">已有修订（' + existingRev.length + '）</div>' +
      existingRev.map(function(r) { return '<div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);border-radius:var(--rm);padding:6px 8px;margin-bottom:4px;font-size:11px">' + esc(r.text) + '<div style="font-size:9px;color:var(--text-muted);margin-top:2px">' + new Date(r.createdAt).toLocaleString() + '</div></div>'; }).join('') + '</div>');
  }

  overlay.querySelector('.modal div').insertAdjacentHTML('beforeend',
    '<div style="margin-bottom:6px;font-size:12px"><strong>添加修订意见：</strong></div>' +
    '<textarea id="nodeRevisionInput" rows="2" style="width:100%;border:1px solid var(--border);border-radius:6px;padding:8px;font-size:12px;font-family:inherit;resize:vertical;box-sizing:border-box" placeholder="例：分支太短，加两个新选项…"></textarea>' +
    '<div style="display:flex;gap:8px;margin-top:12px">' +
    '<button class="btn btn-primary" onclick="saveNodeRevision()" style="flex:1">💾 保存</button>' +
    '<button class="btn btn-ghost" onclick="this.closest(\'.overlay\').remove()" style="flex:1">取消</button>' +
    '</div>');
  overlay.querySelector('.modal div').insertAdjacentHTML('beforeend', '</div>');
  document.body.appendChild(overlay);
}

function saveNodeRevision() {
  var input = document.getElementById('nodeRevisionInput');
  if (!input) return;
  var text = input.value.trim();
  if (!text) { toast('请输入修订意见'); return; }

  var rev = { nodeId: _branchCurrentNodeId, text: text, createdAt: new Date().toISOString() };
  if (!_branchGameData.revisions) _branchGameData.revisions = [];
  _branchGameData.revisions.push(rev);

  toast('✅ 已保存（' + _branchGameData.revisions.length + ' 条修订）');
  input.closest('.overlay').remove();
}

function exportRevisions() {
  if (!_branchGameData || !_branchGameData.revisions || !_branchGameData.revisions.length) {
    toast('暂无修订意见'); return;
  }
  var blob = new Blob([JSON.stringify({ gameMeta: _branchGameData.meta, revisions: _branchGameData.revisions }, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'revisions_' + ((_branchGameData.meta && _branchGameData.meta.title) || 'untitled').replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_') + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('📥 修订文件已下载（' + _branchGameData.revisions.length + ' 条）');
}

// ═══════════════════════
//  AI 方向建议
// ═══════════════════════
function suggestDirections(chId) {
  var ch = _chapters.find(function(c) { return c.id === chId; });
  var title = ch ? ch.title : '当前章节';
  var proj = _currentProject ? _currentProject.name : '';
  var prompt = '帮我看一下「' + proj + '」的「' + title + '」，给出三个后续发展方向的建议。每个方向一句话概括，附简短理由。';
  var ta = document.createElement('textarea');
  ta.value = prompt;
  ta.style.position = 'fixed'; ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  toast('📋 已复制提示词，粘贴发送给 AI 即可');
}

function runCrossValidate() {
  if (!_currentProject) { toast('请先打开项目'); return; }
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.4);backdrop-filter:blur(3px);z-index:200;display:flex;align-items:center;justify-content:center';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  var modal = document.createElement('div');
  modal.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:var(--rm);width:620px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.2)';
  modal.onclick = function(e) { e.stopPropagation(); };
  modal.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border)">' +
    '<span style="font-weight:600;font-size:14px">🔍 交叉验证</span>' +
    '<button class="btn btn-ghost" onclick="this.closest(\'div\').parentElement.parentElement.remove()" style="font-size:11px;padding:4px 8px">✕</button></div>' +
    '<div id="cvResultBody" style="flex:1;overflow-y:auto;padding:16px"><div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:32px;margin-bottom:10px">⏳</div>扫描中…</div></div>';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  var b = document.getElementById('cvResultBody');
  var renderSummary = function(data) {
    if (!b) return;
    var h = '';
    var cats = [
      { key:'characterConflicts', icon:'👤', label:'人物设定冲突', color:'#EF4444' },
      { key:'timelineGaps', icon:'📅', label:'时间线断层', color:'#F59E0B' },
      { key:'unrecoveredChekhovs', icon:'🔮', label:'伏笔未回收', color:'#8B5CF6' },
      { key:'settingConflicts', icon:'🌍', label:'世界观互斥', color:'#EC4899' }
    ];
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">';
    cats.forEach(function(cat) {
      var count = (data[cat.key]||[]).length;
      h += '<div style="border:1px solid var(--border-light);border-radius:var(--radius);padding:10px 12px;text-align:center">';
      h += '<div style="font-size:22px;font-weight:700;color:' + (count ? cat.color : 'var(--text-muted)') + '">' + count + '</div>';
      h += '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">' + cat.icon + ' ' + cat.label + '</div>';
      h += '</div>';
    });
    h += '</div>';
    if (data.totalIssues === 0) {
      h += '<div style="text-align:center;padding:28px 20px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:var(--rm)">';
      h += '<div style="font-size:28px;margin-bottom:6px">✅</div>';
      h += '<div style="font-size:14px;font-weight:600;color:#10B981">一致性良好</div>';
      h += '<div style="font-size:11px;color:var(--text-muted);margin-top:3px">未发现人物冲突、时间线矛盾或未回收伏笔</div></div>';
    } else {
      cats.forEach(function(cat) {
        var items = data[cat.key];
        if (!items || !items.length) return;
        h += '<div style="margin-bottom:14px">';
        h += '<div style="font-weight:600;font-size:12px;color:' + cat.color + ';margin-bottom:6px;display:flex;align-items:center;gap:4px">';
        h += cat.icon + ' ' + cat.label;
        h += '<span style="font-size:10px;background:' + cat.color + ';color:#fff;padding:1px 6px;border-radius:10px">' + items.length + '</span></div>';
        items.forEach(function(it) {
          var desc = '';
          if (cat.key === 'characterConflicts') {
            desc = '<b>' + esc(it.character) + '</b> · ' + esc(it.trait) + '<br><span style="font-size:10px;color:var(--text-muted)">设定「' + esc(it.expected) + '」→ 正文出现矛盾</span>';
          } else if (cat.key === 'timelineGaps') {
            desc = '<span style="font-size:10px;color:var(--text-muted)">⏱ ' + esc(it.gap) + ' 断层</span><br><small>…' + esc((it.from||'').slice(-35)) + '</small><br><small>→ …' + esc((it.to||'').slice(-35)) + '</small>';
          } else if (cat.key === 'unrecoveredChekhovs') {
            desc = '<span style="font-size:10px;color:var(--text-muted)">📎 第 ' + esc(it.chapter) + ' 章埋下，后续未回收</span><br>' + esc(it.event);
          } else if (cat.key === 'settingConflicts') {
            desc = '<b>' + esc(it.card1) + '</b> ↔ <b>' + esc(it.card2) + '</b><br><span style="font-size:10px;color:var(--text-muted)">' + esc(it.field) + '：' + esc(it.val1) + ' vs ' + esc(it.val2) + '</span>';
          }
          h += '<div style="padding:8px 10px;margin-bottom:4px;background:var(--bg-panel);border:1px solid var(--border-light);border-left:3px solid ' + cat.color + ';border-radius:0 var(--radius) var(--radius) 0;font-size:12px;line-height:1.5">' + desc + '</div>';
        });
        h += '</div>';
      });
    }
    b.innerHTML = h;
  };

  fetch(tu(A + '/api/project/' + encodeURIComponent(_currentProject.id) + '/cross-validate'))
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(data) { renderSummary(data); })
    .catch(function(e) {
      if (b) b.innerHTML = '<div style="text-align:center;padding:40px;color:#EF4444">❌ 验证失败<br><span style="font-size:11px;color:var(--text-muted)">' + esc(e.message) + '</span></div>';
    });
}

// ═══════════════════════════════════
//  START
// ═══════════════════════════════════
// 从编年史跳转到写作视图
function openWritingFromDashboard(chapterId) {
  if (!_currentProject) return;
  // 切换侧栏到写作
  renderWritingSidebar();
  // 打开章节
  setTimeout(function() { openChapter(chapterId); }, 200);
}
// ====== END =======
