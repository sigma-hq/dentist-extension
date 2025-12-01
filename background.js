// Background service worker for Sigma Dental Helper
// Provides a simple hook for opening the options page from the content script.

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
  }
  return true;
});
