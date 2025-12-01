console.log('Sigma Dental Helper - loaded');

let overlay = null;
let collapsedView = null;
let currentPatient = null;
let summaryData = null;
let isCollapsed = false;

const authTokens = {
  access: null,
  refresh: null
};

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
  const endpoint = storage.apiEndpoint || 'http://localhost:8000';
  return endpoint.replace(/\/$/, '');
}

async function refreshAccessToken() {
  await loadAuthTokens();
  if (!authTokens.refresh) {
    throw new Error('No refresh token available');
  }

  const baseUrl = await getApiEndpoint();
  const url = `${baseUrl}/api/token/refresh/`;

  const response = await fetch(url, {
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
    const response = await fetch(url, {
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

  let response = await fetch(url, options);

  if (response.status === 401 && authTokens.refresh) {
    try {
      const newAccess = await refreshAccessToken();
      options.headers.Authorization = `Bearer ${newAccess}`;
      response = await fetch(url, options);
    } catch (err) {
      await clearAuthTokens();
      throw err;
    }
  }

  return response;
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
  overlay.style.minWidth = '620px';
  overlay.style.maxWidth = '760px';
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
    chrome.runtime.sendMessage({ action: 'openOptions' });
  });

  overlay.querySelector('#dentist-logout-btn').addEventListener('click', async () => {
    await clearAuthTokens();
    summaryData = null;
    renderOverlayForPatient();
  });
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

function setAuthUiState(authenticated) {
  const logoutBtn = overlay?.querySelector('#dentist-logout-btn');
  if (!logoutBtn) return;
  logoutBtn.style.display = authenticated ? 'inline-block' : 'none';
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
    chrome.runtime.sendMessage({ action: 'openOptions' });
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
      const response = await fetch(url, {
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

  try {
    const baseUrl = await getApiEndpoint();
    const url = `${baseUrl}/api/dental-appointments/summary/by-patient-uuid/${currentPatient.uuid}/`;
    const response = await authenticatedFetch(url, { method: 'GET' });

    if (!response.ok) {
      if (response.status === 401) {
        await clearAuthTokens();
        setAuthUiState(false);
        renderLogin(container);
        return;
      }

      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody.detail || `Failed to load summary (HTTP ${response.status})`;
      container.innerHTML = renderErrorState(message);
      return;
    }

    summaryData = await response.json();
    console.log('[Dental] Summary response:', summaryData);
    setPatientLabel();
    renderTabs(container);
  } catch (err) {
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
    { id: 'allergies', label: 'Allergies' },
    { id: 'conditions', label: 'Past Medical Conditions' },
    { id: 'consumed', label: 'Items Consumed' }
  ];

  if (showInsurance) {
    tabs.push({ id: 'insurance', label: 'Insurance' });
  }

  container.innerHTML = `
    <div style="margin-bottom:12px;">
      <div style="font-weight:700;font-size:14px;color:#004d40;">${summaryData?.patient?.full_name || 'Patient'}</div>
      <div style="font-size:12px;color:#666;">${summaryData?.patient?.customer_identifier || ''}</div>
    </div>
    <div id="dentist-tabs" style="display:flex;border-bottom:1px solid #e0e0e0;background:#f6f6f6;border-radius:6px 6px 0 0;overflow:hidden;">
      ${tabs
        .map(
          (tab, idx) => `
            <button data-tab="${tab.id}" class="dentist-tab ${idx === 0 ? 'active' : ''}" style="flex:1;padding:10px;border:none;background:${idx === 0 ? '#fff' : 'transparent'};cursor:pointer;font-size:13px;font-weight:600;border-bottom:2px solid ${
            idx === 0 ? '#00695C' : 'transparent'
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
      btn.style.borderBottomColor = isActive ? '#00695C' : 'transparent';
    });

    switch (tabId) {
      case 'visit':
        tabContent.innerHTML = renderVisitTab(summaryData);
        break;
      case 'allergies':
        tabContent.innerHTML = renderAllergiesTab(summaryData.allergies || []);
        break;
      case 'conditions':
        tabContent.innerHTML = renderConditionsTab(summaryData.past_medical_conditions || []);
        break;
      case 'consumed':
        tabContent.innerHTML = renderConsumedTab(summaryData.consumed_items || []);
        break;
      case 'insurance':
        tabContent.innerHTML = renderInsuranceTab(summaryData.active_visit?.insurance_scheme);
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
          ['Type', visit.visit_type?.name || '—'],
          ['Status', formatStatus(visit.status)],
          ['Visit Date', formatDateTime(visit.visit_date)],
          ['Mode of Payment', visit.mode_of_payment || '—'],
          ['Requires Pre-Authorization', visit.requires_pre_authorization ? 'Yes' : 'No']
        ])}
      </div>
    `
    : '<p style="color:#666;margin:0 0 10px 0;">No active visit found.</p>';

  const appointmentSection = appointment
    ? `
      <div>
        <h4 style="margin:0 0 8px 0;font-size:13px;color:#00695C;">Upcoming Appointment</h4>
        ${createTable([
          ['Status', formatStatus(appointment.status)],
          ['Date', appointment.appointment_date || '—'],
          ['Time', appointment.appointment_time || '—'],
          ['Reason', appointment.reason || '—'],
          ['Notes', appointment.notes || '—']
        ])}
      </div>
    `
    : '';

  const patientSection = patient
    ? `
      <div style="margin-top:12px;">
        <h4 style="margin:0 0 8px 0;font-size:13px;color:#00695C;">Patient</h4>
        ${createTable([
          ['Identifier', patient.customer_identifier],
          ['Phone', patient.phone_number || '—']
        ])}
      </div>
    `
    : '';

  return visitSection + appointmentSection + patientSection;
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

function renderConditionsTab(conditions) {
  if (!conditions.length) {
    return '<p style="color:#666;">No past medical conditions recorded.</p>';
  }

  return conditions
    .map((condition) => {
      return `
        <div style="border:1px solid #e0e0e0;border-radius:6px;padding:10px;margin-bottom:10px;background:#fafafa;">
          ${createTable([
            ['Condition', condition.disease_name],
            ['Category', condition.disease_category || '—'],
            ['Status', condition.status_display || condition.status],
            ['Diagnosed', condition.diagnosed_date || '—'],
            ['Notes', condition.notes || '—'],
            ['Under Treatment', condition.is_under_treatment ? 'Yes' : 'No']
          ])}
        </div>
      `;
    })
    .join('');
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
        ['Scheme', insurance.insurance_scheme_name],
        ['Company', insurance.insurance_company_name || '—'],
        ['Membership Number', insurance.membership_number || '—'],
        ['Suffix', insurance.suffix || '—']
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

// =========================
// Bootstrap
// =========================

loadAuthTokens();

extractPatient();
setInterval(extractPatient, 2000);
