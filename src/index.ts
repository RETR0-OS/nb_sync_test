import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { INotebookTracker } from '@jupyterlab/notebook';
import { Cell } from '@jupyterlab/cells';
import { Widget } from '@lumino/widgets';

import { requestAPI, listHashKeys, getCellByHash, pushCellByHash } from './handler';
import { authService, UserRole } from './auth';

/**
 * User role storage (now managed by authService)
 */
let currentUserRole: UserRole | null = null;

/**
 * Teacher sync toggle state
 */
let syncEnabled = false;

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
 * Create authentication error dialog
 */
function createAuthErrorDialog(errorMessage: string): void {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'nb-sync-role-overlay';

  // Create dialog
  const dialog = document.createElement('div');
  dialog.className = 'nb-sync-role-dialog';

  // Create title
  const title = document.createElement('h2');
  title.textContent = 'Authentication Required';
  title.className = 'nb-sync-role-title';

  // Create error message
  const errorPara = document.createElement('p');
  errorPara.textContent = errorMessage;
  errorPara.className = 'nb-sync-role-subtitle';
  errorPara.style.color = '#d32f2f';

  // Create retry button
  const retryButton = document.createElement('button');
  retryButton.textContent = '🔄 Retry Authentication';
  retryButton.className = 'nb-sync-role-button nb-sync-teacher-button';
  retryButton.addEventListener('click', async () => {
    overlay.remove();
    await initializeAuthentication();
  });

  // Create info about role configuration
  const infoPara = document.createElement('p');
  infoPara.innerHTML = `
    <strong>Note:</strong> User roles are configured via environment variables:<br>
    • Set <code>JUPYTER_TEACHER_MODE=true</code> to enable teacher mode<br>
    • Or add user to <code>JUPYTER_TEACHER_USERS</code> list
  `;
  infoPara.className = 'nb-sync-role-subtitle';
  infoPara.style.fontSize = '0.9em';
  infoPara.style.color = '#666';

  // Assemble dialog
  dialog.appendChild(title);
  dialog.appendChild(errorPara);
  dialog.appendChild(retryButton);
  dialog.appendChild(infoPara);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
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
    const authResult = await authService.validateSession();

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
    const isAuthenticated = await checkAuthenticatedRole();

    if (isAuthenticated) {
      // Authentication successful, UI should already be initialized by setUserRole
      console.log('Authentication successful, UI initialized');
    } else {
      // Authentication failed, show error dialog
      const errorMessage = 'Could not authenticate with Jupyter session. Please check your session and role configuration.';
      createAuthErrorDialog(errorMessage);
    }
  } catch (error) {
    console.error('Authentication initialization failed:', error);
    const errorMessage = `Authentication error: ${error}`;
    createAuthErrorDialog(errorMessage);
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

    // TODO: Replace with actual fetch request to backend
    // const cellIds = await fetchCellIdsFromBackend();

    // Create and show dropdown with mock data
    const dropdown = createCellIdDropdown(button.node, cell);
    document.body.appendChild(dropdown);
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

    requestAPI<any>('notebook-sync')
      .then(data => {
        console.log(data);
      })
      .catch(reason => {
        console.error(
          `The nb_sync server extension appears to be missing.\n${reason}`
        );
      });
  }
};

export default plugin;
