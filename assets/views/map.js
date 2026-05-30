var _maps = [];
var _currentMap = null;

async function loadMapMarkers() {
  if (!_currentMap) return;
  try {
    var r = await fetch(tu(A + '/api/project/' + encodeURIComponent(_mapProject) + '/markers?map=' + encodeURIComponent(_currentMap.id)));
    _markers = await r.json();
  } catch(e) { _markers = []; }
  renderMapContent();
}

function renderMapSidebar() {
  if (_projects.length === 0) {
    q('sidebar').innerHTML = '<div class="sidebar-header">地图</div><div class="empty-state" style="height:auto;padding:30px 10px"><div class="title" style="font-size:13px">暂无项目</div></div>';
    q('main-panel').innerHTML = '<div class="empty-state"><div class="icon">🗺</div><div class="title">地图视图</div><div class="desc">选择项目后进入地图编辑器</div></div>';
    return;
  }

  var h = '<div class="sidebar-header">项目<span class="count">' + _projects.length + '</span></div>';
  h += '<div class="sidebar-list">';
  _projects.forEach(function(p) {
    var activeClass = _mapProject === p.id ? ' active' : '';
    h += '<div class="pj-card' + activeClass + '" onclick="selectMapProject(\'' + p.id + '\')">';
    h += '<div class="pj-name" style="flex:1">🗺 ' + esc(p.name) + '</div>';
    h += '<button class="btn btn-ghost" style="font-size:11px;padding:2px 6px;margin-left:4px" onclick="event.stopPropagation();quickCreateMap(\'' + p.id + '\')" title="为此项目创建地图">+</button>';
    h += '</div>';
  });
  h += '</div>';;
  q('sidebar').innerHTML = h;

  if (_mapProject) {
    renderMapContent();
  } else {
    q('main-panel').innerHTML = '<div class="empty-state"><div class="icon">🗺</div><div class="title">选择项目查看地图</div><div class="desc">左侧列表中点击项目名打开地图编辑器</div></div>';
  }
}

async function selectMapProject(id) {
  _mapProject = id;
  _currentMap = null;
  renderMapSidebar();

  try {
    var r = await fetch(tu(A + '/api/project/' + encodeURIComponent(id) + '/maps'));
    var d = await r.json();
    _maps = d.maps || [];
    if (_maps.length > 0) _currentMap = _maps[0];
  } catch(e) { _maps = []; }

  if (_currentMap) {
    _markers = _currentMap.markers || [];
    renderMapContent();
  } else {
    renderMapContent();
  }
}

function renderMapContent() {
  if (!_mapProject) return;

  var projectName = (_projects.find(function(p) { return p.id === _mapProject; }) || {}).name || _mapProject;

  var h = '';
  // 地图切换栏
  h += '<div class="panel-header">';
  h += '<span class="badge">🗺 地图</span>';
  h += '<span style="font-size:15px;font-weight:600;color:var(--text)">' + esc(projectName) + '</span>';
  h += '</div>';

  h += '<div style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-bottom:1px solid var(--border-light);flex-wrap:wrap">';
  _maps.forEach(function(m) {
    var active = _currentMap && _currentMap.id === m.id;
    h += '<span class="tag" style="cursor:pointer;' + (active ? 'background:var(--accent);color:#fff;border-color:var(--accent)' : '') + '" onclick="switchMap(\'' + m.id + '\')" ondblclick="renameMap(\'' + m.id + '\')">' + esc(m.name) + '</span>';
  });
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="createMap()">+ 新地图</button>';
  if (_maps.length > 1) h += '<button class="btn btn-ghost" style="font-size:10px;padding:3px 6px;color:var(--danger)" onclick="deleteCurrentMap()">🗑</button>';
  h += '<div style="margin-left:auto;display:flex;gap:6px">';
  h += '<button class="btn" onclick="addMapMarker()">📍 新标记</button>';
  h += '<button class="btn btn-primary" onclick="saveMarkers()">💾 保存</button>';
  h += '<button class="btn btn-ghost" onclick="exportMapHTML()">📦 导出</button>';
  h += '</div>';
  h += '</div>';

  h += '<div class="panel-body">';
  h += '<div class="fade-in">';

  if (_markers.length > 0) {
    h += '<div class="section"><div class="section-title">标记列表</div></div>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">';
    _markers.forEach(function(m, i) {
      var linkedCount = (m.linkedChapters||[]).length;
      h += '<span class="tag" style="cursor:pointer" onclick="editMarker(' + i + ')" title="' + esc(m.description||'点击编辑') + '">';
      h += (m.icon || '📍') + ' ' + esc(m.name);
      if (linkedCount > 0) h += ' <span style="font-size:9px;color:var(--accent)">(' + linkedCount + ')</span>';
      h += '<span style="cursor:pointer;color:var(--danger);margin-left:2px" onclick="removeMarker(' + i + ');event.stopPropagation()">✕</span>';
      h += '</span>';
    });
    h += '</div>';
  }

  h += '<div class="map-container" id="lmap"></div>';
  h += '</div></div>';

  q('main-panel').innerHTML = h;

  loadLeaflet();
}

