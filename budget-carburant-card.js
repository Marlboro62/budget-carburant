/**
 * budget-carburant-card — « Budget carburant »
 *
 * Carte Lovelace des pleins de carburant, voiture par voiture : kilomètres, consommation moyenne
 * et par carburant, litres, budget par plein, par jour, par mois et par année.
 *
 * Elle lit les événements « Plein <voiture> » d'un calendrier Home Assistant, écrits à chaque plein
 * par l'automatisation du tag NFC (voir packages/budget_carburant.yaml) :
 *   description « 42.5 L · E85 · 0.869 €/L · 36.93 € · 162000 km »
 *
 * type: custom:budget-carburant-card
 * calendar: calendar.home
 *
 * Style repris de la carte Enedis Linky New (content-card-linky-new), du même auteur.
 */

const CARD_VERSION = "1.0.0-beta.8";

/* ------------------------------------------------------------- affichage */

const fmt = (n, digits = 1) =>
  n === null || n === undefined
    ? "—"
    : Number(n).toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const euro = (n) =>
  n === null || n === undefined
    ? "—"
    : Number(n).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const TEMPO = {
  blue: { label: "Bleu", cls: "t-blue" },
  white: { label: "Blanc", cls: "t-white" },
  red: { label: "Rouge", cls: "t-red" },
};

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Couleur choisie (hc_color, hp_color) : "#1e88e5", [r, g, b], rgb()/hsl(), var(--x) ou nom CSS.
 *  null si absente ou invalide (la couleur par défaut s'applique). */
const cssColor = (value) => {
  if (Array.isArray(value)) {
    const n = value.map(Number);
    return n.length === 3 && n.every(Number.isFinite) ? `rgb(${n.map((v) => Math.max(0, Math.min(255, Math.round(v)))).join(", ")})` : null;
  }
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return v;
  if (/^(rgba?|hsla?)\([\d\s.,%/]+\)$/i.test(v) || /^var\(--[\w-]+\)$/.test(v) || /^[a-z]{3,20}$/i.test(v)) return v;
  return null;
};

/** Prix du kWh saisis dans la carte (hc_price + hp_price, ou base_price), en €/kWh ; null si non renseignés. */
const positivePrice = (v) => {
  const x = Number(typeof v === "string" ? v.replace(",", ".") : v);
  return Number.isFinite(x) && x > 0 ? x : null;
};
const manualPrices = (c) => {
  const n = positivePrice;
  const hc = n(c.hc_price), hp = n(c.hp_price), base = n(c.base_price);
  if (hc !== null && hp !== null) return { hc, hp, base };
  return base !== null ? { hc: null, hp: null, base } : null;
};
/** Coût d'un jour avec les prix saisis : HC et HP si connus, sinon prix Base sur le total. */
const manualCost = (d, p) => {
  if (p.hc !== null && d.hc !== null && d.hp !== null) return d.hc * p.hc + d.hp * p.hp;
  if (p.base !== null && d.total !== null) return d.total * p.base;
  return null;
};

/** Couleurs Tempo pour lesquelles on peut choisir des couleurs HC / HP propres (hc_blue_color … hp_red_color). */
const TEMPO_KEYS = ["blue", "white", "red"];
const hasTempoColors = (c) => TEMPO_KEYS.some((t) => cssColor(c[`hc_${t}_color`]) || cssColor(c[`hp_${t}_color`]));

/** Style à poser sur ha-card pour les couleurs HC / HP personnalisées (générales, puis par couleur Tempo).
 *  Le texte du détail mélange la couleur choisie avec celle du texte de la carte : même teinte,
 *  mais lisible même si la couleur est foncée. */
const hcHpStyle = (c) => {
  const vars = [];
  for (const t of ["", ...TEMPO_KEYS]) {
    for (const k of ["hc", "hp"]) {
      const col = cssColor(c[t ? `${k}_${t}_color` : `${k}_color`]);
      const v = t ? `--med-${k}-${t}` : `--med-${k}`;
      if (col) vars.push(`${v}: ${col}; ${v}-text: color-mix(in srgb, ${col} 65%, var(--med-text));`);
    }
  }
  const base = cssColor(c.base_color);
  if (base) vars.push(`--med-base: ${base};`);
  // Taille de la police : facteur appliqué à toutes les tailles en rem de la carte (100 % = taille d'origine)
  const fs = Number(c.font_size);
  if (Number.isFinite(fs) && fs >= 50 && fs <= 200 && fs !== 100) vars.push(`--fs: ${fs / 100};`);
  return vars.length ? ` style="${esc(vars.join(" "))}"` : "";
};

/** Conversions pour la roue de couleurs de l'éditeur (teinte 0-360, saturation et luminosité 0-1). */
const hsvToHex = (h, sat, val) => {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * (val - val * sat * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return "#" + [f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, "0")).join("");
};
const hexToHsv = (hex) => {
  let m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m && /^#?([0-9a-f]{3})$/i.test(hex || "")) m = [0, hex.replace("#", "").split("").map((x) => x + x).join("")];
  if (!m) return null;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
};
/** "#1e88e5", [r, g, b] ou "rgb(...)" -> "#rrggbb" (pour la roue), sinon null */
const toHex = (value) => {
  const col = cssColor(value);
  if (!col) return null;
  if (/^#[0-9a-f]{6}$/i.test(col)) return col.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(col)) return ("#" + col.slice(1).split("").map((x) => x + x).join("")).toLowerCase();
  const m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(col);
  return m ? "#" + m.slice(1, 4).map((x) => Math.min(255, Number(x)).toString(16).padStart(2, "0")).join("") : null;
};

/** Le capteur des jours Tempo restants porte l'un de ces deux noms selon l'installation :
 *  celui de la configuration d'abord, puis les deux noms connus. */
const TEMPO_INFO_IDS = (configured) =>
  [...new Set([configured, "sensor.edf_tempo_info", "sensor.edf_tempo_tempo_info", "sensor.myelectricaldata_tempo_info"].filter(Boolean))];

/** Noms possibles des entités de l'export Home Assistant : Home Assistant les nomme d'après l'appareil
 *  (sensor.rte_tempo_today) ou, depuis 2025.10, d'après l'identifiant suggéré (sensor.myelectricaldata_tempo_today). */
const ENTITY_ALIASES = {
  tempo_today: ["sensor.rte_tempo_today", "sensor.myelectricaldata_tempo_today"],
  tempo_tomorrow: ["sensor.rte_tempo_tomorrow", "sensor.myelectricaldata_tempo_tomorrow"],
  ecowatt: ["sensor.rte_ecowatt_j0", "sensor.myelectricaldata_ecowatt_j0"],
};
const PRICE_PREFIXES = ["sensor.edf_tempo_price_", "sensor.myelectricaldata_tempo_price_"];

/** Remplace une entité introuvable par son autre nom, s'il existe. L'éditeur visuel enregistre aussi les valeurs
 *  par défaut : seule l'existence de l'entité compte, une entité choisie qui existe n'est jamais remplacée. */
const withAliases = (config, hass) => {
  const states = hass?.states || {};
  const out = { ...config };
  for (const [key, ids] of Object.entries(ENTITY_ALIASES)) {
    if (key in out && !states[out[key]]) out[key] = ids.find((id) => states[id]) || out[key];
  }
  if ("price_prefix" in out && !states[`${out.price_prefix}blue_hc`]) {
    out.price_prefix = PRICE_PREFIXES.find((p) => states[`${p}blue_hc`]) || out.price_prefix;
  }
  return out;
};

/** Classe de thème de la carte :
 *  v2   : style MyElectricalData, toujours bleu nuit ;
 *  auto : style MyElectricalData, bleu nuit si Home Assistant est en mode sombre, clair sinon ;
 *  ha   : couleurs du thème Home Assistant (clair ou sombre). */
const themeClass = (theme, hass) => {
  const light = hass?.themes?.darkMode === false;
  if (theme === "ha") return `th-ha${light ? " light" : ""}`;
  if (theme === "auto") return `th-v2${light ? " light" : ""}`;
  return "th-v2";
};

/** Pleins de carburant notés au calendrier (un événement « Plein <voiture> » par plein, écrit par
 *  l'automatisation du tag NFC) : description « 42.5 L · E85 · 0.869 €/L · 36.93 € · 162000 km ». */
const FUEL_COLORS = { SP98: "#FF5252", SP95: "#40C4FF", E10: "#69F0AE", E85: "#FF9100", Gazole: "#FFD740", GPL: "#B388FF" };

const PLEINS_DEFAULTS = {
  title: "Budget carburant",
  calendar: "calendar.home",
  prefix: "Plein ",
  car: "",
  months: 6,
  history: 5,
  folded: true,
  theme: "v2",
  font_size: 100,
};

const PLEINS = {
  /** Un plein à partir d'un événement du calendrier, ou null s'il n'est pas lisible. */
  parse(ev, prefix) {
    const summary = String(ev.summary || "");
    if (!summary.toLowerCase().startsWith(prefix.toLowerCase())) return null;
    const car = summary.slice(prefix.length).trim();
    const d = String(ev.description || "").replace(/,/g, ".");
    const num = (re) => { const m = re.exec(d); return m ? Number(m[1]) : null; };
    const litres = num(/([\d.]+)\s*L(?![/\w])/);
    const price = num(/([\d.]+)\s*€\/L/);
    const total = num(/([\d.]+)\s*€(?!\/)/);
    const km = num(/(\d+)\s*km(?!\/)/);
    const fuel = (/·\s*(SP98|SP95|E10|E85|Gazole|GPL)\s*·/.exec(d) || [])[1] || "";
    const date = new Date(ev.start?.dateTime || ev.start?.date || ev.start);
    if (!car || Number.isNaN(date.getTime()) || litres === null) return null;
    return { car, date, litres, price, total: total ?? (price !== null ? litres * price : null), km, fuel };
  },

  /** Préfixe et voiture tolérants : « Plein Laguna » tapé comme début de titre, ou « Plein SLK » comme voiture,
   *  donnent préfixe « Plein » et voiture « Laguna » / « SLK ». */
  target(config) {
    let prefix = String(config.prefix || PLEINS_DEFAULTS.prefix);
    let car = String(config.car || "").trim();
    if (!/\s$/.test(prefix)) {
      const m = /^(\S+)\s+(.+)$/.exec(prefix.trim());
      if (m) { prefix = `${m[1]} `; if (!car) car = m[2].trim(); } else prefix = `${prefix.trim()} `;
    }
    if (car.toLowerCase().startsWith(prefix.toLowerCase())) car = car.slice(prefix.length).trim();
    return { prefix, car };
  },

  /** Statistiques d'une voiture. Consommation « plein à plein » : les litres du plein N ont été brûlés
   *  sur les km depuis le plein N-1, avec le carburant mis au plein N-1. */
  stats(fills, now) {
    const f = [...fills].sort((a, b) => a.date - b.date);
    // consommation de plein à plein, sur la chaîne des kilométrages cohérents :
    // un kilométrage absent ou plus bas que le précédent est une erreur de saisie (signalée dans la liste),
    // ses litres sont reportés sur le plein suivant ; une conso hors 3–30 L/100 km n'est pas comptée.
    let litresConso = 0, costConso = 0, dist = 0, ref = null, firstRef = null, pendL = 0, pendCost = 0, multi = false;
    const byFuel = {};
    const fuelStat = (k) => (byFuel[k] ||= { count: 0, litres: 0, cost: 0, consoL: 0, consoKm: 0 });
    f.forEach((x) => {
      const s = fuelStat(x.fuel || "?");
      s.count += 1; s.litres += x.litres; s.cost += x.total || 0;
      x.kmError = false;
      if (ref === null) {
        if (x.km !== null) ref = firstRef = x;
        return;
      }
      if (x.km === null || x.km <= ref.km) {
        x.kmError = x.km !== null;
        pendL += x.litres; pendCost += x.total || 0; multi = true;
        return;
      }
      const dd = x.km - ref.km, L = pendL + x.litres, c = (L / dd) * 100;
      if (c >= 3 && c <= 30) {
        litresConso += L; costConso += pendCost + (x.total || 0); dist += dd;
        if (!multi) { const ps = fuelStat(ref.fuel || "?"); ps.consoL += L; ps.consoKm += dd; }
      }
      ref = x; pendL = 0; pendCost = 0; multi = false;
    });
    const cost = f.reduce((s, x) => s + (x.total || 0), 0);
    const litres = f.reduce((s, x) => s + x.litres, 0);
    const first = f[0], last = f[f.length - 1];
    const days = first ? Math.max(1, (now - first.date) / 86400000) : null;
    const sameMonth = (x) => x.date.getFullYear() === now.getFullYear() && x.date.getMonth() === now.getMonth();
    const sumCost = (arr) => arr.reduce((s, x) => s + (x.total || 0), 0);
    const month = f.filter(sameMonth), year = f.filter((x) => x.date.getFullYear() === now.getFullYear());
    const months = [];
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const rows = f.filter((x) => x.date.getFullYear() === d.getFullYear() && x.date.getMonth() === d.getMonth());
      months.push({ date: d, cost: sumCost(rows), litres: rows.reduce((s, x) => s + x.litres, 0), count: rows.length });
    }
    return {
      fills: f, first, last, cost, litres, days,
      km: ref && ref !== firstRef ? ref.km - firstRef.km : null,
      odometer: ref ? ref.km : null,
      conso: dist > 0 ? (litresConso / dist) * 100 : null,
      perKm: dist > 0 ? costConso / dist : null,
      // budget par jour : seulement après 7 jours de suivi et au moins deux pleins (sinon il ne veut rien dire)
      perDay: days && days >= 7 && f.length > 1 ? cost / days : null,
      monthCost: sumCost(month), monthLitres: month.reduce((s, x) => s + x.litres, 0), monthCount: month.length,
      yearCost: sumCost(year), yearLitres: year.reduce((s, x) => s + x.litres, 0), yearCount: year.length,
      months: months.reverse(), byFuel,
    };
  },
};

const PUMP_ICON = `<svg viewBox="0 0 32 32" aria-hidden="true"><path class="cyl" d="M7 5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v22H7z"/><path class="band" d="M10 7h7v6h-7z"/><path class="cyl" d="M5.5 27h16v2.5h-16z"/><path class="hose" d="M20 10.5l3.5 3v9.5a1.6 1.6 0 0 0 3.2 0V11l-3.5-3.5"/></svg>`;

class BudgetCarburantCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("budget-carburant-card-editor");
  }

  static getStubConfig() {
    return { calendar: PLEINS_DEFAULTS.calendar };
  }

  setConfig(config) {
    if (!config) throw new Error("Configuration de la carte manquante.");
    this._config = { ...PLEINS_DEFAULTS, ...config, months: Number(config.months || PLEINS_DEFAULTS.months), history: Number(config.history || PLEINS_DEFAULTS.history), ...PLEINS.target(config) };
    this._events = null;
    this._fetched = 0;
    this._car = this._config.car || null;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.addEventListener("click", (ev) => {
        const t = ev.target.closest?.("[data-car]");
        if (!t) return;
        this._car = t.dataset.car;
        this._render();
      });
      // sections pliables : l'état ouvert / plié est gardé d'un rafraîchissement à l'autre
      this._folds = {};
      this.shadowRoot.addEventListener("toggle", (ev) => {
        const d = ev.target;
        if (d?.dataset?.fold) this._folds[d.dataset.fold] = d.open;
      }, true);
    }
    this._render();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    this._load();
    if (first) this._render();
  }

  getCardSize() {
    return 7;
  }

  /** Pleins lus dans le calendrier : au chargement, toutes les 10 minutes, et quand un plein vient d'être enregistré. */
  async _load() {
    const c = this._config;
    if (!c?.calendar || !this._hass?.callApi || this._loading) return;
    const stamp = this._hass.states?.["input_text.plein_etape"]?.last_updated || "";
    if (this._events && this._stamp === stamp && Date.now() - this._fetched < 600000) return;
    this._loading = true;
    try {
      const end = new Date(Date.now() + 86400000), start = new Date(end.getTime() - 5 * 365 * 86400000);
      const events = await this._hass.callApi("GET", `calendars/${c.calendar}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`);
      this._events = (Array.isArray(events) ? events : []).map((e) => PLEINS.parse(e, c.prefix || PLEINS_DEFAULTS.prefix)).filter(Boolean);
      this._error = null;
    } catch (err) {
      this._events = [];
      this._error = String(err?.body?.message || err?.message || err || "erreur");
    }
    this._fetched = Date.now();
    this._stamp = stamp;
    this._loading = false;
    this._render();
  }

  _render() {
    if (!this._config || !this.shadowRoot) return;
    const c = this._config;
    const theme = themeClass(c.theme, this._hass);
    const head = `${STYLE}${GAS_STYLE}${BOTTLE_STYLE}${PLEINS_STYLE}`;
    if (!this._events) {
      this.shadowRoot.innerHTML = `${head}<ha-card class="${theme} gas"${hcHpStyle(c)}><div class="empty"><span>Lecture des pleins…</span></div></ha-card>`;
      return;
    }
    // voitures : celles qui ont des pleins, plus celles de l'installation (onglet même sans plein)
    const known = (c.install?.cars || []).map((x) => String(x?.name || "").trim()).filter(Boolean);
    const cars = [...new Set([...this._events.map((e) => e.car), ...known])].sort();
    // voiture imposée par l'option car : toujours elle, jamais une autre
    if (c.car) this._car = c.car;
    else if (!this._car || !cars.includes(this._car)) this._car = cars[0];
    const fills = this._events.filter((e) => e.car === this._car);
    if (!fills.length) {
      const tabs = !c.car && cars.length > 1 ? this._tabs(cars) : "";
      this.shadowRoot.innerHTML = `${head}<ha-card class="${theme} gas"${hcHpStyle(c)}>${this._header(null)}${tabs}<div class="empty">
        <strong>${this._car ? `Aucun plein pour ${esc(this._car)}` : `Aucun plein dans ${esc(c.calendar)}`}</strong>
        <span>La carte lit les événements « ${esc(c.prefix)}${this._car ? esc(this._car) : "&lt;voiture&gt;"} » écrits à chaque plein (automatisation du tag NFC).</span>
        ${this._error ? `<span>Calendrier illisible : ${esc(this._error)}</span>` : ""}</div></ha-card>`;
      return;
    }
    const s = PLEINS.stats(fills, new Date());
    this.shadowRoot.innerHTML = `${head}<ha-card class="${theme} gas"${hcHpStyle(c)}>
      ${this._header(s)}${!c.car && cars.length > 1 ? this._tabs(cars) : ""}${this._hero(s)}${this._tiles(s)}${this._fold("fuels", this._fuels(s), `${Object.keys(s.byFuel).filter((k) => k !== "?").length} carburant${Object.keys(s.byFuel).filter((k) => k !== "?").length > 1 ? "s" : ""}`)}${this._fold("chart", this._chart(s), `${euro(s.monthCost)} ce mois`)}${this._fold("history", this._history(s), `${s.fills.length} plein${s.fills.length > 1 ? "s" : ""}`)}
      <footer>${s.fills.some((x) => x.kmError) ? "⚠ kilométrage qui n'augmente pas depuis le plein précédent : corriger l'événement dans le calendrier. " : ""}Consommation calculée de plein à plein : remplir le réservoir à chaque plein.</footer></ha-card>`;
  }

  _header(s) {
    const c = this._config;
    const sub = s ? `${this._car} · ${s.fills.length} plein${s.fills.length > 1 ? "s" : ""} depuis le ${s.first.date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}` : "";
    return `<header><div class="brand">${PUMP_ICON}
      <div><div class="title">${esc(c.title || PLEINS_DEFAULTS.title)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div></div></header>`;
  }

  _tabs(cars) {
    return `<nav class="pl-tabs">${cars.map((x) => `<button data-car="${esc(x)}" class="${x === this._car ? "on" : ""}">${esc(x)}</button>`).join("")}</nav>`;
  }

  _hero(s) {
    const l = s.last;
    const col = FUEL_COLORS[l.fuel] || "var(--med-gas)";
    return `<section class="hero">
      <div>
        <div class="hero-l">Dernier plein · ${esc(l.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }))}</div>
        <div class="hero-v">${fmt(l.litres, l.litres % 1 ? 1 : 0)}<span>L</span> <i class="pl-dot" style="background:${col}"></i><span class="pl-fuel">${esc(l.fuel)}</span></div>
        <div class="hero-p">${l.total !== null ? euro(l.total) : "—"}${l.price !== null ? ` · ${fmt(l.price, 3)} €/L` : ""}${l.km !== null ? ` · ${fmt(l.km, 0)} km` : ""}</div>
      </div>
      <div class="hero-r">
        ${s.conso !== null
          ? `<div class="peak">${fmt(s.conso, 1)}<span>L/100 km</span></div><div class="cost-l">consommation moyenne</div>`
          : `<div class="peak">—</div><div class="cost-l">consommation au prochain plein</div>`}
      </div>
    </section>`;
  }

  _tiles(s) {
    const now = new Date();
    const month = now.toLocaleDateString("fr-FR", { month: "long" });
    const tile = (label, value, unit, notes) => `<div class="tile">
      <div class="tile-l">${label}</div><div class="tile-v">${value}${unit ? `<span>${unit}</span>` : ""}</div>
      ${notes.filter(Boolean).length ? `<div class="tile-n">${notes.filter(Boolean).join("<br>")}</div>` : ""}</div>`;
    const avgMonth = s.days && s.days >= 28 ? (s.cost / s.days) * 30.44 : null;
    return `<section class="tiles">
      ${tile(cap(month), euro(s.monthCost), "", [`${fmt(s.monthLitres, 0)} L · ${s.monthCount} plein${s.monthCount > 1 ? "s" : ""}`])}
      ${tile(`Année ${now.getFullYear()}`, euro(s.yearCost), "", [`${fmt(s.yearLitres, 0)} L · ${s.yearCount} plein${s.yearCount > 1 ? "s" : ""}`, avgMonth !== null ? `≈ ${euro(avgMonth)} par mois` : ""])}
      ${tile("Kilomètres", s.km !== null ? fmt(s.km, 0) : "—", s.km !== null ? "km" : "", [s.odometer !== null ? `compteur ${fmt(s.odometer, 0)} km` : "", s.perKm !== null ? `${fmt(s.perKm * 100, 2)} € aux 100 km` : ""])}
      ${tile("Budget", s.perDay !== null ? euro(s.perDay) : "—", s.perDay !== null ? "/jour" : "", [s.perDay === null ? "par jour : connu après quelques jours" : "", `${euro(s.cost)} au total`, `${fmt(s.litres, 0)} L en tout`])}
    </section>`;
  }

  /** Section pliable : son titre devient un bouton, avec un résumé à droite. */
  _fold(key, html, info) {
    if (!html) return "";
    const open = this._folds?.[key] ?? !this._config.folded;
    return html
      .replace(/<div class="chart-h">(<span>[^<]*<\/span>)<\/div>/, (m, title) => `<details class="pl-fold" data-fold="${key}"${open ? " open" : ""}><summary class="chart-h">${title}<em>${esc(info)}</em><i class="pl-chev"></i></summary>`)
      .replace(/<\/section>\s*$/, "</details></section>");
  }

  _fuels(s) {
    const rows = Object.entries(s.byFuel).filter(([k]) => k !== "?").sort((a, b) => b[1].litres - a[1].litres);
    if (!rows.length) return "";
    return `<section class="bills"><div class="chart-h"><span>Par carburant</span></div>${rows.map(([k, v]) => `<div class="bill">
      <span><i class="pl-dot" style="background:${FUEL_COLORS[k] || "var(--med-gas)"}"></i>${esc(k)} · ${v.count} plein${v.count > 1 ? "s" : ""} · ${fmt(v.litres, 0)} L · ${euro(v.cost)}</span>
      <b>${v.consoKm > 0 ? `${fmt((v.consoL / v.consoKm) * 100, 1)} L/100` : "—"}</b></div>`).join("")}</section>`;
  }

  _chart(s) {
    const n = Math.max(3, Math.min(12, this._config.months));
    const months = s.months.slice(-n);
    const max = Math.max(1, ...months.map((m) => m.cost)) * 1.1;
    const H = 100, slot = 100 / n, w = slot * 0.6;
    const bars = months.map((m, k) => {
      const h = (m.cost / max) * H;
      return m.cost > 0 ? `<rect class="pl-bar" x="${k * slot + (slot - w) / 2}" y="${H - h}" width="${w}" height="${h}"/>` : "";
    }).join("");
    const labels = months.map((m) => `<div class="day"><span>${esc(m.date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""))}</span><b>${m.cost > 0 ? Math.round(m.cost) : "·"}</b></div>`).join("");
    return `<section class="chart">
      <div class="chart-h"><span>Dépenses des ${n} derniers mois (€)</span></div>
      <svg viewBox="0 0 100 ${H}" preserveAspectRatio="none" role="img" aria-label="Dépenses de carburant par mois">${bars}</svg>
      <div class="days" style="grid-template-columns:repeat(${n},1fr)">${labels}</div>
    </section>`;
  }

  _history(s) {
    const rows = [...s.fills].reverse().slice(0, this._config.history).map((x) => `<div class="bill">
      <span><i class="pl-dot" style="background:${FUEL_COLORS[x.fuel] || "var(--med-gas)"}"></i>${esc(x.date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }).replace(".", ""))} · ${fmt(x.litres, x.litres % 1 ? 1 : 0)} L ${esc(x.fuel)}${x.km !== null ? ` · ${x.kmError ? "⚠ " : ""}${fmt(x.km, 0)} km` : ""}</span>
      <b>${x.total !== null ? euro(x.total) : "—"}</b></div>`).join("");
    return `<section class="bills"><div class="chart-h"><span>Derniers pleins</span></div>${rows}</section>`;
  }
}

