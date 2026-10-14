# quizapp

A tiny mobile-friendly web app that shows **20 random questions** picked from categories in
[`public/questions.json`](public/questions.json). You choose how many questions come
from each category (defaults to an even split), and a button at the bottom re-randomizes them.

Each question has **✓ Helyes / ✗ Helytelen** buttons. Once every question is marked, the
score is shown: `ROUND(correct / total * 9) + 1` (1–10 pont).

## Questions file

```json
{
  "Category name": {
    "Question?": "Answer",
    "Question without answer?": ""
  }
}
```

Answers are optional — use `""` or `null` and the card will show "Nincs megadott válasz".
Use `\n` inside an answer to put multiple items on separate lines.

## Run locally

Any static server works, e.g.:

```bash
npx serve public          # or: python -m http.server -d public 8080
```

Or with Docker:

```bash
docker compose up --build   # http://localhost
```

## Deploy to AWS

See [DEPLOY.md](DEPLOY.md).