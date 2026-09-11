// 回到顶部
(function() {
  var btn = document.createElement('button');
  btn.className = 'back-to-top';
  btn.innerHTML = '&uarr;';
  btn.title = '回到顶部';
  btn.onclick = function() { window.scrollTo({ top: 0, behavior: 'smooth' }); };
  document.body.appendChild(btn);
  window.addEventListener('scroll', function() {
    if (window.scrollY > 400) btn.classList.add('show');
    else btn.classList.remove('show');
  });
})();

// 点击导航链接后自动关闭移动端菜单
document.addEventListener('click', function(e) {
  var menu = document.getElementById('navMenu');
  if (menu && menu.classList.contains('show') && e.target.tagName === 'A') {
    menu.classList.remove('show');
  }
});

// 卡片点击外部链接新窗口打开
document.addEventListener('click', function(e) {
  if (e.target.matches('a[href^="http"]') || e.target.matches('a[href^="mailto"]')) {
    if (e.target.getAttribute('target') === null && e.target.hostname !== location.hostname) {
      e.target.setAttribute('target', '_blank');
      e.target.setAttribute('rel', 'noopener');
    }
  }
});
