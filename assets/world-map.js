// 墨述 · 世界地图 (v2 - 分类图标 + 卡片式侧边栏)
function tu(s) { return s + (s.indexOf('?') > -1 ? '&' : '?') + 'token=' + TOKEN; }

// 地点类型配置
var LOCATION_TYPES = {
  city: { icon: '🏙️', label: '城市', color: '#2F6FDB' },
  port: { icon: '🌊', label: '港口', color: '#0EA5E9' },
  mountain: { icon: '🏔️', label: '山脉', color: '#6F6A60' },
  forest: { icon: '🌲', label: '森林', color: '#059669' },
  landmark: { icon: '🏛️', label: '地标', color: '#B91C1C' },
  industry: { icon: '🏭', label: '工业', color: '#7C3AED' },
  settlement: { icon: '🏠', label: '村落', color: '#D97706' },
  farm: { icon: '🌾', label: '田园', color: '#65A30D' },
  default: { icon: '📍', label: '地点', color: '#8B6914' }
};

function getTypeInfo(type) { return LOCATION_TYPES[type] || LOCATION_TYPES.default; }

// 初始化地图
var map = L.map('wm', { attributionControl: false }).setView([35, 105], 5);

// 多瓦片源尝试
var tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);

// 5秒后检查是否加载成功，失败则换源
setTimeout(function() {
  if (!document.querySelector('.leaflet-tile-loaded')) {
    // 换用 CartoDB 浅色地图
    map.removeLayer(tileLayer);
    tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);
    
    setTimeout(function() {
      if (!document.querySelector('.leaflet-tile-loaded')) {
        // 还是不行，纯色背景
        document.getElementById('wm').style.background = '#F6F0E6';
        var note = document.createElement('div');
        note.textContent = '🗺 离线模式 · 点击任意位置添加地点';
        note.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:14px;color:#888;z-index:500;background:rgba(255,255,255,0.85);padding:12px 20px;border-radius:8px;pointer-events:none';
        document.getElementById('wm').appendChild(note);
      }
    }, 5000);
  }
}, 5000);

var markers = {};
var locations = [];
var _worlds = [{ id: 'default', name: '主世界' }];
var _currentWorldId = 'default';
var _panel = null;
var _searchQuery = '';

// ===== 侧边栏 UI =====
var sidebar = document.createElement('div');
sidebar.id = 'world-sidebar';
sidebar.innerHTML = '' +
  '<div class="sidebar-header">' +
    '<div style="flex:1;min-width:0">' +
      '<div style="font-weight:600;font-size:14px;color:var(--text,#333);margin-bottom:6px">🗺 世界地图</div>' +
      '<select id="world-select" onchange="switchWorld(this.value)" style="width:100%;padding:6px 10px;border:1px solid var(--border,#ddd);border-radius:6px;background:var(--bg-panel,#fff);font-size:12px;outline:none;color:var(--text,#333);box-sizing:border-box"></select>' +
    '</div>' +
    '<button id="btn-back" style="padding:4px 10px;border:1px solid var(--border,#ddd);border-radius:4px;background:var(--bg-panel,#fff);color:var(--text,#333);font-size:11px;cursor:pointer;flex-shrink:0;margin-left:8px">← 返回</button>' +
  '</div>' +
  '<div class="sidebar-search">' +
    '<input id="loc-search" type="text" placeholder="搜索地点...">' +
  '</div>' +
  '<div id="loc-list" class="sidebar-list"></div>' +
  '<div class="sidebar-footer">' +
    '<button id="btn-add" style="width:100%;padding:8px;border:none;border-radius:6px;background:var(--accent,#2F6FDB);color:#fff;font-size:12px;cursor:pointer;font-weight:500">+ 添加地点</button>' +
  '</div>';
sidebar.style.cssText = 'position:absolute;top:10px;left:10px;bottom:10px;width:280px;z-index:1000;background:var(--bg,#fff);border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.12);display:flex;flex-direction:column;overflow:hidden';
document.body.appendChild(sidebar);