const PLEINS_STYLE = `<style>
.pl-fold > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 8px; user-select: none; }
.pl-fold > summary::-webkit-details-marker { display: none; }
.pl-fold > summary em { margin-left: auto; font-style: normal; font-size: .8rem; color: var(--med-muted); }
.pl-chev { width: 8px; height: 8px; border-right: 2px solid var(--med-muted); border-bottom: 2px solid var(--med-muted);
  transform: rotate(-45deg); transition: transform .2s; margin: 0 4px 2px 2px; flex: none; }
.pl-fold[open] > summary .pl-chev { transform: rotate(45deg); }
.pl-fold:not([open]) > summary { margin-bottom: 0; }
.brand .hose { fill: none; stroke: var(--med-gas); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.pl-tabs { display: flex; gap: 8px; padding: 0 18px 8px; flex-wrap: wrap; }
.pl-tabs button { all: unset; cursor: pointer; padding: 6px 14px; border-radius: 999px; border: 1px solid var(--med-line);
  background: var(--med-surface); font-size: .85rem; color: var(--med-muted); }
.pl-tabs button.on { color: var(--med-text); border-color: var(--med-gas); }
.pl-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin: 0 6px 0 2px; vertical-align: middle; }
.hero-v .pl-dot { width: 12px; height: 12px; margin-left: 10px; }
.hero-v .pl-fuel { font-size: 1rem; color: var(--med-text); font-weight: 600; margin-left: 0; }
.chart rect.pl-bar { fill: var(--med-gas); }
</style>`;

