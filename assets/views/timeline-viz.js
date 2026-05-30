// 墨述 · 时间线可视化
// ═══════════════════════════════════════════════════════════════════════
// 甘特图式时间线：横向滚动时间轴，事件节点，倒叙/插叙标记
// 纯 canvas 绘制，无外部依赖

var _timelineVizDirty = false;
var _timelineVizCanvas = null;
var _timelineVizData = null;

function renderTimelineViz(projectId, data, chapters) {
  console.log('[tlviz] renderTimelineViz called, projectId:', projectId, 'timeline count:', data.length);
  var container = document.getElementById('timelineVizContainer');
  if (!container) {
    console.warn('[tlviz] container not found');
    return;
  }
  
  var canvas = document.createElement('canvas');
  canvas.id = 'timelineVizCanvas';
  canvas.style.cssText = 'width:100%;height:600px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-panel);cursor:grab;';
  container.innerHTML = '';
  container.appendChild(canvas);
  
  var ctx = canvas.getContext('2d');
  canvas._graph = null;
  
  // 数据解析
  console.log('[tlviz] data type:', typeof data, Array.isArray(data), 'data:', data);
  console.log('[tlviz] chapters type:', typeof chapters, Array.isArray(chapters), chapters ? chapters.length : 'null');
  var parsed = parseTimelineData(data, chapters);
  console.log('[tlviz] parsed:', JSON.stringify({ events: parsed.events.length, fuzzy: parsed.fuzzyEvents.length, minDate: parsed.minDate, maxDate: parsed.maxDate }));
  if (!parsed.events.length) {
    canvas.parentNode.innerHTML = '<div class="empty-state" style="height:400px"><div class="title" style="font-size:14px">暂无时间线事件</div><div class="desc" style="font-size:12px;color:var(--text-muted)">请在项目设置中添加时间线事件</div></div>';
    return;
  }
  
  _timelineVizData = parsed;
  console.log('[tlviz] parsed events:', parsed.events.length, 'fuzzy:', parsed.fuzzyEvents.length);
  drawTimeline(ctx, canvas, parsed);
}

function parseTimelineData(timelineEvents, chapters) {
  // 构建章节时间映射
  var chapterMap = {};
  (chapters || []).forEach(function(ch, i) {
    chapterMap[ch.id] = { title: ch.title || ch.name, order: i, wordCount: ch.wordCount || 0 };
  });
  
  // 解析日期（支持 ISO 格式和模糊描述）
  var events = (timelineEvents || []).map(function(evt) {
    var dateObj = parseDate(evt.date);
    return {
      id: evt.id,
      label: evt.label || '未命名事件',
      date: evt.date || '',
      dateObj: dateObj,
      eventType: evt.eventType || 'background',
      chapters: (evt.chapters || []).map(function(chId) {
        return chapterMap[chId] || { id: chId, title: chId, wordCount: 0 };
      }),
      chapterOrder: (evt.chapters || []).reduce(function(max, chId) {
        var ch = chapterMap[chId];
        return ch && ch.order > max ? ch.order : max;
      }, -Infinity),
      flashback: evt.flashback || false,
      description: evt.description || '',
      fuzzy: evt.fuzzy || false,
    };
  });
  
  // 过滤掉无法确定时间的模糊事件
  var concrete = events.filter(function(e) { return e.dateObj !== null; });
  var fuzzyEvents = events.filter(function(e) { return e.dateObj === null && e.label; });
  
  return {
    events: concrete,
    fuzzyEvents: fuzzyEvents,
    allEvents: events,
    minDate: concrete.length ? new Date(Math.min.apply(null, concrete.map(function(e) { return e.dateObj.getTime(); }))) : new Date(),
    maxDate: concrete.length ? new Date(Math.max.apply(null, concrete.map(function(e) { return e.dateObj.getTime(); }))) : new Date(),
    chapterCount: Object.keys(chapterMap).length,
  };
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  // ISO 格式: 2024-03-15
  var match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }
  // 纯年份: 2024
  match = dateStr.match(/^(\d{4})$/);
  if (match) {
    return new Date(parseInt(match[1]), 0, 1);
  }
  return null;
}

// ── 绘制时间线 ──

