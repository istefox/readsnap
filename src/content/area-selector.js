(function() {
  // Prevent double-injection
  if (document.querySelector('.readsnap-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'readsnap-overlay';

  const hint = document.createElement('div');
  hint.className = 'readsnap-hint';
  hint.textContent = 'Drag to select area • ESC to cancel';

  const selection = document.createElement('div');
  selection.className = 'readsnap-selection';
  selection.style.display = 'none';

  document.body.appendChild(overlay);
  document.body.appendChild(hint);
  document.body.appendChild(selection);

  let startX = 0, startY = 0;
  let dragging = false;

  function cleanup() {
    overlay.remove();
    hint.remove();
    selection.remove();
    document.removeEventListener('keydown', onKeyDown, true);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cleanup();
      chrome.runtime.sendMessage({ action: 'areaCancelled' });
    }
  }

  document.addEventListener('keydown', onKeyDown, true);

  overlay.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    dragging = true;
    selection.style.display = 'block';
    selection.style.left = startX + 'px';
    selection.style.top = startY + 'px';
    selection.style.width = '0px';
    selection.style.height = '0px';
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    selection.style.left = x + 'px';
    selection.style.top = y + 'px';
    selection.style.width = w + 'px';
    selection.style.height = h + 'px';
  });

  overlay.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    dragging = false;

    const rect = {
      x: Math.min(e.clientX, startX),
      y: Math.min(e.clientY, startY),
      width: Math.abs(e.clientX - startX),
      height: Math.abs(e.clientY - startY),
    };

    cleanup();

    // Ignore tiny selections (accidental clicks)
    if (rect.width < 10 || rect.height < 10) {
      chrome.runtime.sendMessage({ action: 'areaCancelled' });
      return;
    }

    chrome.runtime.sendMessage({
      action: 'areaSelected',
      rect,
      devicePixelRatio: window.devicePixelRatio,
      pageUrl: window.location.href,
      pageTitle: document.title,
    });
  });
})();
