console.log('Sigma Dental Helper - loaded');

let overlay = null;
let collapsedView = null;
let currentPatient = null;
let summaryData = null;
let isCollapsed = false;
let serviceProducts = [];
let serviceProductsFetchPromise = null;
let serviceProductsLoading = false;
let isUserAuthenticated = false;
let refreshInProgress = false;

const authTokens = {
  access: null,
  refresh: null
};

// =========================
// Tooth Numbering System Data
// =========================

const TOOTH_DATA = {
  fdi: {
    // FDI Two-Digit System (ISO 3950)
    // Quadrant 1 (Upper Right): 11-18
    11: { name: 'Upper Right Central Incisor', type: 'incisor', position: 'upper_right', quadrant: 1 },
    12: { name: 'Upper Right Lateral Incisor', type: 'incisor', position: 'upper_right', quadrant: 1 },
    13: { name: 'Upper Right Canine', type: 'canine', position: 'upper_right', quadrant: 1 },
    14: { name: 'Upper Right First Premolar', type: 'premolar', position: 'upper_right', quadrant: 1 },
    15: { name: 'Upper Right Second Premolar', type: 'premolar', position: 'upper_right', quadrant: 1 },
    16: { name: 'Upper Right First Molar', type: 'molar', position: 'upper_right', quadrant: 1 },
    17: { name: 'Upper Right Second Molar', type: 'molar', position: 'upper_right', quadrant: 1 },
    18: { name: 'Upper Right Third Molar', type: 'molar', position: 'upper_right', quadrant: 1 },
    
    // Quadrant 2 (Upper Left): 21-28
    21: { name: 'Upper Left Central Incisor', type: 'incisor', position: 'upper_left', quadrant: 2 },
    22: { name: 'Upper Left Lateral Incisor', type: 'incisor', position: 'upper_left', quadrant: 2 },
    23: { name: 'Upper Left Canine', type: 'canine', position: 'upper_left', quadrant: 2 },
    24: { name: 'Upper Left First Premolar', type: 'premolar', position: 'upper_left', quadrant: 2 },
    25: { name: 'Upper Left Second Premolar', type: 'premolar', position: 'upper_left', quadrant: 2 },
    26: { name: 'Upper Left First Molar', type: 'molar', position: 'upper_left', quadrant: 2 },
    27: { name: 'Upper Left Second Molar', type: 'molar', position: 'upper_left', quadrant: 2 },
    28: { name: 'Upper Left Third Molar', type: 'molar', position: 'upper_left', quadrant: 2 },
    
    // Quadrant 3 (Lower Left): 31-38
    31: { name: 'Lower Left Central Incisor', type: 'incisor', position: 'lower_left', quadrant: 3 },
    32: { name: 'Lower Left Lateral Incisor', type: 'incisor', position: 'lower_left', quadrant: 3 },
    33: { name: 'Lower Left Canine', type: 'canine', position: 'lower_left', quadrant: 3 },
    34: { name: 'Lower Left First Premolar', type: 'premolar', position: 'lower_left', quadrant: 3 },
    35: { name: 'Lower Left Second Premolar', type: 'premolar', position: 'lower_left', quadrant: 3 },
    36: { name: 'Lower Left First Molar', type: 'molar', position: 'lower_left', quadrant: 3 },
    37: { name: 'Lower Left Second Molar', type: 'molar', position: 'lower_left', quadrant: 3 },
    38: { name: 'Lower Left Third Molar', type: 'molar', position: 'lower_left', quadrant: 3 },
    
    // Quadrant 4 (Lower Right): 41-48
    41: { name: 'Lower Right Central Incisor', type: 'incisor', position: 'lower_right', quadrant: 4 },
    42: { name: 'Lower Right Lateral Incisor', type: 'incisor', position: 'lower_right', quadrant: 4 },
    43: { name: 'Lower Right Canine', type: 'canine', position: 'lower_right', quadrant: 4 },
    44: { name: 'Lower Right First Premolar', type: 'premolar', position: 'lower_right', quadrant: 4 },
    45: { name: 'Lower Right Second Premolar', type: 'premolar', position: 'lower_right', quadrant: 4 },
    46: { name: 'Lower Right First Molar', type: 'molar', position: 'lower_right', quadrant: 4 },
    47: { name: 'Lower Right Second Molar', type: 'molar', position: 'lower_right', quadrant: 4 },
    48: { name: 'Lower Right Third Molar', type: 'molar', position: 'lower_right', quadrant: 4 },
    
    // Primary teeth (Deciduous) - Quadrants 5-8
    51: { name: 'Upper Right Primary Central Incisor', type: 'incisor', position: 'upper_right', quadrant: 5, isPrimary: true },
    52: { name: 'Upper Right Primary Lateral Incisor', type: 'incisor', position: 'upper_right', quadrant: 5, isPrimary: true },
    53: { name: 'Upper Right Primary Canine', type: 'canine', position: 'upper_right', quadrant: 5, isPrimary: true },
    54: { name: 'Upper Right Primary First Molar', type: 'molar', position: 'upper_right', quadrant: 5, isPrimary: true },
    55: { name: 'Upper Right Primary Second Molar', type: 'molar', position: 'upper_right', quadrant: 5, isPrimary: true },
    
    61: { name: 'Upper Left Primary Central Incisor', type: 'incisor', position: 'upper_left', quadrant: 6, isPrimary: true },
    62: { name: 'Upper Left Primary Lateral Incisor', type: 'incisor', position: 'upper_left', quadrant: 6, isPrimary: true },
    63: { name: 'Upper Left Primary Canine', type: 'canine', position: 'upper_left', quadrant: 6, isPrimary: true },
    64: { name: 'Upper Left Primary First Molar', type: 'molar', position: 'upper_left', quadrant: 6, isPrimary: true },
    65: { name: 'Upper Left Primary Second Molar', type: 'molar', position: 'upper_left', quadrant: 6, isPrimary: true },
    
    71: { name: 'Lower Left Primary Central Incisor', type: 'incisor', position: 'lower_left', quadrant: 7, isPrimary: true },
    72: { name: 'Lower Left Primary Lateral Incisor', type: 'incisor', position: 'lower_left', quadrant: 7, isPrimary: true },
    73: { name: 'Lower Left Primary Canine', type: 'canine', position: 'lower_left', quadrant: 7, isPrimary: true },
    74: { name: 'Lower Left Primary First Molar', type: 'molar', position: 'lower_left', quadrant: 7, isPrimary: true },
    75: { name: 'Lower Left Primary Second Molar', type: 'molar', position: 'lower_left', quadrant: 7, isPrimary: true },
    
    81: { name: 'Lower Right Primary Central Incisor', type: 'incisor', position: 'lower_right', quadrant: 8, isPrimary: true },
    82: { name: 'Lower Right Primary Lateral Incisor', type: 'incisor', position: 'lower_right', quadrant: 8, isPrimary: true },
    83: { name: 'Lower Right Primary Canine', type: 'canine', position: 'lower_right', quadrant: 8, isPrimary: true },
    84: { name: 'Lower Right Primary First Molar', type: 'molar', position: 'lower_right', quadrant: 8, isPrimary: true },
    85: { name: 'Lower Right Primary Second Molar', type: 'molar', position: 'lower_right', quadrant: 8, isPrimary: true }
  },
  
  universal: {
    // Universal Numbering System (1-32 for permanent teeth)
    1: { name: 'Upper Right Third Molar', type: 'molar', position: 'upper_right' },
    2: { name: 'Upper Right Second Molar', type: 'molar', position: 'upper_right' },
    3: { name: 'Upper Right First Molar', type: 'molar', position: 'upper_right' },
    4: { name: 'Upper Right Second Premolar', type: 'premolar', position: 'upper_right' },
    5: { name: 'Upper Right First Premolar', type: 'premolar', position: 'upper_right' },
    6: { name: 'Upper Right Canine', type: 'canine', position: 'upper_right' },
    7: { name: 'Upper Right Lateral Incisor', type: 'incisor', position: 'upper_right' },
    8: { name: 'Upper Right Central Incisor', type: 'incisor', position: 'upper_right' },
    9: { name: 'Upper Left Central Incisor', type: 'incisor', position: 'upper_left' },
    10: { name: 'Upper Left Lateral Incisor', type: 'incisor', position: 'upper_left' },
    11: { name: 'Upper Left Canine', type: 'canine', position: 'upper_left' },
    12: { name: 'Upper Left First Premolar', type: 'premolar', position: 'upper_left' },
    13: { name: 'Upper Left Second Premolar', type: 'premolar', position: 'upper_left' },
    14: { name: 'Upper Left First Molar', type: 'molar', position: 'upper_left' },
    15: { name: 'Upper Left Second Molar', type: 'molar', position: 'upper_left' },
    16: { name: 'Upper Left Third Molar', type: 'molar', position: 'upper_left' },
    17: { name: 'Lower Left Third Molar', type: 'molar', position: 'lower_left' },
    18: { name: 'Lower Left Second Molar', type: 'molar', position: 'lower_left' },
    19: { name: 'Lower Left First Molar', type: 'molar', position: 'lower_left' },
    20: { name: 'Lower Left Second Premolar', type: 'premolar', position: 'lower_left' },
    21: { name: 'Lower Left First Premolar', type: 'premolar', position: 'lower_left' },
    22: { name: 'Lower Left Canine', type: 'canine', position: 'lower_left' },
    23: { name: 'Lower Left Lateral Incisor', type: 'incisor', position: 'lower_left' },
    24: { name: 'Lower Left Central Incisor', type: 'incisor', position: 'lower_left' },
    25: { name: 'Lower Right Central Incisor', type: 'incisor', position: 'lower_right' },
    26: { name: 'Lower Right Lateral Incisor', type: 'incisor', position: 'lower_right' },
    27: { name: 'Lower Right Canine', type: 'canine', position: 'lower_right' },
    28: { name: 'Lower Right First Premolar', type: 'premolar', position: 'lower_right' },
    29: { name: 'Lower Right Second Premolar', type: 'premolar', position: 'lower_right' },
    30: { name: 'Lower Right First Molar', type: 'molar', position: 'lower_right' },
    31: { name: 'Lower Right Second Molar', type: 'molar', position: 'lower_right' },
    32: { name: 'Lower Right Third Molar', type: 'molar', position: 'lower_right' },
    
    // Primary teeth (A-T)
    'A': { name: 'Upper Right Primary Second Molar', type: 'molar', position: 'upper_right', isPrimary: true },
    'B': { name: 'Upper Right Primary First Molar', type: 'molar', position: 'upper_right', isPrimary: true },
    'C': { name: 'Upper Right Primary Canine', type: 'canine', position: 'upper_right', isPrimary: true },
    'D': { name: 'Upper Right Primary Lateral Incisor', type: 'incisor', position: 'upper_right', isPrimary: true },
    'E': { name: 'Upper Right Primary Central Incisor', type: 'incisor', position: 'upper_right', isPrimary: true },
    'F': { name: 'Upper Left Primary Central Incisor', type: 'incisor', position: 'upper_left', isPrimary: true },
    'G': { name: 'Upper Left Primary Lateral Incisor', type: 'incisor', position: 'upper_left', isPrimary: true },
    'H': { name: 'Upper Left Primary Canine', type: 'canine', position: 'upper_left', isPrimary: true },
    'I': { name: 'Upper Left Primary First Molar', type: 'molar', position: 'upper_left', isPrimary: true },
    'J': { name: 'Upper Left Primary Second Molar', type: 'molar', position: 'upper_left', isPrimary: true },
    'K': { name: 'Lower Left Primary Second Molar', type: 'molar', position: 'lower_left', isPrimary: true },
    'L': { name: 'Lower Left Primary First Molar', type: 'molar', position: 'lower_left', isPrimary: true },
    'M': { name: 'Lower Left Primary Canine', type: 'canine', position: 'lower_left', isPrimary: true },
    'N': { name: 'Lower Left Primary Lateral Incisor', type: 'incisor', position: 'lower_left', isPrimary: true },
    'O': { name: 'Lower Left Primary Central Incisor', type: 'incisor', position: 'lower_left', isPrimary: true },
    'P': { name: 'Lower Right Primary Central Incisor', type: 'incisor', position: 'lower_right', isPrimary: true },
    'Q': { name: 'Lower Right Primary Lateral Incisor', type: 'incisor', position: 'lower_right', isPrimary: true },
    'R': { name: 'Lower Right Primary Canine', type: 'canine', position: 'lower_right', isPrimary: true },
    'S': { name: 'Lower Right Primary First Molar', type: 'molar', position: 'lower_right', isPrimary: true },
    'T': { name: 'Lower Right Primary Second Molar', type: 'molar', position: 'lower_right', isPrimary: true }
  },
  
  palmer: {
    // Palmer Notation uses quadrant symbols and numbers 1-8
    // We'll use a string format like "UR1", "UL8", "LL3", "LR5"
    'UR1': { name: 'Upper Right Central Incisor', type: 'incisor', position: 'upper_right' },
    'UR2': { name: 'Upper Right Lateral Incisor', type: 'incisor', position: 'upper_right' },
    'UR3': { name: 'Upper Right Canine', type: 'canine', position: 'upper_right' },
    'UR4': { name: 'Upper Right First Premolar', type: 'premolar', position: 'upper_right' },
    'UR5': { name: 'Upper Right Second Premolar', type: 'premolar', position: 'upper_right' },
    'UR6': { name: 'Upper Right First Molar', type: 'molar', position: 'upper_right' },
    'UR7': { name: 'Upper Right Second Molar', type: 'molar', position: 'upper_right' },
    'UR8': { name: 'Upper Right Third Molar', type: 'molar', position: 'upper_right' },
    
    'UL1': { name: 'Upper Left Central Incisor', type: 'incisor', position: 'upper_left' },
    'UL2': { name: 'Upper Left Lateral Incisor', type: 'incisor', position: 'upper_left' },
    'UL3': { name: 'Upper Left Canine', type: 'canine', position: 'upper_left' },
    'UL4': { name: 'Upper Left First Premolar', type: 'premolar', position: 'upper_left' },
    'UL5': { name: 'Upper Left Second Premolar', type: 'premolar', position: 'upper_left' },
    'UL6': { name: 'Upper Left First Molar', type: 'molar', position: 'upper_left' },
    'UL7': { name: 'Upper Left Second Molar', type: 'molar', position: 'upper_left' },
    'UL8': { name: 'Upper Left Third Molar', type: 'molar', position: 'upper_left' },
    
    'LL1': { name: 'Lower Left Central Incisor', type: 'incisor', position: 'lower_left' },
    'LL2': { name: 'Lower Left Lateral Incisor', type: 'incisor', position: 'lower_left' },
    'LL3': { name: 'Lower Left Canine', type: 'canine', position: 'lower_left' },
    'LL4': { name: 'Lower Left First Premolar', type: 'premolar', position: 'lower_left' },
    'LL5': { name: 'Lower Left Second Premolar', type: 'premolar', position: 'lower_left' },
    'LL6': { name: 'Lower Left First Molar', type: 'molar', position: 'lower_left' },
    'LL7': { name: 'Lower Left Second Molar', type: 'molar', position: 'lower_left' },
    'LL8': { name: 'Lower Left Third Molar', type: 'molar', position: 'lower_left' },
    
    'LR1': { name: 'Lower Right Central Incisor', type: 'incisor', position: 'lower_right' },
    'LR2': { name: 'Lower Right Lateral Incisor', type: 'incisor', position: 'lower_right' },
    'LR3': { name: 'Lower Right Canine', type: 'canine', position: 'lower_right' },
    'LR4': { name: 'Lower Right First Premolar', type: 'premolar', position: 'lower_right' },
    'LR5': { name: 'Lower Right Second Premolar', type: 'premolar', position: 'lower_right' },
    'LR6': { name: 'Lower Right First Molar', type: 'molar', position: 'lower_right' },
    'LR7': { name: 'Lower Right Second Molar', type: 'molar', position: 'lower_right' },
    'LR8': { name: 'Lower Right Third Molar', type: 'molar', position: 'lower_right' },
    
    // Primary teeth (lowercase letters)
    'URA': { name: 'Upper Right Primary Central Incisor', type: 'incisor', position: 'upper_right', isPrimary: true },
    'URB': { name: 'Upper Right Primary Lateral Incisor', type: 'incisor', position: 'upper_right', isPrimary: true },
    'URC': { name: 'Upper Right Primary Canine', type: 'canine', position: 'upper_right', isPrimary: true },
    'URD': { name: 'Upper Right Primary First Molar', type: 'molar', position: 'upper_right', isPrimary: true },
    'URE': { name: 'Upper Right Primary Second Molar', type: 'molar', position: 'upper_right', isPrimary: true },
    
    'ULA': { name: 'Upper Left Primary Central Incisor', type: 'incisor', position: 'upper_left', isPrimary: true },
    'ULB': { name: 'Upper Left Primary Lateral Incisor', type: 'incisor', position: 'upper_left', isPrimary: true },
    'ULC': { name: 'Upper Left Primary Canine', type: 'canine', position: 'upper_left', isPrimary: true },
    'ULD': { name: 'Upper Left Primary First Molar', type: 'molar', position: 'upper_left', isPrimary: true },
    'ULE': { name: 'Upper Left Primary Second Molar', type: 'molar', position: 'upper_left', isPrimary: true },
    
    'LLA': { name: 'Lower Left Primary Central Incisor', type: 'incisor', position: 'lower_left', isPrimary: true },
    'LLB': { name: 'Lower Left Primary Lateral Incisor', type: 'incisor', position: 'lower_left', isPrimary: true },
    'LLC': { name: 'Lower Left Primary Canine', type: 'canine', position: 'lower_left', isPrimary: true },
    'LLD': { name: 'Lower Left Primary First Molar', type: 'molar', position: 'lower_left', isPrimary: true },
    'LLE': { name: 'Lower Left Primary Second Molar', type: 'molar', position: 'lower_left', isPrimary: true },
    
    'LRA': { name: 'Lower Right Primary Central Incisor', type: 'incisor', position: 'lower_right', isPrimary: true },
    'LRB': { name: 'Lower Right Primary Lateral Incisor', type: 'incisor', position: 'lower_right', isPrimary: true },
    'LRC': { name: 'Lower Right Primary Canine', type: 'canine', position: 'lower_right', isPrimary: true },
    'LRD': { name: 'Lower Right Primary First Molar', type: 'molar', position: 'lower_right', isPrimary: true },
    'LRE': { name: 'Lower Right Primary Second Molar', type: 'molar', position: 'lower_right', isPrimary: true }
  }
};