document.getElementById('btn-back').onclick = function() {
  window.location.href = 'app?token=' + encodeURIComponent(TOKEN);
};

function renderWorldSelect() {
  var sel = document.getElementById('world-select');
  var h = '';
  _worlds.forEach(function(w) {
    h += '<option value="' + w.id + '"' + (w.id === _currentWorldId ? ' selected' : '') + '>' + w.name + '</option>';
  });
  h += '<option value="__new__">+ 新建世界...</option>';
  sel.innerHTML = h;
}

function switchWorld(id) {
  if (id === '__new__') {
    // 内嵌输入替代 prompt
    showWorldNamePrompt();
  } else {
    _currentWorldId = id;
    renderWorldSelect();
    loadLocations();
  }
}

function showWorldNamePrompt() {
  var el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center';
  el.innerHTML = '<div style="background:#fff;border-radius:12px;padding:24px;width:300px;box-shadow:0 4px 24px rgba(0,0,0,0.2)">' +
    '<div style="font-weight:600;margin-bottom:12px;font-size:14px">🌌 新建世界</div>' +
    '<input id="world-name-inp" type="text" placeholder="如：灵界、星界" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:13px;box-sizing:border-box;margin-bottom:12px">' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
    '<button onclick="this.closest(\'div\').parentElement.remove()" style="padding:6px 14px;border:1px solid #ddd;border-radius:6px;background:#fff;font-size:12px;cursor:pointer">取消</button>' +
    '<button onclick="confirmWorldName()" style="padding:6px 14px;border:none;border-radius:6px;background:#2F6FDB;color:#fff;font-size:12px;cursor:pointer">确定</button>' +
    '</div></div>';
  document.body.appendChild(el);
  setTimeout(function() { var inp = document.getElementById('world-name-inp'); if (inp) inp.focus(); }, 50);
}

function confirmWorldName() {
  var inp = document.getElementById('world-name-inp');
  var name = inp ? inp.value.trim() : '';
  var el = inp ? inp.closest('div').parentElement : null;
  if (el) el.remove();
  if (!name) { renderWorldSelect(); return; }
  _worlds.push({ id: 'w_' + Date.now().toString(36), name: name });
  _currentWorldId = _worlds[_worlds.length - 1].id;
  renderWorldSelect();
  loadLocations();
}

renderWorldSelect();

document.getElementById('btn-add').onclick = function() {
  showPanel('add', null);
};

document.getElementById('loc-search').addEventListener('input', function(e) {
  _searchQuery = e.target.value.toLowerCase();
  renderList();
});

// ===== 渲染地点列表 =====
function renderList() {
  var list = document.getElementById('loc-list');
  var filtered = _searchQuery ? locations.filter(function(l) {
    return l.name.toLowerCase().indexOf(_searchQuery) > -1 || 
           (l.description && l.description.toLowerCase().indexOf(_searchQuery) > -1);
  }) : locations;

  // 按类型分组
  var grouped = {};
  filtered.forEach(function(loc) {
    var type = loc.type || 'default';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(loc);
  });

  var h = '';
  if (filtered.length === 0) {
    h += '<div class="empty-tip">暂无地点<br><span style="font-size:10px">点击地图或底部按钮添加</span></div>';
  } else {
    Object.keys(grouped).sort().forEach(function(type) {
      var info = getTypeInfo(type);
      var locs = grouped[type];
      h += '<div class="loc-group">';
      h += '<div class="loc-group-title">' + info.icon + ' ' + info.label + '<span>' + locs.length + '</span></div>';
      locs.forEach(function(loc) {
        var isSelected = _panel && _panel._locId === loc.id;
        h += '<div class="loc-card' + (isSelected ? ' selected' : '') + '" onclick="selectLoc(\'' + loc.id + '\')">';
        h += '<div class="loc-card-icon" style="background:' + info.color + '20;color:' + info.color + '">' + info.icon + '</div>';
        h += '<div class="loc-card-body">';
        h += '<div class="loc-card-name">' + esc(loc.name) + '</div>';
        if (loc.description) {
          h += '<div class="loc-card-desc">' + esc(loc.description.substring(0, 40)) + (loc.description.length > 40 ? '...' : '') + '</div>';
        }
        h += '</div>';
        h += '<div class="loc-card-arrow">›</div>';
        h += '</div>';
      });
      h += '</div>';
    });
  }
  list.innerHTML = h;
}

