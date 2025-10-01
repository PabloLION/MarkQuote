import type { initializeOptions as InitializeOptions } from "../surfaces/options/page.js";
import { bootstrapDevSurface } from "./dev-surface.js";

bootstrapDevSurface<{ initializeOptions: typeof InitializeOptions }>({
  navKey: "options",
  markupPath: "../../public/options.html",
  hotModulePath: "../surfaces/options/page.js",
  loadModule: () => import("../surfaces/options/page.js"),
  resolveInitializer: (module) => module.initializeOptions,
});
