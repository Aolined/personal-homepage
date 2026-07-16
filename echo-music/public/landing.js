(function () {
  var root = document.documentElement;
  var canvas = document.getElementById('signal-canvas');
  var context = canvas && canvas.getContext('2d');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var precisePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var points = [];
  var width = 0;
  var height = 0;
  var dpr = 1;
  var lastDrawAt = 0;
  var framePending = false;
  var pointer = { x: 0, y: 0, active: false };

  function resizeCanvas() {
    if (!context) return;
    dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    var count = Math.max(28, Math.min(72, Math.floor(width / 25)));
    points = Array.from({ length: count }, function () {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: 0.7 + Math.random() * 1.35,
      };
    });
  }

  function drawSignal(timestamp) {
    if (!context) return;
    requestAnimationFrame(drawSignal);
    if (!reducedMotion && timestamp - lastDrawAt < 1000 / 45) return;
    lastDrawAt = timestamp;
    context.clearRect(0, 0, width, height);

    for (var i = 0; i < points.length; i += 1) {
      var point = points[i];
      if (!reducedMotion) {
        point.x += point.vx;
        point.y += point.vy;
        if (pointer.active) {
          var pdx = pointer.x - point.x;
          var pdy = pointer.y - point.y;
          var pointerDistance = Math.sqrt(pdx * pdx + pdy * pdy);
          if (pointerDistance < 190 && pointerDistance > 1) {
            var pull = (1 - pointerDistance / 190) * 0.006;
            point.x += pdx * pull;
            point.y += pdy * pull;
          }
        }
        if (point.x < -10) point.x = width + 10;
        if (point.x > width + 10) point.x = -10;
        if (point.y < -10) point.y = height + 10;
        if (point.y > height + 10) point.y = -10;
      }

      context.beginPath();
      context.arc(point.x, point.y, point.r, 0, Math.PI * 2);
      context.fillStyle = i % 8 === 0 ? 'rgba(213,189,121,0.58)' : 'rgba(151,205,236,0.62)';
      context.fill();

      for (var j = i + 1; j < points.length; j += 1) {
        var other = points[j];
        var dx = point.x - other.x;
        var dy = point.y - other.y;
        var distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 145) continue;
        context.strokeStyle = 'rgba(113,151,174,' + ((1 - distance / 145) * 0.16) + ')';
        context.lineWidth = 0.6;
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(other.x, other.y);
        context.stroke();
      }

      if (pointer.active) {
        var mx = point.x - pointer.x;
        var my = point.y - pointer.y;
        var mouseDistance = Math.sqrt(mx * mx + my * my);
        if (mouseDistance < 130) {
          context.strokeStyle = 'rgba(95,215,192,' + ((1 - mouseDistance / 130) * 0.24) + ')';
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(pointer.x, pointer.y);
          context.stroke();
        }
      }
    }
  }

  function updatePageState() {
    framePending = false;
    var scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    var scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    root.style.setProperty('--scroll-progress', Math.min(1, scrollTop / scrollRange).toFixed(4));
    var header = document.querySelector('.site-header');
    if (header) header.classList.toggle('is-scrolled', scrollTop > 48);

    if (!reducedMotion && pointer.active && scrollTop < window.innerHeight) {
      var nx = pointer.x / Math.max(1, window.innerWidth) - 0.5;
      var ny = pointer.y / Math.max(1, window.innerHeight) - 0.5;
      root.style.setProperty('--hero-echo-x', (nx * -9).toFixed(2) + 'px');
      root.style.setProperty('--hero-echo-y', (ny * -6).toFixed(2) + 'px');
      root.style.setProperty('--hero-music-x', (nx * 9).toFixed(2) + 'px');
      root.style.setProperty('--hero-music-y', (ny * 6).toFixed(2) + 'px');
    }
  }

  function requestPageState() {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(updatePageState);
  }

  function handlePointerMove(event) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    root.style.setProperty('--pointer-x', event.clientX + 'px');
    root.style.setProperty('--pointer-y', event.clientY + 'px');
    requestPageState();
  }

  function handlePointerLeave() {
    pointer.active = false;
    root.style.setProperty('--hero-echo-x', '0px');
    root.style.setProperty('--hero-echo-y', '0px');
    root.style.setProperty('--hero-music-x', '0px');
    root.style.setProperty('--hero-music-y', '0px');
  }

  function setupRevealMotion() {
    var targets = Array.from(document.querySelectorAll(
      '.section-heading, .feature-grid article, .player-preview, .text-action, .edition-row, .access-band, footer'
    ));
    targets.forEach(function (element, index) {
      element.classList.add('reveal-ready');
      if (element.matches('.feature-grid article')) {
        var itemIndex = Array.prototype.indexOf.call(element.parentNode.children, element);
        element.style.setProperty('--reveal-delay', (itemIndex * 90) + 'ms');
      } else if (index % 2) {
        element.style.setProperty('--reveal-delay', '50ms');
      }
    });

    if (reducedMotion || !('IntersectionObserver' in window)) {
      targets.forEach(function (element) { element.classList.add('is-visible'); });
      return;
    }

    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -7% 0px' });
    targets.forEach(function (element) { revealObserver.observe(element); });
  }

  function setupActiveNavigation() {
    if (!('IntersectionObserver' in window)) return;
    var links = Array.from(document.querySelectorAll('.site-nav a[href^="#"]'));
    var sections = links.map(function (link) {
      return document.querySelector(link.getAttribute('href'));
    }).filter(Boolean);
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-30% 0px -55% 0px', threshold: 0 });
    sections.forEach(function (section) { navObserver.observe(section); });
  }

  function setupPreviewTilt() {
    var preview = document.querySelector('.player-preview');
    if (!preview || reducedMotion || !precisePointer) return;
    preview.addEventListener('pointermove', function (event) {
      var rect = preview.getBoundingClientRect();
      var x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      var y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      preview.style.setProperty('--tilt-x', ((0.5 - y) * 5.5).toFixed(2) + 'deg');
      preview.style.setProperty('--tilt-y', ((x - 0.5) * 7).toFixed(2) + 'deg');
      preview.style.setProperty('--glare-x', (x * 100).toFixed(1) + '%');
      preview.style.setProperty('--glare-y', (y * 100).toFixed(1) + '%');
      preview.classList.add('is-tilting');
    }, { passive: true });
    preview.addEventListener('pointerleave', function () {
      preview.style.setProperty('--tilt-x', '0deg');
      preview.style.setProperty('--tilt-y', '0deg');
      preview.classList.remove('is-tilting');
    }, { passive: true });
  }

  window.addEventListener('resize', function () {
    resizeCanvas();
    requestPageState();
  }, { passive: true });
  window.addEventListener('scroll', requestPageState, { passive: true });
  if (precisePointer) {
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', handlePointerLeave, { passive: true });
  }

  resizeCanvas();
  setupRevealMotion();
  setupActiveNavigation();
  setupPreviewTilt();
  updatePageState();
  if (context) drawSignal(0);
})();