function validateAndGetToothInfo(toothNumber, numberingSystem = 'fdi') {
  const trimmed = String(toothNumber).trim().toUpperCase();
  
  if (!trimmed) {
    return { valid: false, error: 'Tooth number is required' };
  }
  
  let toothKey = trimmed;
  
  // FDI validation (default)
  if (numberingSystem === 'fdi') {
    // Must be exactly 2 digits
    if (!/^\d{2}$/.test(trimmed)) {
      return { valid: false, error: 'FDI tooth number must be exactly 2 digits (e.g., 11, 36, 48)' };
    }
    
    const num = parseInt(trimmed, 10);
    toothKey = num;
    
    if (!TOOTH_DATA.fdi[num]) {
      return { valid: false, error: 'Invalid FDI tooth number. Valid ranges: 11-18, 21-28, 31-38, 41-48 (permanent), 51-55, 61-65, 71-75, 81-85 (primary)' };
    }
    
    return {
      valid: true,
      toothInfo: TOOTH_DATA.fdi[num],
      toothNumber: trimmed,
      numberingSystem: 'fdi'
    };
  }
  
  // Universal validation
  if (numberingSystem === 'universal') {
    // Check if it's a letter (primary teeth A-T)
    if (/^[A-T]$/i.test(trimmed)) {
      const upperLetter = trimmed.toUpperCase();
      if (!TOOTH_DATA.universal[upperLetter]) {
        return { valid: false, error: 'Invalid Universal tooth letter. Valid letters: A-T for primary teeth' };
      }
      
      return {
        valid: true,
        toothInfo: TOOTH_DATA.universal[upperLetter],
        toothNumber: upperLetter,
        numberingSystem: 'universal'
      };
    }
    
    // Otherwise it should be a number 1-32
    if (!/^\d{1,2}$/.test(trimmed)) {
      return { valid: false, error: 'Universal tooth number must be 1-32 or A-T' };
    }
    
    const num = parseInt(trimmed, 10);
    toothKey = num;
    
    if (num < 1 || num > 32 || !TOOTH_DATA.universal[num]) {
      return { valid: false, error: 'Universal tooth number must be between 1 and 32, or A-T for primary teeth' };
    }
    
    return {
      valid: true,
      toothInfo: TOOTH_DATA.universal[num],
      toothNumber: trimmed,
      numberingSystem: 'universal'
    };
  }
  
  // Palmer validation
  if (numberingSystem === 'palmer') {
    // Accept formats like "UR1", "UL8", "LL3", "LR5" for permanent
    // or "URA", "ULE", "LLD" for primary
    if (!/^[UL][RL](\d|[A-E])$/i.test(trimmed)) {
      return { valid: false, error: 'Palmer notation must be in format: UR1-8, UL1-8, LL1-8, LR1-8 (or URA-E, ULA-E, etc. for primary)' };
    }
    
    if (!TOOTH_DATA.palmer[trimmed]) {
      return { valid: false, error: 'Invalid Palmer notation. Examples: UR1, UL8, LL3, LR5 (or URA, ULE for primary)' };
    }
    
    return {
      valid: true,
      toothInfo: TOOTH_DATA.palmer[trimmed],
      toothNumber: trimmed,
      numberingSystem: 'palmer'
    };
  }
  
  return { valid: false, error: 'Unknown numbering system' };
}

