import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { INotebookTracker } from '@jupyterlab/notebook';
import { Cell } from '@jupyterlab/cells';
import { Widget } from '@lumino/widgets';

import { requestAPI, listHashKeys, getCellByHash, pushCellByHash, createSession } from './handler';
import { AuthService, UserRole } from './auth';
import { fetchNetworkInfo } from './handler';

/**
 * User role storage (now managed by authService)
 */
let currentUserRole: UserRole | null = null;

/**
 * Teacher sync toggle state
 */
let syncEnabled = false;

/**
 * Session-related state
 */
let sessionCode: string | null = null;
let teacherIp: string | null = null;
let sessionReady = false;
let creatingSession = false;

/**
 * Load session state from localStorage
 */
function loadSessionState(): void {
  sessionCode = localStorage.getItem('nb_sync_session_code');
  teacherIp = localStorage.getItem('nb_sync_teacher_ip');
  sessionReady = !!sessionCode;
}

/**
 * Save session state to localStorage
 */
function saveSessionState(): void {
  if (sessionCode) {
    localStorage.setItem('nb_sync_session_code', sessionCode);
  }
  if (teacherIp) {
    localStorage.setItem('nb_sync_teacher_ip', teacherIp);
  }
}

/**
 * Clear session state from localStorage
 */
function clearSessionState(): void {
  localStorage.removeItem('nb_sync_session_code');
  localStorage.removeItem('nb_sync_teacher_ip');
  sessionCode = null;
  teacherIp = null;
  sessionReady = false;
}

/**
 * Generate ISO timestamp for cell creation
 */
function generateTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Add creation timestamp to cell metadata (teacher only)
 */
function addTimestampToCell(cell: Cell): void {
  if (currentUserRole !== 'teacher') {
    return;
  }

  try {
    const timestamp = generateTimestamp();

    // Access cell metadata and add timestamp
    if (cell.model && cell.model.metadata) {
      // Use direct property access for metadata
      const metadata = cell.model.metadata as any;
      metadata['nb_sync_created_at'] = timestamp;
      console.log(`Added timestamp to cell: ${timestamp}`);
    }
  } catch (error) {
    console.error('Error adding timestamp to cell:', error);
  }
}

/**
 * Ensure cell identity metadata exists
 */
function ensureCellIdentity(cell: Cell): void {
  if (cell.model && cell.model.metadata) {
    const metadata = cell.model.metadata as any;
    if (!metadata['nb_sync_cell_id']) {
      metadata['nb_sync_cell_id'] = `cell_${Math.random().toString(36).slice(2, 10)}`;
    }
  }
}

/**
 * Set user role and initialize appropriate features
 * Now uses authenticated backend role instead of localStorage
 */ 
async function setUserRole(role: UserRole): Promise<void> {
  currentUserRole = role;
  console.log(`User role set to: ${role}`);

  // No longer store in localStorage - role comes from backend authentication
  // localStorage.setItem('nb-sync-role', role);

  // Initialize features based on role
  if (role === 'student') {
    initializeStudentFeatures();
  } else {
    initializeTeacherFeatures();
  }
}

/**
 * Initialize features for student role
 */
function initializeStudentFeatures(): void {
  console.log('Initializing student features...');
  // Add sync buttons to all existing cells
  console.log('Calling addSyncButtonsToAllCells for student features');
  addSyncButtonsToAllCells();
}

/**
 * Initialize features for teacher role
 */
function initializeTeacherFeatures(): void {
  console.log('Initializing teacher features...');
  // Add toggle buttons to all existing cells
  console.log('Calling addSyncButtonsToAllCells for teacher features');
  addSyncButtonsToAllCells();
}

/**
 * Check authentication and get role from backend
 */
