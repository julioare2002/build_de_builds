let allChampions = [];
let currentChampion = null;
let currentMode = "ranked";
let currentLine = "all";
let currentSearch = "";
let favoritesOnly = false;
const FAVORITES_STORAGE_KEY = "wildrift-builds-favorites-v1";
let favoriteChampionIds = loadFavoriteChampionIds();

function normalizeSearchText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

function loadFavoriteChampionIds() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]",
    );
    return new Set(
      Array.isArray(saved) ? saved.filter((id) => typeof id === "string") : [],
    );
  } catch (error) {
    console.warn("No se pudieron leer los favoritos guardados:", error);
    return new Set();
  }
}

function saveFavoriteChampionIds() {
  try {
    localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify([...favoriteChampionIds]),
    );
  } catch (error) {
    console.warn("No se pudieron guardar los favoritos:", error);
  }
}

function favoriteKey(champion) {
  return String(champion.id || champion.name)
    .trim()
    .toLocaleLowerCase("es");
}

const lineNames = {
  top: "Carril del Barón",
  jungle: "Jungla",
  mid: "Carril central",
  adc: "Carril del Dragón",
  support: "Soporte",
};

const purchaseSlots = [
  ["starting", "Inicio"],
  ["boots", "Botas"],
  ["core1", "Core 1"],
  ["core2", "Core 2"],
  ["core3", "Core 3"],
];

const get = (id) => document.getElementById(id);
const tabs = [...document.querySelectorAll('[role="tab"]')];
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const mobile = window.matchMedia("(max-width: 720px)");
const collator = new Intl.Collator("es", { sensitivity: "base" });

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function updateFavoriteButton(button, champion) {
  const isFavorite = favoriteChampionIds.has(favoriteKey(champion));
  const action = isFavorite
    ? "Quitar " + champion.name + " de favoritos"
    : "Agregar " + champion.name + " a favoritos";
  button.textContent = isFavorite ? "★" : "☆";
  button.setAttribute("aria-pressed", String(isFavorite));
  button.setAttribute("aria-label", action);
  button.title = action;
}

function toggleFavorite(champion, button) {
  const key = favoriteKey(champion);
  if (favoriteChampionIds.has(key)) favoriteChampionIds.delete(key);
  else favoriteChampionIds.add(key);

  saveFavoriteChampionIds();
  if (favoritesOnly) {
    updateChampionList();
    get("favoritesToggle").focus();
  } else {
    updateFavoriteButton(button, champion);
  }
}

function updateChampionList() {
  const term = normalizeSearchText(currentSearch.trim());
  const filtered = allChampions.filter((champion) =>
    (currentLine === "all" || champion.line === currentLine) &&
    (!term || normalizeSearchText(champion.name).includes(term)) &&
    (!favoritesOnly || favoriteChampionIds.has(favoriteKey(champion))),
  );
  const list = get("championsGrid");
  get("searchResults").textContent = filtered.length
    ? filtered.length + (filtered.length === 1 ? " campeón" : " campeones")
    : "No se encontraron campeones.";

  list.replaceChildren(...filtered.map((champion) => {
    const card = element("li", "", "champion-card");
    card.dataset.championId = champion.id;
    const select = element("button", "", "champion-select");
    select.type = "button";
    select.setAttribute("aria-controls", "championProfile");
    const image = element("img");
    image.src = champion.image;
    image.alt = "";
    image.width = 38;
    image.height = 38;
    image.loading = "lazy";
    select.append(image, element("span", champion.name));
    select.addEventListener("click", () => openChampion(champion));

    const favorite = element("button", "", "favorite-btn");
    favorite.type = "button";
    updateFavoriteButton(favorite, champion);
    favorite.addEventListener("click", () => toggleFavorite(champion, favorite));
    card.append(select, favorite);
    return card;
  }));
  markSelectedChampion();
}

function markSelectedChampion() {
  for (const card of get("championsGrid").children) {
    const selected = card.dataset.championId === currentChampion?.id;
    card.classList.toggle("is-current", selected);
    if (selected) card.firstElementChild.setAttribute("aria-current", "true");
    else card.firstElementChild.removeAttribute("aria-current");
  }
}

function setTab(activeTab, focus = false) {
  for (const tab of tabs) {
    const selected = tab === activeTab;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    get(tab.getAttribute("aria-controls")).hidden = !selected;
  }
  if (focus) activeTab.focus();
}

function renderChampion(champion) {
  currentChampion = champion;
  const profile = get("championProfile");
  for (const details of profile.querySelectorAll("details[open]")) details.open = false;
  get("championImage").src = champion.image;
  get("championName").textContent = champion.name;
  get("championRole").textContent = [lineNames[champion.line], champion.role].filter(Boolean).join(" · ");
  get("championDifficulty").textContent = champion.difficulty ? "Dificultad " + champion.difficulty.toLocaleLowerCase("es") : "";
  renderBuild();
  renderTactics(champion.tactics);
  markSelectedChampion();
  profile.hidden = false;
}

