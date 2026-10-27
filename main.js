(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const videoNodes = [...document.querySelectorAll('[data-vimeo]')];
  const siteHost = 'https://player.vimeo.com';

  function videoCommand(frame, method) {
    const player = frame.querySelector('iframe');
    if (!player || !player.contentWindow) return;
    player.contentWindow.postMessage(JSON.stringify({ method }), siteHost);
  }

  function createVideo(frame) {
    if (frame.querySelector('iframe')) return;
    const iframe = document.createElement('iframe');
    const id = frame.getAttribute('data-vimeo');
    const params = new URLSearchParams({
      autoplay: reduceMotion ? '0' : '1',
      muted: '1',
      loop: '1',
      autopause: '0',
      title: '0',
      byline: '0',
      portrait: '0',
      controls: '1',
      dnt: '1'
    });
    iframe.title = frame.dataset.label || '시연 영상';
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.loading = frame.hasAttribute('data-hero') ? 'eager' : 'lazy';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.src = siteHost + '/video/' + encodeURIComponent(id) + '?' + params.toString();
    iframe.addEventListener('load', () => {
      frame.classList.add('is-loaded');
      if (!reduceMotion) videoCommand(frame, 'play');
    }, { once: true });
    frame.appendChild(iframe);
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const frame = entry.target;
        if (entry.isIntersecting) {
          createVideo(frame);
          if (!reduceMotion) videoCommand(frame, 'play');
        } else if (!reduceMotion) {
          videoCommand(frame, 'pause');
        }
      }
    }, { rootMargin: '200px 0px 200px 0px', threshold: 0 });
    videoNodes.forEach(node => observer.observe(node));
  } else {
    videoNodes.forEach(createVideo);
  }

  const sourceLinks = document.querySelectorAll('a[href^="#project-"]');
  function openProjectFromHash(hash) {
    if (!hash || !hash.startsWith('#project-')) return;
    const target = document.getElementById(hash.slice(1));
    if (target && target.tagName === 'DETAILS') target.open = true;
  }
  sourceLinks.forEach(link => link.addEventListener('click', () => {
    openProjectFromHash(link.getAttribute('href'));
  }));
  window.addEventListener('hashchange', () => openProjectFromHash(window.location.hash));
  openProjectFromHash(window.location.hash);

  // Project videos stay lightweight until the visitor explicitly starts playback.
  document.querySelectorAll('.youtube-preview[data-youtube]').forEach(preview => {
    const poster = preview.querySelector('img');
    if (poster) {
      const hideFailedPoster = () => poster.classList.add('load-failed');
      poster.addEventListener('error', hideFailedPoster);
      if (poster.complete && poster.naturalWidth === 0) hideFailedPoster();
    }
    preview.addEventListener('click', () => {
      const id = preview.dataset.youtube;
      if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return;
      const iframe = document.createElement('iframe');
      iframe.className = 'youtube-embed';
      iframe.title = preview.getAttribute('aria-label') || '프로젝트 영상';
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
      iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      preview.replaceWith(iframe);
    }, { once: true });
  });

  const navLinks = [...document.querySelectorAll('.header-nav a')];
  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const currentId = '#' + entry.target.id;
        navLinks.forEach(link => {
          const active = link.getAttribute('href') === currentId;
          link.classList.toggle('active', active);
          if (active) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      }
    }, { rootMargin: '-25% 0px -58% 0px', threshold: 0 });
    document.querySelectorAll('section.portfolio-section[id]').forEach(section => navObserver.observe(section));
  }
})();