async function checkAuthenticatedRole(): Promise<boolean> {
  try {
    console.log('Checking authentication with backend...');
    const authResult = await AuthService.validateSession();

    console.log('Auth result:', authResult);

    if (authResult.authenticated && authResult.role) {
      console.log('Valid authenticated role found:', authResult.role);
      await setUserRole(authResult.role);
      return true;
    } else {
      console.log('Authentication failed:', authResult.message);
      return false;
    }
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
}

/**
 * Initialize authentication and handle UI setup
 */
async function initializeAuthentication(): Promise<void> {
  try {
    // First, try to get role from backend for UI features
    const isAuthenticated = await checkAuthenticatedRole();

    // Initialize session state regardless of auth
    loadSessionState();

    if (isAuthenticated && currentUserRole === 'teacher') {
      // Full teacher features with authenticated role
      console.log('Authenticated teacher - enabling full features');

      if (!sessionReady) {
        // Auto-create session for authenticated teachers
        await autoCreateTeacherSessionAndShare();
      }
    } else if (!sessionReady) {
      // Try to create teacher session without auth (fallback)
      console.log('Attempting teacher session creation without auth...');
      await createTeacherSessionFallback();
    } else {
      // If session already exists, determine role or default to student
      if (!currentUserRole) {
        await setUserRole('student');
      }
    }
  } catch (error) {
    console.error('Authentication initialization failed:', error);
    // Fallback: still allow basic functionality
    console.log('Falling back to basic functionality without auth');
    
    if (!currentUserRole) {
      await setUserRole('student');
    }
    
    if (!sessionReady) {
      showStudentSessionSetupModal();
    }
  }
}

/**
 * Add sync buttons to all existing cells
 */
let addSyncButtonsToAllCells: () => void;

/**
 * Mock cell IDs data (fallback)
 */
const MOCK_CELL_IDS = [
  '0955501c-5637-4204-9ba5-a157055f6da8',
  '88e7db2a-8c6f-4b6f-b1a9-6d73904cf32a',
  'a1d2229d-76af-487d-95f2-93ba04a4544c',
  'eedf1709-269e-4230-accf-9baa9c0476c4',
  '2e91cbd4-c7eb-4a52-b229-44a6571a543f',
  '14892b5b-efc8-4f29-a674-3f001b2cd9f4'
];

/**
 * Mock code snippets mapped to cell IDs (fallback)
 */
const MOCK_CODE_SNIPPETS: { [key: string]: string } = {
  '0955501c-5637-4204-9ba5-a157055f6da8': `print("Hello World!")
for i in range(5):
    print(f"Count: {i}")`,

  '88e7db2a-8c6f-4b6f-b1a9-6d73904cf32a': `import pandas as pd
import numpy as np

df = pd.read_csv("data.csv")
print(df.head())`,

  'a1d2229d-76af-487d-95f2-93ba04a4544c': `import matplotlib.pyplot as plt

x = [1, 2, 3, 4, 5]
y = [2, 4, 6, 8, 10]
plt.plot(x, y)
plt.show()`,

  'eedf1709-269e-4230-accf-9baa9c0476c4': `def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))`,

  '2e91cbd4-c7eb-4a52-b229-44a6571a543f': `import requests
import json

response = requests.get("https://api.example.com/data")
data = response.json()
print(data)`,

  '14892b5b-efc8-4f29-a674-3f001b2cd9f4': `class Calculator:
    def __init__(self):
        self.result = 0

    def add(self, x):
        self.result += x
        return self

calc = Calculator()
print(calc.add(5).add(3).result)`
};

/**
 * Create ghost code preview overlay
 */
function createCodePreview(cell: Cell, code: string): HTMLElement {
  const preview = document.createElement('div');
  preview.className = 'nb-sync-code-preview';

  const preElement = document.createElement('pre');
  preElement.textContent = code;
  preview.appendChild(preElement);

  // Target the CodeMirror editor area specifically for better positioning
  const editorArea = cell.node.querySelector('.cm-editor') ||
                    cell.node.querySelector('.CodeMirror') ||
                    cell.node.querySelector('.jp-InputArea-editor');

  if (editorArea) {
    // Position relative to the editor area
    editorArea.appendChild(preview);
  } else {
    // Fallback to input area
    const inputArea = cell.node.querySelector('.jp-Cell-inputArea');
    if (inputArea) {
      inputArea.appendChild(preview);
    }
  }

  return preview;
}

/**
 * Replace cell content with new code
 */
function replaceCellContent(cell: Cell, newCode: string): void {
  try {
    // Use the working method: sharedModel.source
    if (cell.model && (cell.model as any).sharedModel) {
      const sharedModel = (cell.model as any).sharedModel;
      sharedModel.source = newCode;
    }
  } catch (error) {
    console.error('Error replacing cell content:', error);
  }
}

/**
 * Create dropdown menu with cell IDs
 */
function createCellIdDropdown(buttonElement: HTMLElement, currentCell: Cell): HTMLElement {
  const dropdown = document.createElement('div');
  dropdown.className = 'nb-sync-dropdown';

  const dropdownContent = document.createElement('div');
  dropdownContent.className = 'nb-sync-dropdown-content';

  // Render helper for options
  const renderOption = (label: string, onHover: () => void, onLeave: () => void, onClick: () => void) => {
    const option = document.createElement('div');
    option.className = 'nb-sync-dropdown-option';
    option.textContent = label;
    option.addEventListener('mouseenter', onHover);
    option.addEventListener('mouseleave', onLeave);
    option.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    dropdownContent.appendChild(option);
  };

  // Ask for teacher IP once per dropdown open
  const teacherIp = window.prompt('Enter teacher IP for Redis (leave blank for default server):', '');

  // Try live data first
  let abortController: AbortController | null = null;

  const loadLive = async () => {
    try {
      const res = await listHashKeys({ teacher_ip: teacherIp || undefined, count: 200 });
      const keys = res.items || [];
      if (keys.length === 0) {
        return false;
      }

      for (const fullKey of keys) {
        // fullKey is like 'cell_hash:<hash>'
        const parts = fullKey.split(':');
        const hash = parts[1] || fullKey;

        let previewElement: HTMLElement | null = null;

        renderOption(hash.substring(0, 8) + '…', async () => {
          // Hover: fetch preview
          if (currentCell.node.querySelector('.nb-sync-code-preview')) {
            return;
          }
          if (abortController) {
            abortController.abort();
          }
          abortController = new AbortController();
          try {
            const data = await getCellByHash(hash, teacherIp || undefined);
            const code = data?.content || '# No content available';
            previewElement = createCodePreview(currentCell, code);
          } catch (e) {
            console.warn('Preview fetch failed:', e);
          }
        }, () => {
          if (previewElement) {
            previewElement.remove();
            previewElement = null;
          }
          if (abortController) {
            abortController.abort();
            abortController = null;
          }
        }, async () => {
          // Click: fetch and replace cell content
          try {
            const data = await getCellByHash(hash, teacherIp || undefined);
            const code = data?.content || '# No content available';
            replaceCellContent(currentCell, code);
            console.log('Replaced cell content from hash:', hash.substring(0, 8));
          } catch (e) {
            console.error('Failed to fetch cell by hash:', e);
          }
          dropdown.remove();
        });
      }
      return true;
    } catch (e) {
      console.warn('Falling back to mock data due to error:', e);
      return false;
    }
  };

  // Fallback: render mock items
  const renderMock = () => {
    MOCK_CELL_IDS.forEach(cellId => {
      let previewElement: HTMLElement | null = null;
      renderOption(cellId, () => {
        if (currentCell.node.querySelector('.nb-sync-code-preview')) return;
        const code = MOCK_CODE_SNIPPETS[cellId] || '# No code available';
        previewElement = createCodePreview(currentCell, code);
      }, () => {
        if (previewElement) { previewElement.remove(); previewElement = null; }
      }, () => {
        const code = MOCK_CODE_SNIPPETS[cellId] || '# No code available';
        replaceCellContent(currentCell, code);
        console.log('Replaced cell content with code from:', cellId);
        dropdown.remove();
      });
    });
  };

  // Kick off load
  loadLive().then(success => { if (!success) renderMock(); });

  dropdown.appendChild(dropdownContent);

  // Position dropdown relative to button
  const buttonRect = buttonElement.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.top = `${buttonRect.bottom + 5}px`;
  dropdown.style.left = `${buttonRect.left}px`;
  dropdown.style.zIndex = '10000';

  // Close dropdown when clicking outside
  const closeDropdown = (e: Event) => {
    if (!dropdown.contains(e.target as Node)) {
      dropdown.remove();
      document.removeEventListener('click', closeDropdown);
    }
  };

  setTimeout(() => {
    document.addEventListener('click', closeDropdown);
  }, 0);

  return dropdown;
}

/**
 * Create a sync button widget (for students)
 */
function createSyncButton(cell: Cell): Widget {
  const button = new Widget({ node: document.createElement('button') });
  button.node.className = 'nb-sync-button';
  button.node.textContent = 'Sync';
  button.node.title = 'Sync this cell';

  // Add click handler to show dropdown with cell IDs
  button.node.addEventListener('click', (e) => {
    e.stopPropagation();

    // Remove any existing dropdown
    const existingDropdown = document.querySelector('.nb-sync-dropdown');
    if (existingDropdown) {
      existingDropdown.remove();
      return;
    }

    // If session is ready, add session-specific options
    if (sessionReady && sessionCode) {
      const dropdown = createCellIdDropdown(button.node, cell);
      document.body.appendChild(dropdown);
    }
  });

  return button;
}

/**
 * Create a toggle button widget (for teachers)
 */
function createToggleButton(): Widget {
  const button = new Widget({ node: document.createElement('button') });
  button.node.className = 'nb-sync-toggle-button';
  button.node.textContent = syncEnabled ? 'Sync: ON' : 'Sync: OFF';
  button.node.title = 'Toggle sync for this cell';

  // Update button appearance based on state
  const updateButtonState = () => {
    if (syncEnabled) {
      button.node.textContent = 'Sync: ON';
      button.node.classList.add('sync-enabled');
      button.node.classList.remove('sync-disabled');
    } else {
      button.node.textContent = 'Sync: OFF';
      button.node.classList.add('sync-disabled');
      button.node.classList.remove('sync-enabled');
    }
  };

  updateButtonState();

  // Add click handler to toggle sync state
  button.node.addEventListener('click', (e) => {
    e.stopPropagation();
    syncEnabled = !syncEnabled;
    updateButtonState();
    console.log('Sync toggled:', syncEnabled ? 'ON' : 'OFF');
  });

  // Add a secondary action button for publishing via hash
  const publishBtn = document.createElement('button');
  publishBtn.className = 'nb-sync-teacher-publish-button';
  publishBtn.textContent = 'Publish (Hash)';
  publishBtn.title = 'Publish this cell content using hash-based sync';
  publishBtn.style.marginLeft = '8px';
  publishBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      // Find owning cell from DOM
      const cellNode = button.node.closest('.jp-Cell');
      if (!cellNode) return;
      // We need to map node to Cell; simplest is to search visible notebook
      // Fallback: get content via sharedModel if possible by traversing notebook later
      // For simplicity in this additive change, read text content from CodeMirror DOM as preview
      let content = '';
      const pre = cellNode.querySelector('.jp-InputArea-editor');
      if ((pre as any) && (pre as any).textContent) {
        content = (pre as any).textContent || '';
      }

      // Use metadata timestamp if present; else generate new
      let createdAt = new Date().toISOString();
      try {
        const metaNode = (cellNode as any).model?.metadata;
        if (metaNode && metaNode['nb_sync_created_at']) {
          createdAt = metaNode['nb_sync_created_at'];
        }
      } catch {}

      // Derive a simple cell_id surrogate from DOM id or random fallback
      const cellId = (cellNode as HTMLElement).id || 'cell_' + Math.random().toString(36).slice(2, 10);

      const res = await pushCellByHash({ cell_id: cellId, created_at: createdAt, content });
      console.log('Published cell via hash:', res.hash_key);
      // Optional UI feedback
      alert(`Published (hash): ${res.hash_key}`);

      // Push to session if enabled
      if (sessionReady && currentUserRole === 'teacher' && syncEnabled) {
        console.log('Pushing cell to session:', sessionCode);
        // Add session push logic here
      }
    } catch (err) {
      console.error('Publish (hash) failed:', err);
      alert('Failed to publish cell via hash. See console.');
    }
  });

  // Wrap both buttons in a container
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.appendChild(button.node);
  container.appendChild(publishBtn);

  // Replace widget node with container
  (button as any).node = container;

  return button;
}

