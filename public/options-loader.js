(async () => {
  const isExtensionContext = Boolean(globalThis.chrome?.runtime?.id);
  const modulePath = isExtensionContext ? "./options.js" : "/src/surfaces/options/entry.ts";

  try {
    await import(modulePath);
  } catch (error) {
    console.error("Failed to boot options page.", error);
  }
})();
