// Variables globales
let allChampions = [];
let currentChampion = null;
let currentMode = "ranked";
let currentLine = "all";
let currentSearch = "";

function normalizeSearchText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

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
    const card = document.createElement("button");
    card.className = "champion-card";
    card.type = "button";

    const image = document.createElement("img");
    image.src = champion.image;
    image.alt = "";
    image.loading = "lazy";

    const name = document.createElement("h3");
    name.textContent = champion.name;

    card.append(image, name);

    card.addEventListener("click", () => {
      selectChampion(champion);
    });

    grid.appendChild(card);
  });
}

function updateChampionList() {
  const search = normalizeSearchText(currentSearch.trim());
  const filtered = allChampions.filter((champion) => {
    const matchesLine = currentLine === "all" || champion.line === currentLine;
    const matchesSearch =
      !search || normalizeSearchText(champion.name).includes(search);
    return matchesLine && matchesSearch;
  });

  renderChampions(filtered);
}

// Filtrar campeones por línea
function filterChampionsByLine(line) {
  currentLine = line;
  updateChampionList();

  // Ocultar build display al cambiar de línea
  document.getElementById("buildDisplay").style.display = "none";
}

// Seleccionar campeón
function selectChampion(champion) {
  currentChampion = champion;

  // Actualizar información del campeón
  document.getElementById("championImage").src = champion.image;
  document.getElementById("championImage").alt = champion.name;
  document.getElementById("championName").textContent = champion.name;
  document.getElementById("championRole").textContent = champion.role;
  document.getElementById("championDifficulty").textContent =
    champion.difficulty;

  // Mostrar la sección de build
  document.getElementById("buildDisplay").style.display = "block";

  // Cargar items iniciales
  renderBuild();

  // Scroll suave hacia el build
  document
    .getElementById("buildDisplay")
    .scrollIntoView({ behavior: "smooth", block: "start" });
}

// Renderizar build completo
function renderBuild() {
  if (!currentChampion) return;

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
  if (item) {
    element.innerHTML = `
            <div class="item-name-main">${item.name_es}</div>
            <div class="item-name-alt">${item.name_en}</div>
            <div class="item-cost">${item.cost} oro</div>
        `;
    element.onclick = () => showItemModal(item);
  } else {
    element.innerHTML = '<p style="color: #666;">No disponible</p>';
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

    runeSlot.addEventListener("click", () => {
      showRuneModal(rune);
    });

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

    itemSlot.addEventListener("click", () => {
      showItemModal(item);
    });

    situationalGrid.appendChild(itemSlot);
  });
}

// Mostrar modal de item
function showItemModal(item) {
  const modal = document.getElementById("itemModal");

  document.getElementById("modalItemName").textContent = item.name_es;
  document.getElementById("modalItemNameEn").textContent = item.name_en;
  document.getElementById("modalItemDesc").textContent = item.description;
  document.getElementById("modalItemStats").textContent = item.stats;
  document.getElementById("modalItemCost").textContent = `${item.cost} oro`;
  document.getElementById("modalItemReason").textContent = item.reason;

  // Mostrar situación si existe
  const situationDetail = document.getElementById("situationDetail");
  if (item.situation) {
    document.getElementById("modalItemSituation").textContent = item.situation;
    situationDetail.style.display = "block";
  } else {
    situationDetail.style.display = "none";
  }

  modal.style.display = "flex";
}

// Mostrar modal de runa
function showRuneModal(rune) {
  const modal = document.getElementById("itemModal");

  document.getElementById("modalItemName").textContent = rune.name_es;
  document.getElementById("modalItemNameEn").textContent = rune.name_en;
  document.getElementById("modalItemDesc").textContent = rune.description;
  document.getElementById("modalItemStats").textContent = "Runa";
  document.getElementById("modalItemCost").textContent = "Gratis";
  document.getElementById("modalItemReason").textContent = rune.reason;

  // Ocultar situación para runas
  document.getElementById("situationDetail").style.display = "none";

  modal.style.display = "flex";
}

// Cerrar modal
function closeModal() {
  document.getElementById("itemModal").style.display = "none";
}

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

  document.getElementById("championSearch").addEventListener("input", (e) => {
    currentSearch = e.currentTarget.value;
    updateChampionList();
  });

  // Filtros de modo
  document.querySelectorAll(".mode-btn").forEach((btn) => {
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

  // Cerrar modal
  document.getElementById("closeModal").addEventListener("click", closeModal);

  // Cerrar modal al hacer click fuera
  document.getElementById("itemModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("itemModal")) {
      closeModal();
    }
  });
}

// Inicializar la aplicación
document.addEventListener("DOMContentLoaded", () => {
  loadChampions();
  setupFilters();
});