function drawTimeline(ctx, canvas, data) {
  var W = canvas.width = canvas.clientWidth * 2;
  var H = canvas.height = canvas.clientHeight * 2;
  ctx.scale(2, 2);
  
  var Wd = W / 2, Hd = H / 2;
  var margin = { top: 50, right: 60, bottom: 60, left: 180 };
  var chartW = Wd - margin.left - margin.right;
  var chartH = Hd - margin.top - margin.bottom;
  
  if (chartW <= 0 || chartH <= 0) return;
  
  // 清空
  ctx.clearRect(0, 0, Wd, Hd);
  
  // 绘制背景网格
  drawGrid(ctx, Wd, Hd, margin, chartW, chartH, data);
  
  // 绘制事件
  drawEvents(ctx, data, margin, chartW, chartH);
  
  // 绘制倒叙连线
  drawFlashbackArrows(ctx, data, margin, chartW, chartH);
  
  // 绘制图例
  drawLegend(ctx, Wd, margin, Hd);
  
  // 添加交互
  setupTimelineInteraction(canvas, data, margin, chartW, chartH);
}

function redrawTimeline(canvas, data, margin, chartW, chartH) {
  var s = _tlState.scale;
  canvas.style.transform = 'translateX(' + _tlState.offsetX + 'px) scale(' + s + ')';
  canvas.style.transformOrigin = '0 0';
}

function drawGrid(ctx, Wd, Hd, margin, chartW, chartH, data) {
  var minTime = data.minDate.getTime();
  var maxTime = data.maxDate.getTime();
  var range = maxTime - minTime || 86400000 * 365;
  
  // 自动扩展边界：两端各加 8% 缓冲
  var buf = range * 0.08;
  var displayMin = minTime - buf;
  var displayMax = maxTime + buf;
  var displayRange = displayMax - displayMin || 86400000 * 365;
  
  // 计算时间刻度
  var step = calculateTimeStep(displayRange);
  var minYear = Math.floor(new Date(displayMin).getFullYear());
  var maxYear = Math.ceil(new Date(displayMax).getFullYear());
  
  // 如果是 5 年内的密集事件，用月刻度
  var years = displayRange / (365.25 * 86400000);
  if (years <= 1) {
    step = 86400000 * 7; // 每周
    var start = new Date(minTime);
    start.setDate(1); // 月初
    var end = new Date(maxTime);
    var current = new Date(start);
    while (current <= end) {
      var x = margin.left + ((current.getTime() - displayMin) / displayRange) * chartW;
      if (x >= margin.left && x <= Wd - margin.right) {
        ctx.strokeStyle = 'rgba(120,115,100,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, margin.top);
        ctx.lineTo(x, Hd - margin.bottom);
        ctx.stroke();
        
        ctx.fillStyle = '#707070';
        ctx.font = '10px "Helvetica Neue", sans-serif';
        ctx.textAlign = 'center';
        var monthLabels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
        ctx.fillText(monthLabels[current.getMonth()] + ' ' + current.getFullYear(), x, Hd - margin.bottom + 16);
      }
      current = new Date(current.getTime() + step);
    }
  } else if (years <= 3) {
    step = 86400000 * 30; // 每月
    var start = new Date(minTime);
    start.setDate(1);
    var end = new Date(maxTime);
    var current = new Date(start);
    while (current <= end) {
      var x = margin.left + ((current.getTime() - displayMin) / displayRange) * chartW;
      if (x >= margin.left && x <= Wd - margin.right) {
        ctx.strokeStyle = 'rgba(120,115,100,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, margin.top);
        ctx.lineTo(x, Hd - margin.bottom);
        ctx.stroke();
        
        ctx.fillStyle = '#707070';
        ctx.font = '10px "Helvetica Neue", sans-serif';
        ctx.textAlign = 'center';
        var monthLabels = ['1','2','3','4','5','6','7','8','9','10','11','12'];
        ctx.fillText(monthLabels[current.getMonth()], x, Hd - margin.bottom + 16);
      }
      current = new Date(current.getTime() + step);
    }
  } else if (years <= 10) {
    step = 86400000 * 365; // 每年
    var current = new Date(minYear, 0, 1);
    while (current.getFullYear() <= maxYear) {
      var x = margin.left + ((current.getTime() - displayMin) / displayRange) * chartW;
      if (x >= margin.left && x <= Wd - margin.right) {
        ctx.strokeStyle = 'rgba(120,115,100,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, margin.top);
        ctx.lineTo(x, Hd - margin.bottom);
        ctx.stroke();
        
        ctx.fillStyle = '#858585';
        ctx.font = '11px "Helvetica Neue", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(current.getFullYear().toString(), x, Hd - margin.bottom + 20);
      }
      current = new Date(current.getFullYear() + 1, 0, 1);
    }
  } else {
    step = step; // 5年或10年一档
    var start = new Date(minYear, 0, 1);
    var current = new Date(start);
    while (current <= new Date(maxYear, 0, 1)) {
      var x = margin.left + ((current.getTime() - displayMin) / displayRange) * chartW;
      if (x >= margin.left && x <= Wd - margin.right) {
        ctx.strokeStyle = 'rgba(120,115,100,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, margin.top);
        ctx.lineTo(x, Hd - margin.bottom);
        ctx.stroke();
        
        ctx.fillStyle = '#858585';
        ctx.font = '11px "Helvetica Neue", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(current.getFullYear().toString(), x, Hd - margin.bottom + 20);
      }
      current = new Date(current.getTime() + step);
    }
  }
}