// =========================
// Background Fetch Helper (bypasses mixed content and CORS)
// =========================

async function backgroundFetch(url, options = {}) {
  console.log('[Dental] backgroundFetch REQUEST:', {
    url,
    method: options.method || 'GET',
    headers: options.headers
  });
  
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: 'fetch',
        url: url,
        options: {
          method: options.method || 'GET',
          headers: options.headers || {},
          body: options.body || undefined
        }
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Dental] backgroundFetch ERROR:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response.error) {
          console.error('[Dental] backgroundFetch FAILED:', response);
          const error = new Error(response.message);
          error.name = response.name;
          reject(error);
          return;
        }
        
        console.log('[Dental] backgroundFetch RESPONSE:', {
          url,
          status: response.status,
          ok: response.ok,
          data: response.data
        });
        
        // Create a response-like object
        resolve({
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: { get: (name) => response.headers?.[name.toLowerCase()] },
          json: async () => response.isJson ? response.data : JSON.parse(response.data),
          text: async () => typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
          data: response.data
        });
      }
    );
  });
}

// =========================
// Storage & Auth helpers
// =========================

async function loadAuthTokens() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['authAccess', 'authRefresh'], (result) => {
      authTokens.access = result.authAccess || null;
      authTokens.refresh = result.authRefresh || null;
      resolve(authTokens);
    });
  });
}

async function saveAuthTokens(access, refresh) {
  authTokens.access = access;
  authTokens.refresh = refresh;
  return new Promise((resolve) => {
    chrome.storage.local.set(
      {
        authAccess: access,
        authRefresh: refresh
      },
      resolve
    );
  });
}

async function clearAuthTokens() {
  authTokens.access = null;
  authTokens.refresh = null;
  return new Promise((resolve) => {
    chrome.storage.local.remove(['authAccess', 'authRefresh'], resolve);
  });
}

async function getApiEndpoint() {
  const storage = await new Promise((resolve) => {
    chrome.storage.local.get(['apiEndpoint'], resolve);
  });
  const endpoint = storage.apiEndpoint || 'http://192.168.1.169:5000';
  return endpoint.replace(/\/$/, '');
}

async function refreshAccessToken() {
  await loadAuthTokens();
  if (!authTokens.refresh) {
    throw new Error('No refresh token available');
  }

  const baseUrl = await getApiEndpoint();
  const url = `${baseUrl}/api/token/refresh/`;

  const response = await backgroundFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: authTokens.refresh })
  });

  if (!response.ok) {
    await clearAuthTokens();
    throw new Error('Token refresh failed');
  }

  const data = await response.json();
  await saveAuthTokens(data.access, data.refresh || authTokens.refresh);
  return data.access;
}

async function isAuthenticated() {
  await loadAuthTokens();
  if (!authTokens.access) return false;

  const baseUrl = await getApiEndpoint();
  const url = `${baseUrl}/api/token/verify/`;

  try {
    const response = await backgroundFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: authTokens.access })
    });

    if (response.ok) return true;

    if (authTokens.refresh) {
      try {
        await refreshAccessToken();
        return true;
      } catch (_err) {
        return false;
      }
    }
  } catch (_err) {
    return false;
  }

  return false;
}

async function authenticatedFetch(url, options = {}) {
  await loadAuthTokens();
  options.headers = {
    ...(options.headers || {}),
    ...(authTokens.access ? { Authorization: `Bearer ${authTokens.access}` } : {}),
    'Content-Type': 'application/json'
  };

  let response = await backgroundFetch(url, options);

  if (response.status === 401 && authTokens.refresh) {
    try {
      const newAccess = await refreshAccessToken();
      options.headers.Authorization = `Bearer ${newAccess}`;
      response = await backgroundFetch(url, options);
    } catch (err) {
      await clearAuthTokens();
      throw err;
    }
  }

  return response;
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =========================
// Service products (procedure list)
// =========================

function ensureServiceProductsFetching() {
  if (!serviceProductsFetchPromise) {
    serviceProductsFetchPromise = fetchServiceProducts();
  }
  return serviceProductsFetchPromise;
}

async function fetchServiceProducts() {
  serviceProductsLoading = true;
  refreshProcedureOptions();

  try {
    const baseUrl = await getApiEndpoint();
    const url = `${baseUrl}/api/products/dental/?page_size=100`;
    console.log('[Dental] Fetching dental products (procedures):', url);

    const allItems = [];
    let nextUrl = url;

    while (nextUrl) {
      const response = await authenticatedFetch(nextUrl, { method: 'GET' });
      console.log('[Dental] Dental products response:', {
        url: nextUrl,
        status: response.status,
        ok: response.ok
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.detail || errorBody.message || `Failed to load dental products (HTTP ${response.status})`);
      }

      const data = await response.json();
      console.log('[Dental] Dental products data:', data);

      const items =
        (Array.isArray(data) && data) ||
        (Array.isArray(data?.results) && data.results) ||
        (Array.isArray(data?.data) && data.data) ||
        (Array.isArray(data?.data?.results) && data.data.results) ||
        [];
      if (items.length) {
        allItems.push(...items);
      }

      const nextValue = data?.next ?? data?.data?.next ?? null;
      if (typeof nextValue === 'string' && nextValue.length > 0) {
        nextUrl = nextValue.startsWith('http')
          ? nextValue
          : `${baseUrl}${nextValue.startsWith('/') ? '' : '/'}${nextValue}`;
      } else {
        nextUrl = null;
      }
    }

    serviceProducts = allItems;
    refreshProcedureOptions();
  } catch (err) {
    console.error('[Dental] Error fetching dental products:', err);
    serviceProductsFetchPromise = null;
  } finally {
    serviceProductsLoading = false;
    refreshProcedureOptions();
  }
}

function refreshProcedureOptions(scope) {
  const context = scope || overlay || document;
  if (!context) return;

  const listEl = context.querySelector('#procedure_name_options');
  const statusEl = context.querySelector('#procedure_name_status');

  const setStatus = (text) => {
    if (statusEl) statusEl.textContent = text;
  };

  if (serviceProductsLoading) {
    if (listEl) listEl.innerHTML = '';
    setStatus('Loading dental procedures...');
    return;
  }

  if (!serviceProducts || !serviceProducts.length) {
    if (listEl) listEl.innerHTML = '';
    setStatus('No dental procedures loaded yet.');
    return;
  }

  if (listEl) {
    const optionsHtml = serviceProducts
      .map((item) => {
        const name = item.name || item.display_name || item.product_name || 'Unnamed procedure';
        const price = item.list_price ?? item.lst_price ?? item.price;
        const label = price !== undefined ? `${name} - ${price}` : name;
        return `<option value="${escapeHtml(name)}" label="${escapeHtml(label)}"></option>`;
      })
      .join('');

    listEl.innerHTML = optionsHtml;
  }

  setStatus(`Loaded ${serviceProducts.length} procedures`);
}

// =========================
// Patient detection
// =========================

function extractPatient() {
  const img = document.querySelector('.patient-image');
  const nameEl = document.querySelector('.patient-name');

  let uuid = null;
  let displayId = null;

  if (img && img.src) {
    const match = img.src.match(/patientUuid=([a-z0-9-]+)/i);
    if (match) uuid = match[1];
  }

  if (nameEl && nameEl.innerText) {
    const match = nameEl.innerText.match(/\((.*?)\)/);
    if (match) displayId = match[1];
  }

  if (uuid && (!currentPatient || currentPatient.uuid !== uuid)) {
    currentPatient = { uuid, displayId };
    summaryData = null;
    updateRefreshButtonState();
    renderOverlayForPatient();
  }
}

// =========================
// UI helpers
// =========================

function buildOverlayShell() {
  if (overlay) overlay.remove();

  isCollapsed = false;
  overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.bottom = '0';
  overlay.style.right = '0';
  overlay.style.zIndex = '9999';
  overlay.style.background = '#fff';
  overlay.style.border = '1px solid #ddd';
  overlay.style.padding = '0';
  overlay.style.borderRadius = '10px';
  overlay.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  overlay.style.fontFamily = 'system-ui, sans-serif';
  overlay.style.minWidth = '720px';
  overlay.style.maxWidth = '880px';
  overlay.style.transition = 'all 0.3s ease';
  overlay.style.margin = '0 20px 20px 0';

  overlay.innerHTML = `
    <div id="dentist-overlay-expanded">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #e0e0e0;background:#00695C;color:#fff;border-radius:10px 10px 0 0;">
        <div>
          <div style="font-weight:700;font-size:15px;">Dental Patient Summary</div>
          <div id="dentist-patient-label" style="font-size:12px;opacity:0.85;margin-top:2px;">Loading patient...</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button id="dentist-refresh-btn" title="Refresh summary" style="background:none;border:1px solid rgba(255,255,255,0.4);color:#fff;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;">Refresh</button>
          <button id="dentist-settings-btn" title="Settings" style="background:none;border:1px solid rgba(255,255,255,0.4);color:#fff;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;">Settings</button>
          <button id="dentist-logout-btn" title="Sign out" style="background:#c62828;border:none;color:#fff;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;display:none;">Logout</button>
          <button id="dentist-minimize-btn" title="Minimize" style="background:none;border:none;font-size:20px;cursor:pointer;color:white;padding:0 4px;">−</button>
        </div>
      </div>
      <div id="dentist-content" style="padding:16px;max-height:420px;overflow-y:auto;font-size:13px;">
        <em style="color:#666;">Waiting for patient...</em>
      </div>
    </div>
    <div id="dentist-overlay-collapsed" style="display:none;justify-content:center;align-items:center;width:48px;height:48px;background:#00695C;color:#fff;border-radius:50%;font-size:22px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);transition:transform 0.2s ease;">
      <span style="margin-top:-2px;">+</span>
    </div>
  `;

  document.body.appendChild(overlay);

  collapsedView = overlay.querySelector('#dentist-overlay-collapsed');

  overlay.querySelector('#dentist-minimize-btn').addEventListener('click', () => {
    overlay.querySelector('#dentist-overlay-expanded').style.display = 'none';
    collapsedView.style.display = 'flex';
    overlay.style.background = 'transparent';
    overlay.style.border = 'none';
    overlay.style.boxShadow = 'none';
    overlay.style.margin = '0';
    isCollapsed = true;
  });

  collapsedView.addEventListener('click', () => {
    overlay.querySelector('#dentist-overlay-expanded').style.display = 'block';
    collapsedView.style.display = 'none';
    overlay.style.background = '#fff';
    overlay.style.border = '1px solid #ddd';
    overlay.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    overlay.style.margin = '0 20px 20px 0';
    isCollapsed = false;
  });

  collapsedView.addEventListener('mouseenter', () => {
    collapsedView.style.transform = 'scale(1.08)';
  });
  collapsedView.addEventListener('mouseleave', () => {
    collapsedView.style.transform = 'scale(1)';
  });

  overlay.querySelector('#dentist-settings-btn').addEventListener('click', () => {
    renderSettings();
  });

  const refreshBtn = overlay.querySelector('#dentist-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      if (!currentPatient || refreshInProgress) return;
      refreshInProgress = true;
      const originalText = refreshBtn.textContent;
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Refreshing...';
      try {
        await renderOverlayForPatient();
      } catch (err) {
        console.error('[Dental] Manual refresh failed:', err);
      } finally {
        refreshInProgress = false;
        refreshBtn.textContent = originalText;
        updateRefreshButtonState();
      }
    });
  }

  overlay.querySelector('#dentist-logout-btn').addEventListener('click', async () => {
    await clearAuthTokens();
    summaryData = null;
    renderOverlayForPatient();
  });
  updateRefreshButtonState();
}

