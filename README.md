# ISW Quiz

App web per esercitarsi con le domande dell'esame di Ingegneria del Software.

Questa guida spiega come avviare l'app con Docker, passo dopo passo.

## Cosa Devi Installare

Prima di iniziare servono solo queste cose:

1. Docker Desktop
2. GitHub Desktop oppure Git
3. Un browser, per esempio Chrome, Safari, Firefox o Edge

Scarica Docker Desktop da:

```text
https://www.docker.com/products/docker-desktop/
```

Dopo averlo installato, apri Docker Desktop e lascialo acceso.

## Metodo Facile Con GitHub Desktop

Questo e' il metodo consigliato se non vuoi usare il terminale per scaricare il progetto.

1. Apri GitHub Desktop.
2. Clicca su `File`.
3. Clicca su `Clone Repository`.
4. Seleziona il repository `isw-quiz`.
5. Scegli dove salvarlo sul computer.
6. Clicca su `Clone`.

Ora hai il progetto sul computer.

## Avviare L'App Con Docker

Apri il terminale dentro la cartella del progetto.

Se hai usato GitHub Desktop:

1. Apri GitHub Desktop.
2. Seleziona il repository `isw-quiz`.
3. Clicca su `Repository`.
4. Clicca su `Open in Terminal`.

Poi scrivi questo comando:

```bash
docker compose up --build
```

Aspetta. La prima volta puo' metterci qualche minuto.

Quando nel terminale non vedi piu' tante righe nuove, apri il browser e vai qui:

```text
http://localhost:3000
```

L'app e' partita.

## Come Spegnere L'App

Torna nel terminale dove Docker e' in esecuzione.

Premi:

```text
CTRL + C
```

Se vuoi fermare tutto completamente, puoi anche scrivere:

```bash
docker compose down
```

## Come Riaccendere L'App

Dalla cartella del progetto, scrivi:

```bash
docker compose up
```

Se hai modificato il codice o hai appena scaricato una nuova versione:

```bash
docker compose up --build
```

## Statistiche E Progressi

Quando avvii l'app per la prima volta con Docker, le statistiche sono pulite.

Il database iniziale contiene:

```text
309 domande
0 statistiche
0 tentativi salvati
0 risposte salvate
```

Le statistiche che fai durante l'uso restano salvate nel tuo Docker.

## Resettare Le Statistiche

Se vuoi cancellare tutti i progressi e ripartire da zero:

```bash
docker compose down -v
docker compose up --build
```

Attenzione: `docker compose down -v` cancella il database personale creato da Docker.

Le domande non spariscono, perche' Docker riparte dal database iniziale pulito.

## Problemi Comuni

### Docker Non Parte

Controlla che Docker Desktop sia aperto.

Poi riprova:

```bash
docker compose up --build
```

### La Porta 3000 E' Gia Occupata

Se vedi un errore sulla porta `3000`, forse hai gia' un'altra app aperta.

Prova prima a spegnere l'app:

```bash
docker compose down
```

Poi riavvia:

```bash
docker compose up
```

### Voglio Aggiornare Il Progetto

Se il progetto e' stato aggiornato su GitHub:

1. Apri GitHub Desktop.
2. Clicca su `Fetch origin`.
3. Se compaiono aggiornamenti, clicca su `Pull origin`.
4. Poi nel terminale scrivi:

```bash
docker compose up --build
```

## Per Chi Usa Git Da Terminale

Scarica il progetto:

```bash
git clone https://github.com/Emanuele-Dambrosio/isw-quiz.git
cd isw-quiz
```

Avvia l'app:

```bash
docker compose up --build
```

Apri:

```text
http://localhost:3000
```

## Note Per Il Repository GitHub

Questo repository dovrebbe restare privato se contiene domande, correzioni o immagini estratte da Moodle.

Non serve fare login su Moodle per usare l'app con Docker.

Non serve rifare lo scraping per usare l'app con Docker.

## Sviluppo Locale Senza Docker

Questa parte serve solo se vuoi modificare il codice senza Docker.

```bash
npm install
cp .env.example .env
npm run dev
```

Apri:

```text
http://localhost:3000
```

Per azzerare le statistiche nel database locale di sviluppo:

```bash
npm run db:reset-stats
```

## Stack Tecnico

- Next.js App Router
- TypeScript
- Tailwind CSS
- SQLite
- Drizzle ORM
- Docker
- Python, Playwright e BeautifulSoup per lo scraping Moodle

## Scraping Moodle

Questa parte serve solo a chi deve estrarre nuove domande da Moodle.

1. Imposta in `.env`:
   - `MOODLE_BASE_URL`
   - `MOODLE_LOGIN_URL`
   - `MOODLE_QUIZ_URLS`
   - `MOODLE_REVIEW_SHOW_ALL=true` se Moodle supporta `showall=1`
   - `MOODLE_REVIEW_PAGE_COUNT=50` per revisioni Moodle con una domanda per pagina

2. Salva la sessione:

```bash
npm run scraper:login
```

3. Se gli URL sono pagine di correzione gia' aperte:

```bash
npm run scraper:scrape
```

4. Se gli URL sono pagine con pulsante di inizio quiz:

```bash
npm run scraper:review
```

Completa il tentativo nel browser fino alla pagina di correzione, poi premi Invio nel terminale.

5. Importa il JSON prodotto:

```bash
npm run db:import
```

Le immagini vengono salvate in `public/media/scraped/`.

## Aggiornare Le Date Degli Esami

Se le domande sono gia' state estratte ma gli esami risultano come `Moodle Sapienza`, aggiorna solo i metadati:

```bash
npm run scraper:metadata
npm run db:metadata
```

Questo aggiorna `title` e `date` in `data/raw/question-bank.json` e poi nel database SQLite.
