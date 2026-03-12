const btnFullPage = document.getElementById('btn-full-page');
const btnSelectArea = document.getElementById('btn-select-area');
const linkSettings = document.getElementById('link-settings');
const statusEl = document.getElementById('status');
const chkIncludeImage = document.getElementById('chk-include-image');
const chkOcrEnabled = document.getElementById('chk-ocr-enabled');

// Load saved preferences
chrome.storage.local.get(['includeImage', 'ocrEnabled'], (result) => {
  chkIncludeImage.checked = result.includeImage !== false;
  chkOcrEnabled.checked = result.ocrEnabled !== false;
});

chkIncludeImage.addEventListener('change', () => {
  chrome.storage.local.set({ includeImage: chkIncludeImage.checked });
});

chkOcrEnabled.addEventListener('change', () => {
  chrome.storage.local.set({ ocrEnabled: chkOcrEnabled.checked });
});

function showStatus(message, type = 'info') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function setButtonsDisabled(disabled) {
  btnFullPage.disabled = disabled;
  btnSelectArea.disabled = disabled;
}

btnFullPage.addEventListener('click', async () => {
  setButtonsDisabled(true);
  showStatus('Capturing full page...', 'info');
  try {
    const response = await chrome.runtime.sendMessage({ action: 'captureFullPage' });
    if (response?.error) {
      showStatus(response.error, 'error');
    } else {
      showStatus('Sent to Readwise!', 'success');
      setTimeout(() => window.close(), 1200);
    }
  } catch (err) {
    showStatus(err.message, 'error');
  } finally {
    setButtonsDisabled(false);
  }
});

btnSelectArea.addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ action: 'captureArea' });
    window.close();
  } catch (err) {
    showStatus(err.message, 'error');
  }
});

linkSettings.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// Listen for status updates from service worker
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'captureStatus') {
    showStatus(msg.message, msg.type || 'info');
  }
});
