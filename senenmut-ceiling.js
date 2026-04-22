const zones = [
  { key: "south", label: "Southern decans and lower register", color: "#bb4d2d", x: 168, y: 1008, w: 2256, h: 244 },
  { key: "north", label: "Northern constellations", color: "#185d68", x: 928, y: 278, w: 1240, h: 612 },
  { key: "polar", label: "Polar group", color: "#537456", x: 910, y: 760, w: 670, h: 300 },
  { key: "milky", label: "Nut / Milky Way band", color: "#6b537e", x: 120, y: 112, w: 2350, h: 184 },
  { key: "disputed", label: "Disputed or alternate placements", color: "#c29234", x: 760, y: 420, w: 980, h: 680 }
];

const rawFigures = [
  ["SEN-001", "spdt", "Sopdet", "Sirius and companions", "high", "south", "southern_decans", 203, 1082, "Table 1; authors in total agreement."],
  ["SEN-002", "s3h", "Sah", "Parts of Orion; head at the Belt", "high", "south", "southern_decans", 320, 1080, "Table 1; total agreement."],
  ["SEN-003", "rt", "Jaw", "Hyades cluster with Aldebaran", "high", "south", "southern_decans", 452, 1082, "Table 1; total agreement."],
  ["SEN-004", "h3w", "Myriad or Flock", "Pleiades cluster", "high", "south", "southern_decans", 574, 1085, "Table 1; total agreement."],
  ["SEN-005", "kd", "The Circle or Sheepfold", "Head of Cetus", "probable", "south", "southern_decans", 696, 1087, "Table 1; close agreement."],
  ["SEN-006", "sb3 n s'r", "Star of Fire", "Capella", "probable", "south", "southern_decans", 813, 1087, "Table 1; close agreement."],
  ["SEN-007", "3pd", "The Bird", "Triangulum and Perseus", "high", "north", "northern_constellations", 1120, 356, "Table 1; total agreement; later discussion notes Bird follows Giant in star-charts."],
  ["SEN-008", "rryt", "The Two Jaws", "Cassiopeia", "probable", "north", "northern_constellations", 1183, 426, "Table 1; close agreement."],
  ["SEN-009", "nbt", "The Giant", "From Aquila to the Square of Pegasus", "probable", "north", "northern_constellations", 1074, 600, "Table 1; close agreement; related to later giant sequence debates."],
  ["SEN-010", "tms n hntt", "The Red of the Prow", "Antares", "probable", "south", "southern_decans", 928, 1090, "Table 1; close agreement."],
  ["SEN-011", "sb3w 's3w", "Many Stars", "Coma Berenices", "high", "north", "northern_constellations", 1290, 546, "Table 1; total agreement."],
  ["SEN-012", "rrt (3st d3mt)", "The Female Hippopotamus", "Large polar area from Lyra to Bootes", "high", "polar", "polar_group", 1418, 900, "Table 1; total agreement; central polar beast in the northern group."],
  ["SEN-013", "crocodile on back of rrt", "Crocodile on Hippopotamus", "Area of Serpens Caput", "probable", "polar", "polar_group", 1452, 790, "Table 1; close agreement."],
  ["SEN-014", "hn nfr", "Beautiful Child", "Spica", "probable", "south", "southern_decans", 1038, 1091, "Table 1; close agreement."],
  ["SEN-015", "mnit", "Mooring Post", "Area of Bootes including Arcturus", "probable", "polar", "polar_group", 1566, 918, "Table 1; close agreement."],
  ["SEN-016", "mshtyw", "The Bull's Foreleg", "The Plough (Ursa Major asterism)", "high", "polar", "polar_group", 1644, 848, "Table 1; total agreement."],
  ["SEN-017", "'nw", "Anu (avatar of Horus)", "From Lynx to Canes Venatici", "probable", "north", "northern_constellations", 1758, 830, "Table 1; close agreement."],
  ["SEN-018", "ipds", "Its Own Count or Bright Star", "Hadar (Beta Centauri)", "probable", "south", "southern_decans", 1662, 1091, "Table 1; close agreement."],
  ["SEN-019", "sbsšn", "Sage's Star", "Rigil Kent/Toliman (Alpha Centauri)", "probable", "south", "southern_decans", 1767, 1092, "Table 1; close agreement."],
  ["SEN-020", "wš3ty bk3ty", "Twins and Two Ladies", "Southern Cross", "probable", "south", "southern_decans", 1875, 1092, "Table 1; close agreement."],
  ["SEN-021", "43t", "The Ferryboat", "Area of Argo Navis", "probable", "south", "southern_decans", 2010, 1090, "Table 1; close agreement."],
  ["SEN-022", "htp rdwy", "Lying on His Feet", "Hydra", "high", "north", "northern_constellations", 1822, 660, "Table 1; total agreement."],
  ["SEN-023", "m3i / ntr rwty", "The Divine Lion", "Leo", "high", "north", "northern_constellations", 1428, 946, "Table 1; total agreement."],
  ["SEN-024", "b3kw n s3k", "The Plunderer", "Leo Minor", "probable", "north", "northern_constellations", 1916, 846, "Table 1; close agreement."],
  ["SEN-025", "sb3w nwmw", "Stars of Water", "Praesepe cluster (M44)", "probable", "north", "northern_constellations", 2075, 836, "Table 1; close agreement."]
];