let catalogScroll = 0;

function openChampion(champion) {
  if (mobile.matches) catalogScroll = window.scrollY;
  if (currentChampion !== champion) {
    setTab(tabs[0]);
    renderChampion(champion);
  }
  get("layout").classList.add("show-profile");
  window.scrollTo(0, 0);
  if (mobile.matches) get("championName").focus({ preventScroll: true });
}

function backToCatalog() {
  get("layout").classList.remove("show-profile");
  const card = [...get("championsGrid").children].find((entry) => entry.dataset.championId === currentChampion?.id);
  const target = card?.firstElementChild || get("championSearch");
  window.scrollTo(0, catalogScroll);
  target.focus({ preventScroll: true });
}

function detailRow(name, fields, { slot, context } = {}) {
  const row = element("details", "", slot ? "item-row purchase-row" : "item-row");
  const summary = element("summary");
  const label = element("span", name, "item-title");
  const lead = element("span", "", "item-lead");
  if (context) lead.append(element("span", context, "item-situation"));
  lead.append(label);
  if (slot) summary.append(element("span", slot, "slot-label"));
  summary.append(lead);

  const body = element("dl", "", "detail-body");
  for (const [heading, value] of fields) {
    if (!value) continue;
    const field = element("div");
    field.append(element("dt", heading), element("dd", value));
    body.append(field);
  }
  row.append(summary, body);
  return row;
}

function itemRow(item, { slot, situational = false } = {}) {
  if (!item) {
    const message = element("p", (slot ? slot + " · " : "") + "Sin datos de compra", "secondary");
    return message;
  }
  return detailRow(item.name_es || item.name_en, [
    ["Por qué funciona", item.reason],
    ["Efecto", item.description],
    ["Estadísticas", item.stats],
    ["Costo", item.cost ? item.cost + " oro" : ""],
    ["Nombre en inglés", item.name_es !== item.name_en ? item.name_en : ""],
    ["Situación", situational ? "" : item.situation],
  ], { slot, context: situational ? item.situation : "" });
}