function calculateTimeStep(range) {
  var msPerYear = 365.25 * 86400000;
  var years = range / msPerYear;
  if (years < 2) return 86400000 * 30;    // 月
  if (years < 10) return 86400000 * 365;  // 年
  if (years < 50) return msPerYear * 5;   // 5年
  if (years < 100) return msPerYear * 10; // 10年
  return msPerYear * 50;                   // 50年
}

// Y 轴位置：全局均匀分布 + 类型中心约束 + 小抖动
var _eventYCache = {};
function getEventY(evt, allEvents, typeCenters) {
  var type = evt.eventType || 'background';
  var key = type + '_' + evt.id;
  if (_eventYCache[key]) return _eventYCache[key];
  
  // 按日期排序后的索引
  var sorted = allEvents.slice().sort(function(a, b) {
    return a.dateObj.getTime() - b.dateObj.getTime();
  });
  var total = sorted.length;
  var idx = sorted.indexOf(evt);
  
  // 基础位置：均匀分布在全高度范围内
  var yRatio = total > 1 ? idx / (total - 1) : 0.5;
  
  // 加入类型中心约束：拉向类型中心但保留随机性
  var center = typeCenters[type] || 0.5;
  var strength = 0.4; // 类型中心吸引力强度
  var y = yRatio * (1 - strength) + center * strength;
  
  // 小随机偏移（固定）
  var hash = hashStr(evt.id);
  var jitter = (hash % 7 - 3) / 80; // ±0.0375
  
  var result = y + jitter;
  _eventYCache[key] = result;
  return result;
}

var typeCentersCache = { core: 0.5, background: 0.2, branch: 0.8 };

