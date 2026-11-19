import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { Flame, Layers, MapPin, TrendingUp } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import { brukerEksempelData } from "../services/api.js";
import { useStore } from "../store/useStore.js";
import {
  buildFeatureCollection,
  buildNearbyCircleGeoJson,
  buildNearbyGeoJson,
} from "../utils/geo.js";
import { buildTileFilter } from "../utils/tileFilter.js";
import { buildUpgradeInsights } from "../utils/upgradeInsights.js";
import {
  DARK_MAP_STYLE_URL,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  LAYER_IDS,
  LIGHT_MAP_STYLE_URL,
  MAP_VIEW_MODES,
  SOURCE_IDS,
  heatingGradeName,
} from "../utils/constants.js";
import { ENKEL_VISNINGER, ordningLabel } from "../utils/enheter.js";
import "../styles/map-view.css";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function energyClass(grade) {
  const normalized = String(grade || "unknown")
    .trim()
    .toUpperCase();
  return /^[A-G]$/.test(normalized)
    ? `energy-${normalized.toLowerCase()}`
    : "energy-unknown";
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function displayValue(value, fallback = "Ikke registrert") {
  return hasValue(value) ? value : fallback;
}

const POPUP_HELP = {
  grade:
    "Energikarakteren går fra A til G. A er best og G er dårligst. Den bygger på beregnet levert energi per kvadratmeter per år ved normal bruk.",
  energyUse:
    "Beregnet levert energi per kvadratmeter per år ved normal bruk, vist i kWh/m² per år. Tallet er beregnet, ikke målt.",
  built: "Byggeåret som er registrert for bygget eller enheten.",
  address: "Den registrerte adressen til dette bygget eller denne enheten.",
  issued: "Datoen energiattesten ble utstedt.",
  heatingGrade:
    "Oppvarmingskarakteren er skalaen fra rød til grønn for oppvarmingssystemet i bygget. Grønn er best, og den er uavhengig av energikarakteren.",
  cohort:
    "Bygg fra samme tidsrom er bygget etter de samme byggereglene. Gruppen brukes når bygg sammenlignes med lignende bygg.",
  medianGrade:
    "Medianen er den midterste karakteren når byggets enheter settes i rekkefølge fra A til G. Er det like mange på hver side, brukes den dårligste av de to midterste.",
  medianEnergy:
    "Den midterste verdien av beregnet levert energi for enhetene i bygget, i kWh/m² per år. Tallet er beregnet, ikke målt.",
};

function popupHelp(text) {
  if (!text) return "";

  return `<button type="button" class="popup-help" title="${escapeHtml(text)}" aria-label="${escapeHtml(text)}">?</button>`;
}

function popupLabel(label, tooltip = "") {
  return `<span class="popup-label-text">${escapeHtml(label)}${popupHelp(tooltip)}</span>`;
}

function popupDetail(label, value, tooltip = "") {
  if (!hasValue(value)) return "";

  const valueClass = hasValue(value)
    ? "popup-value"
    : "popup-value popup-value-empty";
  return `
    <div class="popup-detail">
      <span class="popup-label">${popupLabel(label, tooltip)}</span>
      <strong class="${valueClass}">${escapeHtml(value)}</strong>
    </div>
  `;
}

function popupMetric(label, value, modifier = "", tooltip = "") {
  const metricClass = ["popup-metric", modifier].filter(Boolean).join(" ");
  const valueClass = hasValue(value)
    ? "popup-metric-value"
    : "popup-metric-value popup-value-empty";
  return `
    <div class="${metricClass}">
      <span>${popupLabel(label, tooltip)}</span>
      <strong class="${valueClass}">${escapeHtml(displayValue(value, "Mangler"))}</strong>
    </div>
  `;
}

function markerPopupMetric(label, value, tooltip = "") {
  const valueClass = hasValue(value)
    ? "marker-popup-metric-value"
    : "marker-popup-metric-value popup-value-empty";
  return `
    <div class="marker-popup-metric">
      <span class="marker-popup-metric-label">${popupLabel(label, tooltip)}</span>
      <strong class="${valueClass}">${escapeHtml(displayValue(value, "Mangler"))}</strong>
    </div>
  `;
}

function markerPopupDetail(label, value, tooltip = "") {
  if (!hasValue(value)) return "";

  return `
    <div class="marker-popup-detail">
      <span class="marker-popup-detail-label">${popupLabel(label, tooltip)}</span>
      <strong class="marker-popup-detail-value">${escapeHtml(value)}</strong>
    </div>
  `;
}

function firstPopulated(...values) {
  return values.find((value) => hasValue(value));
}

function priorityClass(score) {
  if (score >= 75) return "priority-high";
  if (score >= 45) return "priority-medium";
  return "priority-low";
}

function priorityLabel(score) {
  if (score >= 75) return "Høy prioritet";
  if (score >= 45) return "Middels prioritet";
  return "Lav prioritet";
}

function scoreBar(label, score) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));

  return `
    <div class="score-row">
      <div class="score-row-label">
        <span>${escapeHtml(label)}</span>
        <strong>${safeScore}/100</strong>
      </div>
      <div class="score-track">
        <div class="score-fill ${priorityClass(safeScore)}" style="width: ${safeScore}%"></div>
      </div>
    </div>
  `;
}

function upgradeDriverRows(drivers) {
  return drivers
    .map(
      (item) => `
      <div class="upgrade-driver driver-${escapeHtml(item.tone)}">
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(item.detail)}</span>
      </div>
    `,
    )
    .join("");
}

