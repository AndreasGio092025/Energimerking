import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Database, Flame, Landmark, Layers, MapPin, PlugZap, TrendingUp } from 'lucide-react';
import { fetchBydelStats, fetchEnhetStatistikk } from '../services/api.js';
import { useStore } from '../store/useStore.js';
import { BYDEL_DISPLAY_MODES, MAP_VIEW_MODES, heatingGradeName } from '../utils/constants.js';
import { OSLO_BYDELER, findBydel } from '../utils/osloBydeler.js';
import { ORDNINGER, ordningLabel } from '../utils/enheter.js';

function RangeField({ label, min, max, value, onChange, suffix = '', step = 1, tooltip = '' }) {
  const [draftValue, setDraftValue] = useState(value);
  const draftValueRef = useRef(value);
  const [currentMin, currentMax] = draftValue;
  const span = max - min || 1;
  const minPercent = ((currentMin - min) / span) * 100;
  const maxPercent = ((currentMax - min) / span) * 100;

  useEffect(() => {
    setDraftValue(value);
    draftValueRef.current = value;
  }, [value]);

  const updateDraftValue = (nextValue) => {
    draftValueRef.current = nextValue;
    setDraftValue(nextValue);
  };

  const commitDraftValue = () => {
    onChange(draftValueRef.current);
  };

  const updateMin = (nextValue) => {
    updateDraftValue([Math.min(Number(nextValue), currentMax), currentMax]);
  };
  const updateMax = (nextValue) => {
    updateDraftValue([currentMin, Math.max(Number(nextValue), currentMin)]);
  };

  return (
    <div className="filter-group">
      <div className="filter-label-row">
        <label>
          {tooltip ? (
            <HelpLabel tooltip={tooltip}>{label}</HelpLabel>
          ) : (
            label
          )}
        </label>
        <div className="filter-range-value">
          {currentMin}
          {suffix} - {currentMax}
          {suffix}
        </div>
      </div>
      <div
        className="range-slider"
        style={{
          '--range-start': `${minPercent}%`,
          '--range-end': `${maxPercent}%`
        }}
      >
        <div className="range-track">
          <div className="range-track-fill" />
        </div>
        <input
          className="range-input range-input-min"
          type="range"
          aria-label={`${label} minimum`}
          min={min}
          max={max}
          step={step}
          value={currentMin}
          onChange={(event) => updateMin(event.target.value)}
          onPointerUp={commitDraftValue}
          onPointerCancel={commitDraftValue}
          onBlur={commitDraftValue}
          onKeyUp={commitDraftValue}
        />
        <input
          className="range-input range-input-max"
          type="range"
          aria-label={`${label} maksimum`}
          min={min}
          max={max}
          step={step}
          value={currentMax}
          onChange={(event) => updateMax(event.target.value)}
          onPointerUp={commitDraftValue}
          onPointerCancel={commitDraftValue}
          onBlur={commitDraftValue}
          onKeyUp={commitDraftValue}
        />
      </div>
    </div>
  );
}

function HelpLabel({ children, tooltip }) {
  return (
    <span className="label-with-help">
      <span>{children}</span>
      <button
        type="button"
        className="help-tooltip"
        aria-label={tooltip}
        data-tooltip={tooltip}
      >
        ?
      </button>
      <span className="help-tooltip-panel" role="tooltip">{tooltip}</span>
    </span>
  );
}

function SectionToggle({ children, controlsId, isOpen, onToggle }) {
  return (
    <button
      type="button"
      className="section-toggle-button"
      aria-expanded={isOpen}
      aria-controls={controlsId}
      onClick={onToggle}
    >
      <span className="section-kicker">{children}</span>
      <ChevronDown className="section-toggle-icon" aria-hidden="true" strokeWidth={2.2} />
    </button>
  );
}

const ENERGY_GRADE_MEANINGS = {
  A: 'best',
  B: 'svært god',
  C: 'god',
  D: 'middels',
  E: 'svak',
  F: 'dårlig',
  G: 'dårligst'
};

const HEATING_GRADE_MEANINGS = {
  GREEN: 'svært høy andel fornybar/ikke-elektrisk oppvarming',
  LIGHTGREEN: 'høy andel fornybar oppvarming',
  YELLOW: 'moderat andel fornybar oppvarming',
  ORANGE: 'hovedsakelig elektrisk oppvarming',
  RED: 'direkte elektrisk eller fossil oppvarming'
};

