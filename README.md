# ISW Quiz

Piattaforma personale per preparare l'esame di Ingegneria del Software.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- SQLite con Drizzle ORM
- Python + Playwright + BeautifulSoup per scraping Moodle
- JSON contract versionato tra scraper e app

## Setup locale

```bash
npm install
python3 -m venv .venv
.venv/bin/pip install playwright beautifulsoup4 lxml pydantic python-dotenv scikit-learn
.venv/bin/playwright install chromium
```

## Database

```bash
cp .env.example .env
npm run db:push
npm run db:seed
```

## Sviluppo

```bash
npm run dev
```

Apri `http://localhost:3000`.

## Condivisione Con Docker

Il progetto include un database seed in `data/seed/isw-quiz.seed.db` con domande ed esami gia importati, ma senza statistiche personali.

Per avviare l'app dopo il clone:

```bash
docker compose up --build
```

Apri `http://localhost:3000`.

Al primo avvio Docker copia il seed in un volume locale e lo usa come database runtime. I progressi del tuo collega restano nel volume Docker e non modificano il seed.

Per ripartire da zero con statistiche pulite:

```bash
docker compose down -v
docker compose up --build
```

Per azzerare le statistiche nel database locale di sviluppo:

```bash
npm run db:reset-stats
```

### GitHub

Prima di pubblicare il repository, usa un repository privato se contiene domande, correzioni o immagini estratte da Moodle.

```bash
git init
git add .
git commit -m "Prepare Docker sharing"
git branch -M main
git remote add origin git@github.com:TUO_USERNAME/isw-quiz.git
git push -u origin main
```

## Scraping Moodle

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

3. Se gli URL sono pagine di correzione gia aperte, estrai le domande:

```bash
npm run scraper:scrape
```

4. Se gli URL sono pagine con pulsante di inizio quiz, usa invece la modalita guidata:

```bash
npm run scraper:review
```

Completa il tentativo nel browser fino alla pagina di correzione/review, poi premi Invio nel terminale.

Per una review completa come `review.php?attempt=1957106&cmid=808522&showall=1`, lo scraper legge una sola pagina. Se invece usi una review paginata come `review.php?attempt=1955629&cmid=785231`, lo scraper ricostruisce `page=0...49` quando `MOODLE_REVIEW_PAGE_COUNT=50` e prova comunque a leggere i link nello specchietto "Navigazione quiz".

5. Importa il JSON prodotto:

```bash
npm run db:import
```

Le immagini vengono salvate in `public/media/scraped/` e referenziate nel JSON con path locali.

## Aggiornare Le Date Degli Esami

Se le domande sono gia state estratte ma gli esami risultano come `Moodle Sapienza`, aggiorna solo i metadati:

```bash
npm run scraper:metadata
npm run db:metadata
```

Questo rilegge le pagine di review in `MOODLE_QUIZ_URLS`, aggiorna `title` e `date` in `data/raw/question-bank.json`, poi applica gli stessi metadati al database SQLite senza reimportare domande e immagini.
