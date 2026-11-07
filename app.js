// Variables globales
let allChampions = [];
let currentChampion = null;
let currentMode = "ranked";
let currentLine = "all";
let currentSearch = "";
let favoritesOnly = false;
const FAVORITES_STORAGE_KEY = "wildrift-builds-favorites-v1";
let favoriteChampionIds = loadFavoriteChampionIds();

// Elementos que se despliegan
const UNFOLD_MS = 340;
let buildUnfold = null; // panel de build completo (se inserta bajo la fila del campeón)
let detailUnfold = null; // panel de detalles de ítem/runa (se inserta bajo la fila clickeada)
let activeChampionCard = null;
let activeDetailCard = null;

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

function updateFavoriteButton(button, champion) {
  const isFavorite = favoriteChampionIds.has(favoriteKey(champion));
  button.textContent = isFavorite ? "★" : "☆";
  button.setAttribute("aria-pressed", String(isFavorite));
  button.setAttribute(
    "aria-label",
    `${isFavorite ? "Quitar" : "Agregar"} ${champion.name} ${isFavorite ? "de" : "a"} favoritos`,
  );
  button.title = isFavorite ? "Quitar de favoritos" : "Agregar a favoritos";
}

function toggleFavorite(champion, button) {
  const key = favoriteKey(champion);
  if (favoriteChampionIds.has(key)) favoriteChampionIds.delete(key);
  else favoriteChampionIds.add(key);
  saveFavoriteChampionIds();
  updateFavoriteButton(button, champion);
  if (favoritesOnly) updateChampionList();
  const toggle = document.getElementById("favoritesToggle");
  if (toggle)
    toggle.textContent = `${favoritesOnly ? "★" : "☆"} Favoritos (${favoriteChampionIds.size})`;
}

/* =========================================================
   Utilidades de despliegue (acordeón)
   ========================================================= */

// Abre un contenedor .unfold con animación (debe estar ya en el DOM)
function openUnfold(el) {
  void el.offsetHeight; // fuerza reflow para que la animación arranque desde 0
  el.classList.add("open");
}

// Cierra un contenedor .unfold; al terminar la animación lo saca del DOM
function closeUnfold(el, immediate = false) {
  el.classList.remove("open");
  if (immediate) {
    el.remove();
    return;
  }
  setTimeout(() => {
    if (!el.classList.contains("open")) el.remove();
  }, UNFOLD_MS);
}

// Devuelve la última tarjeta de la fila donde está `card` dentro de `container`
function lastCardInRow(container, card) {
  const cards = [...container.children].filter(
    (child) => !child.classList.contains("unfold"),
  );
  const sameRow = cards.filter((child) => child.offsetTop === card.offsetTop);
  return sameRow[sameRow.length - 1] || card;
}

// Pone una tarjeta como accesible (teclado) y le asigna su acción de click
function makeInteractive(el, handler) {
  if (handler) {
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.setAttribute("aria-expanded", "false");
    el.onclick = handler;
    el.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handler();
      }
    };
  } else {
    el.removeAttribute("tabindex");
    el.removeAttribute("role");
    el.removeAttribute("aria-expanded");
    el.onclick = null;
    el.onkeydown = null;
  }
}

/* =========================================================
   Carga y lista de campeones
   ========================================================= */

// Cargar datos de campeones
async function loadChampions() {
  try {
    const response = await fetch("champions.json");
    const data = await response.json();
    allChampions = data.champions;
    updateChampionList();
  } catch (error) {
    console.error("Error al cargar los campeones:", error);
  }
}

// Renderizar la grilla de campeones
function renderChampions(champions) {
  const grid = document.getElementById("championsGrid");
  const searchResults = document.getElementById("searchResults");

  // Los paneles viven dentro de la grilla: se cierran antes de reconstruirla
  closeBuild(true);

  grid.innerHTML = "";

  if (champions.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "champion-empty";
    emptyState.textContent = "No se encontraron campeones.";
    grid.appendChild(emptyState);
    searchResults.textContent = "0 campeones";
    return;
  }

  searchResults.textContent = `${champions.length} ${
    champions.length === 1 ? "campeón" : "campeones"
  }`;

  champions.forEach((champion) => {
    const card = document.createElement("article");
    card.className = "champion-card";
    card.setAttribute("aria-expanded", "false");

    const selectButton = document.createElement("button");
    selectButton.className = "champion-select";
    selectButton.type = "button";
    selectButton.setAttribute("aria-label", `Ver build de ${champion.name}`);

    const image = document.createElement("img");
    image.src = champion.image;
    image.alt = "";
    image.loading = "lazy";

    const name = document.createElement("h3");
    name.textContent = champion.name;
    selectButton.append(image, name);

    const favoriteButton = document.createElement("button");
    favoriteButton.className = "favorite-btn";
    favoriteButton.type = "button";
    updateFavoriteButton(favoriteButton, champion);
    favoriteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavorite(champion, favoriteButton);
    });

    selectButton.addEventListener("click", () =>
      selectChampion(champion, card),
    );
    card.append(selectButton, favoriteButton);
    grid.appendChild(card);
  });
}

