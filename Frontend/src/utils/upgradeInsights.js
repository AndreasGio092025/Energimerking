import { heatingGradeName } from './constants.js';

const CURRENT_ANALYSIS_YEAR = 2026;
const STALE_CERTIFICATE_YEAR = CURRENT_ANALYSIS_YEAR - 10;

const VALID_ENERGY_GRADES = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
const VALID_HEATING_GRADES = new Set(['GREEN', 'YELLOW', 'ORANGE', 'RED']);

const UNIT_NUMBER_KEYS = [
  'bruksenhetsNr',
  'bruksenhetsnummer',
  'BruksenhetsNr',
  'Bruksenhetsnummer',
  'brukenhetsnummer',
  'brukenhetsNR',
  'Brukenhetsnummer',
  'BrukenhetsNR'
];

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function firstValue(properties, keys) {
  for (const key of keys) {
    if (hasValue(properties?.[key])) return properties[key];
  }

  return '';
}

function toNumber(value, fallback = null) {
  if (!hasValue(value)) return fallback;

  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeGrade(value) {
  return String(value || '').trim().toUpperCase();
}

function parseCertificateYear(value) {
  if (!hasValue(value)) return null;

  const directYear = toNumber(value);
  if (Number.isFinite(directYear) && directYear >= 1900 && directYear <= CURRENT_ANALYSIS_YEAR) {
    return directYear;
  }

  const text = String(value).trim();
  const isoYear = text.match(/^(\d{4})/);
  if (isoYear) return toNumber(isoYear[1]);

  const localDate = text.match(/(?:^|\D)(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\D|$)/);
  if (localDate) return toNumber(localDate[3]);

  const timestamp = Date.parse(text);
  if (Number.isFinite(timestamp)) {
    return new Date(timestamp).getUTCFullYear();
  }

  return null;
}

function certificateYearFromProperties(properties) {
  const normalizedYear = toNumber(properties?.certificateIssuedYear);
  if (
    Number.isFinite(normalizedYear) &&
    normalizedYear >= 1900 &&
    normalizedYear <= CURRENT_ANALYSIS_YEAR
  ) {
    return normalizedYear;
  }

  return parseCertificateYear(properties?.utstedelsesdato);
}

function formatEnergyUse(value) {
  return Number.isFinite(value) && value > 0 ? `${Math.round(value)} kWh/m² per år` : 'Mangler';
}

function formatBuildYear(value) {
  return Number.isFinite(value) && value > 0 ? String(Math.round(value)) : 'Mangler';
}

function addRecommendation(items, text) {
  if (!items.includes(text)) items.push(text);
}

function driver(tone, label, detail) {
  return { tone, label, detail };
}

function buildConfidence(availableCoreCount, totalCoreCount) {
  if (availableCoreCount >= 4) {
    return {
      level: 'high',
      label: 'Høy',
      copy: `${availableCoreCount}/${totalCoreCount} kjerneopplysninger tilgjengelig.`
    };
  }

  if (availableCoreCount === 3) {
    return {
      level: 'medium',
      label: 'Middels',
      copy: `${availableCoreCount}/${totalCoreCount} kjerneopplysninger tilgjengelig.`
    };
  }

  return {
    level: 'low',
    label: 'Begrenset',
    copy: `${availableCoreCount}/${totalCoreCount} kjerneopplysninger tilgjengelig.`
  };
}

export function buildUpgradeInsights(properties = {}) {
  const energyGrade = normalizeGrade(properties.energikarakter);
  const heatingGrade = normalizeGrade(properties.oppvarmingskarakter);
  const energyUse = toNumber(properties.energibruk_kwh_m2 ?? properties.beregnetLevertEnergiTotaltkWhm2);
  const buildYear = toNumber(properties.byggeaar);
  const certificateYear = certificateYearFromProperties(properties);
  const unitNumber = firstValue(properties, UNIT_NUMBER_KEYS);

  const hasEnergyGrade = VALID_ENERGY_GRADES.has(energyGrade);
  const hasHeatingGrade = VALID_HEATING_GRADES.has(heatingGrade);
  const hasEnergyUse = Number.isFinite(energyUse) && energyUse > 0;
  const hasBuildYear = Number.isFinite(buildYear) && buildYear > 0;
  const hasCertificateYear = Number.isFinite(certificateYear);

  const drivers = [];
  const recommendations = [];

  if (!hasEnergyGrade) {
    drivers.push(driver('missing', 'Energikarakter mangler', 'Prioritetsanslaget bruker en nøytral karakter i stedet.'));
  } else if (['E', 'F', 'G'].includes(energyGrade)) {
    drivers.push(driver('high', `Energikarakter ${energyGrade}`, 'Svak ytelse i bygningskroppen er et sterkt signal om oppgradering.'));
    addRecommendation(recommendations, 'Sjekk isolasjon, vinduer, varmegjenvinning i ventilasjonen og lufttetthet først.');
  } else if (['C', 'D'].includes(energyGrade)) {
    drivers.push(driver('medium', `Energikarakter ${energyGrade}`, 'Middels ytelse tilsier målrettede kontroller av bygningskroppen.'));
    addRecommendation(recommendations, 'Sjekk loftsisolasjon, tilstanden på vinduene, ventilasjonsinnstillinger og potensialet for varmegjenvinning.');
  } else {
    drivers.push(driver('low', `Energikarakter ${energyGrade}`, 'Den registrerte karakteren gjør energioppgradering mindre påkrevd.'));
    addRecommendation(recommendations, 'Bekreft mindre effektiviseringstiltak som styring, tetting og justering av ventilasjon.');
  }

  if (!hasEnergyUse) {
    drivers.push(driver('missing', 'Beregnet levert energi mangler', 'kWh/m² per år er ikke tilgjengelig, så anslaget bygger mer på karakterer og alder.'));
  } else if (energyUse >= 300) {
    drivers.push(driver('high', `${formatEnergyUse(energyUse)} beregnet levert energi`, 'Høy beregnet levert energi øker prioriteten.'));
    addRecommendation(recommendations, 'Sammenlign den beregnede leverte energien i energiattesten med lignende bygg i nærheten før du velger tiltak.');
  } else if (energyUse >= 180) {
    drivers.push(driver('medium', `${formatEnergyUse(energyUse)} beregnet levert energi`, 'Middels til høy beregnet levert energi tilsier nærmere undersøkelse.'));
  } else {
    drivers.push(driver('low', `${formatEnergyUse(energyUse)} beregnet levert energi`, 'Beregnet levert energi dominerer ikke denne poengsummen.'));
  }

  if (!hasHeatingGrade) {
    drivers.push(driver('missing', 'Oppvarmingskarakter mangler', 'Kvaliteten på oppvarmingskilden er ikke tilgjengelig for dette anslaget.'));
  } else if (['RED', 'ORANGE'].includes(heatingGrade)) {
    drivers.push(driver('high', `Oppvarmingskarakter ${heatingGradeName(heatingGrade)}`, 'Kvaliteten på oppvarmingskilden er et sterkt signal om oppgradering.'));
    addRecommendation(recommendations, 'Vurder oppvarmingsløsninger som varmepumpe, fjernvarme eller en annen fornybar kilde som ikke er direkte elektrisk.');
  } else if (heatingGrade === 'YELLOW') {
    drivers.push(driver('medium', 'Oppvarmingskarakter gul', 'Oppvarmingen er delvis fornybar, men andelen kan kanskje økes.'));
    addRecommendation(recommendations, 'Vurder om økt andel fornybar oppvarming ville gitt en bedre energiattest.');
  } else {
    drivers.push(driver('low', 'Oppvarmingskarakter grønn', 'Kvaliteten på oppvarmingskilden gjør oppgradering av oppvarmingen mindre påkrevd.'));
  }

  if (!hasBuildYear) {
    drivers.push(driver('missing', 'Byggeår mangler', 'Aldersrelatert risiko for bygningskroppen kan ikke vurderes.'));
  } else if (buildYear < 1987) {
    drivers.push(driver('high', `Byggeår ${Math.round(buildYear)}`, 'Eldre byggeår øker prioriteten for kontroll av bygningskroppen.'));
    addRecommendation(recommendations, 'Undersøk varmetap gjennom tak, vegger, vinduer og gulv før kostbare endringer i tekniske anlegg.');
  } else if (buildYear < 2010) {
    drivers.push(driver('medium', `Byggeår ${Math.round(buildYear)}`, 'Alderen kan fortsatt tilsi målrettede kontroller av bygningskroppen.'));
  } else {
    drivers.push(driver('low', `Byggeår ${Math.round(buildYear)}`, 'Nyere byggeår gir lavere aldersrelatert prioritet.'));
  }

  if (!hasCertificateYear) {
    drivers.push(driver('missing', 'Attestdato ukjent', 'Anslaget kan ikke si om attesten gjenspeiler nylig utført arbeid.'));
    addRecommendation(recommendations, 'Bekreft attestdato og manglende opplysninger før du bruker dette som arbeidsliste.');
  } else if (certificateYear < STALE_CERTIFICATE_YEAR) {
    drivers.push(driver('medium', `Attest fra ${certificateYear}`, 'Eldre attester gjenspeiler kanskje ikke nylige oppgraderinger.'));
    addRecommendation(recommendations, 'Kontroller gjeldende attest og eventuelle nylige oppussinger før du planlegger arbeid.');
  }

  if (recommendations.length === 0) {
    addRecommendation(recommendations, 'Bruk poengsummen som et grovt signal, og kontroller attestdataene før du planlegger tiltak.');
  }

  const availableCoreCount = [
    hasEnergyGrade,
    hasHeatingGrade,
    hasEnergyUse,
    hasBuildYear,
    hasCertificateYear
  ].filter(Boolean).length;

  return {
    confidence: buildConfidence(availableCoreCount, 5),
    drivers: drivers.slice(0, 7),
    recommendations: recommendations.slice(0, 4),
    dataUsed: [
      { label: 'Energikarakter', value: hasEnergyGrade ? energyGrade : 'Mangler', missing: !hasEnergyGrade },
      { label: 'Oppvarmingskarakter', value: hasHeatingGrade ? (heatingGradeName(heatingGrade)) : 'Mangler', missing: !hasHeatingGrade },
      { label: 'Beregnet levert energi', value: formatEnergyUse(energyUse), missing: !hasEnergyUse },
      { label: 'Byggeår', value: formatBuildYear(buildYear), missing: !hasBuildYear },
      { label: 'Attestår', value: hasCertificateYear ? String(certificateYear) : 'Ukjent dato', missing: !hasCertificateYear },
      { label: 'Ordning', value: properties.certificateSchemeLabel || properties.certificateScheme || 'Ukjent', missing: !hasValue(properties.certificateSchemeLabel || properties.certificateScheme) },
      { label: 'Materialvalg', value: properties.materialvalg || 'Ikke registrert', missing: !hasValue(properties.materialvalg) },
      { label: 'Enhet', value: unitNumber || 'Ikke registrert', missing: !hasValue(unitNumber) }
    ]
  };
}