function setPatientLabel() {
  const labelEl = overlay?.querySelector('#dentist-patient-label');
  if (!labelEl) return;
  if (!currentPatient) {
    labelEl.textContent = 'Waiting for patient...';
    return;
  }
  const patientName = summaryData?.patient?.full_name;
  const idPart = summaryData?.patient?.customer_identifier || currentPatient.displayId;
  const pieces = [patientName || 'Patient detected', idPart ? `ID: ${idPart}` : null].filter(Boolean);
  labelEl.textContent = pieces.join(' • ');
}

function updateRefreshButtonState() {
  const refreshBtn = overlay?.querySelector('#dentist-refresh-btn');
  if (!refreshBtn) return;
  refreshBtn.disabled = !currentPatient || refreshInProgress || !isUserAuthenticated;
}

function setAuthUiState(authenticated) {
  isUserAuthenticated = authenticated;
  const logoutBtn = overlay?.querySelector('#dentist-logout-btn');
  if (logoutBtn) {
    logoutBtn.style.display = authenticated ? 'inline-block' : 'none';
  }
  updateRefreshButtonState();
}

// =========================
// Rendering
// =========================

async function renderOverlayForPatient() {
  if (!currentPatient) return;
  if (!overlay || isCollapsed) {
    buildOverlayShell();
  } else {
    setPatientLabel();
  }

  const content = overlay.querySelector('#dentist-content');
  setPatientLabel();
  content.innerHTML = `<p style="margin:0;color:#666;">Checking sign-in status...</p>`;

  const authenticated = await isAuthenticated();
  setAuthUiState(authenticated);

  if (!authenticated) {
    renderLogin(content);
    return;
  }

  await loadSummaryData(content);
}

function renderLogin(container) {
  container.innerHTML = `
    <div>
      <h3 style="margin:0 0 10px 0;color:#00695C;font-size:14px;">Sign in to view patient summary</h3>
      <p style="margin:0 0 14px 0;color:#555;font-size:12px;">Use your Sigma credentials to fetch dental visit data.</p>
      <form id="dentist-login-form" style="display:flex;flex-direction:column;gap:10px;">
        <div>
          <label style="display:block;font-size:12px;margin-bottom:4px;">Email</label>
          <input id="dentist-login-email" type="email" required placeholder="you@example.com" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:13px;box-sizing:border-box;">
        </div>
        <div>
          <label style="display:block;font-size:12px;margin-bottom:4px;">Password</label>
          <input id="dentist-login-password" type="password" required placeholder="Enter password" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:13px;box-sizing:border-box;">
        </div>
        <button type="submit" style="background:#00695C;color:white;border:none;padding:10px 12px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">Sign In</button>
      </form>
      <div id="dentist-login-error" style="display:none;color:#c62828;font-size:12px;margin-top:10px;"></div>
      <div style="margin-top:12px;font-size:12px;color:#555;">
        Need to update the API endpoint? <a id="dentist-open-settings" href="#" style="color:#00695C;text-decoration:underline;">Open settings</a>.
      </div>
    </div>
  `;

  container.querySelector('#dentist-open-settings').addEventListener('click', (e) => {
    e.preventDefault();
    renderSettings();
  });

  container.querySelector('#dentist-login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorDiv = container.querySelector('#dentist-login-error');
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    const email = container.querySelector('#dentist-login-email').value.trim();
    const password = container.querySelector('#dentist-login-password').value;

    if (!email || !password) {
      errorDiv.textContent = 'Email and password are required.';
      errorDiv.style.display = 'block';
      return;
    }

    try {
      const baseUrl = await getApiEndpoint();
      const url = `${baseUrl}/api/token/`;
      const response = await backgroundFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || 'Login failed. Check credentials.');
      }

      const data = await response.json();
      await saveAuthTokens(data.access, data.refresh);
      setAuthUiState(true);
      await loadSummaryData(container);
    } catch (err) {
      errorDiv.textContent = err.message || 'Unable to sign in.';
      errorDiv.style.display = 'block';
    }
  });
}

async function loadSummaryData(container) {
  if (!currentPatient) return;

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;color:#00695C;">
      <div class="loader" style="width:14px;height:14px;border:2px solid #b2dfdb;border-top-color:#00695C;border-radius:50%;animation:spin 1s linear infinite;"></div>
      <span>Fetching dental appointment summary...</span>
    </div>
    <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
  `;

  ensureServiceProductsFetching().then(() => {
    refreshProcedureOptions(container);
    renderProcedureDropdown();
  });

  try {
    const baseUrl = await getApiEndpoint();
    const url = `${baseUrl}/api/dental-appointments/summary/by-patient-uuid/${currentPatient.uuid}/`;
    
    console.log('[Dental] Fetching summary:', { url, patientUuid: currentPatient.uuid });
    
    const response = await authenticatedFetch(url, { method: 'GET' });

    console.log('[Dental] Response:', {
      url,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      data: response.data
    });

    if (!response.ok) {
      console.log('[Dental] Response not OK:', response.status);
      
      if (response.status === 401) {
        await clearAuthTokens();
        setAuthUiState(false);
        renderLogin(container);
        return;
      }

      // Treat 404 as "no dental data found" - this is a valid state, not an error
      if (response.status === 404) {
        console.log('[Dental] 404 - No dental data found for patient');
        summaryData = {
          patient: currentPatient ? {
            customer_identifier: currentPatient.displayId || '',
            phone_number: ''
          } : null,
          appointment: null,
          allergies: [],
          past_medical_conditions: [],
          consumed_items: [],
          active_visit: null
        };
        setPatientLabel();
        renderNoDataState(container);
        return;
      }

      const errorBody = await response.json().catch(() => ({}));
      console.log('[Dental] Error body:', errorBody);
      const message = errorBody.detail || `Failed to load summary (HTTP ${response.status})`;
      container.innerHTML = renderErrorState(message);
      return;
    }

    summaryData = await response.json();
    console.log('[Dental] Summary data loaded:', summaryData);
    setPatientLabel();
    renderTabs(container);
  } catch (err) {
    console.error('[Dental] Error loading summary:', err);
    container.innerHTML = renderErrorState(err.message || 'Unable to reach the server.');
  }
}

function renderErrorState(message) {
  return `
    <div style="padding:12px;border-radius:6px;border:1px solid #ffcdd2;background:#ffebee;color:#c62828;">
      <strong>Could not load data</strong>
      <div style="margin-top:6px;font-size:12px;">${message}</div>
      <div style="margin-top:10px;font-size:12px;color:#555;">
        Check your sign-in status, patient page, or API endpoint configuration.
      </div>
    </div>
  `;
}

function renderNoDataState(container) {
  container.innerHTML = `
    <div style="padding:16px;text-align:center;">
      <div style="font-size:40px;margin-bottom:12px;">🦷</div>
      <h3 style="margin:0 0 8px 0;color:#00695C;font-size:15px;">No Dental Records Found</h3>
      <p style="margin:0;color:#666;font-size:13px;">
        There are no dental appointments or records for this patient yet.
      </p>
      <p style="margin:12px 0 0 0;color:#888;font-size:12px;">
        Records will appear here once dental visits are scheduled or completed.
      </p>
    </div>
  `;
}

function createTable(rows) {
  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      ${rows
        .map(
          ([label, value]) => `
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:10px 6px;font-weight:600;color:#444;width:42%;">${label}</td>
              <td style="padding:10px 6px;color:#212121;">${value ?? '—'}</td>
            </tr>
          `
        )
        .join('')}
    </table>
  `;
}

function renderTabs(container) {
  if (!summaryData) return;

  const showInsurance = summaryData?.active_visit?.mode_of_payment === 'insurance';
  const tabs = [
    { id: 'visit', label: 'Visit' },
    { id: 'patient', label: 'Patient' },
    { id: 'allergies', label: 'Allergies' },
    { id: 'screening', label: 'Medical Screening' },
    // { id: 'consumed', label: 'Items Consumed' }, // Hidden for now, will display later
    { id: 'treatments', label: 'Treatments' }
  ];

  if (showInsurance) {
    tabs.push({ id: 'insurance', label: 'Insurance' });
  }

  container.innerHTML = `
    <div id="dentist-tabs" style="display:flex;border-bottom:1px solid #e0e0e0;background:#f5f5f5;">
      ${tabs
        .map(
          (tab, idx) => `
            <button data-tab="${tab.id}" class="dentist-tab ${idx === 0 ? 'active' : ''}" style="flex:1;padding:10px;border:none;background:${idx === 0 ? '#fff' : 'transparent'};cursor:pointer;font-size:13px;font-weight:500;border-bottom:2px solid ${
            idx === 0 ? '#00897B' : 'transparent'
          };outline:none;">${tab.label}</button>
          `
        )
        .join('')}
    </div>
    <div id="dentist-tab-content" style="padding:12px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 6px 6px;min-height:120px;">
      <!-- content injected -->
    </div>
  `;

  const tabButtons = Array.from(container.querySelectorAll('.dentist-tab'));
  const tabContent = container.querySelector('#dentist-tab-content');

  const renderSelected = (tabId) => {
    tabButtons.forEach((btn) => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle('active', isActive);
      btn.style.background = isActive ? '#fff' : 'transparent';
      btn.style.borderBottomColor = isActive ? '#00897B' : 'transparent';
    });

    switch (tabId) {
      case 'visit':
        tabContent.innerHTML = renderVisitTab(summaryData);
        break;
      case 'patient':
        tabContent.innerHTML = renderPatientTab(summaryData.active_visit?.patient_details || summaryData.patient);
        break;
      case 'allergies':
        tabContent.innerHTML = renderAllergiesTab(summaryData.allergies || []);
        break;
      case 'screening':
        tabContent.innerHTML = renderScreeningTab(summaryData.screening);
        break;
      case 'consumed':
        tabContent.innerHTML = renderConsumedTab(summaryData.consumed_items || []);
        break;
      case 'insurance':
        tabContent.innerHTML = renderInsuranceTab(summaryData.active_visit?.insurance_scheme_details);
        break;
      case 'treatments':
        tabContent.innerHTML = renderTreatmentsTab(summaryData);
        setupTreatmentForm(tabContent);
        break;
      default:
        tabContent.innerHTML = '<p style="color:#666;">No data</p>';
    }
  };

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => renderSelected(btn.dataset.tab));
  });

  renderSelected(tabs[0].id);
}

