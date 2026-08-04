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
    name: "All Styles",
    categories: []
  },
  {
    id: "line",
    name: "Line Icons",
    categories: ["line"]
  },
  {
    id: "solid",
    name: "Solid Icons",
    categories: ["solid"]
  },
  {
    id: "duotone",
    name: "Duotone Icons",
    categories: ["duotone"]
  },
  {
    id: "bold",
    name: "Bold Icons",
    categories: ["bold"]
  },
  {
    id: "colored",
    name: "Colored Icons",
    categories: ["colored"]
  },
  {
    id: "misc",
    name: "Misc Icons",
    categories: ["misc"]
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
  colorModified: false,
  iconColors: [],
  isMultiColor: false,
};

const els = {
  totalCount: document.querySelector("#totalCount"),
  categoryCount: document.querySelector("#categoryCount"),
  searchInput: document.querySelector("#searchInput"),
  clearSearch: document.querySelector("#clearSearch"),
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
  colorControlsContainer: document.querySelector("#colorControlsContainer"),
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
  const cleanName = name.replace(/^\d+-/, "");
  return cleanName
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
  els.categoryCount.textContent = `${FAMILIES.length - 1} styles`;
  updateControlValues();
  renderTabs();
  bindEvents();
  applyFilters();

  if (icons.length) {
    selectIcon(icons.find((icon) => icon.name.includes("heart") && icon.category === "line") || icons[0]);
  }
}

function bindEvents() {
  const handleSearchInput = debounce((val) => {
    state.query = normalize(val);
    state.visible = batchSize;
    applyFilters();
  });

  els.searchInput.addEventListener("input", (event) => {
    const hasValue = Boolean(event.target.value);
    if (els.clearSearch) {
      els.clearSearch.hidden = !hasValue;
    }
    handleSearchInput(event.target.value);
  });

  if (els.clearSearch) {
    els.clearSearch.addEventListener("click", () => {
      els.searchInput.value = "";
      els.clearSearch.hidden = true;
      state.query = "";
      state.visible = batchSize;
      applyFilters();
      els.searchInput.focus();
    });
  }

  els.loadMore.addEventListener("click", () => {
    state.visible += batchSize;
    renderGrid();
  });

  const handleColorChange = (val) => {
    state.colorModified = true;
    const formatted = val.toUpperCase().replace("#", "");
    if (els.iconHex && els.iconHex.value.toUpperCase() !== formatted) {
      els.iconHex.value = formatted;
    }
    if (els.iconColor && els.iconColor.value.toUpperCase() !== `#${formatted}`) {
      els.iconColor.value = `#${formatted}`;
    }
    refreshPreview();
  };

  els.iconColor.addEventListener("input", (e) => {
    handleColorChange(e.target.value);
  });

  if (els.iconHex) {
    els.iconHex.addEventListener("input", (e) => {
      let val = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
      e.target.value = val.toUpperCase();
      if (val.length === 3 || val.length === 6) {
        let fullHex = val;
        if (val.length === 3) {
          fullHex = val.split("").map((c) => c + c).join("");
        }
        handleColorChange(`#${fullHex}`);
      }
    });

    els.iconHex.addEventListener("blur", () => {
      if (state.colorModified && els.iconColor) {
        const currentVal = els.iconColor.value.toUpperCase().replace("#", "");
        els.iconHex.value = currentVal;
      }
    });
  }
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
    return "All styles";
  }
  const family = FAMILIES.find((f) => f.id === state.family);
  return family ? family.name : "All styles";
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
    const cleanName = icon.name.replace(/^\d+-/, "");
    const searchTarget = normalize(`${cleanName} ${icon.name} ${icon.category}`);
    return searchTarget.includes(query) || `${cleanName} ${icon.name}`.toLowerCase().includes(query);
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
  state.colorModified = false;
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
    renderColorControls();
    refreshPreview();
    setDownloadsEnabled(true);
  } catch (error) {
    if (requestId !== state.selectionRequest) return;
    els.previewBox.innerHTML = '<span class="preview-message">Could not load icon. Open with start-icon-shelf.bat or http://127.0.0.1:5177/index.html</span>';
    console.error(error);
  }
}

