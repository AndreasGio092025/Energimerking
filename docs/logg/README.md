# Agentlogg

Én fil per levering: `ÅÅÅÅ-MM-DD-<agent>-<kort-tema>.md`. Malen står i `CLAUDE.md` under "Rapportering".
`aktivitet.log` i denne mappen skrives automatisk hver gang en agent blir ferdig (ikke i git),
men bare hos den som har satt opp hooken lokalt. Hooken ligger i `.claude/settings.local.json`
og `.claude/hooks/`, som ikke er i git, så den kjører ikke hos andre som henter repoet.
