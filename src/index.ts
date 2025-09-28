import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { INotebookTracker } from '@jupyterlab/notebook';
import { Cell } from '@jupyterlab/cells';
import { Widget } from '@lumino/widgets';

import { requestAPI } from './handler';

import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);


/**
 * User role storage
 */
let currentUserRole: 'teacher' | 'student' | null = null;

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

function addNBSyncToCell(cell: Cell): void {

  if (currentUserRole == 'teacher') {
    return;
  }

  if (cell.model && cell.model.type === 'code' && cell.model.metadata) {
    const metadata = cell.model.metadata as any;
    if (metadata['nb_sync_enabled'] === undefined) {
      metadata['nb_sync_enabled'] = false;
      console.log('Initialized nb_sync_enabled=false for code cell');
    }
  }
}

/**
 * Create role selection dialog
 */
function createRoleSelectionDialog(): void {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'nb-sync-role-overlay';

  // Create dialog
  const dialog = document.createElement('div');
  dialog.className = 'nb-sync-role-dialog';

  // Create title
  const title = document.createElement('h2');
  title.textContent = 'Choose Your Role';
  title.className = 'nb-sync-role-title';

  // Create subtitle
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Select how you want to use NB Sync in this session:';
  subtitle.className = 'nb-sync-role-subtitle';

  // Create teacher button
  const teacherButton = document.createElement('button');
  teacherButton.textContent = '👨‍🏫 Teacher';
  teacherButton.className = 'nb-sync-role-button nb-sync-teacher-button';
  teacherButton.addEventListener('click', () => {
    setUserRole('teacher');
    overlay.remove();
  });

  // Create student button
  const studentButton = document.createElement('button');
  studentButton.textContent = '👨‍🎓 Student';
  studentButton.className = 'nb-sync-role-button nb-sync-student-button';
  studentButton.addEventListener('click', () => {
    setUserRole('student');
    overlay.remove();
  });

  // Assemble dialog
  dialog.appendChild(title);
  dialog.appendChild(subtitle);
  dialog.appendChild(teacherButton);
  dialog.appendChild(studentButton);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
}

/**
 * Set user role and initialize appropriate features
 */
