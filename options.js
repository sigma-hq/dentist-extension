// Load saved settings on page ready
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['apiEndpoint'], (result) => {
    const input = document.getElementById('apiEndpoint');
    input.value = result.apiEndpoint || 'http://localhost:8000';
  });
});

// Save settings
document.getElementById('optionsForm').addEventListener('submit', (event) => {
  event.preventDefault();

  const endpoint = document.getElementById('apiEndpoint').value.trim();
  const errorDiv = document.getElementById('endpointError');
  const successDiv = document.getElementById('successMessage');

  errorDiv.style.display = 'none';
  successDiv.style.display = 'none';

  if (!endpoint) {
    errorDiv.textContent = 'Please enter an API endpoint';
    errorDiv.style.display = 'block';
    return;
  }

  try {
    const url = new URL(endpoint);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Protocol must be http:// or https://');
    }
  } catch (_err) {
    errorDiv.textContent = 'Please enter a valid URL (e.g., http://localhost:8000 or https://192.168.1.169:8000)';
    errorDiv.style.display = 'block';
    return;
  }

  chrome.storage.local.set({ apiEndpoint: endpoint }, () => {
    if (chrome.runtime.lastError) {
      errorDiv.textContent = 'Error saving settings: ' + chrome.runtime.lastError.message;
      errorDiv.style.display = 'block';
      return;
    }

    successDiv.style.display = 'block';
    setTimeout(() => {
      successDiv.style.display = 'none';
    }, 3000);
  });
});
