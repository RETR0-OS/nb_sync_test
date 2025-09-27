import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { INotebookTracker } from '@jupyterlab/notebook';
import { Cell } from '@jupyterlab/cells';
import { Widget } from '@lumino/widgets';

import { requestAPI } from './handler';

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
 * Create dropdown menu with cell IDs
 */
function createCellIdDropdown(buttonElement: HTMLElement): HTMLElement {
  const dropdown = document.createElement('div');
  dropdown.className = 'nb-sync-dropdown';

  const dropdownContent = document.createElement('div');
  dropdownContent.className = 'nb-sync-dropdown-content';

  MOCK_CELL_IDS.forEach(cellId => {
    const option = document.createElement('div');
    option.className = 'nb-sync-dropdown-option';
    option.textContent = cellId;
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('Selected cell ID:', cellId);
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
 * Create a sync button widget
 */
function createSyncButton(): Widget {
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
    const dropdown = createCellIdDropdown(button.node);
    document.body.appendChild(dropdown);
  });

  return button;
}

/**
 * Add sync button to a cell
 */
function addSyncButtonToCell(cell: Cell): void {
  if (!cell.node.querySelector('.nb-sync-button')) {
    const syncButton = createSyncButton();

    // Create a container for the button positioned in top-right
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'nb-sync-button-container';
    buttonContainer.appendChild(syncButton.node);

    // Insert the button into the cell's input area
    const inputArea = cell.node.querySelector('.jp-Cell-inputArea');
    if (inputArea) {
      inputArea.appendChild(buttonContainer);
    }
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

    // Add sync buttons to existing and new cells
    notebookTracker.widgetAdded.connect((_sender, notebookPanel) => {
      const notebook = notebookPanel.content;

      // Add buttons to existing cells
      for (let i = 0; i < notebook.widgets.length; i++) {
        const cell = notebook.widgets[i];
        addSyncButtonToCell(cell);
      }

      // Add buttons to new cells as they are created
      notebook.model?.cells.changed.connect(() => {
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
        addSyncButtonToCell(cell);
      }
    });

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