// ===== 选中地点 =====
function selectLoc(id) {
  var loc = locations.find(function(l) { return l.id === id; });
  if (!loc) return;
  map.flyTo([loc.lat, loc.lng], 13, { duration: 0.5 });
  showPanel('edit', loc);
}

// ===== 面板（添加/编辑） =====
function showPanel(mode, loc) {
  // 移除旧面板
  if (_panel) { _panel.remove(); _panel = null; }

  _panel = document.createElement('div');
  _panel._locId = loc ? loc.id : null;
  _panel._mode = mode;

  var isEdit = mode === 'edit';
  var title = isEdit ? '✏️ 编辑地点' : '📍 新建地点';
  var savedLoc = loc || {};

  // 类型选项
  var typeOptions = '';
  Object.keys(LOCATION_TYPES).forEach(function(t) {
    if (t === 'default') return;
    var info = LOCATION_TYPES[t];
    var sel = savedLoc.type === t ? ' selected' : '';
    typeOptions += '<option value="' + t + '"' + sel + '>' + info.icon + ' ' + info.label + '</option>';
  });

  _panel.innerHTML = '<div class="panel-inner">' +
    '<div class="panel-title">' + title + '</div>' +
    '<div class="form-group">' +
      '<label>名称</label>' +
      '<input id="inp-name" type="text" value="' + esc(savedLoc.name || '') + '" placeholder="如：雾港码头">' +
    '</div>' +
    '<div class="form-group">' +
      '<label>类型</label>' +
      '<select id="inp-type">' + typeOptions + '</select>' +
    '</div>' +
    '<div class="form-group">' +
      '<label>描述</label>' +
      '<textarea id="inp-desc" rows="3" placeholder="描述这座城市的历史、特色...">' + esc(savedLoc.description || '') + '</textarea>' +
    '</div>' +
    '<div class="form-group">' +
      '<label>坐标</label>' +
      '<div class="coord-display">' + (savedLoc.lat ? savedLoc.lat.toFixed(4) + ', ' + savedLoc.lng.toFixed(4) : '点击地图选择位置') + '</div>' +
    '</div>' +
    '<div class="panel-actions">' +
      (isEdit ? '<button class="btn-delete" onclick="deleteLoc(\'' + savedLoc.id + '\')">🗑 删除</button>' : '') +
      '<button class="btn-cancel" onclick="closePanel()">取消</button>' +
      '<button class="btn-save" onclick="saveLoc()">💾 保存</button>' +
    '</div>' +
  '</div>';
  _panel.style.cssText = 'position:absolute;top:10px;right:10px;width:320px;z-index:1001;background:var(--bg,#fff);border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.15);overflow:hidden';
  document.body.appendChild(_panel);
}

function closePanel() {
  if (_panel) { _panel.remove(); _panel = null; }
}

