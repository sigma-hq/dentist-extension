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
    const url = `${baseUrl}/api/odoo/products/services/?get_all=true`;
    console.log('[Dental] Fetching service products (procedures):', url);

    const response = await authenticatedFetch(url, { method: 'GET' });
    console.log('[Dental] Service products response:', {
      status: response.status,
      ok: response.ok
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.detail || errorBody.message || `Failed to load service products (HTTP ${response.status})`);
    }

    const data = await response.json();
    console.log('[Dental] Service products data:', data);

    // Support both paginated and plain list responses, including `data` wrappers
    const items =
      (Array.isArray(data) && data) ||
      (Array.isArray(data?.results) && data.results) ||
      (Array.isArray(data?.data) && data.data) ||
      (Array.isArray(data?.data?.results) && data.data.results) ||
      [];
    serviceProducts = items;
    refreshProcedureOptions();
  } catch (err) {
    console.error('[Dental] Error fetching service products:', err);
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
    setStatus('Loading service procedures...');
    return;
  }

  if (!serviceProducts || !serviceProducts.length) {
    if (listEl) listEl.innerHTML = '';
    setStatus('No services loaded yet.');
    return;
  }

  if (listEl) {
    const optionsHtml = serviceProducts
      .map((item) => {
        const name = item.name || item.display_name || item.product_name || 'Unnamed service';
        const price = item.list_price ?? item.lst_price ?? item.price;
        const label = price !== undefined ? `${name} - ${price}` : name;
        return `<option value="${escapeHtml(name)}" label="${escapeHtml(label)}"></option>`;
      })
      .join('');

    listEl.innerHTML = optionsHtml;
  }

  setStatus(`Loaded ${serviceProducts.length} services`);
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
            <input type="text" id="tooth_number" required placeholder="e.g., 14, 36" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;height:36px;background:#fff;" />
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
              <div id="procedure_name_status" style="margin-top:4px;font-size:11px;color:#666;">Loading service procedures...</div>
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
                <option value="universal">Universal</option>
                <option value="fdi">FDI</option>
                <option value="palmer">Palmer</option>
              </select>
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Tooth Name</label>
              <input type="text" id="tooth_name" placeholder="e.g., Lower left first molar" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;" />
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Tooth Type</label>
              <select id="tooth_type" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;height:36px;background:#fff;">
                <option value="">Select type</option>
                <option value="incisor">Incisor</option>
                <option value="canine">Canine</option>
                <option value="premolar">Premolar</option>
                <option value="molar">Molar</option>
              </select>
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#333;">Tooth Position</label>
              <select id="tooth_position" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;height:36px;background:#fff;">
                <option value="">Select position</option>
                <option value="upper_right">Upper Right</option>
                <option value="upper_left">Upper Left</option>
                <option value="lower_right">Lower Right</option>
                <option value="lower_left">Lower Left</option>
              </select>
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
  let selectedProcedureId = null;

  // Kick off background fetch for service procedures without blocking other calls
  ensureServiceProductsFetching().then(() => refreshProcedureOptions(container));
  refreshProcedureOptions(container);

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

  const getProcedureDisplayName = (item) => item?.name || item?.display_name || item?.product_name || 'Unnamed service';
  const getProcedureId = (item) => item?.id ?? item?.product_id ?? item?.local_product_id ?? null;

  const getFilteredProcedures = () => {
    const query = procedureInput?.value?.trim().toLowerCase() || '';
    if (!serviceProducts || !serviceProducts.length) return [];

    const matches = serviceProducts.filter((item) => {
      const name = (item.name || item.display_name || item.product_name || '').toLowerCase();
      const code = (item.default_code || '').toLowerCase();
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
        const code = (item.default_code || '').toLowerCase();
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
          const code = item.default_code;
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
            <div style="font-size:12px;color:#6b7280;pointer-events:none;">${escapeHtml(item.categ_id?.[1] || '')}${pricePart ? escapeHtml(pricePart) : ''}</div>
          </div>
        `;
        })
        .join('');
    }

    procedureDropdown.innerHTML = inner;
    procedureDropdown.style.display = 'block';

    // CRITICAL: Attach event handlers to each item AFTER rendering
    const items = procedureDropdown.querySelectorAll('.procedure-dropdown-item');
    items.forEach((item) => {
      // Use mousedown to prevent input blur from closing dropdown before click registers
      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent input blur
        const idx = Number(item.dataset.idx);
        if (filtered[idx]) {
          handleProcedureSelect(filtered[idx]);
        }
      });
      
      // Hover effect
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

  if (procedureDropdown) {
    // Event handlers are now attached directly to items in renderProcedureDropdown
    // No need for container-level event delegation
  }

  document.addEventListener('click', (e) => {
    if (!procedureWrapper) return;
    if (!procedureWrapper.contains(e.target)) {
      closeProcedureDropdown();
    }
  });

  // Initial render
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

      // Build payload
      const payload = {
        visit: visitId,
        tooth_number: container.querySelector('#tooth_number').value.trim(),
        procedure_name: procedureNameValue,
        procedure_category: container.querySelector('#procedure_category').value,
        treatment_status: container.querySelector('#treatment_status').value,
        treatment_date: container.querySelector('#treatment_date').value
      };

      if (resolvedProcedure !== null && resolvedProcedure !== undefined) {
        payload.procedure_product_id = resolvedProcedure;
      }

      console.log('[Dental] Treatment payload:', payload);

      // Optional fields
      const numberingSystem = container.querySelector('#numbering_system').value;
      if (numberingSystem && numberingSystem !== 'universal') {
        payload.numbering_system = numberingSystem;
      }

      const toothName = container.querySelector('#tooth_name')?.value.trim();
      if (toothName) payload.tooth_name = toothName;

      const toothType = container.querySelector('#tooth_type').value;
      if (toothType) payload.tooth_type = toothType;

      const toothPosition = container.querySelector('#tooth_position').value;
      if (toothPosition) payload.tooth_position = toothPosition;

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

        // Scroll to success message
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

  // Load current endpoint
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
              <br><br>
              <strong>Examples:</strong>
              <ul style="margin: 5px 0; padding-left: 20px;">
                <li>http://localhost:8000</li>
                <li>https://192.168.1.169:8000</li>
                <li>https://api.example.com</li>
              </ul>
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
        
        <div style="background: #e3f2fd; border-left: 4px solid #2196F3; padding: 12px; margin-top: 16px; border-radius: 4px; font-size: 12px; color: #1565C0;">
          <strong>ℹ️ About Certificate Errors</strong>
          <p style="margin: 5px 0 0 0;">
            If you're using HTTPS with a self-signed certificate and seeing "ERR_CERT_AUTHORITY_INVALID" errors:
          </p>
          <ul style="margin: 5px 0; padding-left: 20px;">
            <li>Click the certificate error in your browser's address bar</li>
            <li>Select "Advanced" and then "Proceed to [site] (unsafe)"</li>
            <li>This will allow the browser to accept the certificate for this session</li>
            <li>For production, use a valid SSL certificate from a trusted authority</li>
          </ul>
        </div>
      </div>
    `;

    // Add form submit handler
    const form = content.querySelector('#dentist-settings-form');
    const endpointInput = content.querySelector('#dentist-api-endpoint');
    const errorDiv = content.querySelector('#dentist-endpoint-error');
    const successDiv = content.querySelector('#dentist-settings-success');
    const testBtn = content.querySelector('#dentist-test-connection-btn');
    const connectionStatus = content.querySelector('#dentist-connection-status');
    const backBtn = content.querySelector('#dentist-settings-back-btn');

    // Back button handler
    backBtn.addEventListener('click', () => {
      if (summaryData) {
        renderTabs(content);
      } else {
        renderOverlayForPatient();
      }
    });

    // Test connection button handler
    testBtn.addEventListener('click', async () => {
      const endpoint = endpointInput.value.trim();

      // Hide previous messages
      errorDiv.style.display = 'none';
      connectionStatus.style.display = 'none';

      // Validate endpoint format
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

      // Show testing status
      testBtn.disabled = true;
      testBtn.textContent = 'Testing...';
      connectionStatus.style.display = 'block';
      connectionStatus.style.background = '#fff3e0';
      connectionStatus.style.color = '#e65100';
      connectionStatus.innerHTML = '⏳ Testing connection...';

      try {
        const baseUrl = endpoint.replace(/\/$/, '');
        const testUrl = `${baseUrl}/api/dental-appointments/summary/by-patient-uuid/test/`;

        console.log('[API] Calling endpoint: GET', testUrl);
        console.log('[Settings] Testing connection to:', testUrl);
        const response = await backgroundFetch(testUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        // If we get here, connection worked (even if 404, it means the server responded)
        connectionStatus.style.background = '#e8f5e9';
        connectionStatus.style.color = '#2e7d32';
        connectionStatus.innerHTML = '✅ Connection successful! The endpoint is reachable.';

      } catch (err) {
        let statusMessage = '';
        let statusColor = '#c62828';
        let statusBg = '#ffebee';

        if (err.message.includes('Failed to fetch') || err.message.includes('ERR_CERT_AUTHORITY_INVALID')) {
          statusMessage = '❌ Certificate error detected. You need to accept the certificate in your browser first.';
          statusMessage += '<br><br><strong>Solution:</strong> Open <a href="' + endpoint + '" target="_blank" style="color: #00695C; text-decoration: underline;">' + endpoint + '</a> in a new tab, accept the certificate warning, then try again.';
        } else if (err.message.includes('CORS')) {
          statusMessage = '⚠️ CORS error: The server may not allow requests from this origin.';
        } else if (err.message.includes('ERR_CONNECTION_REFUSED')) {
          statusMessage = '❌ Connection refused. Check if the server is running and the URL is correct.';
        } else {
          statusMessage = '❌ Connection failed: ' + err.message;
        }

        connectionStatus.style.background = statusBg;
        connectionStatus.style.color = statusColor;
        connectionStatus.innerHTML = statusMessage;
      } finally {
        testBtn.disabled = false;
        testBtn.textContent = 'Test Connection';
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const endpoint = endpointInput.value.trim();

      // Hide previous messages
      errorDiv.style.display = 'none';
      successDiv.style.display = 'none';

      // Validate endpoint
      if (!endpoint) {
        errorDiv.textContent = 'Please enter an API endpoint';
        errorDiv.style.display = 'block';
        return;
      }

      // Basic URL validation
      try {
        const url = new URL(endpoint);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Protocol must be http:// or https://');
        }
      } catch (err) {
        errorDiv.textContent = 'Please enter a valid URL (e.g., http://localhost:8000 or https://192.168.1.169:8000)';
        errorDiv.style.display = 'block';
        return;
      }

      // Save to storage
      chrome.storage.local.set({ apiEndpoint: endpoint }, () => {
        if (chrome.runtime.lastError) {
          errorDiv.textContent = 'Error saving settings: ' + chrome.runtime.lastError.message;
          errorDiv.style.display = 'block';
        } else {
          successDiv.style.display = 'block';
          setTimeout(() => {
            successDiv.style.display = 'none';
          }, 3000);

          // Optionally reload the patient data with new endpoint
          if (currentPatient) {
            console.log('Settings saved, reloading patient data with new endpoint...');
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