function upgradeRecommendationItems(recommendations) {
  return recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function upgradeDataRows(dataUsed) {
  return dataUsed
    .map(
      (item) => `
      <div class="upgrade-data-item ${item.missing ? "is-missing" : ""}">
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(displayValue(item.value, "Mangler"))}</strong>
      </div>
    `,
    )
    .join("");
}

function upgradePopupHtml(properties) {
  const address = escapeHtml(
    displayValue(properties.adresse, "Ukjent adresse"),
  );
  const energyUse =
    properties.beregnetLevertEnergiTotaltkWhm2 ?? properties.energibruk_kwh_m2;
  const score = Math.max(
    0,
    Math.min(100, Number(properties.upgradeScore) || 0),
  );
  const priority = properties.upgradePriority || priorityLabel(score);
  const insights = buildUpgradeInsights(properties);

  return `
    <div class="popup-card popup-card-upgrade">
      <div class="popup-header">
        <div class="popup-heading">
          <div class="popup-kicker">Oppgraderingsprioritet</div>
          <div class="popup-title">${address}</div>
          <div class="popup-subtitle">Oppgraderingsanslag basert på energiattest, oppvarming, beregnet levert energi, alder og hvor komplette dataene er.</div>
        </div>
        <div class="priority-badge ${priorityClass(score)}">
          <span>${escapeHtml(priority)}</span>
          <strong>${score}</strong>
        </div>
      </div>

      <div class="upgrade-confidence">
        <div>
          <div class="upgrade-confidence-label">Sikkerhet i anslaget</div>
          <strong>${escapeHtml(insights.confidence.label)}</strong>
          <span>${escapeHtml(insights.confidence.copy)}</span>
        </div>
        <div class="upgrade-confidence-pill confidence-${escapeHtml(insights.confidence.level)}">
          ${escapeHtml(insights.confidence.label)}
        </div>
      </div>

      <div class="popup-metrics">
        ${popupMetric("Energikarakter", properties.energikarakter, "popup-metric-compact", POPUP_HELP.grade)}
        ${popupMetric("Oppvarmingskarakter", heatingGradeName(properties.oppvarmingskarakter), "popup-metric-compact", POPUP_HELP.heatingGrade)}
        ${popupMetric("Beregnet levert energi", energyUse, "popup-metric-compact", POPUP_HELP.energyUse)}
        ${popupMetric("Byggeår", properties.byggeaar, "popup-metric-compact", POPUP_HELP.built)}
      </div>

      <div class="score-breakdown">
        ${scoreBar("Samlet prioritet", score)}
        ${scoreBar("Behov for energioppgradering", properties.energyUpgradeScore)}
        ${scoreBar("Behov for oppgradering av oppvarming", properties.heatingUpgradeScore)}
      </div>

      <div class="upgrade-section">
        <div class="popup-kicker">Viktigste faktorer</div>
        <div class="upgrade-drivers">
          ${upgradeDriverRows(insights.drivers)}
        </div>
      </div>

      <div class="upgrade-actions">
        <div class="popup-kicker">Anbefalte kontroller</div>
        <ul>${upgradeRecommendationItems(insights.recommendations)}</ul>
      </div>

      <div class="upgrade-section">
        <div class="popup-kicker">Data som er brukt</div>
        <div class="upgrade-data-grid">
          ${upgradeDataRows(insights.dataUsed)}
        </div>
      </div>
    </div>
  `;
}

// Popup for ett punkt i bydelsvisningen (én enhet, siste attest i valgt ordning).
function enhetPopupHtml(properties) {
  const address = escapeHtml(displayValue(properties.adresse, "Ukjent adresse"));
  const energyGrade = displayValue(properties.energikarakter, "Mangler");
  const energyGradeClass = energyClass(energyGrade);
  const energy = Number(properties.energi_kwh_m2);
  const energyText =
    properties.energi_kwh_m2 !== null && Number.isFinite(energy)
      ? `${energy.toLocaleString("nb-NO", { maximumFractionDigits: 1 })} kWh/m² per år`
      : null;
  const ordning = ordningLabel(properties.ordning);
  const samme = Number(properties.antall_enheter_samme_punkt);
  const heating =
    hasValue(properties.oppvarmingskarakter)
      ? heatingGradeName(properties.oppvarmingskarakter)
      : "";

  return `
    <article class="popup-card marker-popup">
      <div class="marker-popup-header">
        <div class="marker-popup-heading">
          <div class="marker-popup-meta">
            <span class="marker-popup-kicker">Siste energiattest for enheten</span>
          </div>
          <h2 class="marker-popup-title">${address}</h2>
        </div>
        <div class="marker-popup-grade ${energyGradeClass}">
          <span>Energikarakter</span>
          <strong>${escapeHtml(energyGrade)}</strong>
        </div>
      </div>
      ${samme > 1 ? `<div class="marker-popup-same-point">Antall enheter her: ${samme}</div>` : ""}
      <div class="marker-popup-snapshot" aria-label="Oppsummering av enheten">
        ${markerPopupMetric("Beregnet levert energi", energyText, POPUP_HELP.energyUse)}
        ${markerPopupMetric("Byggeår", properties.byggeaar, POPUP_HELP.built)}
      </div>
      <div class="marker-popup-body">
        <div class="marker-popup-section-title">Detaljer</div>
        <div class="marker-popup-detail-list">
          ${markerPopupDetail("Ordning", ordning)}
          ${markerPopupDetail("Bygningskategori", properties.bygningskategori)}
          ${markerPopupDetail("Byggeårsgruppe", properties.kohort, POPUP_HELP.cohort)}
          ${markerPopupDetail("Attesten utstedt", properties.utstedelsesdato, POPUP_HELP.issued)}
          ${markerPopupDetail("Oppvarming", heating, POPUP_HELP.heatingGrade)}
          ${markerPopupDetail("Bygningsnummer", properties.bygningsnummer)}
        </div>
      </div>
      ${
        hasValue(properties.bygningsnummer)
          ? `<a class="popup-bygg-link" href="#/bygg/${encodeURIComponent(properties.bygningsnummer)}">Vis bygget</a>`
          : ""
      }
    </article>
  `;
}

function formatKwh(value) {
  const number = Number(value);
  return hasValue(value) && Number.isFinite(number)
    ? `${number.toLocaleString("nb-NO", { maximumFractionDigits: 1 })} kWh/m² per år`
    : null;
}

// Popup for ett bygg i «Enkel bygg, per bygg». Alle tall er medianer over byggets enheter
// (siste energiattest per enhet i valgt ordning) og kommer ferdig regnet fra databasen.
function byggPopupHtml(properties) {
  const baseAddress = displayValue(properties.adresse, "Ukjent adresse");
  const otherAddresses = Number(properties.antall_adresser) - 1;
  const address = escapeHtml(
    otherAddresses > 0
      ? `${baseAddress} og ${otherAddresses === 1 ? "1 annen adresse" : `${otherAddresses} andre adresser`}`
      : baseAddress,
  );
  const grade = displayValue(properties.median_karakter, "Mangler");
  const unitCount = Number(properties.antall_enheter);
  const unitText = Number.isFinite(unitCount)
    ? `${unitCount.toLocaleString("nb-NO")} ${unitCount === 1 ? "enhet" : "enheter"}`
    : "enhetene";

  return `
    <article class="popup-card marker-popup">
      <div class="marker-popup-header">
        <div class="marker-popup-heading">
          <div class="marker-popup-meta">
            <span class="marker-popup-kicker">Bygg, samlet for enhetene</span>
          </div>
          <h2 class="marker-popup-title">${address}</h2>
        </div>
        <div class="marker-popup-grade ${energyClass(grade)}" title="${escapeHtml(POPUP_HELP.medianGrade)}">
          <span>Median</span>
          <strong>${escapeHtml(grade)}</strong>
        </div>
      </div>
      <div class="marker-popup-same-point">Median energikarakter ${escapeHtml(grade)} for ${escapeHtml(unitText)}</div>
      <div class="marker-popup-snapshot" aria-label="Oppsummering av bygget">
        ${markerPopupMetric("Median beregnet levert energi", formatKwh(properties.median_kwh_m2), POPUP_HELP.medianEnergy)}
        ${markerPopupMetric("Byggeår", properties.byggeaar, POPUP_HELP.built)}
      </div>
      <div class="marker-popup-body">
        <div class="marker-popup-section-title">Detaljer</div>
        <div class="marker-popup-detail-list">
          ${markerPopupDetail("Antall enheter", Number.isFinite(unitCount) ? unitCount.toLocaleString("nb-NO") : null)}
          ${markerPopupDetail("Ordning", ordningLabel(properties.ordning))}
          ${markerPopupDetail("Bygningskategori", properties.bygningskategori)}
          ${markerPopupDetail("Byggeårsgruppe", properties.kohort, POPUP_HELP.cohort)}
          ${markerPopupDetail("Bygningsnummer", properties.bygningsnummer)}
        </div>
      </div>
      ${
        hasValue(properties.bygningsnummer)
          ? `<a class="popup-bygg-link" href="#/bygg/${encodeURIComponent(properties.bygningsnummer)}">Vis bygget</a>`
          : ""
      }
    </article>
  `;
}

function popupHtmlForMode(properties, mode) {
  return mode === "upgrade"
    ? upgradePopupHtml(properties)
    : enhetPopupHtml(properties);
}

function idsMatch(left, right) {
  return (
    left !== null &&
    left !== undefined &&
    right !== null &&
    right !== undefined &&
    String(left) === String(right)
  );
}

function findFeatureById(features, id) {
  return features.find(
    (item) => idsMatch(item.id, id) || idsMatch(item.properties?.id, id),
  );
}

function coordinateKey(feature) {
  const [longitude, latitude] = feature?.geometry?.coordinates || [];
  if (!Number.isFinite(Number(longitude)) || !Number.isFinite(Number(latitude)))
    return "";
  return `${Number(longitude).toFixed(5)}-${Number(latitude).toFixed(5)}`;
}

function findUnitsAtFeatureLocation(features, selectedFeature) {
  const selectedKey = coordinateKey(selectedFeature);
  if (!selectedKey) return [];

  return features
    .filter((feature) => coordinateKey(feature) === selectedKey)
    .sort((left, right) => {
      const leftUnit = left.properties?.bruksenhetsNr || "";
      const rightUnit = right.properties?.bruksenhetsNr || "";
      return leftUnit.localeCompare(rightUnit, undefined, { numeric: true });
    });
}

function findUnitsAtCoordinates(features, coordinates) {
  return findUnitsAtFeatureLocation(features, {
    geometry: {
      coordinates,
    },
  });
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function percentile(values, targetPercentile) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * targetPercentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function ascendingStops(values) {
  let previous = 0;
  return values.map((value) => {
    const nextValue = Math.max(1, Math.round(Number(value) || 0));
    previous = Math.max(previous + 1, nextValue);
    return previous;
  });
}

function buildHeatmapData(features) {
  const grouped = new Map();

  features.forEach((feature) => {
    const key = coordinateKey(feature);
    const energyUse = Number(feature.properties?.energibruk_kwh_m2);
    if (!key || !Number.isFinite(energyUse) || energyUse <= 0) return;

    if (!grouped.has(key)) {
      grouped.set(key, {
        coordinates: feature.geometry.coordinates,
        values: [],
      });
    }

    grouped.get(key).values.push(energyUse);
  });

  const aggregatedFeatures = Array.from(grouped.entries()).map(
    ([key, group]) => {
      const heatmapEnergy = median(group.values);

      return {
        type: "Feature",
        id: `heatmap-${key}`,
        geometry: {
          type: "Point",
          coordinates: group.coordinates,
        },
        properties: {
          id: `heatmap-${key}`,
          heatmapEnergy,
          unitCount: group.values.length,
        },
      };
    },
  );

  const values = aggregatedFeatures.map(
    (feature) => feature.properties.heatmapEnergy,
  );
  const [p50, p80, p95] = ascendingStops([
    percentile(values, 0.5),
    percentile(values, 0.8),
    percentile(values, 0.95),
  ]);

  return {
    collection: buildFeatureCollection(aggregatedFeatures),
    stats: {
      p50,
      p80,
      p95,
      count: aggregatedFeatures.length,
    },
  };
}

function heatmapWeightExpression(stats) {
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "heatmapEnergy"], 0],
    0,
    0.14,
    stats.p50,
    0.42,
    stats.p80,
    0.72,
    stats.p95,
    1,
  ];
}