function loadLeaflet() {
  if (_mapLoaded === 2) { initMap(); return; }
  if (_mapLoaded === 1) { setTimeout(loadLeaflet, 200); return; }
  _mapLoaded = 1;

  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);

  var script = document.createElement('script');
  script.onload = function() { _mapLoaded = 2; initMap(); };
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  document.body.appendChild(script);
}

function initMap() {
  if (!window.L || !q('lmap')) return;
  if (q('lmap')._map) return;

  q('lmap')._map = L.map('lmap', {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 5,
    center: [0, 0],
    zoom: 0
  });

  q('lmap')._map.fitBounds([[-300, -300], [300, 300]]);

  for (var x = -300; x <= 300; x += 50) {
    L.polyline([[x, -300], [x, 300]], { color: 'rgba(0,0,0,0.05)', weight: 1 }).addTo(q('lmap')._map);
    L.polyline([[-300, x], [300, x]], { color: 'rgba(0,0,0,0.05)', weight: 1 }).addTo(q('lmap')._map);
  }

  renderMarkers();
}

function renderMarkers() {
  var el = q('lmap');
  if (!el || !el._map) return;
  var M = el._map;

  M.eachLayer(function(l) {
    if (l instanceof L.Marker) M.removeLayer(l);
  });

  _markers.forEach(function(m) {
    L.marker([m.y || 0, m.x || 0], {
      icon: L.divIcon({
        className: '',
        html: '<div style="font-size:24px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.2))">' + (m.icon || '📍') + '</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 28]
      })
    }).addTo(M).bindPopup('<div style="max-width:220px"><b>' + esc(m.name) + '</b>' + (m.description ? '<br><small style="color:var(--text-muted)">' + esc(m.description) + '</small>' : '') + (linkedCount > 0 ? '<br><small style="color:var(--accent)">📄 ' + linkedCount + ' 关联章节</small>' : '') + '</div>');
  });
}

function addMapMarker() {
  if (!q('lmap') || !q('lmap')._map) return;
  q('lmap')._map.once('click', function(e) {
    _markers.push({
      id: 'm_' + Date.now().toString(36),
      name: '新地点',
      x: Math.round(e.latlng.lng),
      y: Math.round(e.latlng.lat),
      color: '#d49a6a',
      icon: '📍',
      description: '',
      linkedChapters: []
    });
    renderMarkers();
    renderMapSidebar();
    renderMapContent();
    toast('📍 已添加标记');
  });
  toast('🖱 点击地图放置标记');
}

function removeMarker(i) {
  _markers.splice(i, 1);
  renderMarkers();
  renderMapSidebar();
  renderMapContent();
}

function editMarker(i) {
  var m = _markers[i];
  if (!m) return;
  var overlay = document.createElement('div');
  overlay.className = 'card-form-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.3);backdrop-filter:blur(2px);z-index:200;display:flex;align-items:center;justify-content:center';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  var panel = document.createElement('div');
  panel.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:var(--rm);width:380px;max-height:80vh;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,.15);padding:18px';
  panel.onclick = function(e) { e.stopPropagation(); };
  var h = '<div style="font-weight:600;font-size:14px;margin-bottom:12px">✏️ 编辑标记</div>';
  h += '<label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">名称</label>';
  h += '<input id="emName" value="' + esc(m.name) + '" style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:10px;font-size:13px">';
  h += '<label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">图标</label>';
  h += '<input id="emIcon" value="' + esc(m.icon||'📍') + '" style="width:60px;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:10px;font-size:13px">';
  h += '<label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">颜色</label>';
  h += '<input id="emColor" type="color" value="' + esc(m.color||'#d49a6a') + '" style="width:60px;height:32px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:10px;cursor:pointer">';
  h += '<label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">描述</label>';
  h += '<textarea id="emDesc" style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius);min-height:60px;font-size:12px;resize:vertical;margin-bottom:12px">' + esc(m.description||'') + '</textarea>';
  h += '<div style="display:flex;gap:8px;justify-content:flex-end">';
  h += '<button class="btn btn-ghost" onclick="this.closest(\'.card-form-overlay\').remove()">取消</button>';
  h += '<button class="btn btn-primary" onclick="var ov=this.closest(\'.card-form-overlay\');_markers['+i+'].name=document.getElementById(\'emName\').value;_markers['+i+'].icon=document.getElementById(\'emIcon\').value;_markers['+i+'].color=document.getElementById(\'emColor\').value;_markers['+i+'].description=document.getElementById(\'emDesc\').value;ov.remove();renderMarkers();renderMapContent()">保存</button>';
  h += '</div>';
  panel.innerHTML = h;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

