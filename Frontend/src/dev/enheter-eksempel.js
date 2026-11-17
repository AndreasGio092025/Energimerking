// TESTDATA etter kontrakten «Enheter i kartet» i docs/api-kontrakt.md.
// Oppdiktede adresser (Eksempelveien). Brukes bare med ?eksempel=enheter
// (eller ?eksempel=enheter-avkortet for å se meldingen om at taket er nådd).
// Aldri en reserve for ekte data.

const CELLE_LAT = 0.0016;
const CELLE_LON = 0.0032;
const KATEGORIER = ['Boligblokker', 'Småhus', 'Kontorbygg', 'Barnehager'];
const FARGER = ['Green', 'LightGreen', 'Yellow', 'Orange', 'Red'];
const KARAKTERER = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
// Kohort-tekstene står ferdige, slik API-et leverer dem fra byggeaar_kohort() i SQL.
// Nettleseren regner ikke ut grenser: hver eksempelrad trekker bare en av tekstene.
const KOHORTER = ['før 1949', '1949–1969', '1970–1986', '1987–1996', '1997–2006', '2007–2016', '2017 og senere'];

// Enkel, fast tilfeldighet slik at samme sted gir samme punkter hver gang.
function hash(a, b, c) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function meterFra(lat, lon, lat2, lon2) {
  const dLat = (lat2 - lat) * 111320;
  const dLon = (lon2 - lon) * 111320 * Math.cos((lat * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

function lagEnheter(ordning) {
  const enheter = [];
  const latStart = Math.floor(59.80 / CELLE_LAT);
  const latSlutt = Math.ceil(60.05 / CELLE_LAT);
  const lonStart = Math.floor(10.55 / CELLE_LON);
  const lonSlutt = Math.ceil(11.00 / CELLE_LON);
  const ordningTall = ordning === 'ny' ? 2 : 1;
  const andel = ordning === 'ny' ? 0.22 : 0.7;

  for (let i = latStart; i < latSlutt; i += 1) {
    for (let j = lonStart; j < lonSlutt; j += 1) {
      if (hash(i, j, 1) > andel) continue;
      const lat = (i + 0.15 + hash(i, j, 2) * 0.7) * CELLE_LAT;
      const lon = (j + 0.15 + hash(i, j, 3) * 0.7) * CELLE_LON;
      const kategori = KATEGORIER[Math.floor(hash(i, j, 4) * KATEGORIER.length)];
      const harByggeaar = hash(i, j, 5) > 0.06;
      const byggeaar = harByggeaar ? 1900 + Math.floor(hash(i, j, 6) * 123) : null;
      // Eksempeldata: kohort-teksten trekkes for seg og er ikke utledet av byggeåret. Uten byggeår er den null.
      const kohort = harByggeaar ? KOHORTER[Math.floor(hash(i, j, 14) * KOHORTER.length)] : null;
      const antallSamme = kategori === 'Boligblokker' ? 1 + Math.floor(hash(i, j, 7) * 6) : 1;
      const husnr = 1 + Math.floor(hash(i, j, 8) * 90);

      for (let k = 0; k < antallSamme; k += 1) {
        const seed = i * 7919 + j * 104729 + k * 13;
        // Gammel ordning: bedre karakterer jo nyere bygget er. Ny ordning: litt jevnere.
        const alder = byggeaar === null ? 0.5 : 1 - (byggeaar - 1900) / 123;
        const karakterIndeks = Math.min(6, Math.floor((alder * 0.7 + hash(seed, 9, ordningTall) * 0.5) * 7));
        const energi = hash(seed, 10, ordningTall) > 0.05
          ? Math.round((90 + karakterIndeks * 45 + hash(seed, 11, ordningTall) * 40) * 10) / 10
          : null;
        const maaned = ordning === 'ny' ? 1 + Math.floor(hash(seed, 12, 2) * 10) : 1 + Math.floor(hash(seed, 12, 1) * 12);
        enheter.push({
          id: `eks-${ordning}-${i}-${j}-${k}`,
          lat,
          lon,
          ordning,
          bygningsnummer: String(80000000 + i * 1000 + j + 7),
          adresse: `Eksempelveien ${husnr}${String.fromCharCode(65 + k)}`,
          bygningskategori: kategori,
          byggeaar,
          kohort,
          energikarakter: KARAKTERER[karakterIndeks],
          oppvarmingskarakter: ordning === 'ny' ? null : FARGER[Math.floor(hash(seed, 13, 1) * FARGER.length)],
          energi_kwh_m2: energi,
          utstedelsesdato: `${ordning === 'ny' ? 2026 : 2025}-${String(maaned).padStart(2, '0')}-15`,
          antall_enheter_samme_punkt: antallSamme
        });
      }
    }
  }
  return enheter;
}

const cache = {};
function enheterFor(ordning) {
  if (!cache[ordning]) cache[ordning] = lagEnheter(ordning);
  return cache[ordning];
}

function iSirkel(enheter, lat, lon, radius) {
  return enheter.filter((enhet) => meterFra(lat, lon, enhet.lat, enhet.lon) <= radius);
}

export async function eksempelPunkter({ lat, lon, radius, ordning, avkortet = false }) {
  const treff = iSirkel(enheterFor(ordning), lat, lon, radius);
  const tak = avkortet ? 400 : 50000;
  const synlige = treff.slice(0, tak);
  return {
    type: 'FeatureCollection',
    avkortet: treff.length > tak,
    antall: synlige.length,
    features: synlige.map(({ lat: pLat, lon: pLon, ...egenskaper }) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pLon, pLat] },
      properties: egenskaper
    }))
  };
}