const HEATING_GRADE_ORDER = {
  GREEN: 0,
  LIGHTGREEN: 0.5,
  YELLOW: 1,
  ORANGE: 2,
  RED: 3
};

const FILTER_MODE_ICONS = {
  markers: MapPin,
  heatmap: Flame,
  tiles: Layers,
  upgrade: TrendingUp
};

const FILTER_MODE_ITEMS = MAP_VIEW_MODES.map((item) => ({
  ...item,
  Icon: FILTER_MODE_ICONS[item.value]
}));

const BYDEL_DISPLAY_ICONS = {
  clusters: MapPin,
  heatmap: Flame
};

const BYDEL_DISPLAY_ITEMS = BYDEL_DISPLAY_MODES.map((item) => ({
  ...item,
  Icon: BYDEL_DISPLAY_ICONS[item.value]
}));

function normalizeHeatingGrade(grade) {
  return String(grade || '').trim().toUpperCase();
}

function heatingGradeMeaning(grade) {
  return HEATING_GRADE_MEANINGS[normalizeHeatingGrade(grade)] || 'oppvarmingskarakter';
}

function compareHeatingGrades(left, right) {
  const leftGrade = normalizeHeatingGrade(left);
  const rightGrade = normalizeHeatingGrade(right);
  const leftOrder = HEATING_GRADE_ORDER[leftGrade] ?? 99;
  const rightOrder = HEATING_GRADE_ORDER[rightGrade] ?? 99;

  return leftOrder === rightOrder
    ? leftGrade.localeCompare(rightGrade)
    : leftOrder - rightOrder;
}

function formatRadius(radiusInMeters) {
  return radiusInMeters >= 1000
    ? `${(radiusInMeters / 1000).toFixed(radiusInMeters % 1000 === 0 ? 0 : 1)} km`
    : `${radiusInMeters} m`;
}

function formatEnergy(value) {
  return Number.isFinite(Number(value)) && value !== null
    ? `${Number(value).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} kWh/m² per år`
    : 'Mangler';
}

function formatCount(value, unit) {
  return Number.isFinite(Number(value)) && value !== null
    ? `${Number(value).toLocaleString('nb-NO')} ${unit}`
    : 'Mangler';
}

function formatNumber(value) {
  return Number.isFinite(Number(value)) ? Math.round(Number(value)).toLocaleString('nb-NO') : 'Mangler';
}

