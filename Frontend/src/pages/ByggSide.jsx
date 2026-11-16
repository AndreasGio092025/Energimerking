import { useEffect, useState } from 'react';
import { fetchByggOversikt } from '../services/api.js';
import './bygg-side.css';

const KARAKTERER = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

const OPPVARMING = [
  { nokkel: 'Green', navn: 'Grønn' },
  { nokkel: 'LightGreen', navn: 'Lysegrønn' },
  { nokkel: 'Yellow', navn: 'Gul' },
  { nokkel: 'Orange', navn: 'Oransje' },
  { nokkel: 'Red', navn: 'Rød' }
];

const ORDNING_TITTEL = {
  gammel: 'Gammel energimerkeordning',
  ny: 'Ny energimerkeordning (fra 2026)'
};

const tall = (verdi, desimaler = 0) =>
  Number(verdi).toLocaleString('nb-NO', {
    minimumFractionDigits: desimaler,
    maximumFractionDigits: desimaler
  });

const avTi = (andel) => Math.round(Number(andel) * 10);

function erEksempel() {
  return new URLSearchParams(window.location.search).get('eksempel') === '1';
}

async function hentData(bygningsnummer, signal) {
  if (erEksempel()) {
    // Bevisst valgt av brukeren med ?eksempel=1; aldri som stille reserve ved feil.
    const modul = await import('../dev/bygg-oversikt-eksempel.json');
    return modul.default;
  }
  return fetchByggOversikt(bygningsnummer, { signal });
}

