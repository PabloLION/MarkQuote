const loadModule = async () => {
  const isDev = window.location.hostname === "localhost" || window.location.port === "5173";

  if (isDev) {
    await import("/src/surfaces/popup/main.ts");
    return;
  }

  await import("./popup.js");
};

const renderBootstrapError = () => {
  const statusContainer = document.getElementById("message");
  const statusText = document.getElementById("message-text");
  const preview = document.getElementById("preview");

  if (statusContainer && statusText) {
    statusContainer.removeAttribute("hidden");
    statusContainer.dataset.label = "Error";
    statusContainer.dataset.variant = "warning";
    statusText.textContent =
      "MarkQuote failed to load. Reopen the popup or reload the extension to try again.";
  } else {
    const fallback = document.createElement("div");
    fallback.textContent =
      "MarkQuote failed to load. Reopen the popup or reload the extension to try again.";
    fallback.style.cssText =
      "padding:12px;margin:12px 0;border-radius:8px;border:1px solid #d93025;color:#d93025;font-weight:600;";
    document.body.prepend(fallback);
  }

  preview?.setAttribute("hidden", "true");
};

loadModule().catch((error) => {
  console.error("Unable to bootstrap popup entry", error);
  renderBootstrapError();
});
