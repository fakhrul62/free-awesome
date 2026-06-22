const iconNamesByCategory = window.ICON_MANIFEST || {};
const categories = Object.keys(iconNamesByCategory).sort((a, b) => a.localeCompare(b));
const categoryIcons = new Map(
  categories.map((category) => [
    category,
    iconNamesByCategory[category].map((name) => ({
      name,
      category,
      path: `freeawesome/${category}/${name}.svg`,
    })),
  ]),
);
const icons = categories.flatMap((category) => categoryIcons.get(category));
const batchSize = 120;

const state = {
  category: "all",
  query: "",
  visible: batchSize,
  filtered: icons,
  selected: null,
  svgText: "",
  selectionRequest: 0,
};

const els = {
  totalCount: document.querySelector("#totalCount"),
  categoryCount: document.querySelector("#categoryCount"),
  searchInput: document.querySelector("#searchInput"),
  tabs: document.querySelector("#tabs"),
  resultCount: document.querySelector("#resultCount"),
  activeCategory: document.querySelector("#activeCategory"),
  iconGrid: document.querySelector("#iconGrid"),
  iconScroll: document.querySelector("#iconScroll"),
  loadMore: document.querySelector("#loadMore"),
  emptyState: document.querySelector("#emptyState"),
  previewBox: document.querySelector("#previewBox"),
  selectedName: document.querySelector("#selectedName"),
  selectedPath: document.querySelector("#selectedPath"),
  iconColor: document.querySelector("#iconColor"),
  exportSize: document.querySelector("#exportSize"),
  paddingRange: document.querySelector("#paddingRange"),
  downloadSvg: document.querySelector("#downloadSvg"),
  downloadPng: document.querySelector("#downloadPng"),
  downloadWebp: document.querySelector("#downloadWebp"),
  copySvg: document.querySelector("#copySvg"),
  copyStatus: document.querySelector("#copyStatus"),
};

const categoryLabels = new Map([["all", "All"]]);
categories.forEach((category) => {
  categoryLabels.set(category, toTitle(category));
});

function toTitle(value) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function prettyName(name) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function debounce(fn, wait = 120) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

function init() {
  els.totalCount.textContent = `${icons.length.toLocaleString()} icons`;
  els.categoryCount.textContent = `${categories.length} styles`;
  renderTabs();
  bindEvents();
  applyFilters();

  if (icons.length) {
    selectIcon(icons.find((icon) => icon.name === "heart" && icon.category === "regular") || icons[0]);
  }
}

function bindEvents() {
  els.searchInput.addEventListener(
    "input",
    debounce((event) => {
      state.query = normalize(event.target.value);
      state.visible = batchSize;
      applyFilters();
    }),
  );

  els.loadMore.addEventListener("click", () => {
    state.visible += batchSize;
    renderGrid();
  });

  els.iconColor.addEventListener("input", refreshPreview);
  els.paddingRange.addEventListener("input", refreshPreview);
  els.downloadSvg.addEventListener("click", () => downloadSvg());
  els.downloadPng.addEventListener("click", () => downloadRaster("image/png", "png"));
  els.downloadWebp.addEventListener("click", () => downloadRaster("image/webp", "webp"));
  els.copySvg.addEventListener("click", copySvgCode);
}

function renderTabs() {
  const tabs = ["all", ...categories];
  els.tabs.replaceChildren(
    ...tabs.map((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.role = "tab";
      button.textContent = categoryLabels.get(category);
      button.setAttribute("aria-selected", String(category === state.category));
      button.addEventListener("click", () => {
        state.category = category;
        state.visible = batchSize;
        [...els.tabs.children].forEach((tab) => {
          tab.setAttribute("aria-selected", String(tab === button));
        });
        applyFilters();
      });
      return button;
    }),
  );
}

function applyFilters() {
  const query = state.query;
  const candidates = state.category === "all" ? icons : categoryIcons.get(state.category) || [];

  state.filtered = query ? candidates.filter((icon) => {
    const categoryMatch = state.category === "all" || icon.category === state.category;
    if (!categoryMatch) return false;
    return `${icon.name} ${icon.category}`.includes(query.replaceAll(" ", "-")) || normalize(`${icon.name} ${icon.category}`).includes(query);
  }) : candidates;

  els.iconScroll.scrollTop = 0;
  renderGrid();
}