function sourceLink(label, url) {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
  const link = element("a", label);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function renderBuild() {
  if (!currentChampion) return;
  const build = currentChampion.builds?.[currentMode];
  const purchase = get("purchaseList");
  const runes = get("runesGrid");
  const situational = get("situationalGrid");
  const extras = get("buildExtras");
  purchase.replaceChildren();
  runes.replaceChildren();
  situational.replaceChildren();
  extras.replaceChildren();
  extras.hidden = true;
  if (!build) {
    purchase.append(element("p", "Todavía no hay una build para este modo.", "secondary"));
    for (const list of [runes, situational]) list.closest("details").hidden = true;
    return;
  }

  purchase.append(...purchaseSlots.map(([key, label]) => itemRow(build[key], { slot: label })));
  for (const rune of build.runes || []) {
    runes.append(detailRow(rune.name_es || rune.name_en, [
      ["Por qué funciona", rune.reason],
      ["Efecto", rune.description],
      ["Nombre en inglés", rune.name_es !== rune.name_en ? rune.name_en : ""],
    ]));
  }
  for (const item of build.situational || []) {
    situational.append(itemRow(item, { situational: true }));
  }
  for (const list of [runes, situational]) {
    const disclosure = list.closest("details");
    disclosure.hidden = !list.childElementCount;
  }

  if (build.spells?.length) extras.append(element("p", "Hechizos · " + build.spells.join(" + ")));
  if (build.skill_priority?.length) extras.append(element("p", "Prioridad de habilidades · " + build.skill_priority.join(" → ")));
  const link = sourceLink("Fuente de esta build", build.source);
  if (link) extras.append(link);
  extras.hidden = !extras.childElementCount;
}

function renderCombo(combo, notation) {
  const entry = element("article", "", "combo-entry");
  const sequence = Array.isArray(combo.sequence) ? combo.sequence : [];
  const prefix = sequence.join(" + ") + " · ";
  const name = sequence.length && combo.name?.startsWith(prefix) ? combo.name.slice(prefix.length) : combo.name;
  if (name) entry.append(element("h4", name));
  if (sequence.length) {
    const keys = element("p", "", "combo-sequence");
    for (const [index, key] of sequence.entries()) {
      if (index > 0) keys.append(element("span", "+"));
      keys.append(element("kbd", key));
    }
    entry.append(keys);
  }
  const use = typeof combo.use === "string" && notation && combo.use.endsWith(notation)
    ? combo.use.slice(0, -notation.length).trimEnd()
    : combo.use;
  if (use) entry.append(element("p", use, "combo-use"));
  if (combo.steps?.length) {
    const details = element("details", "", "combo-steps");
    const steps = element("ol");
    for (const step of combo.steps) steps.append(element("li", step));
    details.append(element("summary", "Ver paso a paso"), steps);
    entry.append(details);
  }
  return entry;
}

function renderChampionRelationship(entry) {
  const name = typeof entry === "string" ? entry : entry?.champion;
  if (typeof name !== "string" || !name.trim()) return null;

  const row = element("li");
  row.append(element("strong", name.trim()));
  const reason = entry?.reason;
  if (typeof reason === "string" && reason.trim()) {
    row.append(document.createTextNode(" · " + reason.trim()));
  }
  return row;
}

function renderTactics(data) {
  const comboList = get("comboContent");
  const notation = get("comboNotation");
  const status = get("tacticalStatus");
  const phases = get("strategyList");
  comboList.replaceChildren();
  phases.replaceChildren();

  notation.textContent = data?.combo_notation || "";
  notation.hidden = !notation.textContent;
  const combos = data?.combos || [];
  if (combos.length) {
    comboList.append(...combos.map((combo) => renderCombo(combo, notation.textContent)));
  } else {
    comboList.append(element("p", "La ficha aún no tiene combos.", "secondary"));
  }

  for (const step of data?.strategy || []) {
    const row = element("li");
    row.append(element("strong", step.phase), element("p", step.advice));
    phases.append(row);
  }
  status.textContent = data?.patch ? "Ficha táctica · Parche " + data.patch : "El plan de partida está pendiente.";
  status.hidden = false;

  const sections = [
    ["strengthsList", data?.strengths, (item) => element("li", item)],
    ["weaknessesList", data?.weaknesses, (item) => element("li", item)],
    ["synergiesList", data?.synergies, renderChampionRelationship],
    ["matchupsList", data?.matchups, renderChampionRelationship],
    ["tacticalSources", data?.sources, (item) => {
      const row = element("li");
      row.append(sourceLink(item.name, item.url) || element("span", item.name));
      if (item.type) row.append(document.createTextNode(" · " + item.type));
      return row;
    }],
  ];
  for (const [id, items, render] of sections) {
    const list = get(id);
    list.replaceChildren(...(items || []).map(render).filter(Boolean));
    list.closest("details").hidden = !list.childElementCount;
  }
}

function useData(data) {
  if (!Array.isArray(data.champions) || !data.champions.length ||
      data.champions.some((champion) =>
        !champion || typeof champion.id !== "string" || typeof champion.name !== "string" || !champion.builds,
      )) {
    throw new Error("Archivo de campeones inválido");
  }
  allChampions = [...data.champions].sort((a, b) => collator.compare(a.name, b.name));
  const patch = data.patch || allChampions.find((champion) => champion.tactics?.patch)?.tactics.patch;
  const label = get("patch");
  label.textContent = patch || "";
  label.hidden = !patch;
  get("localData").hidden = true;
  updateChampionList();
  renderChampion(allChampions.find((champion) => champion.id === "sylas") || allChampions[0]);
}

async function loadChampions() {
  if (window.location.protocol === "file:") {
    get("searchResults").textContent = "Carga los datos para abrir el catálogo.";
    get("localData").hidden = false;
    return;
  }
  try {
    const response = await fetch("champions.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    useData(await response.json());
  } catch (error) {
    console.error(error);
    get("searchResults").textContent = "No se pudieron cargar los campeones.";
    get("localData").hidden = false;
  }
}

get("dataFile").addEventListener("change", async (event) => {
  const [file] = event.currentTarget.files;
  if (!file) return;
  try {
    useData(JSON.parse(await file.text()));
  } catch (error) {
    console.error(error);
    get("searchResults").textContent = "No se pudo leer el archivo. Selecciona el champions.json del proyecto.";
    get("dataFile").value = "";
  }
});

get("championSearch").addEventListener("input", (event) => {
  currentSearch = event.currentTarget.value;
  if (allChampions.length) updateChampionList();
});

get("lineFilter").addEventListener("change", (event) => {
  currentLine = event.currentTarget.value;
  if (allChampions.length) updateChampionList();
});

get("favoritesToggle").addEventListener("click", (event) => {
  favoritesOnly = !favoritesOnly;
  event.currentTarget.setAttribute("aria-pressed", String(favoritesOnly));
  if (allChampions.length) updateChampionList();
});

get("backToChampions").addEventListener("click", backToCatalog);
for (const [index, tab] of tabs.entries()) {
  tab.addEventListener("click", () => setTab(tab));
  tab.addEventListener("keydown", (event) => {
    const targets = {
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!Object.hasOwn(targets, event.key)) return;
    event.preventDefault();
    setTab(tabs[targets[event.key]], true);
  });
}

for (const button of modeButtons) {
  button.addEventListener("click", () => {
    if (currentMode === button.dataset.mode) return;
    currentMode = button.dataset.mode;
    for (const mode of modeButtons) mode.setAttribute("aria-pressed", String(mode === button));
    renderBuild();
  });
}

loadChampions();

