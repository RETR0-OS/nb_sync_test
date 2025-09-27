import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { requestAPI } from './handler';

/**
 * Initialization data for the nb_sync extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'nb_sync:plugin',
  description: 'A JupyterLab extension for teaching',
  autoStart: true,
  optional: [ISettingRegistry],
  activate: (app: JupyterFrontEnd, settingRegistry: ISettingRegistry | null) => {
    console.log('JupyterLab extension nb_sync is activated!');

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