const GAS_STYLE = `<style>
ha-card.gas { --med-gas: #ff8f3d; --med-gas-core: #ffd25a; }
ha-card.gas.light { --med-gas: #d4630f; --med-gas-core: #e0a10a; }
.brand .flame { fill: var(--med-gas); } .brand .core { fill: var(--med-gas-core); }
.peak { font-size: 1.6rem; font-weight: 700; color: var(--med-gas); }
.peak span { font-size: .85rem; font-weight: 500; color: var(--med-muted); margin-left: 3px; }
.chart rect.gasb { fill: var(--med-gas); } .chart rect.gasb.est { opacity: .45; }
.legend .k-gas { background: var(--med-gas); } .legend .k-gas.est { opacity: .45; }
.gas-err { margin: 10px 12px 0; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--t-red); font-size: .8rem; }
.empty a { color: var(--med-accent, var(--med-blue)); }
</style>`;

/* --------------------------------------------------------- bouteille de gaz */

/** Bouteille de gaz (butane, propane) suivie par un tag NFC bipé à chaque changement :
 *  date d'installation (input_datetime), durée moyenne (capteur, ou calculée d'après le calendrier
 *  où chaque changement est noté), prix et capacité de la bouteille (nombres ou input_number). */

const BOTTLE_STYLE = `<style>
.brand .cyl { fill: var(--med-gas); } .brand .band { fill: var(--med-gas-core); }
.bt-gauge { height: 10px; border-radius: 6px; background: var(--med-line); overflow: hidden; margin-top: 4px; }
.bt-gauge i { display: block; height: 100%; border-radius: 6px; background: linear-gradient(90deg, var(--med-gas), var(--med-gas-core)); }
.bt-gauge.low i { background: var(--t-red); }
.bills { margin: 14px 12px 0; }
.bill { display: flex; justify-content: space-between; gap: 12px; padding: 8px 12px; border: 1px solid var(--med-line);
  border-radius: 10px; font-size: .85rem; margin-top: 6px; }
.bill span { color: var(--med-muted); }
.bill b.now { color: var(--med-gas); }
</style>`;

/* ------------------------------------------------------------------ pleins */


const TEXT_DEFAULT = { hc: ["#8fb0f0", "#2f5fb8"], hp: ["#eaa070", "#b35619"] };
const TEMPO_CSS = TEMPO_KEYS.flatMap((t) =>
  ["hc", "hp"].map((k) => `
.chart rect.${k}.tb-${t} { fill: var(--med-${k}-${t}, var(--med-${k})); }
.split.tb-${t} .bar .${k}, .legend .k-${k}.tb-${t} { background: var(--med-${k}-${t}, var(--med-${k})); }
.split.tb-${t} .k-${k} { color: var(--med-${k}-${t}-text, var(--med-${k}-text, ${TEXT_DEFAULT[k][0]})); }
ha-card.light .split.tb-${t} .k-${k} { color: var(--med-${k}-${t}-text, var(--med-${k}-text, ${TEXT_DEFAULT[k][1]})); }`),
).join("");