/**
 * Add sync button to a cell (for students) or toggle button (for teachers)
 */
function addSyncButtonToCell(cell: Cell): void {
  // Only add buttons for students and teachers
  if (!currentUserRole || (currentUserRole !== 'student' && currentUserRole !== 'teacher')) {
    return;
  }

  // Ensure cell identity metadata exists
  ensureCellIdentity(cell);

  // Check if button already exists
  const existingButton = cell.node.querySelector('.nb-sync-button') || cell.node.querySelector('.nb-sync-toggle-button');
  if (existingButton) {
    return;
  }

  let button: Widget;
  if (currentUserRole === 'student') {
    button = createSyncButton(cell);
  } else {
    button = createToggleButton();
  }

  // Create a container for the button positioned in top-right
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'nb-sync-button-container';
  buttonContainer.appendChild(button.node);

  // Insert the button into the cell's input area
  const inputArea = cell.node.querySelector('.jp-Cell-inputArea');
  if (inputArea) {
    inputArea.appendChild(buttonContainer);
  }
}

/**
 * Show student session setup modal
 */
function showStudentSessionSetupModal(): void {
  const code = window.prompt('Enter the teacher session code:', '') || '';
  if (!code.trim()) {
    alert('No session code entered. Session will remain inactive.');
    clearSessionState();
    return;
  }
  const ip = window.prompt('Enter teacher Redis IP (blank = default):', '') || '';
  sessionCode = code.trim();
  teacherIp = ip.trim() || null;
  sessionReady = true;
  saveSessionState();
  console.log('Student joined session:', { sessionCode, teacherIp });
  addSyncButtonsToAllCells();
}