function updateChampionList() {
  const search = normalizeSearchText(currentSearch.trim());
  const filtered = allChampions.filter((champion) => {
    const matchesLine = currentLine === "all" || champion.line === currentLine;
    const matchesSearch =
      !search || normalizeSearchText(champion.name).includes(search);
    const matchesFavorites =
      !favoritesOnly || favoriteChampionIds.has(favoriteKey(champion));
    return matchesLine && matchesSearch && matchesFavorites;
  });

  renderChampions(filtered);
}

// Filtrar campeones por línea
function filterChampionsByLine(line) {
  currentLine = line;
  updateChampionList(); // esto también cierra el build abierto
}

/* =========================================================
   Build desplegable
   ========================================================= */

// Seleccionar campeón: el build se despliega justo debajo de su fila
function selectChampion(champion, card) {
  const grid = document.getElementById("championsGrid");

  // Segundo click sobre el mismo campeón = cerrar
  if (currentChampion === champion && buildUnfold.classList.contains("open")) {
    closeBuild();
    return;
  }

  // Limpiar estado anterior
  closeDetail(true);
  if (activeChampionCard) {
    activeChampionCard.classList.remove("is-active");
    activeChampionCard.setAttribute("aria-expanded", "false");
  }
  buildUnfold.classList.remove("open");
  buildUnfold.remove(); // así las posiciones de las tarjetas son las reales

  currentChampion = champion;
  activeChampionCard = card;
  card.classList.add("is-active");
  card.setAttribute("aria-expanded", "true");

  // Insertarlo primero en el DOM: renderBuild busca sus campos por ID
  // y getElementById no encuentra elementos dentro de un panel desconectado.
  lastCardInRow(grid, card).after(buildUnfold);

  // Actualizar información del campeón
  document.getElementById("championImage").src = champion.image;
  document.getElementById("championImage").alt = champion.name;
  document.getElementById("championName").textContent = champion.name;
  document.getElementById("championRole").textContent = champion.role;
  document.getElementById("championDifficulty").textContent =
    champion.difficulty;

  renderTactics(champion);
  renderBuild();
  openUnfold(buildUnfold);

  // Acercar la tarjeta al inicio de la pantalla para ver el panel debajo
  card.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeBuild(immediate = false) {
  closeDetail(true);
  closeUnfold(buildUnfold, immediate);
  if (activeChampionCard) {
    activeChampionCard.classList.remove("is-active");
    activeChampionCard.setAttribute("aria-expanded", "false");
    activeChampionCard = null;
  }
  currentChampion = null;
}

function renderTactics(champion) {
  const status = document.getElementById("tacticalStatus");
  const sourceLink = document.getElementById("tacticalSource");
  const data = champion.tactics;
  const fillList = (id, items, formatter = (item) => item) => {
    const list = document.getElementById(id);
    list.innerHTML = "";
    (items || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = formatter(item);
      list.appendChild(li);
    });
  };

  if (!data) {
    status.textContent =
      "Esta ficha táctica todavía no está verificada para este campeón. La build sigue disponible; no mostramos combos ni sinergias inferidos.";
    document.getElementById("comboContent").textContent =
      "Perfil táctico pendiente de investigación individual.";
    [
      "strengthsList",
      "weaknessesList",
      "strategyList",
      "synergiesList",
      "matchupsList",
    ].forEach((id) => fillList(id, []));
    sourceLink.hidden = true;
    return;
  }

  status.textContent = `Revisado para el parche ${data.patch}. Las recomendaciones de sinergia combinan fuente de guía y análisis del kit.`;
  const comboRoot = document.getElementById("comboContent");
  comboRoot.innerHTML = "";
  (data.combos || []).forEach((combo) => {
    const block = document.createElement("div");
    block.className = "combo-block";
    const title = document.createElement("h5");
    title.textContent = combo.name;
    const steps = document.createElement("ol");
    combo.steps.forEach((step) => {
      const li = document.createElement("li");
      li.textContent = step;
      steps.appendChild(li);
    });
    const use = document.createElement("p");
    use.textContent = combo.use;
    block.append(title, steps, use);
    comboRoot.appendChild(block);
  });
  fillList("strengthsList", data.strengths);
  fillList("weaknessesList", data.weaknesses);
  fillList(
    "strategyList",
    data.strategy,
    (item) => `${item.phase}: ${item.advice}`,
  );
  fillList(
    "synergiesList",
    data.synergies,
    (item) => `${item.champion}: ${item.reason}`,
  );
  fillList("matchupsList", data.matchups);
  if (data.sources?.length) {
    sourceLink.href = data.sources[0].url;
    sourceLink.textContent = "Ver fuentes de esta ficha ↗";
    sourceLink.hidden = false;
  } else sourceLink.hidden = true;
}