const STYLE_BASE = `<style>
:host {
  --med-bg: #1a2434; --med-surface: #212d40; --med-line: #2f3d55;
  --med-text: #e7edf5; --med-muted: #8fa0b8;
  --med-green: #96d21f; --med-blue: #1d93e3;
  --med-hc: #4a7bd8; --med-hp: #d27333;
  --t-blue: #3f7ff0; --t-white: #e9eef4; --t-red: #ee4a4a;
  --med-up: #f08a4b; --med-down: #5fcf8a;
}
ha-card { background: var(--med-bg); color: var(--med-text); border: 1px solid var(--med-line);
  border-radius: 18px; overflow: hidden; font-variant-numeric: tabular-nums; container-type: inline-size; }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 18px 8px; flex-wrap: wrap; }
.brand { display: flex; align-items: center; gap: 10px; }
.brand svg { width: 34px; height: 34px; fill: none; }
.brand .house { stroke: var(--med-green); stroke-width: 2.4; stroke-linejoin: round; stroke-linecap: round; }
.brand .bolt { fill: var(--med-accent, var(--med-blue)); }
.title { font-size: 1.15rem; font-weight: 700; letter-spacing: .2px; }
.sub { font-size: .78rem; color: var(--med-muted); }
.tempo { display: flex; gap: 8px; }
.pill { display: flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px;
  background: var(--med-surface); border: 1px solid var(--med-line); font-size: .78rem; }
.pill-l { color: var(--med-muted); }
.pill-v { font-weight: 600; }
.dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; background: var(--med-muted); flex: none; }
.t-blue .dot { background: var(--t-blue); } .t-white .dot { background: var(--t-white); } .t-red .dot { background: var(--t-red); }
.t-none .pill-v { color: var(--med-muted); font-weight: 400; }
.quotas { display: flex; align-items: center; gap: 14px; padding: 0 18px 10px; font-size: .82rem; }
.quota { display: inline-flex; align-items: center; gap: 5px; font-weight: 600; }
.quota small { color: var(--med-muted); font-weight: 400; }
.quota-l { color: var(--med-muted); }

.hero { margin: 4px 12px 0; padding: 16px; border-radius: 14px; background: var(--med-surface);
  border: 1px solid var(--med-line); display: grid; grid-template-columns: 1fr auto; gap: 6px 16px; }
.hero-l { color: var(--med-muted); font-size: .85rem; }
.hero-v { font-size: 2.4rem; font-weight: 700; line-height: 1.1; }
.hero-v span, .tile-v span { font-size: .9rem; font-weight: 500; color: var(--med-muted); margin-left: 4px; }
.hero-r { text-align: right; align-self: center; }
.cost { font-size: 1.6rem; font-weight: 700; color: var(--med-green); }
.cost.none { color: var(--med-muted); }
.cost.est { color: var(--med-text); opacity: .85; }
.hero-p { font-size: .75rem; color: var(--med-muted); margin-top: 6px; }
.cost-l { font-size: .75rem; color: var(--med-muted); max-width: 160px; }
.evo { font-size: .8rem; font-weight: 600; margin-top: 2px; }
.evo.up { color: var(--med-up); } .evo.down { color: var(--med-down); }
.split { grid-column: 1 / -1; margin-top: 6px; }
.split.wait { font-size: .8rem; color: var(--med-muted); border-top: 1px dashed var(--med-line); padding-top: 8px; }
.bar { display: flex; height: 8px; border-radius: 6px; overflow: hidden; background: var(--med-line); }
.bar i { display: block; } .bar .hc { background: var(--med-hc); } .bar .hp { background: var(--med-hp); }
.split-l { display: flex; justify-content: space-between; font-size: .78rem; margin-top: 6px; }
.k-hc { color: var(--med-hc-text, #8fb0f0); } .k-hp { color: var(--med-hp-text, #eaa070); }

.tiles { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 10px 12px 0; }
@container (min-width: 620px) { .tiles { grid-template-columns: repeat(4, 1fr); } }
@container (min-width: 620px) { .tiles.six { grid-template-columns: repeat(3, 1fr); } }
.tile { padding: 12px; border-radius: 12px; border: 1px solid var(--med-line); }
.tile-l { font-size: .78rem; color: var(--med-muted); }
.tile-v { font-size: 1.35rem; font-weight: 700; margin-top: 2px; }
.tile-n { font-size: .72rem; color: var(--med-muted); margin-top: 4px; }

.chart { margin: 14px 12px 0; }
.chart-h { display: flex; justify-content: space-between; font-size: .82rem; color: var(--med-muted); margin: 0 4px 6px; }
.legend { display: flex; align-items: center; gap: 6px; }
.legend i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; margin-left: 6px; }
.legend .k-hc { background: var(--med-hc); } .legend .k-hp { background: var(--med-hp); }
.chart-h { flex-wrap: wrap; row-gap: 4px; }
.chart-h > span:first-child, .legend .legend-t { white-space: nowrap; }
.legend .legend-t { margin-right: 2px; }
.legend i.pair { margin-left: 2px; }
${TEMPO_CSS}
.chart svg { width: 100%; height: 130px; display: block; }
.chart rect.hc { fill: var(--med-hc); } .chart rect.hp { fill: var(--med-hp); }
.chart rect.partial { fill: var(--med-muted); opacity: .35; }
.chart rect.base { fill: var(--med-base, var(--med-hc)); }
.legend .k-base { background: var(--med-base, var(--med-hc)); }
.chart g.est { opacity: .45; }
.chart rect.sel { fill: rgba(255,255,255,.06); }
.chart rect.hit { fill: transparent; cursor: pointer; }
.days { display: grid; margin-top: 4px; }
.day { all: unset; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 1px;
  padding: 4px 0; border-radius: 8px; font-size: .68rem; color: var(--med-muted); text-transform: capitalize; }
.day b { color: var(--med-text); font-size: .78rem; }
.day .dot { width: 6px; height: 6px; margin-top: 2px; }
.day.on { background: var(--med-surface); }
.day:focus-visible { outline: 2px solid var(--med-accent, var(--med-blue)); }

.detail { margin: 8px 12px 0; padding: 10px 12px; border-radius: 12px; background: var(--med-surface); border: 1px solid var(--med-line); }
.detail-h { display: flex; align-items: center; gap: 8px; font-size: .8rem; color: var(--med-muted); }
.tag { padding: 1px 8px; border-radius: 999px; font-size: .72rem; font-weight: 700; color: #0f1724; }
.tag.t-blue { background: var(--t-blue); color: #fff; } .tag.t-white { background: var(--t-white); } .tag.t-red { background: var(--t-red); color: #fff; }
.detail-v { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin-top: 4px; font-size: .9rem; }
.sep { width: 1px; height: 12px; background: var(--med-line); }
.detail-p { font-size: .78rem; color: var(--med-muted); margin-top: 4px; }
.warn { color: var(--t-red); font-style: normal; font-weight: 600; }

.power { margin: 10px 12px 0; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--med-line); }
.power.is-over { border-color: var(--t-red); }
.power-t { display: flex; justify-content: space-between; font-size: .85rem; }
.gauge { height: 6px; border-radius: 6px; background: var(--med-line); margin: 8px 0 6px; overflow: hidden; }
.gauge i { display: block; height: 100%; background: linear-gradient(90deg, var(--med-green), var(--med-accent, var(--med-blue))); }
.is-over .gauge i { background: var(--t-red); }
.power-n { font-size: .75rem; color: var(--med-muted); }

.eco { margin: 10px 12px 0; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--med-line); font-size: .82rem; display: flex; align-items: center; gap: 8px; }
.eco.e-ok .dot { background: var(--med-down); }
.eco.e-warn { border-color: #f0a33a; } .eco.e-warn .dot { background: #f0a33a; }
.eco.e-alert { border-color: var(--t-red); } .eco.e-alert .dot { background: var(--t-red); }
.eco-l { color: var(--med-muted); }
footer { padding: 10px 18px 14px; font-size: .7rem; color: var(--med-muted); }
.empty { padding: 18px; display: flex; flex-direction: column; gap: 6px; font-size: .9rem; }
.empty span { color: var(--med-muted); }
/* Thème Home Assistant : fond, textes et bordures suivent le thème clair ou sombre */
ha-card.th-ha {
  /* accent (icônes, onglets, sélections, contours) : couleur principale du thème ; les bleus porteurs de sens restent bleus */
  --med-accent: var(--primary-color, #1d93e3);
  --med-on-accent: var(--text-primary-color, #fff);
  --med-bg: var(--ha-card-background, var(--card-background-color, #fff));
  --med-surface: color-mix(in srgb, var(--primary-text-color, #000) 5%, transparent);
  --med-line: var(--divider-color, rgba(127, 127, 127, .25));
  --med-text: var(--primary-text-color, #1f2937);
  --med-muted: var(--secondary-text-color, #6b7280);
  border-radius: var(--ha-card-border-radius, 12px);
  border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color, #e0e0e0));
}
ha-card.th-ha.light { --med-green: #4c8a0b; --med-up: #c2560f; --med-down: #1d8a4b; }
/* Style MyElectricalData en version claire (theme: auto quand Home Assistant est en mode clair) */
ha-card.th-v2.light {
  --med-bg: #ffffff; --med-surface: #f2f5f9; --med-line: #dbe2ec;
  --med-text: #1a2434; --med-muted: #5b6b82;
  --med-green: #4c8a0b; --med-blue: #1673b8; --med-up: #c2560f; --med-down: #1d8a4b;
  box-shadow: 0 1px 3px rgba(26, 36, 52, .08);
}
ha-card.light .k-hc { color: var(--med-hc-text, #2f5fb8); }
ha-card.light .k-hp { color: var(--med-hp-text, #b35619); }
ha-card.light .t-white .dot, ha-card.light .tag.t-white { box-shadow: inset 0 0 0 1px #aab3c0; }
ha-card.light .chart rect.sel { fill: rgba(0, 0, 0, .05); }
ha-card.light .tag.t-white { color: #1f2937; }
@media (max-width: 420px) { .hero-v { font-size: 2rem; } .tempo { width: 100%; } }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
.tiles.h3 { grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, auto); grid-auto-flow: column; }
.tiles.h3 .tile { padding: 8px 10px; min-width: 0; }
@container (max-width: 420px) { .tiles.h3 .tile-v { font-size: 1.1rem; } .tiles.h3 .tile-n { font-size: .66rem; } }
</style>`;
// Variable --fs (réglage « taille de la police ») : sans réglage elle vaut 1 et rien ne change.
const STYLE = STYLE_BASE.replace(/(-?\d*\.?\d+)rem/g, "calc($1rem * var(--fs, 1))");

const WHEEL_STYLE = `<style>
.med-colors { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 16px; }
.med-colors[hidden] { display: none; }
.med-color { border: 1px solid var(--divider-color, #e0e0e0); border-radius: 12px; padding: 12px; min-width: 0; }
.med-color-t { font-weight: 500; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
.med-color-t i { width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--divider-color, #ccc); flex: none; }
.med-wheel { position: relative; width: 180px; max-width: 100%; aspect-ratio: 1; margin: 0 auto; border-radius: 50%;
  touch-action: none; cursor: crosshair;
  background: radial-gradient(circle closest-side, #fff, rgba(255, 255, 255, 0)),
    conic-gradient(from 90deg, red, yellow, lime, cyan, blue, magenta, red); }
.med-wheel .shade { position: absolute; inset: 0; border-radius: 50%; background: #000; pointer-events: none; }
.med-wheel .dot { position: absolute; width: 18px; height: 18px; margin: -11px 0 0 -11px; border-radius: 50%;
  border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0, 0, 0, .5), 0 1px 4px rgba(0, 0, 0, .4); pointer-events: none; }
.med-color label { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: .9rem; }
.med-color input[type=range] { flex: 1; min-width: 0; width: 100%; accent-color: var(--primary-color, #03a9f4); }
.med-color-r { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.med-color-r input[type=text] { flex: 1; min-width: 0; font: inherit; padding: 6px 8px; border-radius: 6px;
  border: 1px solid var(--divider-color, #ccc); background: var(--card-background-color, #fff); color: var(--primary-text-color, #000); }
.med-color-r button { font: inherit; font-size: .85rem; padding: 6px 10px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--divider-color, #ccc); background: transparent; color: var(--primary-color, #03a9f4); }
.med-color small { display: block; margin-top: 6px; color: var(--secondary-text-color, #666); }
.med-tempo-t { display: flex; align-items: center; gap: 8px; margin-top: 16px; font-weight: 500; cursor: pointer; }
.med-small { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-top: 10px; }
.med-small .med-color { padding: 10px; }
.med-small .med-wheel { width: 120px; }
/* Colonnes étroites : luminosité sous son libellé, code et bouton l'un sous l'autre */
.med-small .med-color label { flex-direction: column; align-items: stretch; gap: 4px; font-size: .8rem; }
.med-small .med-color-r { flex-wrap: wrap; }
.med-small .med-color-r input[type=text], .med-small .med-color-r button { flex: 1 1 100%; }
.med-small .med-color-r button { padding: 6px 8px; }
</style>`;