function medianAv(verdier) {
  if (verdier.length === 0) return null;
  const sortert = [...verdier].sort((a, b) => a - b);
  const midt = Math.floor(sortert.length / 2);
  const verdi = sortert.length % 2 ? sortert[midt] : (sortert[midt - 1] + sortert[midt]) / 2;
  return Math.round(verdi * 10) / 10;
}

function raderFor(ordning, lat, lon, radius) {
  const enheter = iSirkel(enheterFor(ordning), lat, lon, radius);
  const karakterfordeling = Object.fromEntries(KARAKTERER.map((k) => [k, 0]));
  const kohortfordeling = Object.fromEntries([...KOHORTER, 'ukjent'].map((k) => [k, 0]));
  const oppvarming = ordning === 'ny' ? null : {};
  const byggeaar = [];
  const energi = [];
  const bygg = new Set();

  enheter.forEach((enhet) => {
    karakterfordeling[enhet.energikarakter] += 1;
    kohortfordeling[enhet.kohort || 'ukjent'] += 1;
    if (oppvarming && enhet.oppvarmingskarakter) {
      oppvarming[enhet.oppvarmingskarakter] = (oppvarming[enhet.oppvarmingskarakter] || 0) + 1;
    }
    if (enhet.byggeaar !== null) byggeaar.push(enhet.byggeaar);
    if (enhet.energi_kwh_m2 !== null) energi.push(enhet.energi_kwh_m2);
    bygg.add(enhet.bygningsnummer);
  });

  return {
    ordning,
    periode: ordning === 'ny' ? 'attester utstedt fra 2026' : 'attester utstedt i 2025',
    antall_enheter: enheter.length,
    antall_attester: Math.round(enheter.length * 1.4),
    antall_bygg: bygg.size,
    enheter_uten_kartpunkt: ordning === 'ny' ? 0 : 37,
    karakterfordeling,
    oppvarmingsfordeling: oppvarming,
    median_kwh_m2: medianAv(energi),
    gjennomsnitt_kwh_m2: energi.length
      ? Math.round((energi.reduce((sum, v) => sum + v, 0) / energi.length) * 10) / 10
      : null,
    gjennomsnitt_byggeaar: byggeaar.length
      ? Math.round(byggeaar.reduce((sum, v) => sum + v, 0) / byggeaar.length)
      : null,
    kohortfordeling
  };
}

export async function eksempelStatistikk({ lat, lon, radius }) {
  return {
    omrade: { lat, lon, radius_m: Math.round(radius) },
    ordninger: [raderFor('gammel', lat, lon, radius), raderFor('ny', lat, lon, radius)]
  };
}
