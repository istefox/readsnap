const tokenInput = document.getElementById('token');
const languageSelect = document.getElementById('language');
const tagsInput = document.getElementById('tags');
const btnSave = document.getElementById('btn-save');
const btnTest = document.getElementById('btn-test');
const saveStatus = document.getElementById('save-status');

// Load saved settings
chrome.storage.local.get(['readwiseToken', 'ocrLanguage', 'defaultTags'], (result) => {
  if (result.readwiseToken) tokenInput.value = result.readwiseToken;
  if (result.ocrLanguage) languageSelect.value = result.ocrLanguage;
  if (result.defaultTags) tagsInput.value = result.defaultTags;
});

btnSave.addEventListener('click', () => {
  chrome.storage.local.set({
    readwiseToken: tokenInput.value.trim(),
    ocrLanguage: languageSelect.value,
    defaultTags: tagsInput.value.trim(),
  }, () => {
    saveStatus.textContent = 'Saved!';
    saveStatus.className = 'save-status';
    setTimeout(() => { saveStatus.textContent = ''; }, 2000);
  });
});

// --- Keyboard shortcuts ---
const shortcutsList = document.getElementById('shortcuts-list');
const btnShortcuts = document.getElementById('btn-shortcuts');

chrome.commands.getAll((commands) => {
  shortcutsList.innerHTML = '';
  for (const cmd of commands) {
    if (cmd.name === '_execute_action') continue; // skip default popup toggle
    const row = document.createElement('div');
    row.className = 'shortcut-row';
    const keyEl = cmd.shortcut
      ? `<span class="shortcut-key">${cmd.shortcut}</span>`
      : `<span class="shortcut-key not-set">Not set</span>`;
    row.innerHTML = `<span class="shortcut-name">${cmd.description}</span>${keyEl}`;
    shortcutsList.appendChild(row);
  }
});

btnShortcuts.addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

btnTest.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (!token) {
    saveStatus.textContent = 'Enter a token first';
    saveStatus.className = 'save-status error';
    return;
  }
  saveStatus.textContent = 'Testing...';
  saveStatus.className = 'save-status';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'validateToken',
      token,
    });
    if (response?.valid) {
      saveStatus.textContent = 'Token is valid!';
      saveStatus.className = 'save-status';
    } else {
      saveStatus.textContent = response?.error || 'Invalid token';
      saveStatus.className = 'save-status error';
    }
  } catch (err) {
    saveStatus.textContent = err.message;
    saveStatus.className = 'save-status error';
  }
});