function makeEditor(schema, labels, defaults, colors = []) {
  const hasDays = schema.some((s) => s.name === "days");
  return class extends HTMLElement {
    setConfig(config) {
      this._config = { ...config };
      this._draw();
    }

    set hass(hass) {
      this._hass = hass;
      if (this._form) this._form.hass = hass;
      else this._draw();
    }

    _draw() {
      if (!this._hass || !this._config) return;
      if (!this._form) {
        this._form = document.createElement("ha-form");
        this._form.computeLabel = (s) => labels[s.name] || s.name;
        this._form.addEventListener("value-changed", (ev) => {
          const v = { ...ev.detail.value };
          if (hasDays && v.days !== undefined) v.days = Number(v.days);
          // Les couleurs se règlent avec les roues, hors du formulaire : garder la valeur en cours
          for (const c of colors) {
            if (this._config[c.key] !== undefined) v[c.key] = this._config[c.key];
            else delete v[c.key];
          }
          this._config = v;
          this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: v }, bubbles: true, composed: true }));
        });
        this.appendChild(this._form);
      }
      this._form.hass = this._hass;
      this._form.schema = schema;
      this._form.data = hasDays
        ? { ...defaults, ...this._config, days: String(this._config.days || defaults.days) }
        : { ...defaults, ...this._config };
      if (colors.length) this._drawColors();
    }

    _emit() {
      this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
    }

    /** Enregistre une couleur (null : retour à la couleur par défaut, l'option disparaît du YAML). */
    _setColor(key, hex) {
      const v = { ...this._config };
      if (hex) v[key] = hex;
      else delete v[key];
      this._config = v;
      // Les roues Tempo non réglées suivent les couleurs HC / HP générales : tout repeindre
      for (const c of colors) this._paintColor(c.key);
      this._emit();
    }

    /** Couleur affichée quand l'option n'est pas réglée : la sienne par défaut, ou celle de l'option de repli. */
    _fallbackHex(c) {
      if (!c.fallback) return c.def;
      const base = colors.find((x) => x.key === c.fallback);
      return toHex(this._config[c.fallback]) || base.def;
    }

    _drawColors() {
      if (!this._colors) {
        const block = (c) => {
          const small = c.group === "tempo";
          const def = c.fallback ? `couleur ${c.key.slice(0, 2).toUpperCase()} ci-dessus` : c.def;
          return `
          <div class="med-color" data-key="${c.key}">
            <div class="med-color-t"><i></i>${esc(c.label)}</div>
            <div class="med-wheel"><div class="shade"></div><div class="dot"></div></div>
            <label>Luminosité <input type="range" min="10" max="100" step="1"></label>
            <div class="med-color-r"><input type="text" spellcheck="false" aria-label="Code couleur">
              <button type="button">${small ? "Par défaut" : "Couleur par défaut"}</button></div>
            <small>Par défaut : ${def}</small>
          </div>`;
        };
        const main = colors.filter((c) => !c.group);
        const tempo = colors.filter((c) => c.group === "tempo");
        this._colors = document.createElement("div");
        this._colors.innerHTML = WHEEL_STYLE + `<div class="med-colors">${main.map(block).join("")}</div>${
          tempo.length
            ? `<label class="med-tempo-t"><input type="checkbox"> Couleurs selon la couleur Tempo du jour (6 roues)</label>
               <div class="med-colors med-small" hidden>${tempo.map(block).join("")}</div>`
            : ""}`;
        this.appendChild(this._colors);
        for (const c of colors) this._bindColor(c);
        const toggle = this._colors.querySelector(".med-tempo-t input");
        if (toggle) {
          const grid = this._colors.querySelector(".med-small");
          toggle.checked = tempo.some((c) => this._config[c.key] !== undefined);
          grid.hidden = !toggle.checked;
          toggle.addEventListener("change", () => {
            grid.hidden = !toggle.checked;
            // Décocher retire les six couleurs Tempo : la carte reprend les couleurs HC / HP générales
            if (!toggle.checked && tempo.some((c) => this._config[c.key] !== undefined)) {
              const v = { ...this._config };
              for (const c of tempo) delete v[c.key];
              this._config = v;
              for (const c of colors) this._paintColor(c.key);
              this._emit();
            }
          });
        }
      }
      for (const c of colors) this._paintColor(c.key);
    }

    _bindColor(c) {
      const box = this._colors.querySelector(`[data-key="${c.key}"]`);
      const wheel = box.querySelector(".med-wheel");
      const range = box.querySelector("input[type=range]");
      const text = box.querySelector("input[type=text]");
      const current = () => hexToHsv(toHex(this._config[c.key]) || this._fallbackHex(c));
      const pick = (ev) => {
        const r = wheel.getBoundingClientRect();
        const dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2);
        const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
        const sat = Math.min(1, Math.hypot(dx, dy) / (r.width / 2));
        this._setColor(c.key, hsvToHex(h, sat, current().v || 1));
      };
      wheel.addEventListener("pointerdown", (ev) => {
        wheel.setPointerCapture(ev.pointerId);
        this._dragging = c.key;
        pick(ev);
      });
      wheel.addEventListener("pointermove", (ev) => { if (this._dragging === c.key) pick(ev); });
      const stop = () => { this._dragging = null; };
      wheel.addEventListener("pointerup", stop);
      wheel.addEventListener("pointercancel", stop);
      range.addEventListener("input", () => {
        const { h, s } = current();
        this._setColor(c.key, hsvToHex(h, s, Number(range.value) / 100));
      });
      text.addEventListener("change", () => {
        const v = text.value.trim();
        if (!v) return this._setColor(c.key, null);
        const hex = toHex(v.startsWith("#") ? v : `#${v}`) || toHex(v);
        if (hex) this._setColor(c.key, hex);
        else this._paintColor(c.key);
      });
      box.querySelector("button").addEventListener("click", () => this._setColor(c.key, null));
    }

    _paintColor(key) {
      const c = colors.find((x) => x.key === key);
      const box = this._colors?.querySelector(`[data-key="${key}"]`);
      if (!c || !box) return;
      const chosen = toHex(this._config[key]);
      const hex = chosen || this._fallbackHex(c);
      const { h, s, v } = hexToHsv(hex);
      const dot = box.querySelector(".dot");
      const rad = (h * Math.PI) / 180;
      dot.style.left = `${50 + 50 * s * Math.cos(rad)}%`;
      dot.style.top = `${50 + 50 * s * Math.sin(rad)}%`;
      dot.style.background = hex;
      box.querySelector(".shade").style.opacity = String(1 - v);
      box.querySelector(".med-color-t i").style.background = hex;
      const range = box.querySelector("input[type=range]");
      if (document.activeElement !== range && this._dragging !== key) range.value = String(Math.round(v * 100));
      const text = box.querySelector("input[type=text]");
      const raw = this._config[key];
      if (document.activeElement !== text) text.value = raw === undefined ? "" : typeof raw === "string" ? raw : chosen || "";
      text.placeholder = this._fallbackHex(c);
    }
  };
}

const THEME_SELECT = {
  name: "theme",
  selector: {
    select: {
      mode: "dropdown",
      options: [
        { value: "v2", label: "Bleu nuit" },
        { value: "auto", label: "Bleu nuit, ou clair si Home Assistant est en mode clair" },
        { value: "ha", label: "Thème Home Assistant (clair ou sombre)" },
      ],
    },
  },
};
const SCHEMA = [
  { name: "calendar", required: true, selector: { entity: { domain: "calendar" } } },
  { name: "prefix", selector: { text: {} } },
  { name: "car", selector: { text: {} } },
  { name: "title", selector: { text: {} } },
  { name: "months", selector: { number: { min: 3, max: 12, step: 1, mode: "box", unit_of_measurement: "mois" } } },
  { name: "history", selector: { number: { min: 1, max: 20, step: 1, mode: "box" } } },
  { name: "folded", selector: { boolean: {} } },
  THEME_SELECT,
  { name: "font_size", selector: { number: { min: 70, max: 150, step: 5, mode: "slider", unit_of_measurement: "%" } } },
];
const LABELS = {
  calendar: "Calendrier où chaque plein est noté",
  prefix: "Début du titre des événements (suivi du nom de la voiture)",
  car: "Voiture affichée",
  title: "Titre",
  months: "Mois dans le graphique des dépenses",
  history: "Derniers pleins affichés",
  folded: "Par carburant, dépenses et derniers pleins repliés au départ",
  theme: "Couleurs de la carte",
  font_size: "Taille du texte",
};
/* ------------------------------------------------------------ installation */

/** Installation du suivi des pleins depuis l'éditeur de la carte : entrées, scripts, automatisation du tag NFC
 *  et page « Plein », créés par l'API de Home Assistant comme le ferait l'interface (compte administrateur). */
const FUELS = ["SP98", "SP95", "E10", "E85", "Gazole", "GPL"];
const FUEL_ICONS = { SP98: "🔴", SP95: "🔵", E10: "🟢", E85: "🟠", Gazole: "🟡", GPL: "🟣" };
const AUTOMATION_ALIAS = "Plein de carburant (tag NFC)";
const PAGE_URL = "plein-carburant";

