import type { initializePopup as InitializePopup } from '../popup.js';
import { bootstrapDevSurface } from './dev-surface.js';

bootstrapDevSurface<{ initializePopup: typeof InitializePopup }>({
  navKey: 'popup',
  markupPath: '../../public/popup.html',
  hotModulePath: '../popup.js',
  loadModule: () => import('../popup.js'),
  resolveInitializer: (module) => module.initializePopup,
});