function renderVisitTab(data) {
  const visit = data.active_visit;
  const appointment = data.appointment;
  const patient = data.patient;

  const visitSection = visit
    ? `
      <div style="margin-bottom:12px;">
        <h4 style="margin:0 0 8px 0;font-size:13px;color:#00695C;">Active Visit</h4>
        ${createTable([
          ['Type', visit.visit_type_name || '—'],
          ['Status', formatStatus(visit.status)],
          ['Visit Date', formatDateTime(visit.visit_date)],
          ['Mode of Payment', visit.mode_of_payment ? visit.mode_of_payment.charAt(0).toUpperCase() + visit.mode_of_payment.slice(1).toLowerCase() : '—'],
          ['Clinic', visit.clinic_name && visit.clinic_code ? `${visit.clinic_name} (${visit.clinic_code})` : visit.clinic_name || '—'],
          ['Requires Pre-Authorization', visit.requires_pre_authorization ? 'Yes' : 'No']
        ])}
      </div>
    `
    : '<p style="color:#666;margin:0 0 10px 0;">No active visit found.</p>';

  const appointmentSection = appointment
    ? `
      <div>
        <h4 style="margin:0 0 8px 0;font-size:13px;color:#00695C;">Appointments</h4>
        ${createTable([
          ['Status', formatStatus(appointment.status)],
          ['Date', appointment.appointment_date || '—'],
          ['Time', appointment.appointment_time || '—'],
          ['Reason', appointment.reason || '—'],
          ['Notes', appointment.notes || '—']
        ])}
      </div>
    `
    : `
      <div style="margin-top:12px;">
        <h4 style="margin:0 0 8px 0;font-size:13px;color:#00695C;">Appointments</h4>
        <p style="color:#666;margin:0;">No appointment scheduled.</p>
      </div>
    `;

  return visitSection + appointmentSection;
}

function renderAllergiesTab(allergies) {
  if (!allergies.length) {
    return '<p style="color:#666;">No allergies recorded.</p>';
  }

  return allergies
    .map((allergy) => {
      return `
        <div style="border:1px solid #e0e0e0;border-radius:6px;padding:10px;margin-bottom:10px;background:#fafafa;">
          ${createTable([
            ['Allergy', allergy.allergy_name],
            ['Type', allergy.allergy_type_display || allergy.allergy_type],
            ['Severity', allergy.severity_display || allergy.severity],
            ['Reaction', allergy.reaction || '—'],
            ['Active', allergy.is_active ? 'Yes' : 'No'],
            ['Critical', allergy.is_critical ? 'Yes' : 'No'],
            ['Identified', allergy.date_identified || '—']
          ])}
        </div>
      `;
    })
    .join('');
}