const moreFigures = [
  ["SEN-026", "hpy sb3wy", "Predecessor of the Two Stars", "Alhena in Gemini", "probable", "north", "northern_constellations", 2223, 1089, "Table 1; close agreement."],
  ["SEN-027", "sb3wy", "Pair of Stars", "Castor and Pollux", "probable", "north", "northern_constellations", 2352, 1088, "Table 1; close agreement."],
  ["SEN-028", "stwy", "The Two Tortoises", "Procyon and Gomeisa", "probable", "south", "southern_decans", 1518, 1089, "Table 1; close agreement."],
  ["SEN-029", "knmt", "Cow?", "Canis Major and Puppis", "probable", "south", "southern_decans", 2235, 1078, "Table 1; close agreement."],
  ["SEN-030", "nwt", "The Goddess Nut", "Milky Way", "broad", "milky", "milky_way_band", 1290, 218, "Broad band-level identification rather than a single compact figure."],
  ["SEN-031", "standing man", "Standing man of celestial diagram", "Gemini (Lull) / identical with the Giant (Belmonte)", "disputed", "disputed", "disputed_features", 1025, 673, "Disputed identification; keep separate until exact placement is reconciled."],
  ["SEN-032", "triangular shape", "Triangular shape of celestial diagram", "Astronomical instrument like a gnomon (Lull) / alternative reading disputed", "disputed", "disputed", "disputed_features", 1056, 505, "Disputed feature in the celestial diagram."],
  ["SEN-033", "mnltwy", "The Mooring Posts", "One = Ramesside mnit (Lull) / posts handled differently by authors", "disputed", "polar", "polar_group", 1588, 1000, "Disputed or alternate handling of the mooring posts."],
  ["SEN-034", "Irkt", "Selkis goddess", "Ursa Minor (Lull) / Virgo (Belmonte)", "disputed", "disputed", "disputed_features", 875, 885, "Authors disagree on modern correlation."],
  ["SEN-035", "srt", "The Sheep/Goat", "Capricornus (Lull) / area of Grus (Belmonte)", "disputed", "south", "southern_decans", 1310, 1091, "Authors disagree on modern correlation."],
  ["SEN-036", "wỉ3", "The Boat", "Sagittarius and Scorpius (Lull) / Capricornus area (Belmonte)", "disputed", "south", "southern_decans", 1190, 1090, "Disputed boat placement and modern correlation."],
  ["SEN-037", "hty", "The Two Nets", "Between Sagittarius and Scorpius; Corona Australis nearby", "disputed", "south", "southern_decans", 2126, 1077, "Disputed feature in the southern register."],
  ["SEN-038", "hmwy", "Two Khanuwy Fishes", "Region of Alpha Scorpii / Sagittarius stars", "disputed", "south", "southern_decans", 2066, 1082, "Disputed feature in the southern register."],
  ["SEN-039", "tm3t", "The Wings", "Corvus and Crater (Lull) / area of Argo Navis (Belmonte)", "disputed", "south", "southern_decans", 1950, 1082, "Authors disagree on modern correlation."],
  ["SEN-040", "3hwy", "The Two Spirits", "Scheat and Markab in Square of Pegasus", "disputed", "south", "southern_decans", 748, 1090, "Disputed or alternate southern identification."],
  ["SEN-041", "b3wy", "The Two Souls", "Alpheratz and Algenib in the Square of Pegasus", "disputed", "south", "southern_decans", 888, 1090, "Disputed or alternate southern identification."],
  ["SEN-042", "bird near lion", "Bird near Lion group", "Leo Minor / Corvus / possibly not identical across sources", "disputed", "north", "northern_constellations", 1376, 872, "Ambiguous bird near the lion group."]
];

