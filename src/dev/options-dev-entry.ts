import type { initializeOptions as InitializeOptions } from "../options.js";
import { bootstrapDevSurface } from "./dev-surface.js";

bootstrapDevSurface<{ initializeOptions: typeof InitializeOptions }>({
  navKey: "options",
  markupPath: "../../public/options.html",
  hotModulePath: "../options.js",
  loadModule: () => import("../options.js"),
  resolveInitializer: (module) => module.initializeOptions,
});