function heatmapPointColorExpression(stats) {
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "energibruk_kwh_m2"], ["get", "heatmapEnergy"], 0],
    0,
    "#7dd3fc",
    stats.p50,
    "#2dd4bf",
    stats.p80,
    "#fde047",
    stats.p95,
    "#ef4444",
  ];
}

function unitsToListPayload(units) {
  return JSON.stringify(
    units.map((unit) => {
      const props = unit.properties || unit;

      return {
        id:
          unit.id ||
          props.id ||
          props.coordinateid ||
          props.Coordinateid ||
          props.CoordinateId,
        adresse: props.adresse || props.Adresse || "",
        poststed: props.poststed || props.Poststed || "",
        kommunenavn: props.kommunenavn || props.Kommunenavn || "",
        bruksenhetsNr:
          firstPopulated(
            props.brukenhetsnummer,
            props.brukenhetsNR,
            props.bruksenhetsNr,
            props.bruksenhetsnummer,
            props.Brukenhetsnummer,
            props.BrukenhetsNR,
            props.BruksenhetsNr,
            props.Bruksenhetsnummer,
          ) || "",
        energikarakter: props.energikarakter || props.Energikarakter || "",
        distanceInMeters: props.distanceInMeters,
      };
    }),
  );
}

function nearbyPopupHtml(properties) {
  const coordinateId = escapeHtml(properties.coordinateid ?? "ukjent");
  const latitude = escapeHtml(properties.latitude ?? "Mangler");
  const longitude = escapeHtml(properties.longitude ?? "Mangler");
  const unitCount = properties.unitCount ?? 1;

  let html = `
    <div class="popup-card popup-card-small">
      <div class="popup-kicker">Treff i nærheten</div>
      <div class="popup-title">Koordinat nr. ${coordinateId}</div>
      <div class="popup-subtitle">Breddegrad ${latitude}, lengdegrad ${longitude}</div>
  `;

  if (unitCount > 1) {
    html += `<div class="popup-grid"><div class="popup-metric"><span>Antall enheter</span><strong>${unitCount}</strong></div></div>`;
  } else {
    const unitNumber = escapeHtml(
      firstPopulated(
        properties.brukenhetsnummer,
        properties.brukenhetsNR,
        properties.bruksenhetsNr,
        properties.bruksenhetsnummer,
        properties.Brukenhetsnummer,
        properties.BrukenhetsNR,
        properties.BruksenhetsNr,
        properties.Bruksenhetsnummer,
      ) || "Mangler",
    );
    html += `
      <div class="popup-grid">
        <div class="popup-metric"><span>Enhetsnummer</span><strong>${unitNumber}</strong></div>
      </div>
    `;
  }

  html += `</div>`;
  return html;
}

function nearbyUnitsListHtml(
  units,
  address = "Ukjent adresse",
  coordinates = [0, 0],
) {
  const parsedUnits = JSON.parse(units);
  const addressDisplay = escapeHtml(address);
  const unitsHtml = parsedUnits
    .map(
      (u) => `
      <div class="nearby-unit-item" data-coordinateid="${u.id}">
        <div class="nearby-unit-row">
          <div class="nearby-unit-title">${escapeHtml(u.adresse || "Ukjent adresse")}</div>
          ${
            u.energikarakter
              ? `<div class="energy-badge energy-badge-small ${energyClass(u.energikarakter)}">${escapeHtml(u.energikarakter)}</div>`
              : ""
          }
        </div>
        ${
          u.bruksenhetsNr || u.poststed || u.kommunenavn
            ? `<div class="nearby-unit-location">${escapeHtml([u.bruksenhetsNr ? `Enhet ${u.bruksenhetsNr}` : "", u.poststed, u.kommunenavn].filter(Boolean).join(" | "))}</div>`
            : ""
        }
        ${
          Number.isFinite(Number(u.distanceInMeters))
            ? `<div class="nearby-unit-distance">${Number(u.distanceInMeters).toFixed(0)} m</div>`
            : ""
        }
      </div>
    `,
    )
    .join("");

  return `
    <div class="popup-card popup-card-units" data-lng="${coordinates[0]}" data-lat="${coordinates[1]}">
      <div class="popup-kicker">Enheter på stedet</div>
      <div class="popup-title">${addressDisplay}</div>
      <div class="popup-subtitle"><strong>${parsedUnits.length}</strong> enheter</div>
      <div class="nearby-units-list">
        ${unitsHtml}
      </div>
    </div>
  `;
}

function keepPopupInView(map, popup) {
  requestAnimationFrame(() => {
    const popupElement = popup.getElement();
    const containerElement = map.getContainer();
    if (!popupElement || !containerElement) return;

    const popupRect = popupElement.getBoundingClientRect();
    const containerRect = containerElement.getBoundingClientRect();
    const popupCenterX = popupRect.left + popupRect.width / 2;
    const popupCenterY = popupRect.top + popupRect.height / 2;
    const containerCenterX = containerRect.left + containerRect.width / 2;
    const containerCenterY = containerRect.top + containerRect.height / 2;

    map.panBy(
      [popupCenterX - containerCenterX, popupCenterY - containerCenterY],
      {
        duration: 360,
        essential: true,
      },
    );
  });
}

function openPopup(map, coordinates, html) {
  const popup = new maplibregl.Popup({
    closeButton: true,
    closeOnClick: false,
    offset: 18,
    maxWidth: "none",
  })
    .setLngLat(coordinates)
    .setHTML(html)
    .addTo(map);

  popup._energimerkingState = {
    coordinates: Array.isArray(coordinates)
      ? coordinates.slice()
      : [coordinates.lng, coordinates.lat],
    html,
  };

  keepPopupInView(map, popup);
  return popup;
}

function formatEnergy(value) {
  return Number.isFinite(value) && value > 0
    ? `${Math.round(value)} kWh/m² per år`
    : "Mangler";
}

function MapLegend({ heatmapStats }) {
  const viewMode = useStore((state) => state.viewMode);
  const bydelDisplayMode = useStore((state) => state.bydelDisplayMode);
  const showHeatmapLegend =
    viewMode === "heatmap" ||
    (viewMode === "markers" && bydelDisplayMode === "heatmap");
  const heatmapStart = formatEnergy(heatmapStats.p50);
  const heatmapEnd = `${formatEnergy(heatmapStats.p95)}+`;

  return (
    <div className="map-legend">
      <div className="legend-kicker">Infokort</div>
      {showHeatmapLegend ? (
        <>
          <div className="legend-copy">Beregnet levert energi per byggested</div>
          <div className="legend-gradient" />
          <div className="legend-scale">
            <span>
              <strong>{heatmapStart}</strong>
              <small>lavere</small>
            </span>
            <span>
              <strong>{heatmapEnd}</strong>
              <small>høyere</small>
            </span>
          </div>
        </>
      ) : viewMode === "tiles" ? (
        <div className="legend-list">
          <div className="legend-item">
            <span className="legend-dot dot-building" />
            Attester i Enkel bygg
          </div>
          <div className="legend-copy">
            Farget etter energikarakter.
          </div>
        </div>
      ) : viewMode === "upgrade" ? (
        <>
          <div className="legend-copy">
            Oppgraderingsprioritet basert på eksisterende attestdata. Byggkortene
            forklarer poengsummen.
          </div>
          <div className="legend-gradient priority-gradient" />
          <div className="legend-scale">
            <span>
              <strong>Lav</strong>
              <small>bedre tilstand</small>
            </span>
            <span>
              <strong>Høy</strong>
              <small>undersøk først</small>
            </span>
          </div>
        </>
      ) : (
        <div className="legend-list">
          <div className="legend-item">
            <span className="legend-dot dot-cluster-small" />
            Liten klynge / enkeltenhet
          </div>
          <div className="legend-item">
            <span className="legend-dot dot-cluster-medium" />
            Middels klynge
          </div>
          <div className="legend-item">
            <span className="legend-dot dot-cluster-large" />
            Stor klynge
          </div>
          <div className="legend-item">
            <span className="legend-dot dot-nearby" />
            Resultat fra søk i radius
          </div>
        </div>
      )}
    </div>
  );
}