function formatCurrency(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value)).toLocaleString()} kr` : 'Mangler';
}

function formatPercent(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : 'Mangler';
}

function BydelStatSection({ Icon, children, status = '' }) {
  return (
    <div className="bydel-stat-section">
      <Icon className="bydel-stat-section-icon" aria-hidden="true" strokeWidth={2.2} />
      <span>{children}</span>
      {status && <small>{status}</small>}
    </div>
  );
}

function BydelStat({ label, value }) {
  return (
    <div className="bydel-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatKm(meter) {
  const km = meter / 1000;
  return `${km.toLocaleString('nb-NO', { maximumFractionDigits: 1 })} km`;
}

function OmradeStatistikk({ rad, omrade, bydelNavn, status }) {
  if (status === 'loading') {
    return <div className="bydel-stat-note">Henter tall for området …</div>;
  }
  if (status === 'error') {
    return <div className="bydel-stat-note">Statistikken kunne ikke hentes akkurat nå.</div>;
  }
  if (!rad) {
    return <div className="bydel-stat-note">Ingen statistikk for valgt ordning.</div>;
  }

  const heatingEntries = rad.oppvarmingsfordeling
    ? Object.entries(rad.oppvarmingsfordeling).sort(([left], [right]) => compareHeatingGrades(left, right))
    : null;

  return (
    <>
      <div className="bydel-stat-note">
        Tallene gjelder alle enheter i en sirkel innenfor {formatKm(omrade.radius_m)} fra midten av {bydelNavn}.
        Sirkelen følger ikke bydelsgrensen. {rad.periode ? `Grunnlag: ${rad.periode}.` : ''}
      </div>
      <div className="bydel-stat-note">Filtrene lenger ned påvirker ikke disse tallene, bare punktene i kartet.</div>
      <BydelStat label="Antall enheter" value={formatCount(rad.antall_enheter, 'enheter')} />
      <BydelStat label="Antall attester" value={formatCount(rad.antall_attester, 'attester')} />
      <BydelStat label="Antall bygg" value={formatCount(rad.antall_bygg, 'bygg')} />
      <BydelStat label="Typisk beregnet levert energi (median)" value={formatEnergy(rad.median_kwh_m2)} />
      <BydelStat label="Gjennomsnittlig beregnet levert energi" value={formatEnergy(rad.gjennomsnitt_kwh_m2)} />
      <BydelStat label="Gjennomsnittlig byggeår" value={rad.gjennomsnitt_byggeaar ?? 'Mangler'} />
      {Object.entries(rad.karakterfordeling || {}).map(([grade, count]) => (
        <BydelStat key={grade} label={`Energikarakter ${grade}`} value={formatCount(count, 'enheter')} />
      ))}
      {heatingEntries && heatingEntries.map(([grade, count]) => (
        <BydelStat key={grade} label={`Oppvarming ${heatingGradeName(grade)}`} value={formatCount(count, 'enheter')} />
      ))}
      {Object.entries(rad.kohortfordeling || {}).sort(([left], [right]) => (left === "ukjent") - (right === "ukjent")).map(([kohort, count]) => (
        <BydelStat
          key={kohort}
          label={kohort === 'ukjent' ? 'Byggeår ukjent' : `Bygget ${kohort}`}
          value={formatCount(count, 'enheter')}
        />
      ))}
      {rad.enheter_uten_kartpunkt > 0 && (
        <div className="bydel-stat-fotnote">
          I hele Oslo har {rad.enheter_uten_kartpunkt.toLocaleString('nb-NO')} enheter i {rad.ordning === 'ny' ? 'ny' : 'gammel'} ordning
          ingen posisjon. De er ikke med i kartet eller i tallene over.
        </div>
      )}
    </>
  );
}

function BydelStatsPanel({ omradeStats, omradeStatus, ordning, bydelNavn, externalBydelStats, externalBydelStatus }) {
  const rad = omradeStats?.ordninger?.find((item) => item.ordning === ordning) || null;

  return (
    <div className="bydel-stats-grid">
      <BydelStatSection Icon={Database}>Statistikk for {ordningLabel(ordning).toLowerCase()}</BydelStatSection>
      <OmradeStatistikk rad={rad} omrade={omradeStats?.omrade} bydelNavn={bydelNavn} status={omradeStatus} />

      <BydelStatSection
        Icon={Landmark}
        status={externalBydelStatus === 'loading' ? 'laster' : ''}
      >
        Statistikk fra SSB / Oslo
      </BydelStatSection>
      <BydelStat label="Median pris" value={formatCurrency(externalBydelStats?.housing?.medianHousePrice)} />
      <BydelStat label="Pris per m²" value={formatCurrency(externalBydelStats?.housing?.pricePerM2)} />
      <BydelStat label="Pristrend" value={formatPercent(externalBydelStats?.housing?.priceTrendPercent)} />
      <BydelStat label="Median husholdningsinntekt" value={formatCurrency(externalBydelStats?.demographics?.medianHouseholdIncome)} />
      <BydelStat label="Folketall" value={formatNumber(externalBydelStats?.demographics?.population)} />
      <BydelStat label="Befolkningsvekst" value={formatPercent(externalBydelStats?.demographics?.populationGrowthPercent)} />

      <BydelStatSection Icon={PlugZap}>Statistikk fra NOBIL</BydelStatSection>
      <BydelStat label="Offentlige ladere" value={formatNumber(externalBydelStats?.chargers?.publicChargers)} />
      <BydelStat label="Hurtigladere" value={formatNumber(externalBydelStats?.chargers?.fastChargers)} />
      {externalBydelStatus === 'error' && (
        <div className="bydel-stat-note">Ekstern bydelsstatistikk er ikke tilgjengelig.</div>
      )}
      {externalBydelStats?.chargers?.status && (
        <div className="bydel-stat-note">{externalBydelStats.chargers.status}</div>
      )}
    </div>
  );
}

function Filters() {
  const viewMode = useStore((state) => state.viewMode);
  const bydelDisplayMode = useStore((state) => state.bydelDisplayMode);
  const allFeatures = useStore((state) => state.allFeatures);
  const selectedBydelId = useStore((state) => state.selectedBydelId);
  const filters = useStore((state) => state.filters);
  const filterBounds = useStore((state) => state.filterBounds);
  const radiusInMeters = useStore((state) => state.radiusInMeters);
  const setViewMode = useStore((state) => state.setViewMode);
  const setBydelDisplayMode = useStore((state) => state.setBydelDisplayMode);
  const setSelectedBydelId = useStore((state) => state.setSelectedBydelId);
  const updateRange = useStore((state) => state.updateRange);
  const updateSelect = useStore((state) => state.updateSelect);
  const setRadiusInMeters = useStore((state) => state.setRadiusInMeters);
  const resetFilters = useStore((state) => state.resetFilters);
  const radiusLabel = radiusInMeters >= 1000
    ? `${(radiusInMeters / 1000).toFixed(radiusInMeters % 1000 === 0 ? 0 : 1)} km`
    : `${radiusInMeters} m`;
  const selectedBydel = findBydel(selectedBydelId);
  const ordning = useStore((state) => state.ordning);
  const setOrdning = useStore((state) => state.setOrdning);
  const [omradeStats, setOmradeStats] = useState(null);
  const [omradeStatus, setOmradeStatus] = useState('idle');
  const omradeStatsCache = useRef(new Map());
  const [externalBydelStats, setExternalBydelStats] = useState(null);
  const [externalBydelStatus, setExternalBydelStatus] = useState('idle');
  const [statsOpen, setStatsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const bydelStatsCache = useRef(new Map());

  useEffect(() => {
    let isActive = true;

    if (bydelStatsCache.current.has(selectedBydelId)) {
      setExternalBydelStats(bydelStatsCache.current.get(selectedBydelId));
      setExternalBydelStatus('ready');
      return () => {
        isActive = false;
      };
    }

    setExternalBydelStatus('loading');
    setExternalBydelStats(null);

    fetchBydelStats(selectedBydelId)
      .then((payload) => {
        if (!isActive) return;
        bydelStatsCache.current.set(selectedBydelId, payload);
        setExternalBydelStats(payload);
        setExternalBydelStatus('ready');
      })
      .catch(() => {
        if (!isActive) return;
        setExternalBydelStatus('error');
      });

    return () => {
      isActive = false;
    };
  }, [selectedBydelId]);

  useEffect(() => {
    let isActive = true;
    const cacheKey = selectedBydelId;

    if (omradeStatsCache.current.has(cacheKey)) {
      setOmradeStats(omradeStatsCache.current.get(cacheKey));
      setOmradeStatus('ready');
      return () => {
        isActive = false;
      };
    }

    const bydel = findBydel(selectedBydelId);
    setOmradeStatus('loading');
    setOmradeStats(null);

    fetchEnhetStatistikk({
      latitude: bydel.latitude,
      longitude: bydel.longitude,
      radiusInMeters: bydel.radiusInMeters
    })
      .then((payload) => {
        if (!isActive) return;
        omradeStatsCache.current.set(cacheKey, payload);
        setOmradeStats(payload);
        setOmradeStatus('ready');
      })
      .catch(() => {
        if (!isActive) return;
        setOmradeStatus('error');
      });

    return () => {
      isActive = false;
    };
  }, [selectedBydelId]);

  const energyGrades = useMemo(() => {
    const values = new Set();
    allFeatures.forEach((feature) => {
      const grade = feature.properties.energikarakter;
      if (grade) values.add(String(grade).trim().toUpperCase());
    });
    return Array.from(values)
      .sort((left, right) => left.localeCompare(right))
      .map((grade) => ({
        grade,
        meaning: ENERGY_GRADE_MEANINGS[grade] || 'registrert karakter'
      }));
  }, [allFeatures]);

  const heatingGrades = useMemo(() => {
    const values = new Set();
    allFeatures.forEach((feature) => {
      const grade = feature.properties.oppvarmingskarakter;
      if (grade) values.add(grade);
    });
    return Array.from(values).sort(compareHeatingGrades);
  }, [allFeatures]);

  const selectedEnergyGrades = Array.isArray(filters.energikarakter)
    ? filters.energikarakter
    : filters.energikarakter === 'all'
      ? []
      : [filters.energikarakter];

  const toggleEnergyGrade = (grade) => {
    const nextGrades = selectedEnergyGrades.includes(grade)
      ? selectedEnergyGrades.filter((item) => item !== grade)
      : [...selectedEnergyGrades, grade].sort();

    updateSelect('energikarakter', nextGrades);
  };

  return (
    <div className="filters-stack">
      <section className="filter-card">
        <div className="section-heading">
          <div>
            <div className="section-kicker">Visningsvalg</div>
          </div>
        </div>
        <div className="filter-group view-mode-select">
          <div className="mode-segment-control" role="group" aria-label="Visningsvalg">
            {FILTER_MODE_ITEMS.map((item) => {
              const Icon = item.Icon;
              const isActive = viewMode === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  className={[
                    'mode-segment-button',
                    isActive ? 'active' : '',
                    item.isolated ? 'is-tiles-mode' : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => setViewMode(item.value)}
                  aria-pressed={isActive}
                  data-mode={item.value}
                >
                  <Icon className="mode-segment-icon" aria-hidden="true" strokeWidth={2.2} />
                  <span className="mode-segment-label">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        {viewMode === 'markers' && (
          <div className="bydel-panel">
            <div className="section-heading">
              <div>
                <div className="section-kicker">Bydeler i Oslo</div>
              </div>
            </div>
            <div className="bydel-display-toggle" role="group" aria-label="Visning av bydeler i kartet">
              {BYDEL_DISPLAY_ITEMS.map((item) => {
                const Icon = item.Icon;
                const isActive = bydelDisplayMode === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    className={`bydel-display-button ${isActive ? 'active' : ''}`}
                    onClick={() => setBydelDisplayMode(item.value)}
                    aria-pressed={isActive}
                  >
                    <Icon className="bydel-display-icon" aria-hidden="true" strokeWidth={2.2} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="section-kicker ordning-kicker">Energimerkeordning</div>
            <div className="bydel-display-toggle" role="group" aria-label="Velg energimerkeordning">
              {ORDNINGER.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`bydel-display-button ${ordning === item.value ? 'active' : ''}`}
                  onClick={() => setOrdning(item.value)}
                  aria-pressed={ordning === item.value}
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className="bydel-stat-note">
              Gammel og ny ordning bruker ulike karakterskalaer og vises derfor aldri sammen.
            </div>
            <div className="bydel-select-wrap">
              <select
                className="bydel-select"
                aria-label="Velg bydel i Oslo"
                value={selectedBydelId}
                onChange={(event) => setSelectedBydelId(event.target.value)}
              >
                {OSLO_BYDELER.map((bydel) => (
                  <option key={bydel.id} value={bydel.id}>
                    {bydel.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="bydel-meta">
              <span>{selectedBydel.name}</span>
              <strong>{formatRadius(selectedBydel.radiusInMeters)} radius</strong>
            </div>
          </div>
        )}
      </section>

      {viewMode === 'markers' && (
        <section className="filter-card stats-card">
          <div className="section-heading">
            <SectionToggle
              controlsId="bydel-stats-panel"
              isOpen={statsOpen}
              onToggle={() => setStatsOpen((open) => !open)}
            >
              Statistikk
            </SectionToggle>
          </div>
          <div
            id="bydel-stats-panel"
            className={`collapsible-region ${statsOpen ? 'is-open' : ''}`}
            aria-hidden={!statsOpen}
            inert={!statsOpen}
          >
            <BydelStatsPanel
              omradeStats={omradeStats}
              omradeStatus={omradeStatus}
              ordning={ordning}
              bydelNavn={selectedBydel.name}
              externalBydelStats={externalBydelStats}
              externalBydelStatus={externalBydelStatus}
            />
          </div>
        </section>
      )}

      <section className="filter-card">
        <div className="section-heading">
          <SectionToggle
            controlsId="filters-fields-panel"
            isOpen={filtersOpen}
            onToggle={() => setFiltersOpen((open) => !open)}
          >
            Filtre
          </SectionToggle>
          <button type="button" className="reset-button" onClick={resetFilters}>
            Nullstill
          </button>
        </div>

        <div
          id="filters-fields-panel"
          className={`collapsible-region ${filtersOpen ? 'is-open' : ''}`}
          aria-hidden={!filtersOpen}
          inert={!filtersOpen}
        >
          <div className="filters-fields">
            <div className="bydel-stat-note">Filtrene gjelder punktene i kartet. De endrer ikke tallene i statistikken.</div>
            <RangeField
              label="Byggeår"
              min={filterBounds.byggeaar[0]}
              max={filterBounds.byggeaar[1]}
              value={filters.byggeaar}
              onChange={(value) => updateRange('byggeaar', value)}
            />
            <RangeField
              label="Beregnet levert energi"
              min={filterBounds.energibruk_kwh_m2[0]}
              max={filterBounds.energibruk_kwh_m2[1]}
              value={filters.energibruk_kwh_m2}
              onChange={(value) => updateRange('energibruk_kwh_m2', value)}
              suffix=" kWh/m² per år"
              tooltip="Beregnet levert energi per kvadratmeter per år ved normal bruk, vist i kWh/m² per år. Tallet er beregnet, ikke målt. Enova bruker det til energikarakteren."
            />
            <div className="filter-group radius-control">
              <div className="filter-label-row">
                <label htmlFor="radius-range">
                  <HelpLabel tooltip="Radius styrer hvor langt fra punktet du klikker i kartet appen søker etter bygg i nærheten. Slå på radius, velg en avstand her og klikk deretter i kartet.">
                    Radius
                  </HelpLabel>
                </label>
                <div className="filter-range-value">{radiusLabel}</div>
              </div>
              <input
                id="radius-range"
                type="range"
                min="500"
                max="10000"
                step="500"
                value={radiusInMeters}
                onChange={(event) => setRadiusInMeters(Number(event.target.value))}
              />
            </div>
            <div className="filter-group">
              <div className="filter-label-row">
                <label>
                  <HelpLabel tooltip="Energikarakteren går fra A til G. A er best og G er dårligst. De nøyaktige grensene i kWh/m² per år varierer med bygningskategori, så områdene i de innlastede dataene kan overlappe.">
                    Energikarakter
                  </HelpLabel>
                </label>
                <div className="filter-range-value">
                  {selectedEnergyGrades.length === 0 ? 'Alle' : selectedEnergyGrades.join(', ')}
                </div>
              </div>
              <div className="checkbox-filter-list">
                {energyGrades.map(({ grade, meaning }) => (
                  <label key={grade} className="checkbox-filter-option">
                    <input
                      type="checkbox"
                      checked={selectedEnergyGrades.includes(grade)}
                      onChange={() => toggleEnergyGrade(grade)}
                    />
                    <span className="filter-option-copy">
                      <strong>{grade}</strong>
                      <span>{meaning}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {heatingGrades.length > 0 && (
            <div className="filter-group">
              <div className="filter-label-row">
                <label>
                  <HelpLabel tooltip="Oppvarmingskarakteren beskriver energikilden til oppvarmingen. Grønn betyr svært høy andel fornybar/ikke-elektrisk oppvarming. Gul betyr moderat andel fornybar oppvarming. Oransje er hovedsakelig elektrisk oppvarming. Rød er hovedsakelig direkte elektrisk oppvarming eller fossilt brensel.">
                    Oppvarmingskarakter
                  </HelpLabel>
                </label>
              </div>
              <div className="checkbox-filter-list">
                <label className="checkbox-filter-option">
                  <input
                    type="radio"
                    name="heating-grade"
                    checked={filters.oppvarmingskarakter === 'all'}
                    onChange={() => updateSelect('oppvarmingskarakter', 'all')}
                  />
                  <span className="filter-option-copy">
                    <strong>Alle</strong>
                    <span>alle oppvarmingskarakterer</span>
                  </span>
                </label>
                {heatingGrades.map((grade) => (
                  <label key={grade} className="checkbox-filter-option">
                    <input
                      type="radio"
                      name="heating-grade"
                      checked={filters.oppvarmingskarakter === grade}
                      onChange={() => updateSelect('oppvarmingskarakter', grade)}
                    />
                    <span className="filter-option-copy">
                      <strong>{heatingGradeName(grade)}</strong>
                      <span>{heatingGradeMeaning(grade)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default Filters;