function renderScreeningTab(screeningData) {
  if (!screeningData || !screeningData.screening) {
    return `
      <div style="text-align:center;padding:40px 20px;color:#666;">
        <p style="margin:0;font-size:14px;">No medical screening data available.</p>
        <p style="margin:8px 0 0 0;font-size:12px;color:#999;">Screening information will appear here once recorded.</p>
      </div>
    `;
  }

  // Define all screening conditions with display names
  const screeningConditions = [
    { key: 'rheumatic_fever', label: 'Rheumatic fever' },
    { key: 'epilepsy', label: 'Epilepsy' },
    { key: 'hepatitis', label: 'Hepatitis' },
    { key: 'diabetes', label: 'Diabetes' },
    { key: 'bleeding_disorder', label: 'Bleeding disorder (Haemophilia)' },
    { key: 'asthma', label: 'Asthma' },
    { key: 'tuberculosis', label: 'Tuberculosis' },
    { key: 'rheumatoid_arthritis', label: 'Rheumatoid arthritis' },
    { key: 'hypertension', label: 'Hypertension' },
    { key: 'hiv', label: 'HIV' },
    { key: 'anaemia_leukemia', label: 'Anaemia/Leukemia' },
    { key: 'psychiatry', label: 'Psychiatry' },
    { key: 'smoke', label: 'Smoke' },
    { key: 'pregnant_contraceptives', label: 'Pregnant/Contraceptives' },
    { key: 'medication', label: 'Medication' },
    { key: 'alcohol', label: 'Alcohol' },
    { key: 'surgery', label: 'Surgery' },
    { key: 'kidney_problems', label: 'Kidney problems' }
  ];

  // Items per page (6 items per page based on the image)
  const itemsPerPage = 6;
  const totalPages = Math.ceil(screeningConditions.length / itemsPerPage);

  // Create unique ID for this screening tab instance
  const screeningId = `screening-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Render first page
  const currentPage = 1;
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = Math.min(startIdx + itemsPerPage, screeningConditions.length);
  const pageConditions = screeningConditions.slice(startIdx, endIdx);

  const conditionsHtml = pageConditions.map(condition => {
    const value = screeningData.screening[condition.key] || false;
    const yesColor = value ? '#ffffff' : '#333';
    const noColor = !value ? '#ffffff' : '#333';
    const yesBg = value ? '#4CAF50' : '#ffffff';
    const noBg = !value ? '#666' : '#ffffff';
    const yesBorder = value ? '#4CAF50' : '#999';
    const noBorder = !value ? '#666' : '#999';

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0;">
        <div style="flex:1;font-size:13px;color:#333;">${condition.label}</div>
        <div style="display:flex;gap:8px;">
          <button 
            data-condition="${condition.key}" 
            data-value="true"
            class="screening-yes-btn"
            style="background:${yesBg};color:${yesColor};border:2px solid ${yesBorder};padding:7px 22px;border-radius:20px;font-size:13px;font-weight:600;cursor:default;transition:all 0.2s;min-width:60px;opacity:1;"
            disabled
          >Yes</button>
          <button 
            data-condition="${condition.key}" 
            data-value="false"
            class="screening-no-btn"
            style="background:${noBg};color:${noColor};border:2px solid ${noBorder};padding:7px 22px;border-radius:20px;font-size:13px;font-weight:600;cursor:default;transition:all 0.2s;min-width:60px;opacity:1;"
            disabled
          >No</button>
        </div>
      </div>
    `;
  }).join('');

  let html = `
    <div id="${screeningId}" style="padding:0;">
      <h3 style="margin:0 0 16px 0;font-size:14px;color:#00695C;font-weight:600;">Past Medical Conditions</h3>
      <div id="${screeningId}-content">
        ${conditionsHtml}
      </div>
      <div id="${screeningId}-pagination" style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;padding-top:16px;border-top:1px solid #e0e0e0;">
        <div style="font-size:12px;color:#666;">Page <span id="${screeningId}-current-page">1</span> of ${totalPages}</div>
        <div style="display:flex;gap:8px;">
          <button id="${screeningId}-prev" style="background:#f5f5f5;color:#666;border:1px solid #ddd;padding:6px 16px;border-radius:4px;font-size:12px;cursor:not-allowed;opacity:0.5;" disabled>Previous</button>
          <button id="${screeningId}-next" style="background:#00695C;color:white;border:none;padding:6px 16px;border-radius:4px;font-size:12px;cursor:${totalPages <= 1 ? 'not-allowed' : 'pointer'};${totalPages <= 1 ? 'opacity:0.5;' : ''}" ${totalPages <= 1 ? 'disabled' : ''}>Next</button>
        </div>
      </div>
    </div>
  `;

  // Set up pagination after DOM is ready
  setTimeout(() => {
    let pageState = { current: 1 };
    const contentDiv = document.getElementById(`${screeningId}-content`);
    const currentPageSpan = document.getElementById(`${screeningId}-current-page`);
    const prevBtn = document.getElementById(`${screeningId}-prev`);
    const nextBtn = document.getElementById(`${screeningId}-next`);

    if (!contentDiv || !prevBtn || !nextBtn) return;

    const renderPage = (pageNum) => {
      const startIdx = (pageNum - 1) * itemsPerPage;
      const endIdx = Math.min(startIdx + itemsPerPage, screeningConditions.length);
      const pageConditions = screeningConditions.slice(startIdx, endIdx);

      return pageConditions.map(condition => {
        const value = screeningData.screening[condition.key] || false;
        const yesColor = value ? '#ffffff' : '#333';
        const noColor = !value ? '#ffffff' : '#333';
        const yesBg = value ? '#4CAF50' : '#ffffff';
        const noBg = !value ? '#666' : '#ffffff';
        const yesBorder = value ? '#4CAF50' : '#999';
        const noBorder = !value ? '#666' : '#999';

        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0;">
            <div style="flex:1;font-size:13px;color:#333;">${condition.label}</div>
            <div style="display:flex;gap:8px;">
              <button 
                data-condition="${condition.key}" 
                data-value="true"
                class="screening-yes-btn"
                style="background:${yesBg};color:${yesColor};border:2px solid ${yesBorder};padding:7px 22px;border-radius:20px;font-size:13px;font-weight:600;cursor:default;transition:all 0.2s;min-width:60px;opacity:1;"
                disabled
              >Yes</button>
              <button 
                data-condition="${condition.key}" 
                data-value="false"
                class="screening-no-btn"
                style="background:${noBg};color:${noColor};border:2px solid ${noBorder};padding:7px 22px;border-radius:20px;font-size:13px;font-weight:600;cursor:default;transition:all 0.2s;min-width:60px;opacity:1;"
                disabled
              >No</button>
            </div>
          </div>
        `;
      }).join('');
    };

    const updatePage = () => {
      contentDiv.innerHTML = renderPage(pageState.current);
      currentPageSpan.textContent = pageState.current;
      
      prevBtn.disabled = pageState.current === 1;
      prevBtn.style.opacity = pageState.current === 1 ? '0.5' : '1';
      prevBtn.style.cursor = pageState.current === 1 ? 'not-allowed' : 'pointer';
      prevBtn.style.background = pageState.current === 1 ? '#f5f5f5' : '#fff';
      
      nextBtn.disabled = pageState.current === totalPages;
      nextBtn.style.opacity = pageState.current === totalPages ? '0.5' : '1';
      nextBtn.style.cursor = pageState.current === totalPages ? 'not-allowed' : 'pointer';
    };

    prevBtn.addEventListener('click', () => {
      if (pageState.current > 1) {
        pageState.current--;
        updatePage();
      }
    });

    nextBtn.addEventListener('click', () => {
      if (pageState.current < totalPages) {
        pageState.current++;
        updatePage();
      }
    });
  }, 50);

  return html;
}

function renderConsumedTab(items) {
  if (!items.length) {
    return '<p style="color:#666;">No consumed items found for this visit.</p>';
  }

  return items
    .map((item) => {
      return `
        <div style="border:1px solid #e0e0e0;border-radius:6px;padding:10px;margin-bottom:10px;background:#fafafa;">
          ${createTable([
            ['Product', item.product_name],
            ['Quantity', item.quantity],
            ['Appointment', `${item.appointment_date || '—'} ${item.appointment_time || ''}`.trim()],
            ['Created By', item.created_by_name || '—'],
            ['Updated By', item.updated_by_name || '—'],
            ['Updated At', item.updated_at || '—']
          ])}
        </div>
      `;
    })
    .join('');
}

function renderInsuranceTab(insurance) {
  if (!insurance) {
    return '<p style="color:#666;">No insurance information available.</p>';
  }

  return `
    <div>
      <h4 style="margin:0 0 8px 0;font-size:13px;color:#00695C;">Insurance</h4>
      ${createTable([
        ['Scheme', insurance.scheme_name || '—'],
        ['Company', insurance.insurance_company_name || '—'],
        ['Membership Number', insurance.membership_number || '—'],
        ['Suffix', insurance.suffix || '—']
      ])}
    </div>
  `;
}

function renderTreatmentsTab(data) {
  const visit = data?.active_visit;
  if (!visit || !visit.id) {
    return '<p style="color:#666;">No active visit found. Please start a visit first.</p>';
  }

  return `
    <div>
      <h4 style="margin:0 0 12px 0;font-size:13px;color:#00695C;">Add Treatment</h4>
      <form id="dentist-treatment-form" style="display:flex;flex-direction:column;gap:10px;max-width:100%;">
        <!-- Minimal required fields -->
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
          <div>
            <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Tooth Number *</label>
            <input type="text" id="tooth_number" required placeholder="e.g., 14, 36, 48" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;height:36px;background:#fff;" />
            <div id="tooth_number_error" style="color:#c62828;font-size:11px;margin-top:3px;display:none;"></div>
            <div id="tooth_number_hint" style="color:#666;font-size:11px;margin-top:3px;">FDI: 2 digits (11-48)</div>
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Treatment Date *</label>
            <input type="date" id="treatment_date" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;height:36px;background:#fff;" />
          </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Procedure Name *</label>
              <div id="procedure_input_wrapper" style="position:relative;">
                <input type="text" id="procedure_name" autocomplete="off" required placeholder="Search or type a procedure" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;height:36px;background:#fff;outline:none;" />
                <div id="procedure_input_spinner" style="display:none;position:absolute;right:10px;top:50%;transform:translateY(-50%);width:16px;height:16px;border:2px solid #e0e0e0;border-top-color:#00695C;border-radius:50%;animation:spin 0.9s linear infinite;"></div>
                <div id="procedure_dropdown" style="display:none;position:absolute;z-index:10000;top:40px;left:0;width:100%;background:#fff;border:1px solid #e5e7eb;box-shadow:0 8px 22px rgba(0,0,0,0.12);border-radius:6px;max-height:260px;overflow-y:auto;">
                </div>
              </div>
              <div id="procedure_name_status" style="margin-top:4px;font-size:11px;color:#666;">Loading dental procedures...</div>
            </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Treatment Status *</label>
            <select id="treatment_status" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;height:36px;background:#fff;">
              <option value="">Select status</option>
              <option value="planned">Planned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <div>
          <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Procedure Category *</label>
          <select id="procedure_category" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;height:36px;background:#fff;">
            <option value="">Select category</option>
            <option value="preventive">Preventive</option>
            <option value="restorative">Restorative</option>
            <option value="endodontic">Endodontic</option>
            <option value="periodontic">Periodontic</option>
            <option value="prosthodontic">Prosthodontic</option>
            <option value="orthodontic">Orthodontic</option>
            <option value="oral_surgery">Oral Surgery</option>
            <option value="cosmetic">Cosmetic</option>
            <option value="diagnostic">Diagnostic</option>
            <option value="emergency">Emergency</option>
            <option value="other">Other</option>
          </select>
        </div>

        <!-- Advanced section toggle -->
        <button type="button" id="toggle_advanced_treatment" style="background:#f5f5f5;color:#333;border:1px solid #ddd;padding:6px 10px;border-radius:4px;font-size:12px;font-weight:500;cursor:pointer;align-self:flex-start;margin-top:4px;">
          Show additional details
        </button>

        <div id="advanced_treatment_section" style="display:none;margin-top:6px;padding:10px;border:1px solid #eee;border-radius:6px;background:#fafafa;max-height:220px;overflow:auto;">
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
            <div>
              <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Numbering System</label>
              <select id="numbering_system" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;height:36px;background:#fff;">
                <option value="fdi" selected>FDI (Default)</option>
                <option value="universal">Universal</option>
                <option value="palmer">Palmer</option>
              </select>
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Tooth Name</label>
              <input type="text" id="tooth_name" readonly placeholder="Auto-filled from tooth number" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;background:#f9f9f9;" />
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Tooth Type</label>
              <select id="tooth_type" disabled style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;height:36px;background:#f9f9f9;">
                <option value="">Auto-filled from tooth number</option>
                <option value="incisor">Incisor</option>
                <option value="canine">Canine</option>
                <option value="premolar">Premolar</option>
                <option value="molar">Molar</option>
              </select>
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Tooth Position</label>
              <select id="tooth_position" disabled style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;height:36px;background:#f9f9f9;">
                <option value="">Auto-filled from tooth number</option>
                <option value="upper_right">Upper Right</option>
                <option value="upper_left">Upper Left</option>
                <option value="lower_right">Lower Right</option>
                <option value="lower_left">Lower Left</option>
              </select>
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Quadrant</label>
              <input type="text" id="quadrant" readonly placeholder="Auto-filled from tooth number" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;background:#f9f9f9;" />
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Surface</label>
              <input type="text" id="surface" placeholder="e.g., MOD, O" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;" />
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Procedure Code</label>
              <input type="text" id="procedure_code" placeholder="e.g., D3310" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;" />
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Estimated Cost</label>
              <input type="number" id="estimated_cost" step="0.01" placeholder="0.00" style="width:100%;padding:8px;border:1px solid:#ddd;border-radius:4px;font-size:13px;box-sizing:border-box;" />
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Actual Cost</label>
              <input type="number" id="actual_cost" step="0.01" placeholder="0.00" style="width:100%;padding:8px;border:1px solid:#ddd;border-radius:4px;font-size:13px;box-sizing:border-box;" />
            </div>
          </div>

          <div style="margin-top:8px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
            <div style="grid-column:1 / -1;">
              <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Notes</label>
              <textarea id="notes" rows="2" placeholder="Additional notes..." style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;resize:vertical;"></textarea>
            </div>
            <div style="grid-column:1 / -1;">
              <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Materials Used</label>
              <textarea id="materials_used" rows="2" placeholder="e.g., Gutta-percha, sealer" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;resize:vertical;"></textarea>
            </div>
            <div style="grid-column:1 / -1;">
              <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Diagnosis</label>
              <input type="text" id="diagnosis" placeholder="e.g., Irreversible pulpitis" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;" />
            </div>
          </div>

          <div style="margin-top:8px;">
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:500;color:#333;">
              <input type="checkbox" id="requires_follow_up" style="width:16px;height:16px;" />
              Requires Follow Up
            </label>
          </div>

          <div id="follow_up_section" style="display:none;margin-top:6px;">
            <div>
              <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Follow Up Date</label>
              <input type="date" id="follow_up_date" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;" />
            </div>
            <div style="margin-top:6px;">
              <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Follow Up Notes</label>
              <textarea id="follow_up_notes" rows="2" placeholder="Follow up notes..." style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;resize:vertical;"></textarea>
            </div>
          </div>
        </div>

        <div id="dentist-treatment-error" style="display:none;color:#c62828;font-size:12px;padding:8px;background:#ffebee;border-radius:4px;"></div>
        <div id="dentist-treatment-success" style="display:none;color:#2e7d32;font-size:12px;padding:8px;background:#e8f5e9;border-radius:4px;"></div>

        <button type="submit" style="background:#00695C;color:white;border:none;padding:10px 16px;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;margin-top:6px;align-self:flex-start;">Create Treatment</button>
      </form>
    </div>
  `;
}

function setupTreatmentForm(container) {
  const form = container.querySelector('#dentist-treatment-form');
  const toggleAdvanced = container.querySelector('#toggle_advanced_treatment');
  const advancedSection = container.querySelector('#advanced_treatment_section');
  const requiresFollowUp = container.querySelector('#requires_follow_up');
  const followUpSection = container.querySelector('#follow_up_section');
  const errorDiv = container.querySelector('#dentist-treatment-error');
  const successDiv = container.querySelector('#dentist-treatment-success');
  const procedureInput = container.querySelector('#procedure_name');
  const procedureWrapper = container.querySelector('#procedure_input_wrapper');
  const procedureDropdown = container.querySelector('#procedure_dropdown');
  const procedureSpinner = container.querySelector('#procedure_input_spinner');
  const procedureStatus = container.querySelector('#procedure_name_status');
  
  // Tooth number fields
  const toothNumberInput = container.querySelector('#tooth_number');
  const toothNumberError = container.querySelector('#tooth_number_error');
  const toothNumberHint = container.querySelector('#tooth_number_hint');
  const numberingSystemSelect = container.querySelector('#numbering_system');
  const toothNameInput = container.querySelector('#tooth_name');
  const toothTypeSelect = container.querySelector('#tooth_type');
  const toothPositionSelect = container.querySelector('#tooth_position');
  const quadrantInput = container.querySelector('#quadrant');
  
  let selectedProcedureId = null;

  // Kick off background fetch for dental procedures without blocking other calls
  ensureServiceProductsFetching().then(() => refreshProcedureOptions(container));
  refreshProcedureOptions(container);

  // =========================
  // Tooth Number Auto-Population Logic
  // =========================
  
  function updateToothFields() {
    const toothNumber = toothNumberInput.value.trim();
    const numberingSystem = numberingSystemSelect.value;
    
    // Clear previous error
    toothNumberError.style.display = 'none';
    toothNumberError.textContent = '';
    
    if (!toothNumber) {
      // Clear all fields
      toothNameInput.value = '';
      toothTypeSelect.value = '';
      toothPositionSelect.value = '';
      quadrantInput.value = '';
      return;
    }
    
    // Validate tooth number
    const result = validateAndGetToothInfo(toothNumber, numberingSystem);
    
    if (!result.valid) {
      // Show error
      toothNumberError.textContent = result.error;
      toothNumberError.style.display = 'block';
      toothNumberInput.style.borderColor = '#c62828';
      
      // Clear auto-filled fields
      toothNameInput.value = '';
      toothTypeSelect.value = '';
      toothPositionSelect.value = '';
      quadrantInput.value = '';
      return;
    }
    
    // Valid tooth number - populate fields
    toothNumberInput.style.borderColor = '#4CAF50';
    const toothInfo = result.toothInfo;
    
    // Populate fields
    toothNameInput.value = toothInfo.name || '';
    toothTypeSelect.value = toothInfo.type || '';
    toothPositionSelect.value = toothInfo.position || '';
    quadrantInput.value = toothInfo.quadrant || '';
    
    console.log('[Dental] Auto-populated tooth fields:', {
      toothNumber: result.toothNumber,
      numberingSystem: result.numberingSystem,
      toothInfo: toothInfo
    });
  }
  
  // Continuation from line where it was cut off

  function updateToothNumberHint() {
    const numberingSystem = numberingSystemSelect.value;
    
    switch (numberingSystem) {
      case 'fdi':
        toothNumberHint.textContent = 'FDI: 2 digits (11-48, 51-85 for primary)';
        toothNumberInput.placeholder = 'e.g., 11, 36, 48';
        break;
      case 'universal':
        toothNumberHint.textContent = 'Universal: 1-32 or A-T for primary';
        toothNumberInput.placeholder = 'e.g., 1, 14, 32, A, T';
        break;
      case 'palmer':
        toothNumberHint.textContent = 'Palmer: UR1-8, UL1-8, LL1-8, LR1-8';
        toothNumberInput.placeholder = 'e.g., UR1, LL6, UL8';
        break;
    }
  }
  
  // Initial hint setup
  updateToothNumberHint();
  
  // Event listeners for auto-population
  toothNumberInput.addEventListener('input', updateToothFields);
  numberingSystemSelect.addEventListener('change', () => {
    updateToothNumberHint();
    updateToothFields();
  });

  // --- Procedure autocomplete dropdown ---
  let isProcedureDropdownOpen = false;
  let highlightedProcedureIndex = 0;

  const ensureSpinnerKeyframes = () => {
    if (document.getElementById('dentist-spinner-style')) return;
    const style = document.createElement('style');
    style.id = 'dentist-spinner-style';
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  };
  ensureSpinnerKeyframes();

  const getProcedureDisplayName = (item) => item?.name || item?.display_name || item?.product_name || 'Unnamed procedure';
  const getProcedureId = (item) => item?.id ?? item?.product_id ?? item?.local_product_id ?? null;

  const getFilteredProcedures = () => {
    const query = procedureInput?.value?.trim().toLowerCase() || '';
    if (!serviceProducts || !serviceProducts.length) return [];

    const matches = serviceProducts.filter((item) => {
      const name = (item.name || item.display_name || item.product_name || '').toLowerCase();
      const code = (item.default_code || item.product_code || '').toLowerCase();
      return !query || name.includes(query) || code.includes(query);
    });

    return matches.slice(0, 50);
  };

  const findProcedureByNameOrCode = (value) => {
    if (!value || !serviceProducts?.length) return null;
    const target = value.trim().toLowerCase();
    return (
      serviceProducts.find((item) => {
        const name = (item.name || item.display_name || item.product_name || '').toLowerCase();
        const code = (item.default_code || item.product_code || '').toLowerCase();
        return (name && name === target) || (code && code === target);
      }) || null
    );
  };

  const closeProcedureDropdown = () => {
    isProcedureDropdownOpen = false;
    if (procedureDropdown) {
      procedureDropdown.style.display = 'none';
    }
  };

  const renderProcedureDropdown = () => {
    if (!procedureDropdown || !procedureInput || !procedureWrapper) return;

    if (procedureSpinner) {
      procedureSpinner.style.display = serviceProductsLoading ? 'block' : 'none';
    }

    const filtered = getFilteredProcedures();

    if (!isProcedureDropdownOpen) {
      procedureDropdown.style.display = 'none';
      return;
    }

    let inner = '';

    if (serviceProductsLoading) {
      inner = `
        <div style="display:flex;align-items:center;justify-content:center;padding:12px;font-size:12px;color:#555;gap:8px;">
          <div style="width:14px;height:14px;border:2px solid #e0e0e0;border-top-color:#00695C;border-radius:50%;animation:spin 0.9s linear infinite;"></div>
          <span>Loading procedures...</span>
        </div>
      `;
    } else if (filtered.length === 0) {
      inner = `
        <div style="padding:12px;font-size:12px;color:#666;">
          No procedures found. Continue typing to add a custom name.
        </div>
      `;
    } else {
      inner = filtered
        .map((item, idx) => {
          const name = getProcedureDisplayName(item);
          const price = item.list_price ?? item.lst_price ?? item.price;
          const code = item.default_code || item.product_code;
          const categoryLabel = item.category_name || item.categ_id?.[1] || '';
          const pricePart = price !== undefined ? ` • ${price}` : '';
          const codePart = code ? ` (${code})` : '';
          const isActive = idx === highlightedProcedureIndex;
          return `
          <div
            class="procedure-dropdown-item"
            data-idx="${idx}"
            style="
              width:100%;
              display:block;
              text-align:left;
              background:${isActive ? '#eef4ff' : 'transparent'};
              padding:10px 12px;
              cursor:pointer;
              font-size:13px;
              transition:background 0.15s ease;
              color:#1f2937;
            "
          >
            <div style="font-weight:600;color:#1f2937;pointer-events:none;">${escapeHtml(name)}${escapeHtml(codePart)}</div>
            <div style="font-size:12px;color:#6b7280;pointer-events:none;">${escapeHtml(categoryLabel)}${pricePart ? escapeHtml(pricePart) : ''}</div>
          </div>
        `;
        })
        .join('');
    }

    procedureDropdown.innerHTML = inner;
    procedureDropdown.style.display = 'block';

    const items = procedureDropdown.querySelectorAll('.procedure-dropdown-item');
    items.forEach((item) => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const idx = Number(item.dataset.idx);
        if (filtered[idx]) {
          handleProcedureSelect(filtered[idx]);
        }
      });
      
      item.addEventListener('mouseenter', () => {
        highlightedProcedureIndex = Number(item.dataset.idx);
        renderProcedureDropdown();
      });
    });
  };

  const handleProcedureSelect = (item) => {
    if (!procedureInput) return;
    procedureInput.value = getProcedureDisplayName(item);
    selectedProcedureId = getProcedureId(item);
    closeProcedureDropdown();
  };

  const openProcedureDropdown = () => {
    isProcedureDropdownOpen = true;
    highlightedProcedureIndex = 0;
    renderProcedureDropdown();
  };

  if (procedureInput) {
    procedureInput.addEventListener('input', () => {
      selectedProcedureId = null;
      isProcedureDropdownOpen = true;
      highlightedProcedureIndex = 0;
      renderProcedureDropdown();
      if (procedureStatus && serviceProducts?.length) {
        const filtered = getFilteredProcedures();
        procedureStatus.textContent = filtered.length ? `Showing ${filtered.length} matching procedures` : 'No match yet. Keep typing to add a custom value.';
      }
    });

    procedureInput.addEventListener('focus', () => {
      openProcedureDropdown();
    });

    procedureInput.addEventListener('keydown', (e) => {
      const filtered = getFilteredProcedures();
      if (!isProcedureDropdownOpen && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
        openProcedureDropdown();
        return;
      }

      if (!isProcedureDropdownOpen || (!filtered.length && !serviceProductsLoading)) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (filtered.length) {
            highlightedProcedureIndex = Math.min(filtered.length - 1, highlightedProcedureIndex + 1);
            renderProcedureDropdown();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (filtered.length) {
            highlightedProcedureIndex = Math.max(0, highlightedProcedureIndex - 1);
            renderProcedureDropdown();
          }
          break;
        case 'Enter':
          if (filtered[highlightedProcedureIndex]) {
            e.preventDefault();
            handleProcedureSelect(filtered[highlightedProcedureIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          closeProcedureDropdown();
          break;
        default:
          break;
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (!procedureWrapper) return;
    if (!procedureWrapper.contains(e.target)) {
      closeProcedureDropdown();
    }
  });

  renderProcedureDropdown();

  // Toggle advanced section visibility
  if (toggleAdvanced && advancedSection) {
    toggleAdvanced.addEventListener('click', () => {
      const isHidden = advancedSection.style.display === 'none' || !advancedSection.style.display;
      advancedSection.style.display = isHidden ? 'block' : 'none';
      toggleAdvanced.textContent = isHidden ? 'Hide additional details' : 'Show additional details';
    });
  }

  // Toggle follow-up section visibility
  if (requiresFollowUp && followUpSection) {
    requiresFollowUp.addEventListener('change', (e) => {
      followUpSection.style.display = e.target.checked ? 'block' : 'none';
    });
  }

  // Set today's date as default for treatment_date
  const treatmentDateInput = container.querySelector('#treatment_date');
  if (treatmentDateInput) {
    const today = new Date().toISOString().split('T')[0];
    treatmentDateInput.value = today;
  }

  // Form submission handler
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorDiv.style.display = 'none';
      successDiv.style.display = 'none';

      const visitId = summaryData?.active_visit?.id;
      if (!visitId) {
        errorDiv.textContent = 'No active visit found.';
        errorDiv.style.display = 'block';
        return;
      }

      const procedureNameValue = container.querySelector('#procedure_name').value.trim();
      const resolvedProcedure =
        selectedProcedureId !== null
          ? selectedProcedureId
          : getProcedureId(findProcedureByNameOrCode(procedureNameValue));

      // Validate tooth number before submission
      const toothNumber = container.querySelector('#tooth_number').value.trim();
      const numberingSystem = container.querySelector('#numbering_system').value;
      const toothValidation = validateAndGetToothInfo(toothNumber, numberingSystem);
      
      if (!toothValidation.valid) {
        errorDiv.textContent = `Invalid tooth number: ${toothValidation.error}`;
        errorDiv.style.display = 'block';
        errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }

      // Build payload
      const payload = {
        visit: visitId,
        tooth_number: toothNumber,
        numbering_system: numberingSystem,
        procedure_name: procedureNameValue,
        procedure_category: container.querySelector('#procedure_category').value,
        treatment_status: container.querySelector('#treatment_status').value,
        treatment_date: container.querySelector('#treatment_date').value
      };

      // Add auto-filled tooth information
      if (toothValidation.toothInfo) {
        const info = toothValidation.toothInfo;
        if (info.name) payload.tooth_name = info.name;
        if (info.type) payload.tooth_type = info.type;
        if (info.position) payload.tooth_position = info.position;
        if (info.quadrant) payload.quadrant = info.quadrant;
        if (info.isPrimary !== undefined) payload.is_primary = info.isPrimary;
      }

      const activeVisit = summaryData?.active_visit;
      if (activeVisit?.mode_of_payment === 'insurance') {
        const pricelistId = activeVisit?.insurance_scheme?.pricelist_id;
        if (pricelistId) {
          payload.pricelist_id = pricelistId;
        }
      }

      if (resolvedProcedure !== null && resolvedProcedure !== undefined) {
        payload.procedure_product_id = resolvedProcedure;
      }

      console.log('[Dental] Treatment payload:', payload);

      // Optional fields from advanced section
      const surface = container.querySelector('#surface').value.trim();
      if (surface) payload.surface = surface;

      const notes = container.querySelector('#notes').value.trim();
      if (notes) payload.notes = notes;

      const materialsUsed = container.querySelector('#materials_used').value.trim();
      if (materialsUsed) payload.materials_used = materialsUsed;

      const diagnosis = container.querySelector('#diagnosis').value.trim();
      if (diagnosis) payload.diagnosis = diagnosis;

      const procedureCode = container.querySelector('#procedure_code').value.trim();
      if (procedureCode) payload.procedure_code = procedureCode;

      const estimatedCost = container.querySelector('#estimated_cost').value;
      if (estimatedCost) payload.estimated_cost = parseFloat(estimatedCost);

      const actualCost = container.querySelector('#actual_cost').value;
      if (actualCost) payload.actual_cost = parseFloat(actualCost);

      if (requiresFollowUp.checked) {
        payload.requires_follow_up = true;
        const followUpDate = container.querySelector('#follow_up_date').value;
        if (followUpDate) payload.follow_up_date = followUpDate;
        const followUpNotes = container.querySelector('#follow_up_notes').value.trim();
        if (followUpNotes) payload.follow_up_notes = followUpNotes;
      }

      // Submit form
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';

      try {
        const baseUrl = await getApiEndpoint();
        const url = `${baseUrl}/api/dental-treatments/`;
        const response = await authenticatedFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || errorData.message || `Failed to create treatment (HTTP ${response.status})`);
        }

        const data = await response.json();
        successDiv.textContent = 'Treatment created successfully!';
        successDiv.style.display = 'block';

        // Reset form
        form.reset();
        if (treatmentDateInput) {
          const today = new Date().toISOString().split('T')[0];
          treatmentDateInput.value = today;
        }
        followUpSection.style.display = 'none';
        
        // Clear auto-filled fields
        toothNameInput.value = '';
        toothTypeSelect.value = '';
        toothPositionSelect.value = '';
        quadrantInput.value = '';
        toothNumberInput.style.borderColor = '#ddd';
        toothNumberError.style.display = 'none';
        updateToothNumberHint();

        successDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      } catch (err) {
        errorDiv.textContent = err.message || 'Failed to create treatment. Please try again.';
        errorDiv.style.display = 'block';
        errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Treatment';
      }
    });
  }
}

function formatPhoneNumber(phone) {
  if (!phone) return '—';
  
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  if (cleaned.startsWith('+')) {
    const countryCode = cleaned.substring(0, cleaned.length - 10);
    const remaining = cleaned.substring(cleaned.length - 10);
    const areaCode = remaining.substring(0, 3);
    const firstPart = remaining.substring(3, 6);
    const secondPart = remaining.substring(6, 10);
    return `${countryCode} (${areaCode}) ${firstPart}-${secondPart}`;
  }
  
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
  }
  
  return phone;
}

function renderPatientTab(patient) {
  if (!patient) {
    return '<p style="color:#666;">No patient data available.</p>';
  }

  const dob = patient.dob ? new Date(patient.dob) : null;
  const formattedPhone = formatPhoneNumber(patient.phone_number);
  
  return `
    <div style="margin-bottom:12px;">
      <h4 style="margin:0 0 8px 0;font-size:13px;color:#00695C;">Patient Details</h4>
      ${createTable([
        ['Full Name', patient.full_name || '—'],
        ['Identifier', patient.customer_identifier || '—'],
        ['Phone Number', formattedPhone],
        ['Gender', patient.gender || '—'],
        ['Date of Birth', dob ? dob.toLocaleDateString() : '—'],
        ['Age', patient.age ? `${patient.age} years` : '—'],
        ['DOB Estimated', patient.dob_is_estimated !== undefined ? (patient.dob_is_estimated ? 'Yes' : 'No') : '—'],
        ['Synced to OpenMRS', patient.has_synced_to_openmrs !== undefined ? (patient.has_synced_to_openmrs ? 'Yes' : 'No') : '—'],
        ['Status', patient.is_active !== undefined ? (patient.is_active ? 'Active' : 'Inactive') : '—']
      ])}
    </div>
  `;
}

function formatStatus(status) {
  if (!status) return '—';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function renderSettings() {
  const content = overlay?.querySelector('#dentist-content');
  if (!content) return;

  chrome.storage.local.get(['apiEndpoint'], (result) => {
    const currentEndpoint = result.apiEndpoint || 'http://192.168.1.169:5000';

    content.innerHTML = `
      <div style="padding: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 14px; color: #00695C;">API Configuration</h3>
          <button id="dentist-settings-back-btn" style="background: #f5f5f5; color: #333; border: 1px solid #ddd; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">Back</button>
        </div>
        
        <form id="dentist-settings-form">
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333; font-size: 13px;">
              API Endpoint Base URL
            </label>
            <input 
              type="text" 
              id="dentist-api-endpoint" 
              value="${currentEndpoint}"
              placeholder="http://localhost:8000 or https://192.168.1.169:8000"
              style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;"
            />
            <div id="dentist-endpoint-error" style="color: #c62828; font-size: 12px; margin-top: 5px; display: none;"></div>
            <div style="font-size: 12px; color: #666; margin-top: 5px;">
              Enter the base URL of your API server. Include the protocol (http:// or https://) and port if needed.
            </div>
          </div>
          
          <div style="display: flex; gap: 8px;">
            <button 
              type="button"
              id="dentist-test-connection-btn"
              style="background: #fff; color: #00695C; border: 1px solid #00695C; padding: 10px 20px; border-radius: 4px; font-size: 13px; font-weight: 500; cursor: pointer; flex: 1;"
            >
              Test Connection
            </button>
            <button 
              type="submit" 
              style="background: #00695C; color: white; border: none; padding: 10px 20px; border-radius: 4px; font-size: 13px; font-weight: 500; cursor: pointer; flex: 1;"
            >
              Save Settings
            </button>
          </div>
        </form>
        
        <div id="dentist-connection-status" style="padding: 12px; border-radius: 4px; margin-top: 16px; display: none; font-size: 13px;"></div>
        
        <div id="dentist-settings-success" style="background: #e8f5e9; color: #2e7d32; padding: 12px; border-radius: 4px; margin-top: 16px; display: none; font-size: 13px;">
          Settings saved successfully!
        </div>
      </div>
    `;

    const form = content.querySelector('#dentist-settings-form');
    const endpointInput = content.querySelector('#dentist-api-endpoint');
    const errorDiv = content.querySelector('#dentist-endpoint-error');
    const successDiv = content.querySelector('#dentist-settings-success');
    const testBtn = content.querySelector('#dentist-test-connection-btn');
    const connectionStatus = content.querySelector('#dentist-connection-status');
    const backBtn = content.querySelector('#dentist-settings-back-btn');

    backBtn.addEventListener('click', () => {
      if (summaryData) {
        renderTabs(content);
      } else {
        renderOverlayForPatient();
      }
    });

    testBtn.addEventListener('click', async () => {
      const endpoint = endpointInput.value.trim();
      errorDiv.style.display = 'none';
      connectionStatus.style.display = 'none';

      if (!endpoint) {
        errorDiv.textContent = 'Please enter an API endpoint first';
        errorDiv.style.display = 'block';
        return;
      }

      try {
        const url = new URL(endpoint);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Invalid protocol');
        }
      } catch (err) {
        errorDiv.textContent = 'Please enter a valid URL first';
        errorDiv.style.display = 'block';
        return;
      }

      testBtn.disabled = true;
      testBtn.textContent = 'Testing...';
      connectionStatus.style.display = 'block';
      connectionStatus.style.background = '#fff3e0';
      connectionStatus.style.color = '#e65100';
      connectionStatus.innerHTML = '⏳ Testing connection...';

      try {
        const baseUrl = endpoint.replace(/\/$/, '');
        const testUrl = `${baseUrl}/api/dental-appointments/summary/by-patient-uuid/test/`;

        const response = await backgroundFetch(testUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        connectionStatus.style.background = '#e8f5e9';
        connectionStatus.style.color = '#2e7d32';
        connectionStatus.innerHTML = '✅ Connection successful! The endpoint is reachable.';
      } catch (err) {
        connectionStatus.style.background = '#ffebee';
        connectionStatus.style.color = '#c62828';
        connectionStatus.innerHTML = '❌ Connection failed: ' + err.message;
      } finally {
        testBtn.disabled = false;
        testBtn.textContent = 'Test Connection';
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const endpoint = endpointInput.value.trim();

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
      } catch (err) {
        errorDiv.textContent = 'Please enter a valid URL';
        errorDiv.style.display = 'block';
        return;
      }

      chrome.storage.local.set({ apiEndpoint: endpoint }, () => {
        if (chrome.runtime.lastError) {
          errorDiv.textContent = 'Error saving settings: ' + chrome.runtime.lastError.message;
          errorDiv.style.display = 'block';
        } else {
          successDiv.style.display = 'block';
          setTimeout(() => {
            successDiv.style.display = 'none';
          }, 3000);

          if (currentPatient) {
            setTimeout(() => {
              renderOverlayForPatient();
            }, 500);
          }
        }
      });
    });
  });
}

// =========================
// Bootstrap
// =========================

loadAuthTokens();
extractPatient();
setInterval(extractPatient, 2000);