const MODE_ICONS = {
  markers: MapPin,
  heatmap: Flame,
  tiles: Layers,
  upgrade: TrendingUp,
};

const MODE_DOCK_ITEMS = MAP_VIEW_MODES.map((item) => ({
  ...item,
  Icon: MODE_ICONS[item.value],
}));

function CollapsedModeDock() {
  const sidebarOpen = useStore((state) => state.sidebarOpen);
  const viewMode = useStore((state) => state.viewMode);
  const setViewMode = useStore((state) => state.setViewMode);

  if (sidebarOpen) return null;

  return (
    <div className="collapsed-mode-dock" aria-label="Visningsvalg for kartet">
      {MODE_DOCK_ITEMS.map((item) => {
        const Icon = item.Icon;

        return (
          <button
            key={item.value}
            type="button"
            className={[
              "collapsed-mode-button",
              viewMode === item.value ? "active" : "",
              item.isolated ? "is-tiles-mode" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setViewMode(item.value)}
            aria-label={item.label}
            aria-pressed={viewMode === item.value}
            data-mode={item.value}
            title={item.label}
          >
            <Icon className="mode-icon" aria-hidden="true" strokeWidth={2.2} />
          </button>
        );
      })}
    </div>
  );
}

function mapStyleUrlForTheme(theme) {
  return theme === "dark" ? DARK_MAP_STYLE_URL : LIGHT_MAP_STYLE_URL;
}

function setLayerVisibility(map, layerId, visibility) {
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, "visibility", visibility);
  }
}

// Fra zoom 14 har ingen tile i Oslo flere bygg enn backendens tak (8000), så alle bygg vises.
// Under 14 ville taket kutte 50-95 % av byggene i klumper (målt 2026-11-15).
const MIN_TILE_ZOOM = 14;
// Over 15 strekker kartet tilene fra zoom 15 (maks ca. 2800 bygg per tile) i stedet for å hente nye.
const MAX_TILE_SOURCE_ZOOM = 15;

// Tile-lagene i «Enkel bygg»: lagnavnet i tilene er det samme som valget («enheter» eller «bygg»).
const TILE_LAYER_IDS = {
  enheter: LAYER_IDS.energyTilePoints,
  bygg: LAYER_IDS.energyTileBygg,
};

function tileUrl(visning, ordning) {
  const parametre = `visning=${visning}&ordning=${ordning}`;
  // Testdata (?eksempel=...) lages i nettleseren; ellers hentes ekte tiles fra API-et.
  return brukerEksempelData()
    ? `eksempeltiles://{z}/{x}/{y}?${parametre}`
    : `${window.location.origin}/tiles/{z}/{x}/{y}.pbf?${parametre}`;
}

// Eksempeltilene lages av dev/tiles-eksempel.js, som først lastes når de trengs.
let eksempelProtokollRegistrert = false;
function registrerEksempelProtokoll() {
  if (eksempelProtokollRegistrert || !brukerEksempelData()) return;
  eksempelProtokollRegistrert = true;
  maplibregl.addProtocol("eksempeltiles", async (params) => {
    const { lagEksempelTile } = await import("../dev/tiles-eksempel.js");
    return { data: lagEksempelTile(params.url) };
  });
}

function energyPinExpression(gradeField) {
  return [
    "match",
    ["get", gradeField],
    "A",
    "energy-pin-a",
    "B",
    "energy-pin-b",
    "C",
    "energy-pin-c",
    "D",
    "energy-pin-d",
    "E",
    "energy-pin-e",
    "F",
    "energy-pin-f",
    "G",
    "energy-pin-g",
    "energy-pin-default",
  ];
}

// Sørger for at kartet har riktig kilde og lag for valgt visning og ordning.
// Endres valget, fjernes det gamle laget og kilden, og nye lages (kilden har ordning i adressen).
function ensureTileLayers(map, visning, ordning) {
  const key = `${visning}|${ordning}`;
  const layerId = TILE_LAYER_IDS[visning];
  if (
    map.getSource(SOURCE_IDS.energyTiles) &&
    map.getLayer(layerId) &&
    map._energimerkingTileKey === key
  ) {
    return;
  }

  Object.values(TILE_LAYER_IDS).forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource(SOURCE_IDS.energyTiles)) {
    map.removeSource(SOURCE_IDS.energyTiles);
  }

  registrerEksempelProtokoll();
  map.addSource(SOURCE_IDS.energyTiles, {
    type: "vector",
    tiles: [tileUrl(visning, ordning)],
    minzoom: MIN_TILE_ZOOM,
    maxzoom: MAX_TILE_SOURCE_ZOOM,
  });
  map.addLayer(
    {
      id: layerId,
      type: "symbol",
      source: SOURCE_IDS.energyTiles,
      "source-layer": visning,
      layout: {
        visibility:
          useStore.getState().viewMode === "tiles" ? "visible" : "none",
        "icon-image": energyPinExpression(
          visning === "bygg" ? "median_karakter" : "energikarakter",
        ),
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          0.42,
          14,
          0.58,
          18,
          0.76,
        ],
        "icon-anchor": "bottom",
        "icon-offset": [0, 3],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    },
    map.getLayer(LAYER_IDS.selectedHalo) ? LAYER_IDS.selectedHalo : undefined,
  );
  map._energimerkingTileKey = key;
}

// Setter kilde, lag og filter i «Enkel bygg» etter det som står i butikken akkurat nå.
function applyTileState(map) {
  if (!map?.getLayer(LAYER_IDS.selectedHalo)) return;

  const { enkelVisning, enkelOrdning, filters, filterBounds } =
    useStore.getState();
  ensureTileLayers(map, enkelVisning, enkelOrdning);
  map.setFilter(
    TILE_LAYER_IDS[enkelVisning],
    buildTileFilter(enkelVisning, enkelOrdning, filters, filterBounds),
  );
}

function existingTileLayerIds(map) {
  return Object.values(TILE_LAYER_IDS).filter((id) => map.getLayer(id));
}

function syncMapDataAndVisibility(
  map,
  {
    featureCollection,
    heatmapCollection,
    heatmapStats,
    nearbyCollection,
    nearbyCircleCollection,
    selectedFeature,
    viewMode,
    bydelDisplayMode,
  },
) {
  if (!map?.isStyleLoaded()) return;

  applyTileState(map);
  map.getSource(SOURCE_IDS.buildings)?.setData(featureCollection);
  map.getSource(SOURCE_IDS.heatmapBuildings)?.setData(heatmapCollection);
  map.getSource(SOURCE_IDS.upgradeBuildings)?.setData(featureCollection);
  map.getSource(SOURCE_IDS.nearby)?.setData(nearbyCollection);
  map.getSource(SOURCE_IDS.nearbyCircle)?.setData(nearbyCircleCollection);
  map
    .getSource(SOURCE_IDS.selected)
    ?.setData(
      selectedFeature
        ? buildFeatureCollection([selectedFeature])
        : buildFeatureCollection([]),
    );

  if (map.getLayer(LAYER_IDS.heatmap)) {
    map.setPaintProperty(
      LAYER_IDS.heatmap,
      "heatmap-weight",
      heatmapWeightExpression(heatmapStats),
    );
  }
  if (map.getLayer(LAYER_IDS.heatmapPoints)) {
    map.setPaintProperty(
      LAYER_IDS.heatmapPoints,
      "circle-color",
      heatmapPointColorExpression(heatmapStats),
    );
  }
  if (map.getLayer(LAYER_IDS.heatmapLocations)) {
    map.setPaintProperty(
      LAYER_IDS.heatmapLocations,
      "circle-color",
      heatmapPointColorExpression(heatmapStats),
    );
  }

  const bydelHeatmapActive =
    viewMode === "heatmap" ||
    (viewMode === "markers" && bydelDisplayMode === "heatmap");
  const bydelClustersActive =
    viewMode === "markers" && bydelDisplayMode !== "heatmap";
  const markerVisibility = bydelClustersActive ? "visible" : "none";
  const heatmapVisibility = bydelHeatmapActive ? "visible" : "none";
  const tileVisibility = viewMode === "tiles" ? "visible" : "none";
  const upgradeVisibility = viewMode === "upgrade" ? "visible" : "none";
  const nearbyCircleVisibility = viewMode === "tiles" ? "none" : "visible";

  setLayerVisibility(map, LAYER_IDS.clusters, markerVisibility);
  setLayerVisibility(map, LAYER_IDS.clusterCount, markerVisibility);
  setLayerVisibility(map, LAYER_IDS.points, markerVisibility);
  setLayerVisibility(map, LAYER_IDS.heatmap, heatmapVisibility);
  setLayerVisibility(map, LAYER_IDS.heatmapLocations, heatmapVisibility);
  setLayerVisibility(map, LAYER_IDS.heatmapPoints, heatmapVisibility);
  setLayerVisibility(map, LAYER_IDS.upgradePriorityPoints, upgradeVisibility);
  existingTileLayerIds(map).forEach((id) =>
    setLayerVisibility(map, id, tileVisibility),
  );
  setLayerVisibility(map, LAYER_IDS.nearbyCircle, nearbyCircleVisibility);
}