function normalizeColorHex(col) {
  if (!col) return "";
  col = col.trim().toLowerCase();
  if (col === "none" || col === "currentcolor" || col === "transparent" || col === "#00000000" || col.startsWith("url(")) return "";
  if (col.startsWith("#")) {
    if (col.length === 4) {
      return ("#" + col[1] + col[1] + col[2] + col[2] + col[3] + col[3]).toUpperCase();
    }
    if (col.length === 7) return col.toUpperCase();
    if (col.length === 9) return col.slice(0, 7).toUpperCase();
  }
  const rgbMatch = col.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    const r = Number(rgbMatch[1]).toString(16).padStart(2, "0");
    const g = Number(rgbMatch[2]).toString(16).padStart(2, "0");
    const b = Number(rgbMatch[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`.toUpperCase();
  }
  return "";
}

function extractSvgColors(svgText) {
  if (!svgText) return [];
  const colorSet = new Set();

  const fillMatches = svgText.match(/fill=["']([^"']+)["']/gi) || [];
  fillMatches.forEach((m) => {
    const val = m.replace(/fill=["']/i, "").replace(/["']$/, "");
    const hex = normalizeColorHex(val);
    if (hex) colorSet.add(hex);
  });

  const strokeMatches = svgText.match(/stroke=["']([^"']+)["']/gi) || [];
  strokeMatches.forEach((m) => {
    const val = m.replace(/stroke=["']/i, "").replace(/["']$/, "");
    const hex = normalizeColorHex(val);
    if (hex) colorSet.add(hex);
  });

  const styleMatches = svgText.match(/style=["']([^"']+)["']/gi) || [];
  styleMatches.forEach((m) => {
    const styleStr = m.replace(/style=["']/i, "").replace(/["']$/, "");
    const subFills = styleStr.match(/fill\s*:\s*([^;"]+)/gi) || [];
    subFills.forEach((f) => {
      const val = f.replace(/fill\s*:\s*/i, "").trim();
      const hex = normalizeColorHex(val);
      if (hex) colorSet.add(hex);
    });
    const subStrokes = styleStr.match(/stroke\s*:\s*([^;"]+)/gi) || [];
    subStrokes.forEach((s) => {
      const val = s.replace(/stroke\s*:\s*/i, "").trim();
      const hex = normalizeColorHex(val);
      if (hex) colorSet.add(hex);
    });
  });

  const styleBlockMatches = svgText.match(/<style[\s\S]*?<\/style>/gi) || [];
  styleBlockMatches.forEach((block) => {
    const subFills = block.match(/fill\s*:\s*([^;}\s]+)/gi) || [];
    subFills.forEach((f) => {
      const val = f.replace(/fill\s*:\s*/i, "").trim();
      const hex = normalizeColorHex(val);
      if (hex) colorSet.add(hex);
    });
    const subStrokes = block.match(/stroke\s*:\s*([^;}\s]+)/gi) || [];
    subStrokes.forEach((s) => {
      const val = s.replace(/stroke\s*:\s*/i, "").trim();
      const hex = normalizeColorHex(val);
      if (hex) colorSet.add(hex);
    });
    const hexes = block.match(/#([0-9a-fA-F]{3,8})\b/g) || [];
    hexes.forEach((h) => {
      const hex = normalizeColorHex(h);
      if (hex) colorSet.add(hex);
    });
  });

  return Array.from(colorSet);
}

function renderColorControls() {
  if (!els.colorControlsContainer) return;

  const detectedColors = extractSvgColors(state.svgText);

  if (detectedColors.length > 1) {
    state.isMultiColor = true;
    state.iconColors = detectedColors.slice(0, 16).map((orig) => ({
      original: orig,
      current: orig,
    }));

    const container = document.createElement("div");
    container.className = "color-controls-wrapper multi-color-wrapper";

    const header = document.createElement("div");
    header.className = "color-controls-header";
    header.innerHTML = `
      <span class="color-label-text">Icon colors (${state.iconColors.length} layers)</span>
      <button type="button" class="reset-colors-btn" title="Reset to original colors">Reset</button>
    `;

    const resetBtn = header.querySelector(".reset-colors-btn");
    resetBtn.addEventListener("click", () => {
      state.iconColors.forEach((layer) => {
        layer.current = layer.original;
      });
      state.colorModified = false;
      renderColorControls();
      refreshPreview();
    });

    const palette = document.createElement("div");
    palette.className = "color-swatch-palette";

    state.iconColors.forEach((layer, index) => {
      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.className = "color-swatch-picker square-swatch";
      colorInput.value = layer.current;
      colorInput.title = `Layer ${index + 1} (${layer.current})`;

      colorInput.addEventListener("input", (e) => {
        state.colorModified = true;
        layer.current = e.target.value.toUpperCase();
        colorInput.title = `Layer ${index + 1} (${layer.current})`;
        refreshPreview();
      });

      palette.append(colorInput);
    });

    container.append(header, palette);
    els.colorControlsContainer.replaceChildren(container);
  } else {
    state.isMultiColor = false;
    let defaultColor = "#0F172A";
    if (detectedColors[0] && /^#[0-9A-F]{6}$/i.test(detectedColors[0])) {
      defaultColor = detectedColors[0];
    } else if (state.iconColors[0] && /^#[0-9A-F]{6}$/i.test(state.iconColors[0].current)) {
      defaultColor = state.iconColors[0].current;
    }
    state.iconColors = [{ original: defaultColor, current: defaultColor }];

    const wrapper = document.createElement("div");
    wrapper.className = "color-control-wrapper";

    const labelSpan = document.createElement("span");
    labelSpan.className = "color-label-text";
    labelSpan.textContent = "Icon color";

    const colorInput = document.createElement("input");
    colorInput.id = "iconColor";
    colorInput.type = "color";
    colorInput.className = "color-swatch-picker square-swatch";
    colorInput.value = defaultColor;
    colorInput.title = `Icon color (${defaultColor})`;

    colorInput.addEventListener("input", (e) => {
      state.colorModified = true;
      state.iconColors[0].current = e.target.value.toUpperCase();
      colorInput.title = `Icon color (${state.iconColors[0].current})`;
      refreshPreview();
    });

    wrapper.append(labelSpan, colorInput);
    els.iconColor = colorInput;
    els.colorControlsContainer.replaceChildren(wrapper);
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
  const weight = Number(els.strokeRange.value);

  const detectedColors = extractSvgColors(state.svgText);
  const isMultiColor = state.isMultiColor || detectedColors.length > 1 || (state.selected && state.selected.category === "colored");
  const primaryColor = state.iconColors[0] ? state.iconColors[0].current : "#0F172A";

  // Clean up BOM and comments from the whole SVG string
  let svg = state.svgText
    .replace(/^\uFEFF/, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  const match = svg.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/i);
  if (!match) return svg;

  let [, attributes, content] = match;

  // Remove width/height from root attributes
  attributes = attributes.replace(/\s(width|height)=["'][^"']*["']/g, "");

  const isStroke = state.svgText.includes("stroke=") && !state.svgText.includes('stroke="none"') && !state.svgText.includes("stroke='none'");

  if (state.colorModified) {
    if (isMultiColor) {
      // Multi-color mode: replace each original color with its updated current color
      state.iconColors.forEach(({ original, current }) => {
        if (original && current && original.toUpperCase() !== current.toUpperCase()) {
          const origEscaped = original.replace("#", "");
          const hexRegex = new RegExp(`(#${origEscaped})`, "gi");
          content = content.replace(hexRegex, current);
        }
      });
    } else {
      // Single-color mode: update inner elements to apply primaryColor across all fills and strokes
      attributes = attributes.replace(/\s(fill|stroke)=["'](?!none["'])[^"']*["']/g, "");
      content = content
        .replace(/\sfill=["'](?!none["']|transparent["']|#00000000["'])[^"']*["']/gi, ` fill="${primaryColor}"`)
        .replace(/\sstroke=["'](?!none["']|transparent["'])[^"']*["']/gi, ` stroke="${primaryColor}"`)
        .replace(/\sstyle=["']([^"']*)["']/gi, (fullMatch, styleContent) => {
          const updatedStyle = styleContent
            .replace(/fill\s*:\s*(?!none\b)[^;"]+/gi, `fill: ${primaryColor}`)
            .replace(/stroke\s*:\s*(?!none\b)[^;"]+/gi, `stroke: ${primaryColor}`);
          return ` style="${updatedStyle}"`;
        });
    }
  }

  let cleanAttrs = attributes;
  if (!cleanAttrs.includes("xmlns=")) {
    cleanAttrs = `xmlns="http://www.w3.org/2000/svg" ${cleanAttrs}`;
  }

  if (!weight) {
    let rootAttrs = cleanAttrs;
    if (state.colorModified && !isMultiColor) {
      const fillStrokeAttrs = isStroke ? `fill="none" stroke="${primaryColor}"` : `fill="${primaryColor}"`;
      rootAttrs = `${cleanAttrs} ${fillStrokeAttrs} color="${primaryColor}"`;
    }
    return `<svg ${rootAttrs} overflow="visible">${content}</svg>`;
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

  const floodColor = (state.colorModified && !isMultiColor) ? primaryColor : "currentColor";
  const fillStrokeAttrs = (state.colorModified && !isMultiColor) ? (isStroke ? `fill="none" stroke="${primaryColor}"` : `fill="${primaryColor}"`) : "";
  const rootAttrs = `${newAttrs} ${fillStrokeAttrs} overflow="visible"`;

  return `<svg ${rootAttrs}><defs>${originalDefs.join("")}<filter id="${filterId}" x="${formatNumber(filterX)}" y="${formatNumber(filterY)}" width="${formatNumber(filterW)}" height="${formatNumber(filterH)}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="${operator}" radius="${formatNumber(radius)}" result="morph" /><feFlood flood-color="${floodColor}" result="flood" /><feComposite in="flood" in2="morph" operator="in" result="filled" /></filter></defs><g filter="url(#${filterId})">${body}</g></svg>`;
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
  const svgText = editedSvg();
  if (!svgText) return;

  const size = Number(els.exportSize.value);
  const padding = Number(els.paddingRange.value);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  // Encode SVG as a clean Data URL so Image() loads cross-domain on live sites without CORS or Blob URL restrictions
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
  const img = new Image();
  img.crossOrigin = "anonymous";

  try {
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
      img.src = dataUrl;
    });

    const drawSize = Math.max(1, size - padding * 2);
    ctx.drawImage(img, padding, padding, drawSize, drawSize);

    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (blob) {
          saveBlob(blob, exportName(extension));
        } else {
          fallbackCanvasDownload(canvas, extension, mimeType);
        }
      }, mimeType);
    } else {
      fallbackCanvasDownload(canvas, extension, mimeType);
    }
  } catch (error) {
    console.error("Raster generation via Data URL failed, attempting Blob URL fallback...", error);
    try {
      const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const blobUrl = URL.createObjectURL(svgBlob);
      const img2 = new Image();
      await new Promise((resolve, reject) => {
        img2.onload = resolve;
        img2.onerror = reject;
        img2.src = blobUrl;
      });
      const drawSize = Math.max(1, size - padding * 2);
      ctx.drawImage(img2, padding, padding, drawSize, drawSize);
      URL.revokeObjectURL(blobUrl);
      fallbackCanvasDownload(canvas, extension, mimeType);
    } catch (fallbackErr) {
      console.error("Raster download failed:", fallbackErr);
    }
  }
}

function fallbackCanvasDownload(canvas, extension, mimeType) {
  try {
    const dataUrl = canvas.toDataURL(mimeType);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = exportName(extension);
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    console.error("DataURL download error:", e);
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