const figures = rawFigures.concat(moreFigures).map((row) => ({
  id: row[0],
  egyptian: row[1],
  label: row[2],
  modern: row[3],
  confidence: row[4],
  zone: row[5],
  layer: row[6],
  page: "383",
  x: row[7],
  y: row[8],
  notes: row[9]
}));

const stage = document.getElementById("stage");
const stageScroll = document.getElementById("stageScroll");
const search = document.getElementById("search");
const list = document.getElementById("figureList");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const calibrate = document.getElementById("calibrate");
const calibration = document.getElementById("calibration");
let activeFilter = "all";
let activeId = figures[0].id;

const zoneNames = {
  south: "Southern decans",
  north: "Northern constellations",
  polar: "Polar group",
  milky: "Milky Way band",
  disputed: "Disputed features"
};

const zoneColors = {
  south: "#bb4d2d",
  north: "#185d68",
  polar: "#537456",
  milky: "#6b537e",
  disputed: "#c29234"
};

function shortId(id) {
  return id.replace("SEN-", "");
}

function xPct(x) {
  return `${(x / 2678) * 100}%`;
}

function yPct(y) {
  return `${(y / 1589) * 100}%`;
}

function matchesFigure(figure) {
  const query = search.value.trim().toLowerCase();
  const filterMatch =
    activeFilter === "all" ||
    figure.zone === activeFilter ||
    (activeFilter === "disputed" && figure.confidence === "disputed");
  if (!query) return filterMatch;

  const haystack = [
    figure.id,
    figure.egyptian,
    figure.label,
    figure.modern,
    figure.confidence,
    figure.layer,
    figure.notes
  ].join(" ").toLowerCase();
  return filterMatch && haystack.includes(query);
}

function renderZones() {
  zones.forEach((zone) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "zone";
    el.dataset.zone = zone.key;
    el.style.setProperty("--zone-color", zone.color);
    el.style.left = xPct(zone.x);
    el.style.top = yPct(zone.y);
    el.style.width = xPct(zone.w);
    el.style.height = yPct(zone.h);
    el.innerHTML = `<span class="zone-label">${zone.label}</span>`;
    el.addEventListener("click", () => {
      activeFilter = zone.key === "milky" ? "all" : zone.key;
      updatePressedFilter();
      render();
    });
    stage.appendChild(el);
  });
}

function renderPins() {
  figures.forEach((figure) => {
    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = "pin";
    pin.dataset.id = figure.id;
    pin.dataset.short = shortId(figure.id);
    pin.title = `${figure.id}: ${figure.label}`;
    pin.style.left = xPct(figure.x);
    pin.style.top = yPct(figure.y);
    pin.style.setProperty("--pin-color", zoneColors[figure.zone] || zoneColors.disputed);
    pin.addEventListener("click", () => selectFigure(figure.id, true));
    stage.appendChild(pin);
  });
}