/**
 * Create and show teacher share modal (session code + IP list)
 */
function showTeacherShareModal(sessionCode: string, ipAddresses: string[]): void {
  ensureShareModalStyles();

  const overlay = document.createElement('div');
  overlay.className = 'nb-sync-share-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'nb-sync-share-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');

  const title = document.createElement('h2');
  title.textContent = 'Share this Session';
  dialog.appendChild(title);

  const codeLabel = document.createElement('div');
  codeLabel.className = 'nb-sync-share-label';
  codeLabel.textContent = 'Session Code';
  dialog.appendChild(codeLabel);

  const codeBox = document.createElement('div');
  codeBox.className = 'nb-sync-share-code';
  codeBox.textContent = sessionCode;
  dialog.appendChild(codeBox);

  const copyCodeBtn = document.createElement('button');
  copyCodeBtn.className = 'nb-sync-share-copy-btn';
  copyCodeBtn.textContent = 'Copy Code';
  copyCodeBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(sessionCode).catch(() => {});
    copyCodeBtn.textContent = 'Copied!';
    setTimeout(() => (copyCodeBtn.textContent = 'Copy Code'), 1500);
  });
  dialog.appendChild(copyCodeBtn);

  // Teacher IP (primary) section - prefer public/non-loopback IPs
  const isIpv4 = (ip: string) => /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
  const isLoopback = (ip: string) => ip === '::1' || ip.startsWith('127.');
  const isLinkLocal = (ip: string) => isIpv4(ip) ? ip.startsWith('169.254.') : ip.toLowerCase().startsWith('fe80:');
  const isPrivateV4 = (ip: string) => ip.startsWith('10.') || ip.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip);
  const isUniqueLocalV6 = (ip: string) => ip.toLowerCase().startsWith('fc00:') || ip.toLowerCase().startsWith('fd00:');

  const candidates = (ipAddresses || []).filter(Boolean);
  // 1) Public IPv4
  let primaryIp = candidates.find(ip => isIpv4(ip) && !isLoopback(ip) && !isLinkLocal(ip) && !isPrivateV4(ip));
  // 2) Global IPv6 (not loopback/link-local/unique-local)
  if (!primaryIp) {
    primaryIp = candidates.find(ip => !isIpv4(ip) && !isLoopback(ip) && !isLinkLocal(ip) && !isUniqueLocalV6(ip));
  }
  // 3) Private/LAN IPv4 (usable on the same network)
  if (!primaryIp) {
    primaryIp = candidates.find(ip => isIpv4(ip) && !isLoopback(ip) && !isLinkLocal(ip));
  }
  // 4) Fallback to hostname if it's not localhost
  if (!primaryIp) {
    const hn = window.location.hostname;
    if (hn && hn !== 'localhost' && hn !== '127.0.0.1') {
      primaryIp = hn;
    }
  }

  const tipLabel = document.createElement('div');
  tipLabel.className = 'nb-sync-share-label';
  tipLabel.style.marginTop = '14px';
  tipLabel.textContent = 'Teacher IP';
  dialog.appendChild(tipLabel);

  const tipRow = document.createElement('div');
  tipRow.className = 'nb-sync-share-ip-primary-row';

  const tipBox = document.createElement('div');
  tipBox.className = 'nb-sync-share-ip-primary';
  tipBox.textContent = primaryIp ? String(primaryIp) : 'Not detected — use one of the IPs below';
  tipRow.appendChild(tipBox);

  const copyIpBtn = document.createElement('button');
  copyIpBtn.className = 'nb-sync-share-copy-btn small';
  copyIpBtn.textContent = 'Copy IP';
  copyIpBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(String(primaryIp)).catch(() => {});
    copyIpBtn.textContent = 'Copied!';
    setTimeout(() => (copyIpBtn.textContent = 'Copy IP'), 1200);
  });
  tipRow.appendChild(copyIpBtn);
  dialog.appendChild(tipRow);

  const ipLabel = document.createElement('div');
  ipLabel.className = 'nb-sync-share-label';
  ipLabel.style.marginTop = '14px';
  ipLabel.textContent = 'Available IP Addresses';
  dialog.appendChild(ipLabel);

  const ipList = document.createElement('div');
  ipList.className = 'nb-sync-share-ip-list';
  ipAddresses.forEach((ip, idx) => {
    const row = document.createElement('div');
    row.className = 'nb-sync-share-ip-row';

    const ipSpan = document.createElement('span');
    ipSpan.textContent = ip;
    ipSpan.className = 'nb-sync-share-ip';
    row.appendChild(ipSpan);

    const btn = document.createElement('button');
    btn.className = 'nb-sync-share-copy-btn small';
    btn.textContent = 'Copy';
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(ip).catch(() => {});
      btn.textContent = 'Copied!';
      setTimeout(() => (btn.textContent = 'Copy'), 1200);
    });
    row.appendChild(btn);
    ipList.appendChild(row);
    if (idx === 0) {
      setTimeout(() => btn.focus(), 50);
    }
  });
  dialog.appendChild(ipList);

  const help = document.createElement('p');
  help.className = 'nb-sync-share-help';
  help.innerHTML = `Students: Use one of the IPs above when asked for teacher Redis host (or set <code>REDIS_URL=redis://IP:6379</code>) and enter the session code.`;
  dialog.appendChild(help);

  const close = document.createElement('button');
  close.className = 'nb-sync-share-close';
  close.textContent = 'Close';
  close.addEventListener('click', () => overlay.remove());
  dialog.appendChild(close);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
}