function addSourceIfMissing(map, sourceId, source) {
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, source);
  }
}

function addLayerIfMissing(map, layer) {
  if (!map.getLayer(layer.id)) {
    map.addLayer(layer);
  }
}

const MAP_PIN_IMAGES = [
  ["map-pin-marker", "#1a73e8"],
  ["map-pin-upgrade-low", "#22c55e"],
  ["map-pin-upgrade-mid", "#facc15"],
  ["map-pin-upgrade-high", "#f97316"],
  ["map-pin-upgrade-critical", "#dc2626"],
  ["map-pin-selected", "#fbbc04"],
  ["map-pin-nearby", "#ea4335"],
  ["energy-pin-a", "#15803d"],
  ["energy-pin-b", "#22c55e"],
  ["energy-pin-c", "#84cc16"],
  ["energy-pin-d", "#facc15"],
  ["energy-pin-e", "#f97316"],
  ["energy-pin-f", "#dc2626"],
  ["energy-pin-g", "#991b1b"],
  ["energy-pin-default", "#64748b"],
];

function createEnergyPinImage(color) {
  const pixelRatio = 2;
  const width = 56;
  const height = 64;
  const canvas = document.createElement("canvas");
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  const context = canvas.getContext("2d");

  context.scale(pixelRatio, pixelRatio);
  context.clearRect(0, 0, width, height);

  context.save();
  context.translate(width / 2, 56);
  context.scale(1, 0.32);
  context.beginPath();
  context.arc(0, 0, 12, 0, Math.PI * 2);
  context.fillStyle = "rgba(0, 0, 0, 0.22)";
  context.fill();
  context.restore();

  context.save();
  context.translate(width / 2, 26);
  context.rotate(Math.PI / 4);
  context.beginPath();
  context.moveTo(-4, -18);
  context.quadraticCurveTo(18, -18, 18, 4);
  context.lineTo(18, 18);
  context.lineTo(4, 18);
  context.quadraticCurveTo(-18, 18, -18, -4);
  context.quadraticCurveTo(-18, -18, -4, -18);
  context.closePath();
  context.lineWidth = 11;
  context.lineJoin = "round";
  context.strokeStyle = color;
  context.stroke();
  context.restore();

  return {
    image: context.getImageData(0, 0, canvas.width, canvas.height),
    pixelRatio,
  };
}

function addMapImages(map) {
  MAP_PIN_IMAGES.forEach(([id, color]) => {
    if (map.hasImage?.(id)) return;

    const { image, pixelRatio } = createEnergyPinImage(color);
    map.addImage(id, image, { pixelRatio });
  });
}

function addMapLayers(map) {
  addMapImages(map);

  addSourceIfMissing(map, SOURCE_IDS.buildings, {
    type: "geojson",
    data: buildFeatureCollection([]),
    cluster: true,
    clusterRadius: 50,
    clusterMaxZoom: 13,
  });

  addSourceIfMissing(map, SOURCE_IDS.heatmapBuildings, {
    type: "geojson",
    data: buildFeatureCollection([]),
  });

  addSourceIfMissing(map, SOURCE_IDS.upgradeBuildings, {
    type: "geojson",
    data: buildFeatureCollection([]),
  });

  addLayerIfMissing(map, {
    id: LAYER_IDS.clusters,
    type: "circle",
    source: SOURCE_IDS.buildings,
    filter: ["has", "point_count"],
    paint: {
      "circle-color": [
        "step",
        ["get", "point_count"],
        "#1a73e8",
        25,
        "#34a853",
        100,
        "#fbbc04",
      ],
      "circle-radius": ["step", ["get", "point_count"], 18, 25, 26, 100, 34],
      "circle-opacity": 0.88,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });

  addLayerIfMissing(map, {
    id: LAYER_IDS.clusterCount,
    type: "symbol",
    source: SOURCE_IDS.buildings,
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["Open Sans Bold"],
      "text-size": 12,
    },
    paint: {
      "text-color": "#ffffff",
    },
  });

  addLayerIfMissing(map, {
    id: LAYER_IDS.points,
    type: "symbol",
    source: SOURCE_IDS.buildings,
    filter: ["!", ["has", "point_count"]],
    layout: {
      "icon-image": "map-pin-marker",
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        0.42,
        12,
        0.62,
        16,
        0.76,
      ],
      "icon-anchor": "bottom",
      "icon-offset": [0, 3],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });

  addLayerIfMissing(map, {
    id: LAYER_IDS.heatmap,
    type: "heatmap",
    source: SOURCE_IDS.heatmapBuildings,
    maxzoom: 22,
    layout: { visibility: "none" },
    paint: {
      "heatmap-weight": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "heatmapEnergy"], 0],
        0,
        0.14,
        60,
        0.42,
        180,
        0.72,
        420,
        1,
      ],
      "heatmap-intensity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        4,
        0.48,
        8,
        0.68,
        12,
        0.82,
        16,
        0.9,
      ],
      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(56, 189, 248, 0)",
        0.08,
        "rgba(125, 211, 252, 0.54)",
        0.28,
        "rgba(45, 212, 191, 0.62)",
        0.52,
        "rgba(163, 230, 53, 0.68)",
        0.74,
        "rgba(253, 224, 71, 0.76)",
        0.9,
        "rgba(253, 186, 116, 0.84)",
        1,
        "rgba(239, 68, 68, 0.92)",
      ],
      "heatmap-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        4,
        16,
        8,
        22,
        12,
        30,
        18,
        42,
      ],
      "heatmap-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        4,
        0.72,
        9,
        0.82,
        16,
        0.76,
        20,
        0.48,
      ],
    },
  });

  addLayerIfMissing(map, {
    id: LAYER_IDS.heatmapLocations,
    type: "circle",
    source: SOURCE_IDS.heatmapBuildings,
    layout: { visibility: "none" },
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        4,
        5,
        8,
        7,
        12,
        10,
        16,
        14,
      ],
      "circle-color": "#2dd4bf",
      "circle-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        4,
        0.42,
        10,
        0.5,
        16,
        0.34,
      ],
      "circle-blur": [
        "interpolate",
        ["linear"],
        ["zoom"],
        4,
        1.1,
        12,
        0.85,
        16,
        0.55,
      ],
      "circle-stroke-width": 0,
    },
  });

  addLayerIfMissing(map, {
    id: LAYER_IDS.heatmapPoints,
    type: "circle",
    source: SOURCE_IDS.buildings,
    filter: ["!", ["has", "point_count"]],
    minzoom: 11,
    layout: { visibility: "none" },
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        3.2,
        11,
        5.2,
        14,
        7.2,
        17,
        9.5,
      ],
      "circle-color": "#2dd4bf",
      "circle-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        0.68,
        12,
        0.82,
        15,
        0.94,
      ],
      "circle-stroke-color": "rgba(255, 255, 255, 0.86)",
      "circle-stroke-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        0.4,
        14,
        1.3,
      ],
    },
  });

  addLayerIfMissing(map, {
    id: LAYER_IDS.upgradePriorityPoints,
    type: "symbol",
    source: SOURCE_IDS.upgradeBuildings,
    layout: {
      visibility: "none",
      "icon-image": [
        "step",
        ["coalesce", ["get", "upgradeScore"], 0],
        "map-pin-upgrade-low",
        45,
        "map-pin-upgrade-mid",
        75,
        "map-pin-upgrade-high",
        100,
        "map-pin-upgrade-critical",
      ],
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        0.38,
        12,
        0.58,
        16,
        0.74,
      ],
      "icon-anchor": "bottom",
      "icon-offset": [0, 3],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });

  addSourceIfMissing(map, SOURCE_IDS.selected, {
    type: "geojson",
    data: buildFeatureCollection([]),
  });
  addLayerIfMissing(map, {
    id: LAYER_IDS.selectedHalo,
    type: "symbol",
    source: SOURCE_IDS.selected,
    layout: {
      "icon-image": "map-pin-selected",
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        0.72,
        14,
        0.92,
        18,
        1.05,
      ],
      "icon-anchor": "bottom",
      "icon-offset": [0, 3],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });
  addLayerIfMissing(map, {
    id: LAYER_IDS.selectedPoint,
    type: "symbol",
    source: SOURCE_IDS.selected,
    layout: {
      "icon-image": "map-pin-selected",
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        0.5,
        14,
        0.68,
        18,
        0.82,
      ],
      "icon-anchor": "bottom",
      "icon-offset": [0, 3],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });

  addSourceIfMissing(map, SOURCE_IDS.nearby, {
    type: "geojson",
    data: buildFeatureCollection([]),
  });
  addLayerIfMissing(map, {
    id: LAYER_IDS.nearby,
    type: "symbol",
    source: SOURCE_IDS.nearby,
    layout: {
      "icon-image": "map-pin-nearby",
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        0.42,
        12,
        0.58,
        16,
        0.72,
      ],
      "icon-anchor": "bottom",
      "icon-offset": [0, 3],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });

  addSourceIfMissing(map, SOURCE_IDS.nearbyCircle, {
    type: "geojson",
    data: buildFeatureCollection([]),
  });
  addLayerIfMissing(map, {
    id: LAYER_IDS.nearbyCircle,
    type: "fill",
    source: SOURCE_IDS.nearbyCircle,
    paint: {
      "fill-color": "#ea4335",
      "fill-opacity": 0.12,
      "fill-outline-color": "#ea4335",
    },
  });

  const { enkelVisning, enkelOrdning } = useStore.getState();
  ensureTileLayers(map, enkelVisning, enkelOrdning);
}

