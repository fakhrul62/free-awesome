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

const FAMILIES = [
  {
    id: "all",
    name: "All Libraries",
    categories: []
  },
  {
    id: "fa-classic",
    name: "Font Awesome Classic",
    categories: ["solid", "regular", "light", "thin", "duotone", "brands"],
    styleLabels: {
      "all": "All Styles",
      "solid": "Solid",
      "regular": "Regular",
      "light": "Light",
      "thin": "Thin",
      "duotone": "Duotone",
      "brands": "Brands"
    }
  },
  {
    id: "fa-sharp",
    name: "Font Awesome Sharp",
    categories: ["sharp-solid", "sharp-regular", "sharp-light", "sharp-thin"],
    styleLabels: {
      "all": "All Styles",
      "sharp-solid": "Solid",
      "sharp-regular": "Regular",
      "sharp-light": "Light",
      "sharp-thin": "Thin"
    }
  },
  {
    id: "material",
    name: "Material Design",
    categories: ["material", "material-design-icons"],
    styleLabels: {
      "all": "All Styles",
      "material": "Material Icons",
      "material-design-icons": "Design Icons"
    }
  },
  {
    id: "lucide",
    name: "Lucide",
    categories: ["lucide"]
  },
  {
    id: "feather",
    name: "Feather",
    categories: ["feather"]
  },
  {
    id: "ionicons",
    name: "Ionicons",
    categories: ["ionicons"]
  },
  {
    id: "octicons",
    name: "Octicons",
    categories: ["octicons"]
  },
  {
    id: "iconoir",
    name: "Iconoir",
    categories: ["iconoir"]
  }
];

const state = {
  family: "all",
  style: "all",
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
  familyTabs: document.querySelector("#familyTabs"),
  styleTabs: document.querySelector("#styleTabs"),
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
  strokeRange: document.querySelector("#strokeRange"),
  strokeValue: document.querySelector("#strokeValue"),
  paddingRange: document.querySelector("#paddingRange"),
  paddingValue: document.querySelector("#paddingValue"),
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
  els.categoryCount.textContent = `${FAMILIES.length - 1} libraries`;
  updateControlValues();
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
  els.strokeRange.addEventListener("input", refreshPreview);
  els.paddingRange.addEventListener("input", refreshPreview);
  els.downloadSvg.addEventListener("click", () => downloadSvg());
  els.downloadPng.addEventListener("click", () => downloadRaster("image/png", "png"));
  els.downloadWebp.addEventListener("click", () => downloadRaster("image/webp", "webp"));
  els.copySvg.addEventListener("click", copySvgCode);
}

function renderTabs() {
  els.familyTabs.replaceChildren(
    ...FAMILIES.map((family) => {
      const button = document.createElement("button");
      button.type = "button";
      button.role = "tab";
      button.textContent = family.name;
      button.setAttribute("aria-selected", String(family.id === state.family));
      button.addEventListener("click", () => {
        state.family = family.id;
        state.style = "all";
        state.visible = batchSize;
        [...els.familyTabs.children].forEach((tab) => {
          tab.setAttribute("aria-selected", String(tab === button));
        });
        renderStyleTabs(family);
        applyFilters();
      });
      return button;
    }),
  );

  const activeFamily = FAMILIES.find((f) => f.id === state.family);
  renderStyleTabs(activeFamily);
}

function renderStyleTabs(family) {
  if (!family || !family.styleLabels) {
    els.styleTabs.style.display = "none";
    els.styleTabs.innerHTML = "";
    return;
  }

  els.styleTabs.style.display = "flex";
  const styles = ["all", ...family.categories];
  els.styleTabs.replaceChildren(
    ...styles.map((style) => {
      const button = document.createElement("button");
      button.type = "button";
      button.role = "tab";
      button.textContent = family.styleLabels[style] || toTitle(style);
      button.setAttribute("aria-selected", String(style === state.style));
      button.addEventListener("click", () => {
        state.style = style;
        state.visible = batchSize;
        [...els.styleTabs.children].forEach((tab) => {
          tab.setAttribute("aria-selected", String(tab === button));
        });
        applyFilters();
      });
      return button;
    }),
  );
}

function getActiveLabel() {
  if (state.family === "all") {
    return "All libraries";
  }
  const family = FAMILIES.find((f) => f.id === state.family);
  if (!family) return "All libraries";
  if (!family.styleLabels || state.style === "all") {
    return family.name;
  }
  const styleLabel = family.styleLabels[state.style] || toTitle(state.style);
  return `${family.name} / ${styleLabel}`;
}