const INSTALL = {
  /** Identifiant d'une voiture, comme Home Assistant le tire du nom d'une entrée (« Clio 4 » → clio_4). */
  slug(name) {
    return String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  },

  /** Réglages de l'éditeur nettoyés : voitures nommées, tags (par défaut « Plein <nom> »). */
  normalize(install) {
    const i = install || {};
    const cars = (Array.isArray(i.cars) ? i.cars : [])
      .map((c) => ({
        name: String(c?.name || "").trim(),
        tags: String(c?.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
        odometer: c?.odometer || "",
      }))
      .filter((c) => c.name && INSTALL.slug(c.name))
      .map((c) => ({ ...c, id: INSTALL.slug(c.name), tags: c.tags.length ? c.tags : [`Plein ${c.name}`] }));
    const stations = {};
    for (const f of FUELS) if (i[`station_${f.toLowerCase()}`]) stations[f] = i[`station_${f.toLowerCase()}`];
    return { cars, notify: i.notify || "", launcher: String(i.launcher || "").trim(), stations };
  },

  /** Entrées à créer : [domaine, nom, réglages]. L'identifiant vient du nom (« Plein étape » → plein_etape). */
  helpers(cars) {
    const num = (unit, icon, max, step) => ({ min: 0, max, step, mode: "box", unit_of_measurement: unit, icon });
    const list = [
      ["input_text", "Plein étape", { max: 255, icon: "mdi:gas-station" }],
      ["input_text", "Plein saisie carburant", { max: 20, icon: "mdi:gas-station" }],
      ["input_text", "Plein prix au litre", { max: 10, pattern: "^[0-9]*([.,][0-9]*)?$", icon: "mdi:cash" }],
      ["input_text", "Plein litres", { max: 10, pattern: "^[0-9]*([.,][0-9]*)?$", icon: "mdi:water" }],
      ["input_text", "Plein kilométrage", { max: 10, pattern: "^[0-9 ]*$", icon: "mdi:counter" }],
    ];
    for (const c of cars) {
      list.push(["input_text", `Plein ${c.name} dernier`, { max: 255, icon: "mdi:gas-station-outline" }]);
      list.push(["input_number", `Plein ${c.name} dépense totale`, num("€", "mdi:cash-multiple", 1000000, 0.01)]);
      list.push(["input_number", `Plein ${c.name} litres cumulés`, num("L", "mdi:water", 1000000, 0.01)]);
      list.push(["input_number", `Plein ${c.name} km cumulés`, num("km", "mdi:map-marker-distance", 10000000, 1)]);
    }
    return list.map(([domain, name, opts]) => ({ domain, name, id: INSTALL.slug(name), opts }));
  },

  scripts(o) {
    return {
      plein_choisir_carburant: {
        alias: "Plein – choisir le carburant",
        description: "Appelé par les pastilles de la page « Plein » : note le carburant et pré-remplit le prix du jour de la station.",
        icon: "mdi:gas-station",
        mode: "single",
        fields: {
          carburant: {
            name: "Carburant", description: FUELS.join(", "), required: true,
            selector: { select: { options: FUELS } },
          },
        },
        sequence: [
          { variables: { stations: o.stations } },
          { variables: { prix: "{% set e = stations.get(carburant) %}{{ states(e) | float(0) if e else 0 }}" } },
          { action: "input_text.set_value", target: { entity_id: "input_text.plein_saisie_carburant" }, data: { value: "{{ carburant }}" } },
          {
            action: "input_text.set_value", target: { entity_id: "input_text.plein_prix_au_litre" },
            data: { value: "{{ (('%g' % prix) | replace('.', ',')) if prix > 0 else '' }}" },
          },
          { event: "plein_carburant_choisi", event_data: { carburant: "{{ carburant }}" } },
        ],
      },
      plein_valider: {
        alias: "Plein – enregistrer",
        description: "Bouton « Enregistrer le plein » de la page « Plein ».",
        icon: "mdi:content-save",
        mode: "single",
        sequence: [{ event: "plein_valide" }],
      },
    };
  },

  automation(o, calendar, id) {
    const notify = o.notify ? `notify.${o.notify}` : "";
    const names = Object.fromEntries(o.cars.map((c) => [c.id, c.name]));
    const odometers = Object.fromEntries(o.cars.map((c) => [c.id, c.odometer || ""]));
    // les messages vont au téléphone qui a bipé le tag, sinon au téléphone par défaut
    const send = (data) => ({ if: [{ condition: "template", value_template: "{{ phone != '' }}" }], then: [{ action: "{{ phone }}", data }] });
    const note = (title, message, data) => [send({ title, message, data })];
    const text = (entity, value) => ({ action: "input_text.set_value", target: { entity_id: entity }, data: { value } });
    const tpl = (v) => ({ condition: "template", value_template: v });
    const litresFr = "{{ ('%g' % litres) | replace('.', ',') }}";
    const totalFr = "{{ '%.2f' | format(total) | replace('.', ',') }}";
    const consoFr = "{{ ('%g' % conso) | replace('.', ',') }}";
    return {
      id,
      alias: AUTOMATION_ALIAS,
      description: "Bip du tag NFC d'une voiture au plein : ouvre la page Plein, attend le bouton Enregistrer, vérifie et enregistre le plein (dernier plein, cumuls pour la consommation, calendrier). Créée par la carte Budget carburant.",
      mode: "single",
      max_exceeded: "silent",
      triggers: o.cars.flatMap((c) => c.tags.map((t) => ({ trigger: "tag", tag_id: t, id: c.id }))),
      conditions: [],
      actions: [
        {
          variables: {
            car: "{{ trigger.id }}",
            phone_default: notify,
            phone: `{% set d = (trigger.event.data.device_id | default('')) if trigger.event is defined else '' %}{% set n = device_attr(d, 'name') if d else '' %}{{ ('notify.mobile_app_' ~ (n | slugify)) if n else '${notify}' }}`,
          },
        },
        {
          variables: {
            car_name: `{{ ${JSON.stringify(names)}.get(car, car) }}`,
            odometer: `{{ ${JSON.stringify(odometers)}.get(car, '') }}`,
            ctx: "{{ 'PLEIN_' ~ (car | upper) ~ '_' ~ (now().timestamp() | int) }}",
            fuel_icons: FUEL_ICONS,
          },
        },
        {
          variables: {
            last: "{% set s = states('input_text.plein_' ~ car ~ '_dernier') %}{{ s | from_json if s.startswith('{') else {} }}",
            obd_km: "{{ states(odometer) | float(0) | round(0) if odometer and is_number(states(odometer)) else 0 }}",
          },
        },
        { variables: { prev_km: "{{ last.km | default(0) | float(0) }}" } },
        text(["input_text.plein_saisie_carburant", "input_text.plein_prix_au_litre", "input_text.plein_litres"], ""),
        text("input_text.plein_kilometrage", "{% set k = obd_km if obd_km > 0 else prev_km %}{{ (k | int) if k > 0 else '' }}"),
        text("input_text.plein_etape", "⛽ Plein {{ car_name }} : choisis le carburant, remplis, puis Enregistrer"),
        send({ message: "command_webview", data: { command: `/${PAGE_URL}/choix` } }),
        ...note("Plein {{ car_name }}", "Remplis la page Plein puis touche Enregistrer (touche ici pour la rouvrir).", {
          tag: "{{ ctx }}", clickAction: `/${PAGE_URL}/choix`, sticky: "true", color: "#1d93e3", notification_icon: "mdi:gas-station",
        }),
        { variables: { essais: 0, ok: false, fuel: "", price: 0, litres: 0, km: 0, err: "" } },
        {
          repeat: {
            sequence: [
              { wait_for_trigger: [{ trigger: "event", event_type: "plein_valide" }], timeout: "00:15:00", continue_on_timeout: true },
              {
                if: [tpl("{{ wait.trigger is none }}")],
                then: [
                  text("input_text.plein_etape", "❌ Plein {{ car_name }} annulé : pas enregistré à temps"),
                  ...note("Plein {{ car_name }}", "Plein annulé : la page n'a pas été enregistrée.", { tag: "{{ ctx }}", notification_icon: "mdi:gas-station" }),
                  { stop: "Pas d'enregistrement" },
                ],
              },
              {
                variables: {
                  fuel: "{{ states('input_text.plein_saisie_carburant') }}",
                  price: "{{ states('input_text.plein_prix_au_litre') | replace(',', '.') | replace(' ', '') | float(0) }}",
                  litres: "{{ states('input_text.plein_litres') | replace(',', '.') | replace(' ', '') | float(0) }}",
                  km: "{{ states('input_text.plein_kilometrage') | replace(' ', '') | float(0) | round(0) }}",
                },
              },
              {
                variables: {
                  essais: "{{ essais + 1 }}",
                  err: "{% if fuel not in fuel_icons %}choisis un carburant{% elif price <= 0 or price > 5 %}prix au litre incorrect ({{ price }} €){% elif litres <= 0 or litres > 150 %}litres incorrects ({{ litres }} L){% endif %}",
                },
              },
              {
                if: [tpl("{{ err == '' }}")],
                then: [{ variables: { ok: true } }],
                else: [text("input_text.plein_etape", "⚠️ {{ err | capitalize }} : corrige puis touche Enregistrer")],
              },
            ],
            until: [tpl("{{ ok or essais >= 5 }}")],
          },
        },
        {
          if: [tpl("{{ not ok }}")],
          then: [text("input_text.plein_etape", "❌ Plein {{ car_name }} non enregistré : trop d'erreurs, rebipe le tag"), { stop: "Saisie incorrecte" }],
        },
        {
          variables: {
            total: "{{ (price * litres) | round(2) }}",
            dist: "{{ (km - prev_km) | round(0) if km > 0 and prev_km > 0 and km > prev_km else 0 }}",
          },
        },
        { variables: { conso: "{{ (litres / dist * 100) | round(2) if dist > 0 else 0 }}" } },
        {
          action: "input_number.set_value", target: { entity_id: "input_number.plein_{{ car }}_depense_totale" },
          data: { value: "{{ (states('input_number.plein_' ~ car ~ '_depense_totale') | float(0) + total) | round(2) }}" },
        },
        {
          if: [tpl("{{ dist > 0 }}")],
          then: [
            {
              action: "input_number.set_value", target: { entity_id: "input_number.plein_{{ car }}_litres_cumules" },
              data: { value: "{{ (states('input_number.plein_' ~ car ~ '_litres_cumules') | float(0) + litres) | round(2) }}" },
            },
            {
              action: "input_number.set_value", target: { entity_id: "input_number.plein_{{ car }}_km_cumules" },
              data: { value: "{{ (states('input_number.plein_' ~ car ~ '_km_cumules') | float(0) + dist) | round(0) }}" },
            },
          ],
        },
        text("input_text.plein_{{ car }}_dernier",
          "{{ {'d': now().isoformat(timespec='minutes'), 'f': fuel, 'l': litres, 'p': price, 't': total, 'km': (km if km > 0 else prev_km), 'c': conso} | to_json }}"),
        {
          action: "calendar.create_event", target: { entity_id: calendar },
          data: {
            summary: "Plein {{ car_name }}",
            description: "{{ litres }} L · {{ fuel }} · {{ price }} €/L · {{ total }} €{% if km > 0 %} · {{ km | int }} km{% endif %}{% if conso > 0 %} · {{ conso }} L/100 km{% endif %}",
            start_date_time: "{{ now() }}",
            end_date_time: "{{ now() + timedelta(minutes=1) }}",
          },
        },
        text("input_text.plein_etape",
          `✔️ Plein {{ car_name }} enregistré : ${litresFr} L de {{ fuel_icons.get(fuel, '⛽') }} {{ fuel }}, ${totalFr} €{% if conso > 0 %} · ${consoFr} L/100 km{% endif %}`),
        ...note("Plein {{ car_name }} enregistré",
          `${litresFr} L de {{ fuel_icons.get(fuel, '⛽') }} {{ fuel }} à {{ ('%g' % price) | replace('.', ',') }} €/L, soit ${totalFr} €.{% if conso > 0 %} Consommation : ${consoFr} L/100 km sur {{ dist | int }} km.{% endif %}`,
          { tag: "{{ ctx }}", notification_icon: "mdi:gas-station" }),
        // retour à l'accueil : seulement sur le téléphone par défaut, dont le lanceur est connu
        ...(notify && o.launcher ? [
          { delay: { seconds: 3 } },
          {
            if: [{ condition: "template", value_template: "{{ phone == phone_default }}" }],
            then: [{ action: "{{ phone }}", data: { message: "command_activity", data: { intent_action: "android.intent.action.MAIN", intent_package_name: o.launcher } } }],
          },
        ] : []),
      ],
    };
  },

  /** Page « Plein » : pastilles de maison-chips-card si elle est installée, sinon cartes de Home Assistant. */
  page(o, chips) {
    const pick = (f) => ({ action: "perform-action", perform_action: "script.plein_choisir_carburant", data: { carburant: f } });
    const title = (t) => (chips ? { type: "custom:maison-titre-card", title: t } : { type: "heading", heading: t });
    const fuelCards = chips
      ? [{
        type: "custom:maison-chips-card", align: "center",
        chips: FUELS.map((f) => ({
          name: o.stations[f] ? `${f} · {state} €` : f, ...(o.stations[f] ? { entity: o.stations[f] } : {}),
          icon: "mdi:gas-station", color: FUEL_COLORS[f], tap_action: pick(f), hold_action: { action: "none" },
        })),
      }]
      : FUELS.map((f) => (o.stations[f]
        ? { type: "tile", entity: o.stations[f], name: f, icon: "mdi:gas-station", tap_action: pick(f), grid_options: { columns: 6 } }
        : { type: "button", name: f, icon: "mdi:gas-station", tap_action: pick(f), grid_options: { columns: 6 } }));
    const save = { action: "perform-action", perform_action: "script.plein_valider" };
    const cards = [
      { type: "markdown", content: "{% set e = states('input_text.plein_etape') %}## {{ e if e not in ['', 'unknown', 'unavailable'] else '⛽ Choisis le carburant puis remplis le plein' }}" },
      title("1 · Carburant"),
      ...fuelCards,
      {
        type: "markdown",
        content: `{% set f = states('input_text.plein_saisie_carburant') %}{% set ic = ${JSON.stringify(FUEL_ICONS)} %}### {{ ('Carburant choisi : ' ~ ic.get(f, '⛽') ~ ' ' ~ f) if f not in ['', 'unknown', 'unavailable'] else 'Touche un carburant ci-dessus' }}`,
      },
      title("2 · Plein"),
      {
        type: "entities", state_color: false,
        entities: [
          { entity: "input_text.plein_prix_au_litre", name: "Prix au litre (€)" },
          { entity: "input_text.plein_litres", name: "Litres" },
          { entity: "input_text.plein_kilometrage", name: "Kilométrage au compteur" },
        ],
      },
      {
        type: "markdown",
        content: "{% set p = states('input_text.plein_prix_au_litre') | replace(',', '.') | float(0) %}{% set l = states('input_text.plein_litres') | replace(',', '.') | float(0) %}{% if p > 0 and l > 0 %}### Total : {{ '%.2f' | format(p * l) | replace('.', ',') }} €\n{{ ('%g' % l) | replace('.', ',') }} L × {{ ('%g' % p) | replace('.', ',') }} €/L{% else %}### Total : —\nRemplis le prix et les litres{% endif %}",
      },
      chips
        ? { type: "custom:maison-chips-card", align: "center", chips: [{ name: "Enregistrer le plein", icon: "mdi:content-save", active: true, tap_action: save, hold_action: { action: "none" } }] }
        : { type: "button", name: "Enregistrer le plein", icon: "mdi:content-save", tap_action: save },
    ];
    return chips
      ? { views: [{ title: "Plein", path: "choix", icon: "mdi:gas-station", max_columns: 1, cards }] }
      : { views: [{ title: "Plein", path: "choix", icon: "mdi:gas-station", type: "sections", max_columns: 1, sections: [{ type: "grid", cards }] }] };
  },

  /** Réglages de l'installation repris d'une automatisation et d'un script déjà en place (installation faite
   *  à la main ou par une version précédente), pour ne rien perdre en relançant l'installation. */
  fromExisting(auto, script) {
    const tags = {};
    for (const t of auto?.triggers || auto?.trigger || []) {
      if ((t.trigger || t.platform) === "tag" && t.id && t.tag_id) (tags[t.id] ||= []).push(t.tag_id);
    }
    const vars = Object.assign({}, ...(auto?.actions || auto?.action || []).filter((a) => a.variables).map((a) => a.variables));
    // « {{ {"laguna": "Laguna"}.get(car, car) }} » ou « {{ 'Laguna' if car == 'laguna' else 'SLK' }} »
    const mapOf = (tpl) => {
      const s = String(tpl || "");
      const j = /\{\{\s*(\{.*\})\.get\(/.exec(s);
      if (j) { try { return JSON.parse(j[1]); } catch (e) { /* forme ternaire */ } }
      const out = {};
      for (const m of s.matchAll(/'([^']*)'\s+if\s+car\s*==\s*'([^']+)'/g)) out[m[2]] = m[1];
      const e = /else\s+'([^']*)'\s*\}\}/.exec(s);
      if (e) out[" else"] = e[1];
      return out;
    };
    const names = mapOf(vars.car_name), odos = mapOf(vars.odometer);
    const cars = Object.entries(tags).map(([id, list]) => ({
      name: names[id] ?? names[" else"] ?? id,
      tags: list.join(", "),
      odometer: odos[id] ?? odos[" else"] ?? "",
    }));
    const steps = auto?.actions || auto?.action || [];
    const notify = String(vars.phone_default || "") || steps.map((a) => a.action || a.service || "").find((a) => a.startsWith("notify.mobile_app_"));
    const launch = steps.flatMap((a) => [a, ...(a.then || [])]).find((a) => a.data?.message === "command_activity");
    const out = { cars, notify: notify ? notify.slice(7) : "", launcher: launch?.data?.data?.intent_package_name || "" };
    const st = (script?.sequence || []).find((a) => a.variables?.stations)?.variables.stations || {};
    for (const f of FUELS) if (st[f]) out[`station_${f.toLowerCase()}`] = st[f];
    return out;
  },

  /** Crée ou met à jour le tout. log(texte) décrit chaque étape. Les entrées existantes sont gardées
   *  (avec leurs valeurs) ; scripts, automatisation et page sont réécrits. */
  async run(hass, config, log) {
    const o = INSTALL.normalize(config.install);
    if (!hass.user?.is_admin) throw new Error("il faut un compte administrateur de Home Assistant");
    if (!o.cars.length) throw new Error("ajoutez au moins une voiture");
    // calendrier de la carte ; absent du YAML quand il est resté à sa valeur par défaut
    const calendar = config.calendar || PLEINS_DEFAULTS.calendar;
    if (!hass.states[calendar]) throw new Error(`le calendrier ${calendar} n'existe pas : choisissez-en un dans les options de la carte`);
    const ids = new Set(o.cars.map((c) => c.id));
    if (ids.size !== o.cars.length) throw new Error("deux voitures ont le même nom");

    const existing = {};
    for (const d of ["input_text", "input_number"]) {
      existing[d] = new Set((await hass.callWS({ type: `${d}/list` })).map((x) => x.id));
    }
    let made = 0;
    for (const h of INSTALL.helpers(o.cars)) {
      if (existing[h.domain].has(h.id)) continue;
      const res = await hass.callWS({ type: `${h.domain}/create`, name: h.name, ...h.opts });
      if (res?.id && res.id !== h.id) throw new Error(`l'entrée « ${h.name} » a reçu l'identifiant ${res.id} au lieu de ${h.id}`);
      made += 1;
    }
    log(made ? `${made} entrée${made > 1 ? "s" : ""} créée${made > 1 ? "s" : ""}` : "entrées déjà présentes");

    for (const [id, cfg] of Object.entries(INSTALL.scripts(o))) await hass.callApi("POST", `config/script/config/${id}`, cfg);
    log("scripts plein_choisir_carburant et plein_valider enregistrés");

    const current = Object.values(hass.states).find((s) => s.entity_id.startsWith("automation.") && s.attributes?.friendly_name === AUTOMATION_ALIAS);
    const autoId = current?.attributes?.id || "budget_carburant_plein_tag_nfc";
    await hass.callApi("POST", `config/automation/config/${autoId}`, INSTALL.automation(o, calendar, autoId));
    log(`automatisation « ${AUTOMATION_ALIAS} » ${current ? "mise à jour" : "créée"} (${o.cars.reduce((n, c) => n + c.tags.length, 0)} tag(s))`);

    const boards = await hass.callWS({ type: "lovelace/dashboards/list" });
    if (!boards.some((b) => b.url_path === PAGE_URL)) {
      await hass.callWS({ type: "lovelace/dashboards/create", url_path: PAGE_URL, title: "Plein", icon: "mdi:gas-station", show_in_sidebar: false, require_admin: false, mode: "storage" });
    }
    const chips = !!customElements.get("maison-chips-card");
    await hass.callWS({ type: "lovelace/config/save", url_path: PAGE_URL, config: INSTALL.page(o, chips) });
    log(`page « Plein » enregistrée (/${PAGE_URL}/choix${chips ? "" : ", cartes de Home Assistant"})`);
    if (!o.notify) log("pas de téléphone choisi : la page ne s'ouvrira pas toute seule au bip");
  },
};

const INSTALL_STYLE = `<style>
.bc-inst { margin-top: 24px; border-top: 1px solid var(--divider-color, #e0e0e0); padding-top: 16px; }
.bc-inst h3 { margin: 0 0 6px; font-size: 1.05rem; font-weight: 500; }
.bc-inst p { margin: 0 0 12px; color: var(--secondary-text-color, #666); font-size: .9rem; line-height: 1.4; }
.bc-car { border: 1px solid var(--divider-color, #e0e0e0); border-radius: 12px; padding: 12px; margin-bottom: 10px; }
.bc-car-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-weight: 500; }
.bc-inst button { font: inherit; font-size: .9rem; padding: 8px 14px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--divider-color, #ccc); background: transparent; color: var(--primary-color, #03a9f4); }
.bc-inst button.bc-go { background: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff); border-color: transparent; }
.bc-inst button[disabled] { opacity: .5; cursor: default; }
.bc-row { display: flex; gap: 10px; flex-wrap: wrap; margin: 12px 0; }
.bc-log { margin: 10px 0 0; padding: 0; list-style: none; font-size: .9rem; }
.bc-log li { margin: 4px 0; }
.bc-log .err { color: var(--error-color, #db4437); }
</style>`;

const CAR_SCHEMA = [
  { name: "name", required: true, selector: { text: {} } },
  { name: "tags", selector: { text: {} } },
  { name: "odometer", selector: { entity: { domain: "sensor" } } },
];
const CAR_LABELS = {
  name: "Nom de la voiture",
  tags: "Tags NFC (séparés par des virgules ; vide : « Plein <nom> »)",
  odometer: "Compteur kilométrique (facultatif : pré-remplit le kilométrage)",
};
const INSTALL_LABELS = {
  notify: "Téléphone par défaut (la page s'ouvre sur le téléphone qui a bipé ; celui-ci sert si on ne sait pas lequel)",
  launcher: "Après l'enregistrement, revenir à l'accueil (Android, facultatif) : paquet du lanceur",
  ...Object.fromEntries(FUELS.map((f) => [`station_${f.toLowerCase()}`, `Prix du jour ${f} (facultatif)`])),
};

/** Éditeur de la carte, avec en dessous l'installation du suivi des pleins. */
class BudgetCarburantCardEditor extends makeEditor(SCHEMA, LABELS, PLEINS_DEFAULTS) {
  _draw() {
    super._draw();
    if (!this._hass || !this._config) return;
    // voiture affichée : liste des voitures de l'installation (ou un nom tapé) ; le début de titre reste en YAML
    const names = (this._config.install?.cars || []).map((x) => String(x?.name || "").trim()).filter(Boolean);
    const cur = String(this._config.car || "").trim();
    if (cur && !names.includes(cur)) names.push(cur);
    this._form.schema = SCHEMA.filter((s) => s.name !== "prefix").map((s) => (s.name === "car"
      ? { name: "car", selector: { select: { mode: "dropdown", custom_value: true, options: [{ value: "", label: "Toutes (un onglet par voiture)" }, ...names.map((n) => ({ value: n, label: n }))] } } }
      : s));
    this._drawInstall();
  }

  _setInstall(install) {
    this._config = { ...this._config, install };
    this._emit();
  }

  /** Première ouverture sans réglages d'installation : les reprendre de l'automatisation déjà en place. */
  _current() {
    return Object.values(this._hass.states).find((s) => s.entity_id.startsWith("automation.") && s.attributes?.friendly_name === AUTOMATION_ALIAS);
  }

  /** force : bouton « Reprendre l'installation en place » (remplace les réglages saisis). */
  async _prefill(force = false) {
    this._prefilled = true;
    const cur = force ? {} : this._config.install || {};
    if ((cur.cars || []).some((c) => c?.name) || !this._hass.user?.is_admin) return;
    const st = this._current();
    if (!st?.attributes?.id) return;
    try {
      const auto = await this._hass.callApi("GET", `config/automation/config/${st.attributes.id}`);
      const script = await this._hass.callApi("GET", "config/script/config/plein_choisir_carburant").catch(() => null);
      const found = INSTALL.fromExisting(auto, script);
      if (!found.cars.length) return;
      this._setInstall({ ...found, ...Object.fromEntries(Object.entries(cur).filter(([k, v]) => k !== "cars" && v)) });
      this._drawInstall();
      const li = document.createElement("li");
      li.textContent = "ℹ Réglages repris de l'installation déjà en place : vérifiez-les, puis installez.";
      this._inst.querySelector(".bc-log").replaceChildren(li);
    } catch (e) { /* pas de reprise : formulaire vide */ }
  }

  _drawInstall() {
    if (!this._prefilled) this._prefill();
    const inst = this._config.install || {};
    const cars = Array.isArray(inst.cars) && inst.cars.length ? inst.cars : [{ name: "" }];
    if (!this._inst) {
      this._inst = document.createElement("div");
      this._inst.className = "bc-inst";
      this._inst.innerHTML = `${INSTALL_STYLE}<h3>Installation du suivi des pleins</h3>
        <p>Crée dans Home Assistant les entrées, les scripts, l'automatisation du tag NFC et la page « Plein »
        (adresse /${PAGE_URL}/choix). À relancer après avoir ajouté une voiture : les pleins déjà notés sont gardés.
        Les tags s'écrivent avec l'application (Paramètres › Tags).</p>
        <div class="bc-cars"></div>
        <div class="bc-row"><button type="button" class="bc-add">Ajouter une voiture</button>
          <button type="button" class="bc-take" hidden>Reprendre l'installation en place</button></div>
        <div class="bc-glob"></div>
        <div class="bc-row"><button type="button" class="bc-go">Installer ou mettre à jour</button></div>
        <ul class="bc-log"></ul>`;
      this._inst.querySelector(".bc-add").addEventListener("click", () => {
        const cur = this._config.install || {};
        const list = Array.isArray(cur.cars) && cur.cars.length ? cur.cars : [{ name: "" }];
        this._setInstall({ ...cur, cars: [...list, { name: "" }] });
        this._drawInstall();
      });
      this._inst.querySelector(".bc-go").addEventListener("click", () => this._install());
      this._inst.querySelector(".bc-take").addEventListener("click", () => this._prefill(true));
      this.appendChild(this._inst);
    }
    const box = this._inst.querySelector(".bc-cars");
    while (box.children.length > cars.length) box.lastChild.remove();
    cars.forEach((car, k) => {
      let el = box.children[k];
      if (!el) {
        el = document.createElement("div");
        el.className = "bc-car";
        el.innerHTML = `<div class="bc-car-h"><span></span><button type="button">Retirer</button></div>`;
        const form = document.createElement("ha-form");
        form.computeLabel = (s) => CAR_LABELS[s.name] || s.name;
        form.schema = CAR_SCHEMA;
        form.addEventListener("value-changed", (ev) => {
          const cur = this._config.install || {};
          const list = [...(Array.isArray(cur.cars) && cur.cars.length ? cur.cars : [{ name: "" }])];
          list[Number(el.dataset.k)] = { ...ev.detail.value };
          this._setInstall({ ...cur, cars: list });
        });
        el.querySelector("button").addEventListener("click", () => {
          const cur = this._config.install || {};
          const list = [...(cur.cars || [])];
          list.splice(Number(el.dataset.k), 1);
          this._setInstall({ ...cur, cars: list });
          this._drawInstall();
        });
        el.appendChild(form);
        box.appendChild(el);
      }
      el.dataset.k = k;
      el.querySelector(".bc-car-h span").textContent = `Voiture ${k + 1}`;
      const form = el.querySelector("ha-form");
      form.hass = this._hass;
      form.data = { ...car };
    });

    if (!this._glob) {
      this._glob = document.createElement("ha-form");
      this._glob.computeLabel = (s) => INSTALL_LABELS[s.name] || s.name;
      this._glob.addEventListener("value-changed", (ev) => {
        const cur = this._config.install || {};
        const { cars: _cars, ...rest } = ev.detail.value;
        this._setInstall({ ...rest, cars: cur.cars || [] });
      });
      this._inst.querySelector(".bc-glob").appendChild(this._glob);
    }
    const phones = Object.keys(this._hass.services?.notify || {}).filter((s) => s.startsWith("mobile_app_")).sort();
    this._glob.hass = this._hass;
    this._glob.schema = [
      { name: "notify", selector: { select: { mode: "dropdown", options: [{ value: "", label: "Aucun" }, ...phones.map((p) => ({ value: p, label: p.replace(/^mobile_app_/, "") }))] } } },
      ...FUELS.map((f) => ({ name: `station_${f.toLowerCase()}`, selector: { entity: { domain: "sensor" } } })),
      { name: "launcher", selector: { text: {} } },
    ];
    const { cars: _c, ...glob } = inst;
    this._glob.data = glob;
    const go = this._inst.querySelector(".bc-go");
    const admin = !!this._hass.user?.is_admin;
    go.disabled = !admin || this._busy;
    go.title = admin ? "" : "Réservé aux administrateurs";
    this._inst.querySelector(".bc-take").hidden = !admin || !this._current();
  }

  async _install() {
    const log = this._inst.querySelector(".bc-log");
    const add = (t, err) => { const li = document.createElement("li"); li.textContent = `${err ? "✖" : "✔"} ${t}`; if (err) li.className = "err"; log.appendChild(li); };
    log.innerHTML = "";
    this._busy = true;
    this._drawInstall();
    try {
      await INSTALL.run(this._hass, this._config, (t) => add(t));
      add("installation terminée");
    } catch (err) {
      add(`installation arrêtée : ${err?.body?.message || err?.message || err}`, true);
    }
    this._busy = false;
    this._drawInstall();
  }
}

/* ---------------------------------------------------------- enregistrement */

if (typeof customElements !== "undefined") {
  const define = (name, cls) => { if (!customElements.get(name)) customElements.define(name, cls); };
  define("budget-carburant-card", BudgetCarburantCard);
  define("budget-carburant-card-editor", BudgetCarburantCardEditor);
  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === "budget-carburant-card")) {
    window.customCards.push({
      type: "budget-carburant-card",
      name: "Budget carburant",
      description: "Pleins de carburant par voiture (tag NFC) : kilomètres, consommation moyenne et par carburant, litres, budget par plein, jour, mois et année.",
      preview: true,
    });
  }
  console.info(`%c BUDGET-CARBURANT %c ${CARD_VERSION} `, "background:#FF9100;color:#1a2434;font-weight:700", "background:#1d93e3;color:#fff");
}

if (typeof module !== "undefined") module.exports = { PLEINS, INSTALL };
