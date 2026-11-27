// TESTDATA: lager vektor-tiles (Mapbox Vector Tile) i nettleseren etter kontrakten
// «Vektor-tiles for Enkel bygg» i docs/api-kontrakt.md. Brukes bare med ?eksempel=enheter,
// som erstatning for /tiles/{z}/{x}/{y}.pbf mens SQL og backend ikke er klare.
// Oppdiktede adresser (Eksempelveien). Aldri en reserve for ekte data.
import { eksempelEnheterRaa } from './enheter-eksempel.js';

const EXTENT = 4096;
const KARAKTERER = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

// --- Minimal protobuf-skriver (bare det en MVT trenger) ---
function varint(tall) {
  const bytes = [];
  let verdi = tall;
  while (verdi > 127) {
    bytes.push((verdi % 128) | 128);
    verdi = Math.floor(verdi / 128);
  }
  bytes.push(verdi);
  return bytes;
}

function tag(felt, type) {
  return varint((felt << 3) | type);
}

function lengdeFelt(felt, bytes) {
  return [...tag(felt, 2), ...varint(bytes.length), ...bytes];
}

function tekstBytes(tekst) {
  return Array.from(new TextEncoder().encode(tekst));
}

function verdiBytes(verdi) {
  if (typeof verdi === 'string') return lengdeFelt(1, tekstBytes(verdi));
  if (Number.isInteger(verdi) && verdi >= 0) return [...tag(4, 0), ...varint(verdi)];
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0, verdi, true);
  return [...tag(3, 1), ...Array.from(new Uint8Array(buffer))];
}

function zigzag(tall) {
  return tall >= 0 ? tall * 2 : -tall * 2 - 1;
}

function lagTileBytes(lagNavn, punkter) {
  const nokler = [];
  const verdier = [];
  const noklerIndeks = new Map();
  const verdiIndeks = new Map();
  const slaaOpp = (kart, liste, nokkel, verdi) => {
    if (!kart.has(nokkel)) {
      kart.set(nokkel, liste.length);
      liste.push(verdi);
    }
    return kart.get(nokkel);
  };

  const features = punkter.map(({ x, y, egenskaper }) => {
    const tags = [];
    Object.entries(egenskaper).forEach(([navn, verdi]) => {
      if (verdi === null || verdi === undefined) return; // null-felt utelates, som i ekte tiles
      tags.push(slaaOpp(noklerIndeks, nokler, navn, navn));
      tags.push(slaaOpp(verdiIndeks, verdier, `${typeof verdi}:${verdi}`, verdi));
    });
    const geometri = [9, ...varint(zigzag(x)), ...varint(zigzag(y))];
    return lengdeFelt(2, [
      ...lengdeFelt(2, tags.flatMap((t) => varint(t))),
      ...tag(3, 0), 1,
      ...lengdeFelt(4, geometri)
    ]);
  });

  const lag = [
    ...tag(15, 0), 2,
    ...lengdeFelt(1, tekstBytes(lagNavn)),
    ...features.flat(),
    ...nokler.flatMap((n) => lengdeFelt(3, tekstBytes(n))),
    ...verdier.flatMap((v) => lengdeFelt(4, verdiBytes(v))),
    ...tag(5, 0), ...varint(EXTENT)
  ];
  return new Uint8Array(lengdeFelt(3, lag)).buffer;
}

// --- Data per enhet og per bygg ---
function median(tall) {
  if (tall.length === 0) return null;
  const sortert = [...tall].sort((a, b) => a - b);
  const midt = Math.floor(sortert.length / 2);
  const verdi = sortert.length % 2 ? sortert[midt] : (sortert[midt - 1] + sortert[midt]) / 2;
  return Math.round(verdi * 10) / 10;
}

function byggFra(enheter) {
  const perBygg = new Map();
  enheter.forEach((enhet) => {
    if (!perBygg.has(enhet.bygningsnummer)) perBygg.set(enhet.bygningsnummer, []);
    perBygg.get(enhet.bygningsnummer).push(enhet);
  });
  return Array.from(perBygg.values()).map((gruppe) => {
    // Midterste karakter A→G; ved partall den dårligste av de to midterste.
    const indekser = gruppe.map((e) => KARAKTERER.indexOf(e.energikarakter)).sort((a, b) => a - b);
    const medianIndeks = indekser[Math.floor(indekser.length / 2)];
    const adresser = Array.from(new Set(gruppe.map((e) => e.adresse))).sort();
    const forste = gruppe[0];
    return {
      lat: gruppe.reduce((sum, e) => sum + e.lat, 0) / gruppe.length,
      lon: gruppe.reduce((sum, e) => sum + e.lon, 0) / gruppe.length,
      egenskaper: {
        bygningsnummer: forste.bygningsnummer,
        ordning: forste.ordning,
        adresse: adresser[0],
        antall_adresser: adresser.length,
        antall_enheter: gruppe.length,
        median_karakter: KARAKTERER[medianIndeks],
        median_kwh_m2: median(gruppe.map((e) => e.energi_kwh_m2).filter((v) => v !== null)),
        bygningskategori: forste.bygningskategori,
        byggeaar: forste.byggeaar,
        kohort: forste.kohort
      }
    };
  });
}

function tilPiksler(lat, lon, z, tx, ty) {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const radianer = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(radianer) + 1 / Math.cos(radianer)) / Math.PI) / 2) * n;
  return { x: Math.round((x - tx) * EXTENT), y: Math.round((y - ty) * EXTENT) };
}

// url: eksempeltiles://{z}/{x}/{y}?visning=enheter|bygg&ordning=gammel|ny
export function lagEksempelTile(url) {
  const treff = url.match(/eksempeltiles:\/\/(\d+)\/(\d+)\/(\d+)\?(.*)$/);
  if (!treff) return lagTileBytes('enheter', []);
  const [z, x, y] = [Number(treff[1]), Number(treff[2]), Number(treff[3])];
  const parametre = new URLSearchParams(treff[4]);
  const visning = parametre.get('visning') === 'bygg' ? 'bygg' : 'enheter';
  const ordning = parametre.get('ordning') === 'ny' ? 'ny' : 'gammel';
  if (z < 10) return lagTileBytes(visning, []);

  const enheter = eksempelEnheterRaa(ordning);
  const kilde = visning === 'bygg'
    ? byggFra(enheter)
    : enheter.map(({ lat, lon, ...egenskaper }) => ({ lat, lon, egenskaper }));

  const punkter = [];
  kilde.forEach(({ lat, lon, egenskaper }) => {
    const piksel = tilPiksler(lat, lon, z, x, y);
    if (piksel.x >= 0 && piksel.x < EXTENT && piksel.y >= 0 && piksel.y < EXTENT) {
      punkter.push({ ...piksel, egenskaper });
    }
  });
  return lagTileBytes(visning, punkter);
}