function applyFilters() {
  const query = state.query;
  let candidates = [];

  if (state.family === "all") {
    candidates = icons;
  } else {
    const family = FAMILIES.find((f) => f.id === state.family);
    if (family) {
      if (state.style === "all") {
        candidates = family.categories.flatMap((cat) => categoryIcons.get(cat) || []);
      } else {
        candidates = categoryIcons.get(state.style) || [];
      }
    } else {
      candidates = icons;
    }
  }

  state.filtered = query ? candidates.filter((icon) => {
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
  els.activeCategory.textContent = getActiveLabel();
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
  const weight = Number(els.strokeRange.value);

  // Clean up BOM and comments from the whole SVG string
  let svg = state.svgText
    .replace(/^\uFEFF/, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  const match = svg.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/i);
  if (!match) return svg;

  let [, attributes, content] = match;

  // Only remove width/height and non-none fill/stroke from the root svg attributes
  attributes = attributes
    .replace(/\s(width|height)=["'][^"']*["']/g, "")
    .replace(/\s(fill|stroke)=["'](?!none["'])[^"']*["']/g, "");

  const isStroke = state.svgText.includes("stroke=") && !state.svgText.includes('stroke="none"') && !state.svgText.includes("stroke='none'");
  const cleanAttrs = attributes.replace(/\s(fill|stroke)=["'][^"']*["']/g, "");

  if (!weight) {
    const fillStrokeAttrs = isStroke ? `fill="none" stroke="${color}"` : `fill="${color}"`;
    const rootAttrs = `${cleanAttrs} ${fillStrokeAttrs} color="${color}" overflow="visible"`;
    return `<svg${rootAttrs}>${content}</svg>`;
  }

  const viewBox = parseViewBox(cleanAttrs);
  const radius = Math.abs(weight) * (weight > 0 ? 0.35 : 0.5);
  const pad = Math.max(8, Math.ceil(radius * 4));
  const filterId = "icon-weight";
  const originalDefs = content.match(/<defs[\s\S]*?<\/defs>/gi) || [];
  const body = content.replace(/<defs[\s\S]*?<\/defs>/gi, "");
  const operator = weight > 0 ? "dilate" : "erode";

  let newAttrs = cleanAttrs;
  let filterX = viewBox.x - pad;
  let filterY = viewBox.y - pad;
  let filterW = viewBox.width + pad * 2;
  let filterH = viewBox.height + pad * 2;

  if (weight > 0) {
    const newX = viewBox.x - pad;
    const newY = viewBox.y - pad;
    const newW = viewBox.width + pad * 2;
    const newH = viewBox.height + pad * 2;
    const newViewBoxStr = `viewBox="${formatNumber(newX)} ${formatNumber(newY)} ${formatNumber(newW)} ${formatNumber(newH)}"`;
    
    if (cleanAttrs.match(/\bviewBox=["'][^"']*["']/i)) {
      newAttrs = cleanAttrs.replace(/\bviewBox=["'][^"']*["']/i, newViewBoxStr);
    } else {
      newAttrs = cleanAttrs + " " + newViewBoxStr;
    }
    filterX = newX;
    filterY = newY;
    filterW = newW;
    filterH = newH;
  }

  const fillStrokeAttrs = isStroke ? `fill="none" stroke="${color}"` : `fill="${color}"`;
  const rootAttrs = `${newAttrs} ${fillStrokeAttrs} color="${color}" overflow="visible"`;

  return `<svg${rootAttrs}><defs>${originalDefs.join("")}<filter id="${filterId}" x="${formatNumber(filterX)}" y="${formatNumber(filterY)}" width="${formatNumber(filterW)}" height="${formatNumber(filterH)}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="${operator}" radius="${formatNumber(radius)}" result="morph" /><feFlood flood-color="${color}" result="flood" /><feComposite in="flood" in2="morph" operator="in" result="filled" /></filter></defs><g filter="url(#${filterId})">${body}</g></svg>`;
}

function refreshPreview() {
  if (!state.svgText) {
    if (state.selected && window.location.protocol === "file:") showFileModePreview(state.selected);
    updateControlValues();
    return;
  }
  updateControlValues();
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

function updateControlValues() {
  els.strokeValue.textContent = formatWeight(Number(els.strokeRange.value));
  els.paddingValue.textContent = `${formatPx(Number(els.paddingRange.value))}`;
}

function formatWeight(value) {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : ""}${value}`;
}

function formatPx(value) {
  return `${Number.isInteger(value) ? value : value.toFixed(1).replace(/\.0$/, "")}px`;
}

function formatNumber(value) {
  return `${Number.isInteger(value) ? value : Number(value.toFixed(2))}`;
}

function parseViewBox(attributes) {
  const match = attributes.match(/\bviewBox="([^"]+)"/i);
  if (!match) return { x: 0, y: 0, width: 512, height: 512 };

  const parts = match[1]
    .trim()
    .split(/[\s,]+/)
    .map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return { x: 0, y: 0, width: 512, height: 512 };
  }

  return {
    x: parts[0],
    y: parts[1],
    width: parts[2],
    height: parts[3],
  };
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
