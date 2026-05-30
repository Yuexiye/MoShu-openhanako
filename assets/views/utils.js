/* global API, TOKEN */
// ═══════════════════════════════════
//  墨述 · 工具函数
// ═══════════════════════════════════

var A = API, T = TOKEN;

// ── Utility ──
function q(id) { return document.getElementById(id); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function tu(url) { return url + (url.indexOf('?') > -1 ? '&' : '?') + 'token=' + encodeURIComponent(T); }

function toast(msg) {
  var el = q('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(function() { el.classList.remove('show'); }, 2000);
}

// ── Markdown ──
function renderMarkdown(body) {
  if (!body) return '';
  var html = esc(body);
  html = html.replace(/\/\*\s+(.+?)\s+\*\//g, '<span style="color:#999;font-style:italic">$1</span>');
  html = html.replace(/===([^=]+)===/g, '<mark style="background:#FFF3B0;padding:1px 4px;border-radius:3px">$1</mark>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#2F6FDB;text-decoration:underline">$1</a>');
  html = html.replace(/^### (.+)$/gm, '<h4 style="font-size:15px;margin:12px 0 6px;color:var(--text)">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 style="font-size:17px;margin:16px 0 8px;color:var(--text)">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2 style="font-size:19px;margin:20px 0 10px;color:var(--text);border-bottom:1px solid var(--border);padding-bottom:4px">$1</h2>');
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

// ── Inline Input Dialog (replaces blocked prompt()) ──
function showInputDialog(title, defaultValue, callback) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:9999;display:flex;align-items:center;justify-content:center';
  overlay.onclick = function(e) { if (e.target === overlay) { document.body.removeChild(overlay); } };
  var dialog = document.createElement('div');
  dialog.style.cssText = 'background:var(--bg-panel,#fff);border-radius:8px;padding:16px;min-width:280px;box-shadow:0 4px 24px rgba(0,0,0,0.15);border:1px solid var(--border,#ddd)';
  dialog.onclick = function(e) { e.stopPropagation(); };
  var input = document.createElement('input');
  input.value = defaultValue || '';
  input.style.cssText = 'width:100%;padding:6px 10px;border:1px solid var(--border,#ccc);border-radius:4px;font-size:13px;background:var(--bg,#fafafa);color:var(--text,#333);outline:none;box-sizing:border-box';
  dialog.innerHTML = '<div style="font-size:13px;margin-bottom:8px;color:var(--text,#333)">' + title + '</div>';
  dialog.appendChild(input);
  var btns = document.createElement('div');
  btns.style.cssText = 'margin-top:10px;text-align:right;display:flex;gap:6px;justify-content:flex-end';
  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.style.cssText = 'padding:4px 14px;border:1px solid var(--border,#ccc);border-radius:4px;background:var(--bg,#fafafa);color:var(--text,#333);cursor:pointer;font-size:12px';
  cancelBtn.onclick = function() { document.body.removeChild(overlay); };
  var okBtn = document.createElement('button');
  okBtn.textContent = '确定';
  okBtn.style.cssText = 'padding:4px 14px;border:1px solid var(--accent,#6366f1);border-radius:4px;background:var(--accent,#6366f1);color:#fff;cursor:pointer;font-size:12px';
  okBtn.onclick = function() { document.body.removeChild(overlay); callback(input.value); };
  btns.appendChild(cancelBtn);
  btns.appendChild(okBtn);
  dialog.appendChild(btns);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  setTimeout(function() { input.focus(); input.select(); }, 50);
  input.onkeydown = function(e) { if (e.key === 'Enter') okBtn.click(); if (e.key === 'Escape') cancelBtn.click(); };
}

// ── Confirm Dialog ──
function showConfirmDialog(msg, callback) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:9999;display:flex;align-items:center;justify-content:center';
  overlay.onclick = function(e) { if (e.target === overlay) { document.body.removeChild(overlay); } };
  var dialog = document.createElement('div');
  dialog.style.cssText = 'background:var(--bg-panel,#fff);border-radius:8px;padding:16px;min-width:280px;box-shadow:0 4px 24px rgba(0,0,0,0.15);border:1px solid var(--border,#ddd);text-align:center';
  dialog.onclick = function(e) { e.stopPropagation(); };
  dialog.innerHTML = '<div style="font-size:13px;margin-bottom:14px;color:var(--text,#333)">' + msg + '</div>';
  var btns = document.createElement('div');
  btns.style.cssText = 'display:flex;gap:6px;justify-content:center';
  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.style.cssText = 'padding:4px 14px;border:1px solid var(--border,#ccc);border-radius:4px;background:var(--bg,#fafafa);color:var(--text,#333);cursor:pointer;font-size:12px';
  cancelBtn.onclick = function() { document.body.removeChild(overlay); };
  var okBtn = document.createElement('button');
  okBtn.textContent = '确定';
  okBtn.style.cssText = 'padding:4px 14px;border:1px solid var(--danger,#e53e3e);border-radius:4px;background:var(--danger,#e53e3e);color:#fff;cursor:pointer;font-size:12px';
  okBtn.onclick = function() { document.body.removeChild(overlay); callback(); };
  btns.appendChild(cancelBtn);
  btns.appendChild(okBtn);
  dialog.appendChild(btns);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
}
