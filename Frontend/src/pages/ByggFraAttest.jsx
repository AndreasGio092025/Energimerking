import { useEffect, useState } from 'react';
import { fetchByggFraAttest } from '../services/api.js';
import './bygg-side.css';

// Slår opp bygningsnummer for et attestnummer og sender brukeren til bygg-siden.
export default function ByggFraAttest({ attestnummer }) {
  const [feil, setFeil] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchByggFraAttest(attestnummer, { signal: controller.signal })
      .then((svar) => {
        if (!svar?.bygningsnummer) throw new Error('Mangler bygningsnummer');
        window.location.replace(`#/bygg/${encodeURIComponent(svar.bygningsnummer)}`);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') setFeil(true);
      });
    return () => controller.abort();
  }, [attestnummer]);

  return (
    <div className="bygg-side">
      <main className="bygg-innhold">
        {feil ? (
          <div role="alert">
            <h1>Fant ikke bygget</h1>
            <p>Vi fant ikke noe bygg for denne energiattesten.</p>
            <a className="bygg-tilbake" href="#/">Tilbake til kartet</a>
          </div>
        ) : (
          <p role="status">Henter bygget …</p>
        )}
      </main>
    </div>
  );
}