function hashStr(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function truncateText(ctx, text, maxWidth, font) {
  if (!text) return '';
  ctx.font = font;
  if (ctx.measureText(text).width <= maxWidth) return text;
  // 截断中文
  var truncated = text;
  while (ctx.measureText(truncated).width > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
}

function drawEvents(ctx, data, margin, chartW, chartH) {
  var displayMin = data.minDate.getTime();
  var displayMax = data.maxDate.getTime();
  var range = displayMax - displayMin;
  var buf = range * 0.08;
  displayMin -= buf;
  displayMax += buf;
  var displayRange = displayMax - displayMin || 86400000 * 365;
  
  var typeColors = {
    core: '#d49a6a',
    background: '#a0a0a0',
    branch: '#7b9cb5',
  };
  var typeSizes = {
    core: 8,
    background: 5,
    branch: 6,
  };
  
  // 按类型分组
  var grouped = { core: [], background: [], branch: [] };
  data.events.forEach(function(evt) {
    var t = evt.eventType || 'background';
    if (!grouped[t]) t = 'background';
    grouped[t].push(evt);
  });
  
  // 画连接线（同组内）
  Object.keys(grouped).forEach(function(type) {
    var grp = grouped[type];
    if (grp.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = type === 'core' ? 'rgba(212,154,106,0.12)' : 'rgba(120,120,120,0.08)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    grp.forEach(function(evt, i) {
      var x = margin.left + ((evt.dateObj.getTime() - displayMin) / displayRange) * chartW;
      var yPos = margin.top + getEventY(evt, data.events, typeCentersCache) * chartH;
      if (i === 0) ctx.moveTo(x, yPos);
      else ctx.lineTo(x, yPos);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  });
  
  // 倒叙事件连线
  data.events.forEach(function(evt) {
    if (!evt.flashback) return;
    var nearest = null, minDist = Infinity;
    data.events.forEach(function(other) {
      if (other === evt || other.flashback) return;
      var d = Math.abs(other.dateObj.getTime() - evt.dateObj.getTime());
      if (d < minDist) { minDist = d; nearest = other; }
    });
    if (!nearest) return;
    var fx = margin.left + ((evt.dateObj.getTime() - displayMin) / displayRange) * chartW;
    var fy = margin.top + getEventY(evt, data.events, typeCentersCache) * chartH;
    var nx = margin.left + ((nearest.dateObj.getTime() - displayMin) / displayRange) * chartW;
    var ny = margin.top + getEventY(nearest, data.events, typeCentersCache) * chartH;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(231,76,60,0.3)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.moveTo(fx, fy);
    var mx = (fx + nx) / 2;
    ctx.bezierCurveTo(mx, fy, mx, ny, nx, ny);
    ctx.stroke();
    ctx.setLineDash([]);
    // 倒叙标记
    ctx.fillStyle = '#e74c3c';
    ctx.font = '10px "Helvetica Neue", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('↺ 倒叙', fx, fy - 14);
  });
  
  data.events.forEach(function(evt) {
    var x = margin.left + ((evt.dateObj.getTime() - displayMin) / displayRange) * chartW;
    var type = evt.eventType || 'background';
    var y = margin.top + getEventY(evt, data.events, typeCentersCache) * chartH;
    
    var color = typeColors[type] || typeColors.background;
    var radius = typeSizes[type] || typeSizes.background;
    
    // 事件节点
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // 事件标签 — 按奇偶行交替上下，减少重叠
    var evtIdx = data.events.indexOf(evt);
    var labelY = (evtIdx % 2 === 0) ? y + radius + 14 : y - radius - 8;
    var labelText = truncateText(ctx, evt.label, 220, '10px "Helvetica Neue", sans-serif');
    ctx.fillStyle = '#d8d8d8';
    ctx.font = '10px "Helvetica Neue", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(labelText, x, labelY);
    
    // 关联章节标记 — 放在节点另一侧
    if (evt.chapters.length > 0) {
      ctx.fillStyle = 'rgba(212,154,106,0.45)';
      ctx.font = '9px "Helvetica Neue", sans-serif';
      ctx.textAlign = 'center';
      var chText = evt.chapters.map(function(c) { return '◆' + c.title; }).join(' ');
      var chLabelY = (evtIdx % 2 === 0) ? y - radius - 26 : y + radius + 30;
      ctx.fillText(truncateText(ctx, chText, 220, '9px "Helvetica Neue", sans-serif'), x, chLabelY);
    }
  });
}

function drawFlashbackArrows(ctx, data, margin, chartW, chartH) {
  // 倒叙连线已在 drawEvents 中处理，此函数保留为兼容
}

function drawLegend(ctx, Wd, margin, Hd) {
  var items = [
    { color: '#d49a6a', label: '核心事件' },
    { color: '#a0a0a0', label: '背景事件' },
    { color: '#7b9cb5', label: '分支事件' },
  ];
  
  var startX = Wd / 2 - 100;
  var y = 20;
  ctx.font = '11px "Helvetica Neue", sans-serif';
  ctx.textAlign = 'left';
  
  items.forEach(function(item, i) {
    var x = startX + i * 80;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.fillStyle = '#a0a0a0';
    ctx.fillText(item.label, x + 8, y + 4);
  });
}

// ── 交互 ──

var _tlState = { scale: 1, offsetX: 0, dragging: false, panStart: null, scrollStart: null };

function setupTimelineInteraction(canvas, data, margin, chartW, chartH) {
  var minTime = data.minDate.getTime();
  var maxTime = data.maxDate.getTime();
  var range = maxTime - minTime || 86400000 * 365;
  var buf = range * 0.08;
  var displayMin = minTime - buf;
  var displayMax = maxTime + buf;
  var displayRange = displayMax - displayMin || 86400000 * 365;
  
  // 清除旧缩放状态
  _tlState = { scale: 1, offsetX: 0, dragging: false, panStart: null, scrollStart: null, reorder: null, reorderIdx: -1 };
  
  function dateToX(dateObj) {
    return margin.left + ((dateObj.getTime() - displayMin) / displayRange) * chartW;
  }
  
  function xToDate(x) {
    return new Date(displayMin + ((x - margin.left) / chartW) * displayRange);
  }
  
  var _offsetX = _tlState.offsetX;
  
  // 点击检测
  canvas.addEventListener('click', function(e) {
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left - _tlState.offsetX) / _tlState.scale;
    var y = (e.clientY - rect.top) / _tlState.scale;
    
    for (var i = 0; i < data.events.length; i++) {
      var evt = data.events[i];
      var ex = dateToX(evt.dateObj);
      var ey = margin.top + getEventY(evt, data.events, typeCentersCache) * chartH;
      var dist = Math.sqrt((x - ex) * (x - ex) + (y - ey) * (y - ey));
      
      if (dist < 25) {
        console.log('[tlviz] CLICKED:', evt.label, 'dist:', dist.toFixed(1));
        showEventDetail(e, evt, canvas.parentNode);
        return;
      }
    }
    console.log('[tlviz] no event clicked, scale:', _tlState.scale, 'offsetX:', _tlState.offsetX);
  });
  
  // 鼠标滚轮缩放
  canvas.addEventListener('wheel', function(e) {
    e.preventDefault();
    var delta = e.deltaY > 0 ? 0.9 : 1.1;
    var newScale = Math.max(0.5, Math.min(5, _tlState.scale * delta));
    
    // 以鼠标位置为中心缩放
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    
    _tlState.offsetX = mx - (mx - _tlState.offsetX) * (newScale / _tlState.scale);
    _tlState.scale = newScale;
    
    // 重新渲染
    redrawTimeline(canvas, data, margin, chartW, chartH);
  }, { passive: false });
  
  // 拖拽平移
  var isDragging = false;
  var startX2 = 0, startY2 = 0;
  
  canvas.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    isDragging = true;
    startX2 = e.clientX;
    startY2 = e.clientY;
    canvas.style.cursor = 'grabbing';
  });
  
  canvas.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    var dx = e.clientX - startX2;
    var dy = e.clientY - startY2;
    _tlState.offsetX += dx;
    startX2 = e.clientX;
    startY2 = e.clientY;
    redrawTimeline(canvas, data, margin, chartW, chartH);
  });
  
  canvas.addEventListener('mouseup', function(e) {
    if (isDragging) {
      var dx = Math.abs(e.clientX - startX2);
      var dy = Math.abs(e.clientY - startY2);
      isDragging = false;
      canvas.style.cursor = 'grab';
      
      // 如果移动距离很小，可能是拖拽排序
      if (dx < 5 && dy < 5) return; // 点击事件已经处理了
    }
  });
  
  canvas.addEventListener('mouseleave', function() {
    isDragging = false;
    canvas.style.cursor = 'grab';
  });
  
  // 拖拽排序（按住 Shift + 拖拽节点）
  var isReordering = false;
  var reorderEvt = null;
  var dragStartY = 0;
  
  canvas.addEventListener('mousedown', function(e) {
    if (!e.shiftKey) return;
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left) / _tlState.scale - _tlState.offsetX / _tlState.scale;
    var y = (e.clientY - rect.top) / _tlState.scale;
    
    for (var i = 0; i < data.events.length; i++) {
      var evt = data.events[i];
      var ex = dateToX(evt.dateObj);
      var ey = margin.top + getEventY(evt, data.events, typeCentersCache) * chartH;
      var dist = Math.sqrt((x - ex) * (x - ex) + (y - ey) * (y - ey));
      
      if (dist < 20) {
        isReordering = true;
        reorderEvt = evt;
        dragStartY = y;
        canvas.style.cursor = 'move';
        e.preventDefault();
        return;
      }
    }
  });
  
  canvas.addEventListener('mousemove', function(e) {
    if (!isReordering) {
      // 悬停提示
      var rect = canvas.getBoundingClientRect();
      var x = (e.clientX - rect.left) / _tlState.scale - _tlState.offsetX / _tlState.scale;
      var y = (e.clientY - rect.top) / _tlState.scale;
      var found = false;
      for (var i = 0; i < data.events.length; i++) {
        var evt = data.events[i];
        var ex = dateToX(evt.dateObj);
        var ey = margin.top + getEventY(evt, data.events, typeCentersCache) * chartH;
        if (Math.sqrt((x - ex) * (x - ex) + (y - ey) * (y - ey)) < 15) { found = true; break; }
      }
      canvas.style.cursor = found ? 'pointer' : 'grab';
      return;
    }
    
    var dy = (e.clientY - canvas.getBoundingClientRect().top) / _tlState.scale - dragStartY;
    var rowH = chartH / data.events.length;
    var moveRows = Math.round(dy / rowH);
    
    if (moveRows !== 0) {
      var idx = data.events.indexOf(reorderEvt);
      var newIdx = Math.max(0, Math.min(data.events.length - 1, idx + moveRows));
      
      // 移除并插入
      data.events.splice(idx, 1);
      data.events.splice(newIdx, 0, reorderEvt);
      
      // 清除缓存
      _eventYCache = {};
      dragStartY = margin.top + getEventY(reorderEvt, data.events, typeCentersCache) * chartH;
      
      redrawTimeline(canvas, data, margin, chartW, chartH);
    }
  });
  
  canvas.addEventListener('mouseup', function() {
    if (isReordering) {
      isReordering = false;
      reorderEvt = null;
      canvas.style.cursor = 'grab';
    }
  });
  
  // 显示操作提示
  var tip = document.createElement('div');
  tip.style.cssText = 'position:absolute;bottom:8px;right:12px;font-size:10px;color:var(--text-muted);pointer-events:none;z-index:10;';
  tip.textContent = '滚轮缩放 · 拖拽平移 · Shift+拖拽排序';
  canvas.parentNode.style.position = 'relative';
  canvas.parentNode.appendChild(tip);
  setTimeout(function() { tip.style.opacity = '0'; tip.style.transition = 'opacity 2s'; }, 4000);
}

