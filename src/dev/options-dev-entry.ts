import type { initializeOptions as InitializeOptions } from "../surfaces/options/controller.js";
import { bootstrapDevSurface } from "./dev-surface.js";

bootstrapDevSurface<{ initializeOptions: typeof InitializeOptions }>({
  navKey: "options",
  markupPath: "../../public/options.html",
  hotModulePath: "../surfaces/options/controller.js",
  loadModule: () => import("../surfaces/options/controller.js"),
  resolveInitializer: (module) => module.initializeOptions,
});