function saveLoc() {
  var name = document.getElementById('inp-name').value.trim();
  var type = document.getElementById('inp-type').value;
  var desc = document.getElementById('inp-desc').value.trim();

  if (!name) { showToast('请输入地点名称'); return; }

  var data = { name: name, type: type, description: desc, worldId: _currentWorldId };
  if (_panel._mode === 'edit' && _panel._locId) {
    data.id = _panel._locId;
    data.lat = locations.find(function(l) { return l.id === _panel._locId; }).lat;
    data.lng = locations.find(function(l) { return l.id === _panel._locId; }).lng;
  } else if (_clickCoords) {
    data.lat = _clickCoords.lat;
    data.lng = _clickCoords.lng;
  }

  fetch(tu(API + '/api/world/locations'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(function(r) { return r.json(); }).then(function() {
    closePanel();
    _clickCoords = null;
    loadLocations();
  }).catch(function(e) { showToast('保存失败: ' + e.message); });
}

function deleteLoc(id) {
  showConfirm('确定删除此地点？', function() {
    fetch(tu(API + '/api/world/locations/' + id), { method: 'DELETE' })
      .then(function(r) { return r.json(); }).then(function() {
        closePanel();
        loadLocations();
      }).catch(function(e) { showToast('删除失败: ' + e.message); });
  });
}

// 内嵌 Toast
function showToast(msg) {
  var t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:99999;background:#333;color:#fff;padding:10px 20px;border-radius:8px;font-size:12px;white-space:nowrap;animation:fadeIn .2s ease';
  document.body.appendChild(t);
  setTimeout(function() { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(function() { t.remove(); }, 300); }, 2000);
}

// 内嵌确认弹窗
function showConfirm(msg, cb) {
  var el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center';
  el.innerHTML = '<div style="background:#fff;border-radius:12px;padding:24px;width:300px;box-shadow:0 4px 24px rgba(0,0,0,0.2)">' +
    '<div style="margin-bottom:16px;font-size:14px;color:#333">' + msg + '</div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
    '<button onclick="this.closest(\'div\').parentElement.remove()" style="padding:6px 14px;border:1px solid #ddd;border-radius:6px;background:#fff;font-size:12px;cursor:pointer">取消</button>' +
    '<button onclick="this.closest(\'div\').parentElement.remove();(' + cb.toString() + ')()" style="padding:6px 14px;border:none;border-radius:6px;background:#B91C1C;color:#fff;font-size:12px;cursor:pointer">确定</button>' +
    '</div></div>';
  document.body.appendChild(el);
}

var _clickCoords = null;

// ===== 地图点击添加 =====
map.on('click', function(e) {
  _clickCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
  closePanel();
  showPanel('add', null);
});

// ===== 加载地点 =====
function loadLocations() {
  fetch(tu(API + '/api/world/locations'))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      // 按当前世界过滤
      locations = data.filter(function(loc) {
        return (loc.worldId || 'default') === _currentWorldId;
      });
      // 清除旧标记
      Object.keys(markers).forEach(function(k) { map.removeLayer(markers[k]); });
      markers = {};
      // 添加新标记
      data.forEach(function(loc) {
        var info = getTypeInfo(loc.type);
        // 自定义图标：带类型的圆形标记
        var icon = L.divIcon({
          className: 'custom-marker',
          html: '<div class="marker-pin" style="background:' + info.color + '">' + info.icon + '</div>',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32]
        });
        var mk = L.marker([loc.lat, loc.lng], { icon: icon }).addTo(map);
        var popupHtml = '<div class="marker-popup">' +
          '<div class="popup-icon">' + info.icon + '</div>' +
          '<div class="popup-name">' + esc(loc.name) + '</div>' +
          '<div class="popup-type">' + info.label + '</div>' +
          (loc.description ? '<div class="popup-desc">' + esc(loc.description) + '</div>' : '') +
          '<button class="popup-edit" onclick="selectLoc(\'' + loc.id + '\')">✏️ 编辑</button>' +
        '</div>';
        mk.bindPopup(popupHtml);
        markers[loc.id] = mk;
      });
      renderList();
    });
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 初始加载
loadLocations();

