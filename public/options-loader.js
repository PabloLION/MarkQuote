(async () => {
  const isExtensionContext = Boolean(globalThis.chrome?.runtime?.id);
  const modulePath = isExtensionContext ? "./options.js" : "/src/surfaces/options/main.ts";

  try {
    await import(modulePath);
  } catch (error) {
    console.error("Failed to boot options page.", error);

    const statusElement = document.getElementById("status");
    if (statusElement) {
      statusElement.textContent =
        "MarkQuote options failed to load. Refresh this tab or reopen the options page.";
      statusElement.setAttribute("role", "alert");
    } else {
      const fallback = document.createElement("p");
      fallback.textContent =
        "MarkQuote options failed to load. Refresh this tab or reopen the options page.";
      fallback.style.cssText =
        "margin:16px 0;padding:12px;border:1px solid #d93025;border-radius:8px;color:#d93025;font-weight:600;";
      document.body.prepend(fallback);
    }
  }
})();