async function saveMarkers() {
  if (!_currentMap) { toast('请先选择地图'); return; }
  try {
    await fetch(tu(A + '/api/project/' + encodeURIComponent(_mapProject) + '/markers'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markers: _markers, _mapId: _currentMap.id })
    });
    toast('💾 标记已保存');
  } catch(e) {
    toast('❌ 保存失败');
  }
}

// ═══════════════════════════════════

async function createMap() {
  showInputDialog('地图名称：', '新地图', async function(name) {
  if (!name) return;
  try {
    var r = await fetch(tu(A + '/api/project/' + encodeURIComponent(_mapProject) + '/maps'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: name })
    });
    var d = await r.json();
    _maps = d.maps || [];
    _currentMap = _maps[_maps.length - 1];
    _markers = _currentMap ? _currentMap.markers || [] : [];
    renderMapSidebar();
    toast('✅ 地图已创建');
  } catch(e) { toast('❌ 创建失败'); }
  });
}

async function renameMap(mapId) {
  var m = _maps.find(function(x) { return x.id === mapId; });
  if (!m) return;
  showInputDialog('重命名地图：', m.name, async function(name) {
  if (!name || name === m.name) return;
  try {
    var r = await fetch(tu(A + '/api/project/' + encodeURIComponent(_mapProject) + '/maps'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id: mapId, name: name })
    });
    var d = await r.json();
    _maps = d.maps || [];
    renderMapSidebar();
    toast('✅ 已重命名');
  } catch(e) { toast('❌ 重命名失败'); }
  });
}

async function deleteCurrentMap() {
  if (!_currentMap) return;
  showConfirmDialog('确定删除地图「' + _currentMap.name + '」？此操作不可撤销。', async function() {
  try {
    var r = await fetch(tu(A + '/api/project/' + encodeURIComponent(_mapProject) + '/maps'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: _currentMap.id })
    });
    var d = await r.json();
    _maps = d.maps || [];
    if (_maps.length > 0) {
      _currentMap = _maps[0];
      _markers = _currentMap.markers || [];
    } else {
      _currentMap = null;
      _markers = [];
    }
    renderMapSidebar();
    toast('✅ 已删除');
  } catch(e) { toast('❌ 删除失败'); }
  });
}

function switchMap(mapId) {
  _currentMap = _maps.find(function(x) { return x.id === mapId; }) || null;
  renderMapSidebar();
  renderMapContent();
  if (_currentMap) loadMapMarkers();
}

async function exportMapHTML() {
  if (!_mapProject || !_currentMap) { toast('请先选择地图'); return; }
  var id = _mapProject;
  var mid = _currentMap.id;
  var url = tu(A + '/api/project/' + encodeURIComponent(id) + '/export/map?map=' + encodeURIComponent(mid));
  toast('⏳ 导出中...');
  fetch(url).then(function(r) { return r.json(); }).then(function(d) {
    if (d.ok) {
      toast('✅ 已保存到 ' + d.path);
    } else {
      toast('❌ ' + (d.error || '导出失败'));
    }
  }).catch(function() { toast('❌ 导出失败'); });
}

// ═══════════════════════════════════
//  START
// ═══════════════════════════════════

async function quickCreateMap(projectId) {
  var p = _projects.find(function(x) { return x.id === projectId; });
  showInputDialog('为「' + (p ? p.name : '') + '」创建地图', '新地图', async function(name) {
    if (!name) return;
    try {
      var r = await fetch(tu(A + '/api/project/' + encodeURIComponent(projectId) + '/maps'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name: name })
      });
      var d = await r.json();
      _maps = d.maps || [];
      _mapProject = projectId;
      if (_maps.length > 0) _currentMap = _maps[_maps.length - 1];
      _markers = [];
      renderMapSidebar();
      renderMapContent();
      toast('✅ 地图已创建');
    } catch(e) { toast('❌ 创建失败'); }
  });
}

// ====== END =======
