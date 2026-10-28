(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  // Inside a sandboxed viewer (published preview) other sites cannot be embedded, so videos stay as link-out posters.
  let embedBlocked = !!window.claude;

  /* ------------------------------------------------------------------
     Terrain diagram: faces split by slope (normal based projection)
  ------------------------------------------------------------------ */
  const tersvg = document.getElementById('tersvg');
  if (tersvg) {
    const N = 9, M = 7;
    const H = [];
    for (let j = 0; j < M; j++) {
      H[j] = [];
      for (let i = 0; i < N; i++) {
        const dx = (i - 3.8) / 2.6, dz = (j - 3) / 2.0;
        let v = 3.6 * Math.exp(-(dx * dx + dz * dz));
        v += (Math.sin(i * 2.3 + j * 1.1) + Math.cos(i * 1.3 - j * 2.7)) * 0.3 * Math.min(1, v / 1.2);
        H[j][i] = Math.max(0, v);
      }
    }
    // Axes and terrain share one projection: x -> right, y -> up, z -> (22, -13) per unit.
    const OX = 60, OY = 300, ZX = 22, ZY = -13;
    const ox = OX + 14, oy = OY, cx = 36, dxz = ZX, dyz = -ZY, hs = 34;
    const proj = (i, j) => [ox + i * cx + j * dxz, oy - j * dyz - H[j][i] * hs];
    const f = n => n.toFixed(1);

    let base = '';
    // legend (top left)
    base += '<rect class="lg-flat" x="14" y="12" width="30" height="16"/>';
    base += '<text x="54" y="25" font-size="14" class="lg-text">바닥 텍스처</text>';
    base += '<rect class="lg-steep" x="14" y="38" width="30" height="16"/>';
    base += '<text x="54" y="51" font-size="14" class="lg-text">절벽 텍스처</text>';
    // axes
    const z6 = [OX + ZX * 6, OY + ZY * 6];
    base += `<line class="axis" x1="${OX}" y1="${OY}" x2="${OX}" y2="80"/>`;
    base += `<line class="axis" x1="${OX}" y1="${OY}" x2="610" y2="${OY}"/>`;
    base += `<line x1="${OX}" y1="${OY}" x2="${z6[0]}" y2="${z6[1]}" stroke="#7686f5" stroke-width="2.4"/>`;
    base += `<text class="mono" font-size="13" x="${OX - 14}" y="94" fill="#4fbf80" text-anchor="end">y</text>`;
    base += `<text class="mono" font-size="13" x="${z6[0] + 8}" y="${z6[1] - 2}" fill="#5f70e8">z</text>`;
    base += `<text class="mono" font-size="13" x="610" y="${OY + 22}" fill="#e25a5a" text-anchor="end">x</text>`;
    tersvg.insertAdjacentHTML('beforeend', base + '<g id="faces"></g>');
    const faces = tersvg.querySelector('#faces');

    // precompute quads, back to front
    const quads = [];
    for (let j = M - 2; j >= 0; j--) {
      for (let i = 0; i < N - 1; i++) {
        const gx = ((H[j][i + 1] + H[j + 1][i + 1]) - (H[j][i] + H[j + 1][i])) / 2;
        const gz = ((H[j + 1][i] + H[j + 1][i + 1]) - (H[j][i] + H[j][i + 1])) / 2;
        const ang = Math.atan(Math.hypot(gx, gz)) * 180 / Math.PI;
        const pts = [proj(i, j), proj(i + 1, j), proj(i + 1, j + 1), proj(i, j + 1)].map(p => f(p[0]) + ',' + f(p[1])).join(' ');
        quads.push({ ang, pts });
      }
    }
    faces.innerHTML = quads.map(q => `<polygon class="face flat" points="${q.pts}"/>`).join('');
    const polys = [...faces.children];

    const slope = document.getElementById('slope');
    const out = document.getElementById('slope-out');
    const cnt = document.getElementById('ter-count');
    const update = () => {
      const t = +slope.value;
      let steep = 0;
      quads.forEach((q, k) => {
        const s = q.ang > t;
        if (s) steep++;
        polys[k].setAttribute('class', 'face ' + (s ? 'steep' : 'flat'));
      });
      out.textContent = t + '°';
      cnt.textContent = '절벽 면 ' + steep + ' / ' + quads.length;
    };
    slope.addEventListener('input', update);
    update();
  }

  /* ------------------------------------------------------------------
     Video frames (Vimeo): iframes are in the markup with autoplay, mute and loop.
     Pause them off screen; where embeds are blocked, the poster link underneath shows instead.
  ------------------------------------------------------------------ */
  const host = 'https://player.vimeo.com';
  const frames = [...document.querySelectorAll('[data-vimeo]')];
  const command = (frame, method) => {
    const f = frame.querySelector('iframe');
    if (f && f.contentWindow) f.contentWindow.postMessage(JSON.stringify({ method }), host);
  };
  if (embedBlocked) {
    frames.forEach(fr => fr.querySelectorAll('iframe').forEach(n => n.remove()));
  } else {
    frames.forEach(fr => {
      const f = fr.querySelector('iframe');
      if (f) f.addEventListener('load', () => fr.classList.add('is-loaded'), { once: true });
    });
    document.addEventListener('securitypolicyviolation', e => {
      if (!/frame|child/.test(e.violatedDirective || '')) return;
      embedBlocked = true;
      frames.forEach(fr => { fr.classList.remove('is-loaded'); fr.querySelectorAll('iframe').forEach(n => n.remove()); });
    });
    if ('IntersectionObserver' in window && !reduceMotion) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => command(en.target, en.isIntersecting ? 'play' : 'pause'));
      }, { rootMargin: '200px 0px', threshold: 0 });
      frames.forEach(fr => io.observe(fr));
    }
  }

  /* YouTube previews: load only on click, or open the link where embeds are blocked */
  document.querySelectorAll('.yt-preview[data-youtube]').forEach(btn => {
    const img = btn.querySelector('img');
    if (img) {
      const fail = () => img.classList.add('load-failed');
      img.addEventListener('error', fail);
      if (img.complete && img.naturalWidth === 0) fail();
    }
    btn.addEventListener('click', () => {
      const id = btn.dataset.youtube;
      if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return;
      if (embedBlocked) {
        const link = btn.closest('.yt').querySelector('figcaption a');
        if (link) link.click();
        return;
      }
      const iframe = document.createElement('iframe');
      iframe.className = 'yt-embed';
      iframe.title = btn.getAttribute('aria-label') || '프로젝트 영상';
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
      iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      btn.replaceWith(iframe);
    });
  });

  /* ------------------------------------------------------------------
     Project details open from "프로젝트" links
  ------------------------------------------------------------------ */
  const openFromHash = hash => {
    if (!hash || !hash.startsWith('#project-')) return;
    const t = document.getElementById(hash.slice(1));
    if (t && t.tagName === 'DETAILS') t.open = true;
  };
  document.querySelectorAll('a[href^="#project-"]').forEach(a => a.addEventListener('click', () => openFromHash(a.getAttribute('href'))));
  window.addEventListener('hashchange', () => openFromHash(location.hash));
  openFromHash(location.hash);

  /* ------------------------------------------------------------------
     Header: active node + scroll progress
  ------------------------------------------------------------------ */
  const links = [...document.querySelectorAll('.path-nav a')];
  if ('IntersectionObserver' in window) {
    const so = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const id = '#' + en.target.id;
        links.forEach(l => {
          const on = l.getAttribute('href') === id;
          l.classList.toggle('on', on);
          if (on) l.setAttribute('aria-current', 'location'); else l.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-25% 0px -60% 0px', threshold: 0 });
    document.querySelectorAll('section.sec[id]').forEach(s => so.observe(s));
  }
  const bar = document.querySelector('.head-progress i');
  if (bar) {
    let ticking = false;
    const paint = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0).toFixed(4) + ')';
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }, { passive: true });
    paint();
  }
})();
