/**
 * store.js — 墨述前端状态管理
 * 简单的 Pub/Sub store，替代 20+ 个闭包变量
 */

var Store = (function () {
  var state = {
    projects: [],
    currentProject: null,
    chapters: [],
    cards: [],
    currentChapter: null,
    editing: false,
    markers: [],
    mapProject: null,
    activeView: 'writing',
    expandedCard: null,
    expandedVolumes: {},
    facts: [],
    factFilter: '',
    factTableView: false,
    // v2 新增
    structure: null,        // parts + arcs + timeline
    knowledge: null,        // rules + terms + lore
    selectedPartId: null,
    selectedArcId: null,
    selectedTimelineId: null,
    // UI 状态
    sidebarWidth: 280,
    autoSaveEnabled: true,
    autoSaveInterval: 5000,
    wordCount: 0,
    unsavedChanges: false,
  };

  var listeners = {};
  var batchDepth = 0;
  var batchedKeys = new Set();

  function subscribe(key, fn) {
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(fn);
    return function () {
      var i = listeners[key].indexOf(fn);
      if (i >= 0) listeners[key].splice(i, 1);
    };
  }

  function emit(key) {
    if (batchDepth > 0) { batchedKeys.add(key); return; }
    var fns = listeners[key] || [];
    for (var i = 0; i < fns.length; i++) fns[i](state[key]);
  }

  function get(key) { return state[key]; }
  function getAll() { return state; }

  function set(key, value) {
    state[key] = value;
    emit(key);
  }

  function batch(fn) {
    batchDepth++;
    fn();
    batchDepth--;
    if (batchDepth === 0) {
      var keys = Array.from(batchedKeys);
      batchedKeys = new Set();
      for (var i = 0; i < keys.length; i++) emit(keys[i]);
    }
  }

  // ── API helpers ──
  function apiGet(url) {
    return fetch(A + url + (url.indexOf('?') > -1 ? '&' : '?') + 'token=' + encodeURIComponent(T))
      .then(function (r) { return r.json(); });
  }

  function apiPost(url, body) {
    return fetch(A + url + '?token=' + encodeURIComponent(T), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (r) { return r.json(); });
  }

  return {
    get: get,
    set: set,
    getAll: getAll,
    subscribe: subscribe,
    batch: batch,
    apiGet: apiGet,
    apiPost: apiPost,
    // 便捷方法
    loadProject: function (projectId) {
      var self = this;
      return Promise.all([
        self.apiGet('/api/project/' + projectId + '/chapters'),
        self.apiGet('/api/project/' + projectId + '/cards'),
        self.apiGet('/api/project/' + projectId + '/markers'),
        self.apiGet('/api/project/' + projectId + '/facts'),
      ]).then(function (results) {
        batch(function () {
          self.set('chapters', results[0] || []);
          self.set('cards', results[1] || []);
          self.set('markers', results[2] || []);
          self.set('facts', results[3] || []);
        });
      });
    },
  };
})();

// 暴露到全局
window.Store = Store;