function setUserRole(role: 'teacher' | 'student'): void {
  currentUserRole = role;
  console.log(`User role set to: ${role}`);

  // Store role in localStorage for persistence
  localStorage.setItem('nb-sync-role', role);
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
 * Check for stored role preference
 */
function checkStoredRole(): boolean {
  const storedRole = localStorage.getItem('nb-sync-role') as 'teacher' | 'student' | null;
  console.log('Checking stored role:', storedRole);
  if (storedRole && (storedRole === 'teacher' || storedRole === 'student')) {
    console.log('Valid stored role found, setting role to:', storedRole);
    setUserRole(storedRole);
    return true;
  }
  console.log('No valid stored role found');
  return false;
}

/**
 * Add sync buttons to all existing cells
 */
let addSyncButtonsToAllCells: () => void;

/**
 * Mock cell IDs data
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
 * Mock code snippets mapped to cell IDs
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

  MOCK_CELL_IDS.forEach(cellId => {
    const option = document.createElement('div');
    option.className = 'nb-sync-dropdown-option';
    option.textContent = cellId;

    let previewElement: HTMLElement | null = null;

    // Add hover to show preview
    option.addEventListener('mouseenter', () => {
      // Check if preview already exists for this cell
      if (currentCell.node.querySelector('.nb-sync-code-preview')) {
        return;
      }

      // TODO: Replace with actual fetch request to backend
      // const code = await fetchCodeFromBackend(cellId);

      const code = MOCK_CODE_SNIPPETS[cellId] || '# No code available';
      previewElement = createCodePreview(currentCell, code);
    });

    // Remove preview on mouse leave
    option.addEventListener('mouseleave', () => {
      if (previewElement) {
        previewElement.remove();
        previewElement = null;
      }
    });

    // Click to replace cell content
    option.addEventListener('click', (e) => {
      console.log('Cell ID selected:', cellId);
      e.stopPropagation();

      // Remove any existing preview
      if (previewElement) {
        previewElement.remove();
        previewElement = null;
      }

      if (currentCell.model.type === 'code' && currentUserRole === 'student') {
        const metadata = currentCell.model.metadata as any;
        metadata['nb_sync_enabled'] = true;
        console.log('Cell marked as synced');
        const inputArea = currentCell.node.querySelector('.jp-InputArea-editor') as HTMLElement;
        if (inputArea) {
          inputArea.classList.add('nb-sync-synced');  
        }
      }

      // TODO: Replace with actual fetch request to backend
      // const code = await fetchCodeFromBackend(cellId);

      const code = MOCK_CODE_SNIPPETS[cellId] || '# No code available';
      replaceCellContent(currentCell, code);

      console.log('Replaced cell content with code from:', cellId);
      dropdown.remove();
    });

    dropdownContent.appendChild(option);
  });

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

function addButtonToNotebook(notebookTracker: INotebookTracker) {
  notebookTracker.widgetAdded.connect((_sender, notebookPanel) => {
    notebookPanel.revealed.then(() => {
      const button = document.createElement('div');
      button.className = 'nb-sync-panel-button';
      button.textContent = 'Stats';

      button.onclick = () => {
        console.log('Chart button clicked!');

          // If chart already exists, just toggle visibility
          let chartContainer = notebookPanel.node.querySelector('.nb-sync-chart-container') as HTMLElement;
          if (chartContainer) {
            chartContainer.style.display =
              chartContainer.style.display === 'none' ? 'block' : 'none';
            return;
          }

          // Create chart container
          chartContainer = document.createElement('div');
          chartContainer.className = 'nb-sync-chart-container';

          const canvas = document.createElement('canvas');
          chartContainer.appendChild(canvas);
          notebookPanel.node.appendChild(chartContainer);
          document.addEventListener('click', (event) => {
          if (
              chartContainer &&
              !chartContainer.contains(event.target as Node) &&
              event.target !== button
            ) {
              chartContainer.remove();
            }
          })
          const syncedCells = notebookPanel.node.querySelectorAll('.nb-sync-synced').length;
          const totalCodeCells = notebookPanel.node.querySelectorAll('.jp-CodeCell').length;
          const unsyncedCells = totalCodeCells - syncedCells;
          // Use Chart.js
          // @ts-ignore (if TS complains about Chart)
          new Chart(canvas.getContext('2d'), {
            type: 'pie',
            data: {
              labels: ['Synced', 'Unsynced'],
              datasets: [{
                label: 'Sync Status',
                data: [syncedCells, unsyncedCells], // 🔥 replace with real synced/unsynced count later
                backgroundColor: ['#4caf50', '#006effff']
              }]
            },
            options: {
              responsive: true,
              plugins: {
                legend: { position: 'bottom' }
              }
            }
          });
      };

      notebookPanel.node.appendChild(button);
    });
  });

  // Handle already open notebooks
  notebookTracker.forEach(notebookPanel => {
    notebookPanel.revealed.then(() => {
      const button = document.createElement('div');
      button.className = 'nb-sync-panel-button';
      button.textContent = 'Test Button';

      button.onclick = () => {
        console.log('Button clicked inside notebook panel!');
        alert('Button works in notebook panel!');
      };

      notebookPanel.node.appendChild(button);
    });
  });
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
    addButtonToNotebook(notebookTracker);
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

          addNBSyncToCell(cell);

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

          addNBSyncToCell(cell);

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

    // Check for stored role or show role selection dialog
    if (!checkStoredRole()) {
      // Show role selection dialog after a brief delay
      setTimeout(() => {
        createRoleSelectionDialog();
      }, 1000);
    } else {
      // If role was loaded from storage, ensure buttons are added
      if (currentUserRole === 'student') {
        setTimeout(() => {
          addSyncButtonsToAllCells();
        }, 500);
      }
    }

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

    requestAPI<any>('get-example')
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
