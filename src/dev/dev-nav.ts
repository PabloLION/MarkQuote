type PageKey = "home" | "options" | "popup" | "popup-explorer";

type NavLink = {
  key: PageKey;
  label: string;
  href: string;
};

const links: NavLink[] = [
  { key: "home", label: "Overview", href: "/index.html" },
  { key: "options", label: "Options Page", href: "/options.html" },
  { key: "popup", label: "Popup", href: "/popup.html" },
  { key: "popup-explorer", label: "Popup Explorer", href: "/dev/popup.html" },
];

export function mountDevNav(active: PageKey) {
  const existing = document.getElementById("dev-nav");
  if (existing) {
    existing.remove();
  }

  const nav = document.createElement("nav");
  nav.id = "dev-nav";
  nav.innerHTML = `
    <style>
      #dev-nav {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 12px 16px;
        background: #202124;
        color: #fff;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      #dev-nav a {
        color: inherit;
        text-decoration: none;
        padding: 6px 10px;
        border-radius: 6px;
        transition: background 0.15s ease;
      }

      #dev-nav a[data-active="true"] {
        background: rgba(255, 255, 255, 0.18);
      }

      #dev-nav a:hover {
        background: rgba(255, 255, 255, 0.12);
      }

      #dev-nav span {
        opacity: 0.7;
        margin-left: auto;
        font-size: 0.85rem;
      }
    </style>
  `;

  links.forEach((link) => {
    const anchor = document.createElement("a");
    anchor.href = link.href;
    anchor.textContent = link.label;
    anchor.dataset.active = String(link.key === active);
    nav.appendChild(anchor);
  });

  const helperText = document.createElement("span");
  helperText.textContent = "Development preview with hot reload";
  nav.appendChild(helperText);

  document.body.prepend(nav);
}
