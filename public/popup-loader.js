const loadModule = async () => {
  const isDev = window.location.hostname === "localhost" || window.location.port === "5173";

  if (isDev) {
    await import("/src/popup-entry.ts");
    return;
  }

  await import("./popup.js");
};

loadModule().catch((error) => {
  console.error("Unable to bootstrap popup entry", error);
});