let shareStylesInjected = false;
function ensureShareModalStyles(): void {
  if (shareStylesInjected) return;
  shareStylesInjected = true;
  const style = document.createElement('style');
  style.id = 'nb-sync-share-styles';
  style.textContent = `
  .nb-sync-share-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.45);
    z-index: 10000;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--jp-ui-font-family);
  }
  .nb-sync-share-dialog {
    background: var(--jp-layout-color1, #fff);
    color: var(--jp-ui-font-color1, #111);
    padding: 24px 28px;
    border-radius: 10px;
    width: 460px;
    max-width: 90%;
    box-shadow: 0 6px 24px rgba(0,0,0,0.25);
    animation: fadeIn .18s ease;
  }
  .nb-sync-share-dialog h2 {
    margin: 0 0 10px;
    font-size: 1.4em;
    font-weight: 600;
  }
  .nb-sync-share-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.06em;
    opacity: 0.8;
    margin-bottom: 4px;
  }
  .nb-sync-share-code {
    font-family: monospace;
    font-size: 1.9rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    background: #222;
    color: #fff;
    padding: 10px 14px;
    border-radius: 6px;
    text-align: center;
    user-select: all;
  }
  .nb-sync-share-ip-primary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .nb-sync-share-ip-primary {
    flex: 1 1 auto;
    font-family: monospace;
    font-size: 1.1rem;
    font-weight: 600;
    background: var(--jp-layout-color2, #f5f5f5);
    color: var(--jp-ui-font-color1, #111);
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid var(--jp-border-color2, #ccc);
    word-break: break-all;
  }
  .nb-sync-share-copy-btn {
    margin-top: 10px;
    background: #1976d2;
    color: #fff;
    border: none;
    padding: 6px 14px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }
  .nb-sync-share-copy-btn:hover { background: #1565c0; }
  .nb-sync-share-copy-btn.small {
    margin: 0;
    padding: 4px 10px;
    font-size: 0.7rem;
  }
  .nb-sync-share-ip-list {
    margin-top: 4px;
    max-height: 180px;
    overflow-y: auto;
    border: 1px solid var(--jp-border-color2,#ccc);
    border-radius: 6px;
    padding: 6px 8px;
    background: var(--jp-layout-color2,#fafafa);
  }
  .nb-sync-share-ip-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 2px;
    font-family: monospace;
    font-size: 0.9rem;
  }
  .nb-sync-share-ip-row + .nb-sync-share-ip-row {
    border-top: 1px solid rgba(0,0,0,0.08);
  }
  .nb-sync-share-help {
    font-size: 0.72rem;
    line-height: 1.2rem;
    margin: 14px 0 4px;
    opacity: 0.85;
  }
  .nb-sync-share-help code {
    background: #eee;
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 0.65rem;
  }
  .nb-sync-share-close {
    margin-top: 8px;
    background: #444;
    color: #fff;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    float: right;
  }
  .nb-sync-share-close:hover { background: #222; }
  @keyframes fadeIn {
    from { opacity:0; transform: translateY(4px); }
    to { opacity:1; transform: translateY(0); }
  }
  `;
  document.head.appendChild(style);
}