function renderGrid() {
  const visibleIcons = state.filtered.slice(0, state.visible);
  const fragment = document.createDocumentFragment();

  visibleIcons.forEach((icon, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `icon-card${state.selected?.path === icon.path ? " is-active" : ""}`;
    button.title = `${prettyName(icon.name)} - ${categoryLabels.get(icon.category)}`;
    button.dataset.path = icon.path;
    button.setAttribute("aria-label", button.title);
    button.addEventListener("click", () => selectIcon(icon));

    const img = document.createElement("img");
    img.src = pathToUrl(icon.path);
    img.alt = "";
    img.loading = index < 24 ? "eager" : "lazy";
    img.fetchPriority = index < 12 ? "high" : "low";
    img.decoding = "async";
    img.width = 36;
    img.height = 36;

    const label = document.createElement("span");
    label.textContent = icon.name;

    button.append(img, label);
    fragment.append(button);
  });

  els.iconGrid.replaceChildren(fragment);
  els.resultCount.textContent = `${state.filtered.length.toLocaleString()} result${state.filtered.length === 1 ? "" : "s"}`;
  els.activeCategory.textContent = state.category === "all" ? "All categories" : categoryLabels.get(state.category);
  els.loadMore.hidden = state.visible >= state.filtered.length;
  els.emptyState.hidden = state.filtered.length > 0;
}

async function selectIcon(icon) {
  const requestId = ++state.selectionRequest;
  state.selected = icon;
  state.svgText = "";
  showCopyStatus("");
  els.selectedName.textContent = prettyName(icon.name);
  els.selectedPath.textContent = `${categoryLabels.get(icon.category)} / ${icon.name}.svg`;
  els.previewBox.innerHTML = "<span>Loading...</span>";
  setDownloadsEnabled(false);
  updateActiveCard();

  if (window.location.protocol === "file:") {
    showFileModePreview(icon);
    return;
  }

  try {
    const response = await fetch(pathToUrl(icon.path));
    if (!response.ok) throw new Error(`Could not load ${icon.path}`);
    const svgText = await response.text();
    if (requestId !== state.selectionRequest) return;
    state.svgText = svgText;
    refreshPreview();
    setDownloadsEnabled(true);
  } catch (error) {
    if (requestId !== state.selectionRequest) return;
    els.previewBox.innerHTML = '<span class="preview-message">Could not load icon. Open with start-icon-shelf.bat or http://127.0.0.1:5177/index.html</span>';
    console.error(error);
  }
}

function updateActiveCard() {
  [...els.iconGrid.children].forEach((card) => {
    card.classList.toggle("is-active", card.dataset.path === state.selected?.path);
  });
}

function pathToUrl(path) {
  return path.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function showFileModePreview(icon) {
  els.previewBox.style.padding = `${Number(els.paddingRange.value) / 4}%`;
  els.previewBox.innerHTML = "";

  const img = document.createElement("img");
  img.src = pathToUrl(icon.path);
  img.alt = prettyName(icon.name);
  img.className = "file-preview";

  const message = document.createElement("span");
  message.className = "preview-message";
  message.textContent = "Preview only in file mode. Use start-icon-shelf.bat for color edits and downloads.";

  els.previewBox.append(img, message);
}

function setDownloadsEnabled(enabled) {
  els.downloadSvg.disabled = !enabled;
  els.downloadPng.disabled = !enabled;
  els.downloadWebp.disabled = !enabled;
  els.copySvg.disabled = !enabled;
}

function editedSvg() {
  if (!state.svgText) return "";
  const color = els.iconColor.value;
  let svg = state.svgText
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s(width|height)="[^"]*"/g, "")
    .replace(/\s(fill|stroke)="(?!none)[^"]*"/g, "");

  svg = svg.replace("<svg", `<svg fill="${color}" color="${color}"`);
  return svg;
}

function refreshPreview() {
  if (!state.svgText) {
    if (state.selected && window.location.protocol === "file:") showFileModePreview(state.selected);
    return;
  }
  els.previewBox.style.padding = `${Number(els.paddingRange.value) / 4}%`;
  els.previewBox.innerHTML = editedSvg();
}

function downloadSvg() {
  if (!state.selected) return;
  const blob = new Blob([editedSvg()], { type: "image/svg+xml;charset=utf-8" });
  saveBlob(blob, exportName("svg"));
}

async function copySvgCode() {
  const svg = editedSvg();
  if (!svg) return;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(svg);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = svg;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) throw new Error("Clipboard copy was rejected");
    }
    showCopyStatus("SVG code copied!");
  } catch (error) {
    showCopyStatus("Could not copy SVG code.");
    console.error(error);
  }
}

function showCopyStatus(message) {
  els.copyStatus.textContent = message;
  window.clearTimeout(showCopyStatus.timer);
  if (message) {
    showCopyStatus.timer = window.setTimeout(() => {
      els.copyStatus.textContent = "";
    }, 2400);
  }
}

async function downloadRaster(mimeType, extension) {
  if (!state.selected) return;
  const size = Number(els.exportSize.value);
  const padding = Number(els.paddingRange.value);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  const svgBlob = new Blob([editedSvg()], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();

  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });

    const drawSize = Math.max(1, size - padding * 2);
    ctx.drawImage(img, padding, padding, drawSize, drawSize);
    canvas.toBlob((blob) => {
      if (blob) saveBlob(blob, exportName(extension));
    }, mimeType);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function exportName(extension) {
  const name = state.selected?.name || "icon";
  const category = state.selected?.category || "edited";
  return `${name}-${category}.${extension}`;
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

init();
