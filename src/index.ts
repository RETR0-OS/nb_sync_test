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
 * Create a sync button widget
 */
function createSyncButton(): Widget {
  const button = new Widget({ node: document.createElement('button') });
  button.node.className = 'nb-sync-button';
  button.node.textContent = 'Sync';
  button.node.title = 'Sync this cell';

  // Add click handler (currently no functionality)
  button.node.addEventListener('click', () => {
    console.log('Sync button clicked (no functionality yet)');
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
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry | null
  ) => {
    console.log('JupyterLab extension nb_sync is activated!');

    // Add sync buttons to existing and new cells
    notebookTracker.widgetAdded.connect((sender, notebookPanel) => {
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