/**
 * Auto-create teacher session and show share modal (no fallback prompts)
 */
async function autoCreateTeacherSessionAndShare(): Promise<void> {
  // Guard: only teachers should auto-create sessions
  if (currentUserRole !== 'teacher') return;
  if (sessionReady || creatingSession) return;
  
  try {
    creatingSession = true;
    console.log('Creating teacher session automatically...');
    
    // Create session without auth check (backend now allows this)
    const res = await createSession();
    sessionCode = res.session_code;
    sessionReady = true;
    saveSessionState();
    console.log('Session created:', sessionCode);

    let ipAddresses: string[] = [];
    try {
      const netInfo = await fetchNetworkInfo();
      ipAddresses = netInfo.ip_addresses || [];
    } catch (e) {
      console.error('Failed to fetch network info:', e);
    }
    if (!ipAddresses.length) {
      ipAddresses = [window.location.hostname || '127.0.0.1'];
    }
    showTeacherShareModal(sessionCode, ipAddresses);
    addSyncButtonsToAllCells();
  } catch (e: any) {
    console.error('Automatic session creation failed:', e);
    
    // If this fails, fall back to student mode
    console.log('Falling back to student mode after session creation failure');
    await setUserRole('student');
    showStudentSessionSetupModal();
  } finally {
    creatingSession = false;
  }
}