function Soylediagram({ fordeling, tittel }) {
  const storste = Math.max(1, ...KARAKTERER.map((k) => Number(fordeling?.[k] ?? 0)));
  return (
    <figure className="soyle-figur">
      <figcaption>{tittel}</figcaption>
      <div className="soyler" role="img" aria-label={`${tittel}: ${KARAKTERER.map((k) => `${k} ${fordeling?.[k] ?? 0}`).join(', ')}`}>
        {KARAKTERER.map((k) => {
          const antall = Number(fordeling?.[k] ?? 0);
          return (
            <div className="soyle" key={k}>
              <span className="soyle-antall">{antall}</span>
              <div className="soyle-felt">
                <div className={`soyle-stolpe karakter-${k}`} style={{ height: `${(antall / storste) * 100}%` }} />
              </div>
              <span className="soyle-bokstav">{k}</span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

function Oppvarming({ fordeling }) {
  return (
    <div className="oppvarming">
      <h4>Oppvarmingskarakter (antall enheter)</h4>
      <ul>
        {OPPVARMING.map(({ nokkel, navn }) => (
          <li key={nokkel}>
            <span className={`prikk oppvarming-${nokkel}`} aria-hidden="true" />
            {navn}: <strong>{fordeling[nokkel] ?? 0}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sammenligning({ lignende, bygg }) {
  const { grunnlag, antall_enheter, antall_bygg, nok_data } = lignende;

  if (!nok_data) {
    return (
      <div className="sammenligning">
        <h4>Sammenligning med lignende bygg</h4>
        <p>Det er for få lignende bygg til en rettferdig sammenligning.</p>
      </div>
    );
  }

  let grunnlagTekst;
  if (grunnlag === 'kategori og byggeår') {
    grunnlagTekst = `Sammenlignet med ${tall(antall_enheter)} leiligheter i ${tall(antall_bygg)} lignende bygg fra samme periode (${bygg.kohort}).`;
  } else if (grunnlag === 'bare kategori') {
    grunnlagTekst = `Sammenlignet med ${tall(antall_enheter)} leiligheter i ${tall(antall_bygg)} bygg i alle ${(bygg.bygningskategori || '').toLowerCase()}, uansett byggeår.`;
  } else {
    grunnlagTekst = 'Byggets kategori er ukjent, så vi finner ikke lignende bygg.';
  }

  return (
    <div className="sammenligning">
      <h4>Sammenligning med lignende bygg</h4>
      <p>{grunnlagTekst}</p>
      <ul>
        {lignende.andel_med_hoyere_energibruk != null && (
          <li>
            Bygget bruker mindre energi enn {avTi(lignende.andel_med_hoyere_energibruk)} av 10 lignende leiligheter.
          </li>
        )}
        {lignende.andel_enheter_bedre_enn_lignende != null && (
          <li>
            {avTi(lignende.andel_enheter_bedre_enn_lignende)} av 10 leiligheter i bygget bruker mindre enn vanlig for lignende bygg.
          </li>
        )}
        {lignende.median_kwh_m2 != null && (
          <li>Typisk (median) energibruk for lignende leiligheter: {tall(lignende.median_kwh_m2, 1)} kWh/m² per år.</li>
        )}
      </ul>
    </div>
  );
}

function OrdningSeksjon({ rad, bygg }) {
  return (
    <section className="ordning">
      <h2>{ORDNING_TITTEL[rad.ordning] ?? `Ordning: ${rad.ordning}`}</h2>
      <p className="periode">Energiattester {rad.periode.replace(/^attester /, '')}</p>

      <dl className="nokkeltall">
        <div>
          <dt>Antall enheter (leiligheter)</dt>
          <dd>{tall(rad.antall_enheter)}</dd>
        </div>
        <div>
          <dt>Antall attester</dt>
          <dd>{tall(rad.antall_attester)}</dd>
        </div>
        <div>
          <dt>Median energibruk</dt>
          <dd>
            {rad.median_kwh_m2 != null ? `${tall(rad.median_kwh_m2, 1)} kWh/m² per år` : 'Ikke tilgjengelig'}
          </dd>
        </div>
      </dl>
      <p className="liten">
        En leilighet kan ha flere attester over tid. Karakterene under teller bare siste attest per leilighet.
      </p>

      <Soylediagram fordeling={rad.karakterfordeling} tittel="Antall enheter per energikarakter" />

      {rad.oppvarmingsfordeling && <Oppvarming fordeling={rad.oppvarmingsfordeling} />}

      <Sammenligning lignende={rad.lignende} bygg={bygg} />
    </section>
  );
}

export default function ByggSide({ bygningsnummer }) {
  const [tilstand, setTilstand] = useState({ status: 'laster', data: null });

  useEffect(() => {
    const controller = new AbortController();
    hentData(bygningsnummer, controller.signal)
      .then((data) => setTilstand({ status: 'ok', data }))
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setTilstand({ status: 'feil', data: null });
      });
    return () => controller.abort();
  }, [bygningsnummer]);

  const { status, data } = tilstand;

  return (
    <div className="bygg-side">
      <main className="bygg-innhold">
        <nav className="bygg-verktoy">
          <a className="bygg-tilbake" href="#/">← Tilbake til kartet</a>
          {status === 'ok' && (
            <button type="button" className="bygg-skriv-ut" onClick={() => window.print()}>
              Skriv ut / lagre som PDF
            </button>
          )}
        </nav>

        {status === 'laster' && <p role="status">Henter bygget …</p>}

        {status === 'feil' && (
          <div role="alert">
            <h1>Fant ikke bygget</h1>
            <p>Vi fant ikke noe bygg med dette nummeret.</p>
            <a className="bygg-tilbake" href="#/">Tilbake til kartet</a>
          </div>
        )}

        {status === 'ok' && (
          <>
            <header>
              <p className="kicker">Energimerking av bygg</p>
              <h1>{data.adresser?.length ? data.adresser.join(', ') : `Bygg ${data.bygningsnummer}`}</h1>
              <p className="bygg-fakta">
                {data.bygningskategori ?? 'Ukjent bygningskategori'}
                {data.byggeaar != null ? `, bygget i ${data.byggeaar}` : ', ukjent byggeår'}
                {data.kohort ? `, bygget i perioden ${data.kohort}` : ''}
              </p>
              <p className="bygg-fakta liten">Bygningsnummer {data.bygningsnummer}</p>
            </header>

            <p className="advarsel">
              Energimerkeordningen ble endret 1. januar 2026. Karakterene i gammel og ny ordning er ikke den samme skalaen
              og kan ikke sammenlignes direkte. Derfor vises de hver for seg.
            </p>

            {data.ordninger.length === 0 && <p>Dette bygget har ingen energiattester.</p>}
            {data.ordninger.map((rad) => (
              <OrdningSeksjon key={rad.ordning} rad={rad} bygg={data} />
            ))}

            <section className="forklaring">
              <h2>Slik leser du tallene</h2>
              <p>
                <strong>Energikarakter</strong> (A til G) sier hvor mye energi en leilighet bruker per kvadratmeter i året.
                A er best og G er dårligst.
              </p>
              <p>
                <strong>Oppvarmingskarakter</strong> sier hvor miljøvennlig oppvarmingen i bygget er, fra grønn
                (best) til rød (minst miljøvennlig). Den finnes bare i den gamle ordningen.
              </p>
              <p>
                <strong>Enhet</strong> betyr én leilighet eller bruksenhet. <strong>Attest</strong> er ett enkelt
                dokument fra Enova. Én leilighet kan ha flere attester. Tallene beskriver bare hva som er registrert, og
                sier ikke noe om årsaker.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
