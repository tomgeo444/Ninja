/**
 * SLICE IT: Ninja Mode - Background Service Worker (Manifest V3)
 * Handles global keyboard shortcuts (Alt+S) and on-demand script injection.
 */

const DEFAULT_SETTINGS = {
  mode: 'classic',
  bladeColor: 'neon_cyan',
  effectIntensity: 'high',
  soundVolume: 0.7,
  dismissAlert: false
};

// Set default settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['sliceIt_settings'], (res) => {
    if (!res || !res.sliceIt_settings) {
      chrome.storage.sync.set({ sliceIt_settings: DEFAULT_SETTINGS });
    }
  });
});

// Handle keyboard command: Alt+S
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-ninja-mode') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) return;
      const tab = tabs[0];
      if (!tab.id || !tab.url) return;

      // Restrict on privileged URLs
      if (
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('about:')
      ) {
        return;
      }

      chrome.storage.sync.get(['sliceIt_settings'], (res) => {
        const settings = res && res.sliceIt_settings ? res.sliceIt_settings : DEFAULT_SETTINGS;

        // Ping active tab
        chrome.tabs.sendMessage(tab.id, { action: 'PING' }, (response) => {
          if (chrome.runtime.lastError || !response) {
            // Need injection
            chrome.scripting.insertCSS({
              target: { tabId: tab.id },
              files: ['css/content.css']
            }, () => {
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: [
                  'js/math.js',
                  'js/audio.js',
                  'js/particles.js',
                  'js/fruits.js',
                  'js/slicer.js',
                  'js/hud.js',
                  'js/engine.js',
                  'js/content.js'
                ]
              }, () => {
                setTimeout(() => {
                  chrome.tabs.sendMessage(tab.id, {
                    action: 'START_GAME',
                    settings
                  });
                }, 80);
              });
            });
          } else {
            // Toggle
            chrome.tabs.sendMessage(tab.id, {
              action: 'TOGGLE_GAME',
              settings
            });
          }
        });
      });
    });
  }
});