// Renderizar build completo
function renderBuild() {
  if (!currentChampion) return;

  closeDetail(true);

  const builds = currentChampion.builds[currentMode];

  // Renderizar items principales
  renderItemSlot("startingItem", builds.starting);
  renderItemSlot("bootsItem", builds.boots);
  renderItemSlot("core1Item", builds.core1);
  renderItemSlot("core2Item", builds.core2);
  renderItemSlot("core3Item", builds.core3);

  // Renderizar runas
  renderRunes(builds.runes);

  // Renderizar items situacionales
  renderSituationalItems(builds.situational);
}

// Renderizar un slot de item
function renderItemSlot(elementId, item) {
  const element = document.getElementById(elementId);
  const slot = element.closest(".item-slot");

  if (item) {
    element.innerHTML = `
            <div class="item-name-main">${item.name_es}</div>
            <div class="item-name-alt">${item.name_en}</div>
            <div class="item-cost">${item.cost} oro</div>
        `;
    makeInteractive(slot, () =>
      toggleDetail(slot, item.name_es, item.name_en, itemSections(item)),
    );
  } else {
    element.innerHTML = '<p style="color: #666;">No disponible</p>';
    makeInteractive(slot, null);
  }
}

// Renderizar runas
function renderRunes(runes) {
  const runesGrid = document.getElementById("runesGrid");
  runesGrid.innerHTML = "";

  runes.forEach((rune) => {
    const runeSlot = document.createElement("div");
    runeSlot.className = "rune-slot";
    runeSlot.innerHTML = `
            <div class="rune-name">${rune.name_es}</div>
            <div class="item-name-alt">${rune.name_en}</div>
        `;

    makeInteractive(runeSlot, () =>
      toggleDetail(runeSlot, rune.name_es, rune.name_en, runeSections(rune)),
    );

    runesGrid.appendChild(runeSlot);
  });
}

// Renderizar items situacionales
function renderSituationalItems(items) {
  const situationalGrid = document.getElementById("situationalGrid");
  situationalGrid.innerHTML = "";

  if (!items || items.length === 0) {
    situationalGrid.innerHTML =
      '<p style="color: #666; text-align: center; grid-column: 1/-1;">No hay items situacionales para este modo</p>';
    return;
  }

  items.forEach((item) => {
    const itemSlot = document.createElement("div");
    itemSlot.className = "item-slot-situational";
    itemSlot.innerHTML = `
            <div class="item-name-main">${item.name_es}</div>
            <div class="item-name-alt">${item.name_en}</div>
            <div class="item-situation">${item.situation}</div>
            <div class="item-cost">${item.cost} oro</div>
        `;

    makeInteractive(itemSlot, () =>
      toggleDetail(itemSlot, item.name_es, item.name_en, itemSections(item)),
    );

    situationalGrid.appendChild(itemSlot);
  });
}

/* =========================================================
   Detalles desplegables (reemplazan al modal)
   ========================================================= */

function itemSections(item) {
  const sections = [
    { label: "Descripción", text: item.description },
    { label: "Estadísticas", text: item.stats },
    { label: "Costo", text: `${item.cost} oro`, cls: "item-cost" },
    { label: "¿Por qué este item?", text: item.reason, cls: "item-reason" },
  ];
  if (item.situation) {
    sections.push({ label: "Situación", text: item.situation });
  }
  return sections.filter((section) => section.text);
}

function runeSections(rune) {
  return [
    { label: "Descripción", text: rune.description },
    { label: "¿Por qué esta runa?", text: rune.reason, cls: "item-reason" },
  ].filter((section) => section.text);
}

function createDetailUnfold() {
  const el = document.createElement("div");
  el.className = "unfold detail-unfold";
  el.innerHTML = `
    <div class="unfold-inner">
      <div class="unfold-pad">
        <div class="detail-panel" role="region" aria-live="polite">
          <button type="button" class="detail-close" aria-label="Cerrar detalles">&times;</button>
          <div class="detail-head">
            <p class="detail-title"></p>
            <p class="item-name-en"></p>
          </div>
          <div class="detail-body"></div>
        </div>
      </div>
    </div>`;

  el.querySelector(".detail-close").addEventListener("click", () => {
    const card = activeDetailCard;
    closeDetail();
    if (card) card.focus();
  });

  return el;
}