function renderList(visibleFigures) {
  list.innerHTML = "";
  visibleFigures.forEach((figure) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `figure-button ${figure.id === activeId ? "active" : ""}`;
    button.dataset.id = figure.id;
    button.innerHTML = `
      <span class="figure-id">${figure.id}</span>
      <span>
        <span class="figure-name">${figure.label}</span>
        <span class="figure-modern">${figure.modern}</span>
      </span>
    `;
    button.addEventListener("click", () => selectFigure(figure.id, true));
    list.appendChild(button);
  });
}

function renderDetail(figure) {
  document.getElementById("detailTitle").textContent = `${figure.id}: ${figure.label}`;
  document.getElementById("detailSubtitle").textContent = figure.modern;
  document.getElementById("egyptianName").textContent = figure.egyptian || "-";
  document.getElementById("modernId").textContent = figure.modern || "-";
  document.getElementById("zoneLabel").textContent = zoneNames[figure.zone] || figure.layer;
  document.getElementById("sourcePage").textContent = figure.page ? `p. ${figure.page}` : "-";
  document.getElementById("note").textContent = figure.notes;

  const badges = document.getElementById("badges");
  badges.innerHTML = `
    <span class="badge confidence-${figure.confidence}">${figure.confidence}</span>
    <span class="badge">${figure.layer.replaceAll("_", " ")}</span>
    <span class="badge">x ${figure.x}, y ${figure.y}</span>
  `;
}

function selectFigure(id, panToPin = false) {
  activeId = id;
  const figure = figures.find((item) => item.id === id) || figures[0];
  renderDetail(figure);

  document.querySelectorAll(".pin").forEach((pin) => {
    pin.classList.toggle("active", pin.dataset.id === id);
  });
  document.querySelectorAll(".figure-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.id === id);
  });

  if (panToPin) {
    const left = (figure.x / 2678) * stageScroll.scrollWidth;
    const top = (figure.y / 1589) * stageScroll.scrollHeight;
    stageScroll.scrollTo({
      left: Math.max(0, left - stageScroll.clientWidth / 2),
      top: Math.max(0, top - stageScroll.clientHeight / 2),
      behavior: "smooth"
    });
  }
}

function updatePressedFilter() {
  filterButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.filter === activeFilter));
  });
}

function render() {
  const visibleFigures = figures.filter(matchesFigure);
  document.getElementById("visibleCount").textContent = visibleFigures.length;
  document.getElementById("totalCount").textContent = figures.length;

  document.querySelectorAll(".pin").forEach((pin) => {
    const figure = figures.find((item) => item.id === pin.dataset.id);
    pin.classList.toggle("dimmed", !matchesFigure(figure));
  });

  document.querySelectorAll(".zone").forEach((zone) => {
    const isActive = activeFilter !== "all" && zone.dataset.zone === activeFilter;
    zone.classList.toggle("active", isActive);
  });

  renderList(visibleFigures);
  if (!visibleFigures.some((figure) => figure.id === activeId) && visibleFigures[0]) {
    activeId = visibleFigures[0].id;
  }
  if (visibleFigures.length) {
    selectFigure(activeId, false);
  }
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    updatePressedFilter();
    render();
  });
});

search.addEventListener("input", render);

calibrate.addEventListener("click", () => {
  const active = !stage.classList.contains("calibrating");
  stage.classList.toggle("calibrating", active);
  calibrate.setAttribute("aria-pressed", String(active));
});

stage.addEventListener("mousemove", (event) => {
  if (!stage.classList.contains("calibrating")) return;
  const rect = stage.getBoundingClientRect();
  const scaleX = 2678 / rect.width;
  const scaleY = 1589 / rect.height;
  const x = Math.round((event.clientX - rect.left) * scaleX);
  const y = Math.round((event.clientY - rect.top) * scaleY);
  calibration.textContent = `x: ${x}, y: ${y}`;
});

renderZones();
renderPins();
render();