/**
 * Create teacher session for unauthenticated users who might be teachers
 */
async function createTeacherSessionFallback(): Promise<void> {
  if (sessionReady || creatingSession) return;
  
  try {
    creatingSession = true;
    console.log('Attempting to create teacher session without auth...');
    
    // Try to create session - this should work now without auth
    const res = await createSession();
    sessionCode = res.session_code;
    sessionReady = true;
    saveSessionState();
    console.log('Session created successfully:', sessionCode);
    
    // Set role to teacher since session creation worked
    await setUserRole('teacher');

    let ipAddresses: string[] = [];
    try {
      const netInfo = await fetchNetworkInfo();
      ipAddresses = netInfo.ip_addresses || [];
    } catch (e) {
      console.error('Failed to fetch network info:', e);
    }
    if (!ipAddresses.length) {
      ipAddresses = [window.location.hostname || '127.0.0.1'];
    }
    showTeacherShareModal(sessionCode, ipAddresses);
    addSyncButtonsToAllCells();
  } catch (e: any) {
    console.error('Teacher session fallback failed:', e);
    // If this fails, fall back to student mode
    await setUserRole('student');
    showStudentSessionSetupModal();
  } finally {
    creatingSession = false;
  }
}

/**
 * Initialization data for the nb_sync extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'nb_sync:plugin',
  description: 'A JupyterLab extension for teaching',
  autoStart: true,
  optional: [ISettingRegistry],
  requires: [INotebookTracker],
  activate: (
    _app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry | null
  ) => {
    console.log('JupyterLab extension nb_sync is activated!');

    // Update the addSyncButtonsToAllCells function first
    addSyncButtonsToAllCells = () => {
      console.log('Adding sync buttons to all cells, current role:', currentUserRole);
      notebookTracker.forEach(notebookPanel => {
        const notebook = notebookPanel.content;
        for (let i = 0; i < notebook.widgets.length; i++) {
          const cell = notebook.widgets[i];

          // Add timestamp to existing cells that don't have one (teacher only)
          if (currentUserRole === 'teacher' && cell.model && cell.model.metadata) {
            const metadata = cell.model.metadata as any;
            if (!metadata['nb_sync_created_at']) {
              addTimestampToCell(cell);
            }
          }

          addSyncButtonToCell(cell);
        }
      });
    };

    // Store reference to notebook tracker for later use
    const setupNotebookTracking = () => {
      // Add sync buttons to existing and new cells
      notebookTracker.widgetAdded.connect((_sender, notebookPanel) => {
        const notebook = notebookPanel.content;

        // Add buttons to existing cells and timestamps for teachers
        for (let i = 0; i < notebook.widgets.length; i++) {
          const cell = notebook.widgets[i];

          // Add timestamp to existing cells that don't have one (teacher only)
          if (currentUserRole === 'teacher' && cell.model && cell.model.metadata) {
            const metadata = cell.model.metadata as any;
            if (!metadata['nb_sync_created_at']) {
              addTimestampToCell(cell);
            }
          }

          addSyncButtonToCell(cell);
        }

        // Add buttons to new cells as they are created
        notebook.model?.cells.changed.connect((_sender, args) => {
          // Add timestamp to newly created cells (teacher only)
          if (args.type === 'add' && currentUserRole === 'teacher') {
            args.newValues.forEach((cellModel: any) => {
              // Find the corresponding cell widget
              const cellWidget = notebook.widgets.find(widget => widget.model === cellModel);
              if (cellWidget) {
                addTimestampToCell(cellWidget);
              }
            });
          }

          setTimeout(() => {
            for (let i = 0; i < notebook.widgets.length; i++) {
              const cell = notebook.widgets[i];
              addSyncButtonToCell(cell);
            }
          }, 100); // Small delay to ensure cell DOM is ready
        });
      });

      // Handle already open notebooks
      notebookTracker.forEach(notebookPanel => {
        const notebook = notebookPanel.content;
        for (let i = 0; i < notebook.widgets.length; i++) {
          const cell = notebook.widgets[i];

          // Add timestamp to existing cells that don't have one (teacher only)
          if (currentUserRole === 'teacher' && cell.model && cell.model.metadata) {
            const metadata = cell.model.metadata as any;
            if (!metadata['nb_sync_created_at']) {
              addTimestampToCell(cell);
            }
          }

          addSyncButtonToCell(cell);
        }
      });
    };

    // Setup notebook tracking
    setupNotebookTracking();

    // Initialize authentication system
    setTimeout(async () => {
      await initializeAuthentication();
    }, 1000);

    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
        .then(settings => {
          console.log('nb_sync settings loaded:', settings.composite);
        })
        .catch(reason => {
          console.error('Failed to load settings for nb_sync.', reason);
        });
    }

    requestAPI<any>('status')
      .then(data => {
        console.log(data);
      })
      .catch(reason => {
        console.error(
          `The nb_sync server status endpoint failed.\n${reason}`
        );
      });
  }
};

export default plugin;