// Abre / cambia / cierra el detalle justo debajo de la fila de la tarjeta
function toggleDetail(card, nameEs, nameEn, sections) {
  const container = card.parentElement;

  // Segundo click sobre la misma tarjeta = cerrar
  if (activeDetailCard === card && detailUnfold.classList.contains("open")) {
    closeDetail();
    return;
  }

  const openHere =
    detailUnfold.classList.contains("open") &&
    detailUnfold.parentElement === container;

  if (openHere) {
    // Mismo grupo: solo cambia el contenido y se mueve, sin cerrar
    if (activeDetailCard) {
      activeDetailCard.classList.remove("is-active");
      activeDetailCard.setAttribute("aria-expanded", "false");
    }
  } else {
    closeDetail(true);
  }

  // Rellenar contenido
  detailUnfold.querySelector(".detail-title").textContent = nameEs;
  detailUnfold.querySelector(".item-name-en").textContent = nameEn || "";

  const body = detailUnfold.querySelector(".detail-body");
  body.innerHTML = "";
  sections.forEach((section) => {
    const block = document.createElement("div");
    block.className = "item-detail";

    const title = document.createElement("h4");
    title.textContent = section.label;

    const text = document.createElement("p");
    text.textContent = section.text;
    if (section.cls) text.className = section.cls;

    block.append(title, text);
    body.appendChild(block);
  });

  activeDetailCard = card;
  card.classList.add("is-active");
  card.setAttribute("aria-expanded", "true");

  lastCardInRow(container, card).after(detailUnfold);
  if (!openHere) openUnfold(detailUnfold);

  // Si el panel queda fuera de pantalla, acercarlo cuando termine de abrirse
  setTimeout(() => {
    if (detailUnfold.classList.contains("open")) {
      detailUnfold.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, UNFOLD_MS);
}

function closeDetail(immediate = false) {
  if (activeDetailCard) {
    activeDetailCard.classList.remove("is-active");
    activeDetailCard.setAttribute("aria-expanded", "false");
    activeDetailCard = null;
  }
  closeUnfold(detailUnfold, immediate);
}

// Reubicar los paneles abiertos si cambia el número de columnas (resize)
function repositionUnfolds() {
  const grid = document.getElementById("championsGrid");

  if (
    buildUnfold.classList.contains("open") &&
    activeChampionCard &&
    buildUnfold.parentElement === grid
  ) {
    const target = lastCardInRow(grid, activeChampionCard);
    if (target.nextElementSibling !== buildUnfold) target.after(buildUnfold);
  }

  if (detailUnfold.classList.contains("open") && activeDetailCard) {
    const container = activeDetailCard.parentElement;
    const target = lastCardInRow(container, activeDetailCard);
    if (target.nextElementSibling !== detailUnfold) target.after(detailUnfold);
  }
}

/* =========================================================
   Filtros y arranque
   ========================================================= */

// Configurar event listeners para filtros
function setupFilters() {
  // Filtros de línea
  document.querySelectorAll(".line-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".line-btn")
        .forEach((b) => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      filterChampionsByLine(e.currentTarget.dataset.line);
    });
  });

  const favoritesToggle = document.getElementById("favoritesToggle");
  favoritesToggle.textContent = `☆ Favoritos (${favoriteChampionIds.size})`;
  favoritesToggle.addEventListener("click", () => {
    favoritesOnly = !favoritesOnly;
    favoritesToggle.classList.toggle("active", favoritesOnly);
    favoritesToggle.setAttribute("aria-pressed", String(favoritesOnly));
    favoritesToggle.textContent = `${favoritesOnly ? "★" : "☆"} Favoritos (${favoriteChampionIds.size})`;
    updateChampionList();
  });

  document.getElementById("championSearch").addEventListener("input", (e) => {
    currentSearch = e.currentTarget.value;
    updateChampionList();
  });

  // El panel se desconecta del documento al iniciar; enlazar sus botones directamente
  buildUnfold.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".mode-btn")
        .forEach((b) => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      currentMode = e.currentTarget.dataset.mode;
      if (currentChampion) {
        renderBuild();
      }
    });
  });

  // Escape cierra el detalle abierto
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && activeDetailCard) {
      const card = activeDetailCard;
      closeDetail();
      card.focus();
    }
  });

  // Reubicar paneles si cambia el ancho de la ventana
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(repositionUnfolds, 150);
  });
}

// Inicializar la aplicación
document.addEventListener("DOMContentLoaded", () => {
  buildUnfold = document.getElementById("buildUnfold");
  buildUnfold.remove(); // arranca fuera de la página; se inserta al elegir campeón
  detailUnfold = createDetailUnfold();

  loadChampions();
  setupFilters();
});
