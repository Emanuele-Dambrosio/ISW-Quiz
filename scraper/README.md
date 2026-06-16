# Moodle scraper

Questo scraper produce un question bank JSON compatibile con `data/question-bank.schema.json`.

## Flusso

1. Copia `.env.example` in `.env` e imposta `MOODLE_BASE_URL`, `MOODLE_LOGIN_URL` e `MOODLE_QUIZ_URLS`.
2. Esegui `npm run scraper:login` e completa il login Moodle nel browser.
3. Se gli URL sono gia pagine di correzione/review, esegui `npm run scraper:scrape`.
4. Se gli URL sono pagine con il pulsante per iniziare il quiz, esegui `npm run scraper:review`.
5. Importa il risultato con `npm run db:push` e `npm run db:import`.

`MOODLE_QUIZ_URLS` accetta URL separati da virgola. Lo scraper salva le immagini in `public/media/scraped/` e riscrive gli `src` HTML con path locali servibili da Next.js.

Se Moodle offre la revisione completa con `showall=1`, usa quella: e molto piu veloce perche lo scraper apre una sola pagina.

```env
MOODLE_QUIZ_URLS="https://elearning.uniroma1.it/mod/quiz/review.php?attempt=1957106&cmid=808522&showall=1"
MOODLE_REVIEW_SHOW_ALL=true
```

Con `MOODLE_REVIEW_SHOW_ALL=true`, anche un link senza `showall=1` viene convertito automaticamente quando punta a `review.php`.

Per revisioni Moodle paginate come:

```text
review.php?attempt=1955629&cmid=785231
review.php?attempt=1955629&cmid=785231&page=1
...
review.php?attempt=1955629&cmid=785231&page=49
```

puoi mettere solo il primo link in `MOODLE_QUIZ_URLS` e impostare:

```env
MOODLE_REVIEW_PAGE_COUNT=50
```

Lo scraper prova anche a scoprire automaticamente i link dalla sezione "Navigazione quiz", ma questa variabile rende il comportamento esplicito. Se il link contiene `showall=1`, la paginazione viene ignorata e viene letta solo la pagina completa.

## Quiz con tentativo Moodle

Molti quiz Moodle mostrano la correzione solo dopo aver iniziato e consegnato un tentativo. In quel caso non usare lo scraping automatico diretto sulla pagina iniziale: usa la modalita guidata.

```bash
npm run scraper:review
```

Per ogni URL lo scraper apre il browser. Tu completi il flusso Moodle manualmente:

1. clicchi il pulsante per iniziare il quiz;
2. completi o consegni il tentativo secondo le regole di Moodle;
3. arrivi alla pagina di correzione/review;
4. torni nel terminale e premi Invio.

A quel punto lo scraper estrae domande, opzioni, risposte corrette e immagini. Se la review e divisa su piu pagine, prova a seguire automaticamente i link `review.php?...page=N`.

Lo scraper non salva domande se non trova almeno una risposta corretta marcata: questo evita di importare per errore pagine di tentativo non corrette.

## Note

Moodle cambia markup tra temi e versioni. Il parser usa selettori robusti per quiz standard (`.que`, `.qtext`, `.answer`), ma potremo adattarlo appena vediamo l'HTML reale del tuo corso.
