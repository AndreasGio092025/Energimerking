import { useEffect, useState } from 'react';
import App from './App.jsx';
import ByggSide from './pages/ByggSide.jsx';
import ByggFraAttest from './pages/ByggFraAttest.jsx';

// Enkel hash-ruting (ingen ruter-pakke):
//   (tom hash)                       -> kartet
//   #/bygg/{bygningsnummer}          -> bygg-siden
//   #/bygg-fra-attest/{attestnummer} -> slår opp bygningsnummer, går så til #/bygg/{bygningsnummer}
function parseHash(hash) {
  const [, first, second] = hash.split('/');
  if (first === 'bygg' && second) return { page: 'bygg', id: decodeURIComponent(second) };
  if (first === 'bygg-fra-attest' && second) return { page: 'fra-attest', id: decodeURIComponent(second) };
  return { page: 'kart' };
}

export default function Router() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  if (route.page === 'bygg') return <ByggSide key={route.id} bygningsnummer={route.id} />;
  if (route.page === 'fra-attest') return <ByggFraAttest key={route.id} attestnummer={route.id} />;
  return <App />;
}