function showEventDetail(e, evt, _ignore) {
  // 移除已有详情
  var old = document.querySelector('.timeline-detail');
  if (old) old.remove();
  
  var detail = document.createElement('div');
  detail.className = 'timeline-detail';
  detail.style.cssText = 'position:fixed;z-index:9999;background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:12px;max-width:300px;box-shadow:0 4px 20px rgba(0,0,0,0.4);font-size:12px;pointer-events:auto;';
  
  // 用鼠标页面坐标定位（fixed 直接相对于视口）
  var mx = e.clientX + 15;
  var my = e.clientY - 10;
  
  detail.style.left = mx + 'px';
  detail.style.top = my + 'px';
  document.body.appendChild(detail);
  
  // 边界检测
  var detailRect = detail.getBoundingClientRect();
  var vw = window.innerWidth, vh = window.innerHeight;
  if (detailRect.right > vw - 10) {
    detail.style.left = (mx - detailRect.width - 30) + 'px';
  }
  if (detailRect.bottom > vh - 10) {
    detail.style.top = (my - detailRect.height - 10) + 'px';
  }
  
  var eventType = evt.eventType;
  var typeLabel = { core: '核心事件', background: '背景事件', branch: '分支事件' }[eventType] || eventType;
  var typeColor = { core: '#d49a6a', background: '#a0a0a0', branch: '#7b9cb5' }[eventType] || '#a0a0a0';
  
  detail.innerHTML =
    '<div style="font-size:14px;font-weight:600;margin-bottom:6px">' + esc(evt.label) + '</div>' +
    '<div style="font-size:11px;color:' + typeColor + ';margin-bottom:4px">' + typeLabel + (evt.flashback ? ' · 倒叙' : '') + (evt.fuzzy ? ' · 模糊时间' : '') + '</div>' +
    '<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">📅 ' + esc(evt.date) + '</div>' +
    (evt.description ? '<div style="font-size:12px;color:var(--text);line-height:1.6;margin-bottom:8px">' + esc(evt.description).replace(/\n/g, '<br>') + '</div>' : '') +
    (evt.chapters.length > 0 ? '<div style="font-size:11px;color:var(--text-muted)">关联章节：' + evt.chapters.map(function(c) { return esc(c.title); }).join('、') + '</div>' : '');
  
  // 点击其他地方关闭
  var closeHandler = function(e2) {
    if (!detail.contains(e2.target)) {
      detail.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(function() { document.addEventListener('click', closeHandler); }, 10);
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