// ===== 内嵌样式 =====
var style = document.createElement('style');
style.textContent = `
  .sidebar-header { padding:16px;display:flex;align-items:flex-start;border-bottom:1px solid var(--border,#e5e0d8);gap:8px }
  .sidebar-search { padding:12px 16px 8px }
  .sidebar-search input { width:100%;padding:8px 12px;border:1px solid var(--border,#ddd);border-radius:8px;background:var(--bg-panel,#fff);font-size:12px;outline:none;box-sizing:border-box }
  .sidebar-search input:focus { border-color:var(--accent,#2F6FDB);box-shadow:0 0 0 2px rgba(47,111,219,0.1) }
  .sidebar-list { flex:1;overflow-y:auto;padding:8px 12px }
  .empty-tip { text-align:center;padding:40px 20px;color:var(--text-muted,#aaa);font-size:12px;line-height:1.6 }
  .loc-group { margin-bottom:16px }
  .loc-group-title { font-size:11px;font-weight:600;color:var(--text-muted,#888);text-transform:uppercase;letter-spacing:0.5px;padding:4px 8px;display:flex;justify-content:space-between }
  .loc-group-title span { font-weight:400;opacity:0.6 }
  .loc-card { display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;cursor:pointer;transition:all .15s;margin-bottom:4px;border:1px solid transparent }
  .loc-card:hover { background:var(--bg-hover,#f5f5f5) }
  .loc-card.selected { background:rgba(47,111,219,0.08);border-color:rgba(47,111,219,0.2) }
  .loc-card-icon { width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0 }
  .loc-card-body { flex:1;min-width:0 }
  .loc-card-name { font-size:13px;font-weight:600;color:var(--text,#333);white-space:nowrap;overflow:hidden;text-overflow:ellipsis }
  .loc-card-desc { font-size:11px;color:var(--text-muted,#888);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis }
  .loc-card-arrow { color:var(--text-muted,#ccc);font-size:16px }
  .sidebar-footer { padding:12px 16px;border-top:1px solid var(--border,#e5e0d8) }
  
  .panel-inner { padding:20px }
  .panel-title { font-size:16px;font-weight:600;color:var(--text,#333);margin-bottom:16px }
  .form-group { margin-bottom:14px }
  .form-group label { display:block;font-size:11px;font-weight:600;color:var(--text-muted,#888);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px }
  .form-group input,.form-group select,.form-group textarea { width:100%;padding:10px 12px;border:1px solid var(--border,#ddd);border-radius:8px;background:var(--bg-panel,#fff);font-size:13px;outline:none;box-sizing:border-box;font-family:inherit }
  .form-group input:focus,.form-group select:focus,.form-group textarea:focus { border-color:var(--accent,#2F6FDB);box-shadow:0 0 0 2px rgba(47,111,219,0.1) }
  .form-group textarea { resize:vertical;min-height:80px }
  .coord-display { padding:10px 12px;background:var(--bg-hover,#f5f5f5);border-radius:8px;font-size:12px;color:var(--text-muted,#888);font-family:monospace }
  .panel-actions { display:flex;gap:8px;margin-top:20px }
  .panel-actions button { flex:1;padding:10px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s }
  .btn-save { background:var(--accent,#2F6FDB);color:#fff;border:none }
  .btn-cancel { background:var(--bg-panel,#fff);color:var(--text,#333);border:1px solid var(--border,#ddd) }
  .btn-delete { background:#fef2f2;color:#B91C1C;border:1px solid #fecaca;flex:0 0 auto;min-width:70px }
  
  .custom-marker { background:none;border:none }
  .marker-pin { width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.2);cursor:pointer;transition:transform .15s }
  .marker-pin:hover { transform:rotate(-45deg) scale(1.1) }
  .marker-pin span { transform:rotate(45deg) }
  
  .marker-popup { padding:4px;min-width:180px }
  .marker-popup .popup-icon { font-size:28px;text-align:center;margin-bottom:4px }
  .marker-popup .popup-name { font-size:14px;font-weight:600;text-align:center;color:#333 }
  .marker-popup .popup-type { font-size:11px;text-align:center;color:#888;margin-bottom:6px }
  .marker-popup .popup-desc { font-size:12px;color:#666;margin:8px 0;padding:6px;background:#f9f9f9;border-radius:4px;line-height:1.5 }
  .marker-popup .popup-edit { display:block;width:100%;margin-top:8px;padding:6px;border:1px solid #ddd;border-radius:4px;background:#fff;font-size:11px;cursor:pointer }
  .marker-popup .popup-edit:hover { background:#f5f5f5 }
`;
document.head.appendChild(style);