function MapView({
  features,
  allFeaturesCount,
  selectedFeature,
  searchSelection,
  nearbyState,
  selectedBydel,
  onMapClick,
  isSearchingNearby,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const featuresRef = useRef(features);
  const allFeatures = useStore((state) => state.allFeatures);
  const allFeaturesRef = useRef(allFeatures);
  const mapClickRef = useRef(onMapClick);
  const hasFittedRef = useRef(false);
  const theme = useStore((state) => state.theme);
  const viewMode = useStore((state) => state.viewMode);
  const bydelDisplayMode = useStore((state) => state.bydelDisplayMode);
  const nearbySearchEnabled = useStore((state) => state.nearbySearchEnabled);
  const radiusInMeters = useStore((state) => state.radiusInMeters);
  const setSelectedFeature = useStore((state) => state.setSelectedFeature);
  const ordning = useStore((state) => state.ordning);
  const enkelVisning = useStore((state) => state.enkelVisning);
  const enkelOrdning = useStore((state) => state.enkelOrdning);
  const filters = useStore((state) => state.filters);
  const filterBounds = useStore((state) => state.filterBounds);
  const punktInfo = useStore((state) => state.punktInfo);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);
  const featureCollection = useMemo(
    () => buildFeatureCollection(features),
    [features],
  );
  const heatmapData = useMemo(() => buildHeatmapData(features), [features]);
  const nearbyCollection = useMemo(
    () => buildNearbyGeoJson(nearbyState.results),
    [nearbyState.results],
  );
  const nearbyCircleCollection = useMemo(() => {
    if (!nearbyState.center) return buildFeatureCollection([]);
    return buildNearbyCircleGeoJson(
      nearbyState.center.longitude,
      nearbyState.center.latitude,
      nearbyState.radiusInMeters,
    );
  }, [nearbyState.center, nearbyState.radiusInMeters]);
  const featureCollectionRef = useRef(featureCollection);
  const heatmapCollectionRef = useRef(heatmapData.collection);
  const heatmapStatsRef = useRef(heatmapData.stats);
  const nearbyCollectionRef = useRef(nearbyCollection);
  const nearbyCircleCollectionRef = useRef(nearbyCircleCollection);
  const selectedFeatureRef = useRef(selectedFeature);
  const mapStyleUrlRef = useRef(mapStyleUrlForTheme(theme));
  const viewModeRef = useRef(viewMode);
  const bydelDisplayModeRef = useRef(bydelDisplayMode);
  const nearbySearchEnabledRef = useRef(nearbySearchEnabled);
  const radiusInMetersRef = useRef(radiusInMeters);
  const selectedBydelRef = useRef(selectedBydel);

  useEffect(() => {
    featuresRef.current = features;
  }, [features]);

  useEffect(() => {
    allFeaturesRef.current = allFeatures;
  }, [allFeatures]);

  useEffect(() => {
    featureCollectionRef.current = featureCollection;
  }, [featureCollection]);

  useEffect(() => {
    heatmapCollectionRef.current = heatmapData.collection;
    heatmapStatsRef.current = heatmapData.stats;
  }, [heatmapData]);

  useEffect(() => {
    nearbyCollectionRef.current = nearbyCollection;
  }, [nearbyCollection]);

  useEffect(() => {
    nearbyCircleCollectionRef.current = nearbyCircleCollection;
  }, [nearbyCircleCollection]);

  useEffect(() => {
    selectedFeatureRef.current = selectedFeature;
  }, [selectedFeature]);

  useEffect(() => {
    mapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    bydelDisplayModeRef.current = bydelDisplayMode;
  }, [bydelDisplayMode]);

  useEffect(() => {
    nearbySearchEnabledRef.current = nearbySearchEnabled;
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = nearbySearchEnabled
        ? "crosshair"
        : "";
    }
  }, [nearbySearchEnabled]);

  useEffect(() => {
    radiusInMetersRef.current = radiusInMeters;
  }, [radiusInMeters]);

  useEffect(() => {
    selectedBydelRef.current = selectedBydel;
  }, [selectedBydel]);

  const ensureTilesMinZoom = useCallback((map) => {
    if (!map || viewModeRef.current !== "tiles") return;

    if (!map.isStyleLoaded()) {
      map.once("idle", () => {
        if (mapRef.current === map) ensureTilesMinZoom(map);
      });
      return;
    }

    if (map.getZoom() < MIN_TILE_ZOOM) {
      const activeBydel = selectedBydelRef.current;
      map.easeTo({
        center: activeBydel
          ? [activeBydel.longitude, activeBydel.latitude]
          : map.getCenter(),
        zoom: MIN_TILE_ZOOM,
        duration: 600,
        essential: true,
      });
    }
  }, []);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return undefined;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapStyleUrlRef.current,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
      locale: {
        "Map.Title": "Kart",
        "NavigationControl.ZoomIn": "Zoom inn",
        "NavigationControl.ZoomOut": "Zoom ut",
        "NavigationControl.ResetBearing": "Dra for å rotere kartet, klikk for å nullstille retningen til nord",
        "Popup.Close": "Lukk popup",
      },
    });

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "bottom-right",
    );
    setZoomLevel(map.getZoom());

    const updateZoomLevel = () => {
      setZoomLevel(Number(map.getZoom().toFixed(1)));
    };

    map.on("zoom", updateZoomLevel);

    map.on("load", () => {
      addMapLayers(map);
      const syncInitialData = () =>
        syncMapDataAndVisibility(map, {
          featureCollection: featureCollectionRef.current,
          heatmapCollection: heatmapCollectionRef.current,
          heatmapStats: heatmapStatsRef.current,
          nearbyCollection: nearbyCollectionRef.current,
          nearbyCircleCollection: nearbyCircleCollectionRef.current,
          selectedFeature: selectedFeatureRef.current,
          viewMode: viewModeRef.current,
          bydelDisplayMode: bydelDisplayModeRef.current,
        });
      syncInitialData();
      // Stilen regnes ikke som ferdig lastet rett etter at lagene er lagt til.
      // Er dataene allerede hentet (f.eks. fra hurtigbufferen), må de settes inn igjen når kartet er i ro.
      map.once("idle", syncInitialData);
      ensureTilesMinZoom(map);

      map.on("click", LAYER_IDS.clusters, (event) => {
        const clusterFeature = map.queryRenderedFeatures(event.point, {
          layers: [LAYER_IDS.clusters],
        })[0];
        const clusterId = clusterFeature.properties.cluster_id;
        map
          .getSource(SOURCE_IDS.buildings)
          .getClusterExpansionZoom(clusterId, (error, zoom) => {
            if (!error)
              map.easeTo({ center: clusterFeature.geometry.coordinates, zoom });
          });
      });

      map.on("click", LAYER_IDS.points, (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const selected = findFeatureById(
          allFeaturesRef.current,
          feature.properties.id,
        );
        const unitsAtLocation = selected
          ? findUnitsAtFeatureLocation(allFeaturesRef.current, selected)
          : [];
        const coordinates =
          selected?.geometry?.coordinates?.slice() ||
          feature.geometry.coordinates.slice();
        const address =
          selected?.properties?.adresse ||
          feature.properties.adresse ||
          "Ukjent adresse";
        setSelectedFeature(selected || null);
        popupRef.current?.remove();
        popupRef.current = openPopup(
          map,
          coordinates,
          unitsAtLocation.length > 1
            ? nearbyUnitsListHtml(
                unitsToListPayload(unitsAtLocation),
                address,
                coordinates,
              )
            : popupHtmlForMode(
                selected?.properties || feature.properties,
                "markers",
              ),
        );
      });

      map.on("click", LAYER_IDS.heatmapPoints, (event) => {
        const feature = event.features?.[0];
        if (!feature) return;

        const selected = findFeatureById(
          allFeaturesRef.current,
          feature.properties.id,
        );
        const unitsAtLocation = selected
          ? findUnitsAtFeatureLocation(allFeaturesRef.current, selected)
          : [];
        const coordinates =
          selected?.geometry?.coordinates?.slice() ||
          feature.geometry.coordinates.slice();
        const address =
          selected?.properties?.adresse ||
          feature.properties.adresse ||
          "Ukjent adresse";

        setSelectedFeature(selected || null);
        popupRef.current?.remove();
        popupRef.current = openPopup(
          map,
          coordinates,
          unitsAtLocation.length > 1
            ? nearbyUnitsListHtml(
                unitsToListPayload(unitsAtLocation),
                address,
                coordinates,
              )
            : popupHtmlForMode(
                selected?.properties || feature.properties,
                "heatmap",
              ),
        );
      });

      map.on("click", LAYER_IDS.upgradePriorityPoints, (event) => {
        const feature = event.features?.[0];
        if (!feature) return;

        const selected = findFeatureById(
          allFeaturesRef.current,
          feature.properties.id,
        );
        const unitsAtLocation = selected
          ? findUnitsAtFeatureLocation(allFeaturesRef.current, selected)
          : [];
        const coordinates =
          selected?.geometry?.coordinates?.slice() ||
          feature.geometry.coordinates.slice();
        const address =
          selected?.properties?.adresse ||
          feature.properties.adresse ||
          "Ukjent adresse";

        setSelectedFeature(selected || null);
        popupRef.current?.remove();
        popupRef.current = openPopup(
          map,
          coordinates,
          unitsAtLocation.length > 1
            ? nearbyUnitsListHtml(
                unitsToListPayload(unitsAtLocation),
                address,
                coordinates,
              )
            : popupHtmlForMode(
                selected?.properties || feature.properties,
                "upgrade",
              ),
        );
      });

      // Tilene har alt popupen trenger, så det hentes ingenting fra API-et ved klikk.
      // Lagnavnet i tilen sier om punktet er en enhet eller et bygg.
      Object.entries(TILE_LAYER_IDS).forEach(([visning, layerId]) => {
        map.on("click", layerId, (event) => {
          const feature = event.features?.[0];
          if (!feature) return;

          popupRef.current?.remove();
          popupRef.current = openPopup(
            map,
            feature.geometry.coordinates.slice(),
            visning === "bygg"
              ? byggPopupHtml(feature.properties || {})
              : enhetPopupHtml(feature.properties || {}),
          );
        });
      });

      // Add delegated click handler for unit selection at the document level
      const handleUnitSelection = (e) => {
        const unitItem = e.target.closest(".nearby-unit-item");
        if (!unitItem) return;

        e.preventDefault();
        e.stopPropagation();

        const coordinateId = unitItem.getAttribute("data-coordinateid");
        const popupCard = unitItem.closest(".popup-card-units");
        const lng = popupCard?.getAttribute("data-lng");
        const lat = popupCard?.getAttribute("data-lat");

        const selected = findFeatureById(allFeaturesRef.current, coordinateId);

        if (selected) {
          setSelectedFeature(selected);
          // Ensure the current popup is fully removed
          if (popupRef.current) {
            popupRef.current.remove();
            popupRef.current = null;
          }

          // Use a small delay to ensure removal is complete
          setTimeout(() => {
            popupRef.current = openPopup(
              map,
              [parseFloat(lng) || 0, parseFloat(lat) || 0],
              popupHtmlForMode(selected.properties, viewModeRef.current),
            );
          }, 100);
        }
      };

      const handlePopupOutsideClick = (event) => {
        if (!popupRef.current) return;
        const popupElement = popupRef.current.getElement();
        if (popupElement?.contains(event.target)) return;
        if (
          event.target.closest(
            ".sidebar-shell, .collapsed-mode-dock, .top-overlay",
          )
        )
          return;

        popupRef.current.remove();
        popupRef.current = null;
        setSelectedFeature(null);
      };

      // Use capture because MapLibre popups can stop bubbling before document sees the click.
      document.addEventListener("click", handleUnitSelection, true);
      document.addEventListener("mousedown", handlePopupOutsideClick, true);

      // Store cleanup function
      const cleanup = () => {
        document.removeEventListener("click", handleUnitSelection, true);
        document.removeEventListener(
          "mousedown",
          handlePopupOutsideClick,
          true,
        );
      };

      mapRef.current._cleanup = cleanup;

      map.on("click", LAYER_IDS.nearby, (event) => {
        const feature = event.features?.[0];
        if (!feature) return;

        const unitCount = feature.properties.unitCount ?? 1;
        popupRef.current?.remove();

        if (unitCount > 1) {
          // Show list of units
          // Get address from the first unit's building
          const parsedUnits = JSON.parse(feature.properties.units);
          const firstBuildingId = parsedUnits[0]?.id;
          const firstBuilding = firstBuildingId
            ? findFeatureById(allFeaturesRef.current, firstBuildingId)
            : null;
          const address =
            firstBuilding?.properties?.adresse || "Ukjent adresse";
          const enrichedUnits = parsedUnits.map(
            (unit) => findFeatureById(allFeaturesRef.current, unit.id) || unit,
          );

          // Store a reference to the current feature for the event handler
          const currentFeatureCoordinates =
            feature.geometry.coordinates.slice();

          popupRef.current = openPopup(
            map,
            currentFeatureCoordinates,
            nearbyUnitsListHtml(
              unitsToListPayload(enrichedUnits),
              address,
              currentFeatureCoordinates,
            ),
          );
        } else {
          // Single unit - show full building info
          const selected = findFeatureById(
            allFeaturesRef.current,
            feature.properties.coordinateid,
          );
          setSelectedFeature(selected || null);
          popupRef.current = openPopup(
            map,
            feature.geometry.coordinates.slice(),
            selected
              ? enhetPopupHtml(selected.properties)
              : nearbyPopupHtml(feature.properties),
          );
        }
      });

      map.on("click", (event) => {
        const hits = map.queryRenderedFeatures(event.point, {
          layers: [
            LAYER_IDS.clusters,
            LAYER_IDS.points,
            LAYER_IDS.heatmapPoints,
            LAYER_IDS.upgradePriorityPoints,
            ...existingTileLayerIds(map),
            LAYER_IDS.nearby,
          ],
        });
        if (hits.length > 0) return;
        popupRef.current?.remove();
        popupRef.current = null;
        setSelectedFeature(null);
        if (!nearbySearchEnabledRef.current) return;
        mapClickRef.current({
          latitude: Number(event.lngLat.lat.toFixed(6)),
          longitude: Number(event.lngLat.lng.toFixed(6)),
          radiusInMeters: radiusInMetersRef.current,
        });
      });

      [
        LAYER_IDS.clusters,
        LAYER_IDS.points,
        LAYER_IDS.heatmapPoints,
        LAYER_IDS.upgradePriorityPoints,
        ...Object.values(TILE_LAYER_IDS),
        LAYER_IDS.nearby,
      ].forEach((layerId) => {
        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = nearbySearchEnabledRef.current
            ? "crosshair"
            : "";
        });
      });
    });

    mapRef.current = map;
    return () => {
      popupRef.current?.remove();
      mapRef.current?._cleanup?.();
      map.off("zoom", updateZoomLevel);
      map.remove();
      mapRef.current = null;
    };
  }, [ensureTilesMinZoom, setSelectedFeature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const nextStyleUrl = mapStyleUrlForTheme(theme);
    if (mapStyleUrlRef.current === nextStyleUrl) return;

    mapStyleUrlRef.current = nextStyleUrl;
    map.once("style.load", () => {
      const activePopup = popupRef.current;
      const popupState = activePopup?.isOpen?.()
        ? activePopup._energimerkingState
        : null;
      if (activePopup && !activePopup.isOpen?.()) {
        popupRef.current = null;
      }
      addMapLayers(map);
      const restoreMapOverlays = () => {
        addMapLayers(map);
        syncMapDataAndVisibility(map, {
          featureCollection: featureCollectionRef.current,
          heatmapCollection: heatmapCollectionRef.current,
          heatmapStats: heatmapStatsRef.current,
          nearbyCollection: nearbyCollectionRef.current,
          nearbyCircleCollection: nearbyCircleCollectionRef.current,
          selectedFeature: selectedFeatureRef.current,
          viewMode: viewModeRef.current,
          bydelDisplayMode: bydelDisplayModeRef.current,
        });
      };

      restoreMapOverlays();
      if (popupState) {
        popupRef.current?.remove();
        popupRef.current = openPopup(
          map,
          popupState.coordinates,
          popupState.html,
        );
      }
      map.once("idle", restoreMapOverlays);
    });
    map.setStyle(nextStyleUrl, { diff: false });
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    syncMapDataAndVisibility(map, {
      featureCollection,
      heatmapCollection: heatmapData.collection,
      heatmapStats: heatmapData.stats,
      nearbyCollection,
      nearbyCircleCollection,
      selectedFeature,
      viewMode,
      bydelDisplayMode,
    });
  }, [
    bydelDisplayMode,
    featureCollection,
    heatmapData,
    nearbyCollection,
    nearbyCircleCollection,
    selectedFeature,
    viewMode,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (viewMode === "tiles") ensureTilesMinZoom(map);
  }, [ensureTilesMinZoom, viewMode]);

  // Bytter kilde, lag og filter i «Enkel bygg» når valget eller filtrene endres.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyTileState(map);
    existingTileLayerIds(map).forEach((id) =>
      setLayerVisibility(map, id, viewMode === "tiles" ? "visible" : "none"),
    );
    if (viewMode === "tiles") popupRef.current?.remove();
  }, [enkelVisning, enkelOrdning, filters, filterBounds, viewMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const source = map.getSource(SOURCE_IDS.selected);
    if (!source) return;
    if (!selectedFeature) {
      source.setData(buildFeatureCollection([]));
      popupRef.current?.remove();
      return;
    }
    source.setData(buildFeatureCollection([selectedFeature]));
    map.flyTo({
      center: selectedFeature.geometry.coordinates,
      zoom: Math.max(map.getZoom(), 14),
      duration: 1200,
      essential: true,
    });
  }, [selectedFeature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !searchSelection?.featureId) return;

    const searchedFeature = findFeatureById(
      allFeaturesRef.current,
      searchSelection.featureId,
    );
    if (!searchedFeature) return;

    const unitsAtLocation = findUnitsAtFeatureLocation(
      allFeaturesRef.current,
      searchedFeature,
    );
    const coordinates = searchedFeature.geometry.coordinates.slice();
    const address = searchedFeature.properties?.adresse || "Ukjent adresse";

    popupRef.current?.remove();
    popupRef.current = openPopup(
      map,
      coordinates,
      unitsAtLocation.length > 1
        ? nearbyUnitsListHtml(
            unitsToListPayload(unitsAtLocation),
            address,
            coordinates,
          )
        : enhetPopupHtml(searchedFeature.properties),
    );
  }, [searchSelection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const nearbySource = map.getSource(SOURCE_IDS.nearby);
    const circleSource = map.getSource(SOURCE_IDS.nearbyCircle);
    if (nearbySource) nearbySource.setData(nearbyCollection);
    if (circleSource) circleSource.setData(nearbyCircleCollection);
  }, [nearbyCollection, nearbyCircleCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (
      !map ||
      hasFittedRef.current ||
      allFeaturesCount === 0 ||
      features.length === 0
    )
      return;
    const activeBydel = selectedBydelRef.current;
    if (activeBydel) {
      map.easeTo({
        center: [activeBydel.longitude, activeBydel.latitude],
        zoom: activeBydel.zoom || 11,
        duration: 1200,
        essential: true,
      });
      hasFittedRef.current = true;
      return;
    }

    const coordinates = features.map((feature) => feature.geometry.coordinates);
    const bounds = coordinates.reduce(
      (accumulator, coordinate) => accumulator.extend(coordinate),
      new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
    );
    map.fitBounds(bounds, {
      padding: { top: 140, right: 80, bottom: 80, left: 420 },
      duration: 1400,
      maxZoom: 12,
    });
    hasFittedRef.current = true;
  }, [allFeaturesCount, features]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !selectedBydel) return;
    const bydelZoom = selectedBydel.zoom || 11;
    map.easeTo({
      center: [selectedBydel.longitude, selectedBydel.latitude],
      // I «Enkel bygg» vises byggene først fra MIN_TILE_ZOOM; ellers blir kartet tomt.
      zoom:
        viewModeRef.current === "tiles"
          ? Math.max(bydelZoom, MIN_TILE_ZOOM)
          : bydelZoom,
      duration: 900,
      essential: true,
    });
  }, [selectedBydel]);

  return (
    <div className="map-shell">
      <div ref={mapContainerRef} className="map-canvas" />
      <CollapsedModeDock />
      <div className="zoom-readout">Zoom {zoomLevel.toFixed(1)}</div>
      <div className="map-floating">
        {viewMode !== "tiles" && <MapLegend heatmapStats={heatmapData.stats} />}
        {viewMode === "tiles" && (
          <div className="map-pill">
            Viser {enkelVisning === "bygg" ? "ett punkt per bygg (median for enhetene)" : "ett punkt per enhet"},{" "}
            {ordningLabel(enkelOrdning).toLowerCase()}
          </div>
        )}
        {viewMode === "tiles" && zoomLevel < MIN_TILE_ZOOM && (
          <div className="map-pill is-hint">
            Zoom inn for å se {enkelVisning === "bygg" ? "byggene" : "enhetene"}
          </div>
        )}
        {(viewMode === "markers" || viewMode === "upgrade") && (
          <div className="map-pill">
            Viser {ordningLabel(viewMode === "upgrade" ? "gammel" : ordning)}
          </div>
        )}
        {viewMode !== "tiles" && punktInfo.avkortet && (
          <div className="map-pill is-hint" role="status">
            Kartet viser bare de første {punktInfo.antall.toLocaleString("nb-NO")}{" "}
            enhetene i området. Det finnes flere.
          </div>
        )}
        {nearbySearchEnabled && (
          <div className="map-pill is-hint">
            Klikk i kartet for å søke innenfor {radiusInMeters.toLocaleString()} m
          </div>
        )}
        {isSearchingNearby && (
          <div className="map-pill is-loading">
            <span className="map-pill-loader" aria-hidden="true" />
            Finner enheter i nærheten innenfor {radiusInMeters.toLocaleString()}{" "}
            m …
          </div>
        )}
        {nearbyState.results.length > 0 && (
          <div className="map-pill is-count">
            <strong>{nearbyState.results.length}</strong> enheter i nærheten
            (maks 200)
          </div>
        )}
      </div>
    </div>
  );
}

export default MapView;
