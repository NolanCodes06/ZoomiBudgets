# ZoomiBudgets

Live demo: https://nolancodes06.github.io/ZoomiBudgets/

A budgeting app for students that runs entirely in your browser. No server, no
database, no bank connections. Everything saves to localStorage on your own
machine.

I built this for a group final project my freshman year at UTSA. I wrote the
application; my teammates worked on the proposal and the presentation. HTML, CSS,
and vanilla JavaScript, with Chart.js for the graphs.

## Running it

Easiest way is to serve the folder locally:

```
python -m http.server 8080
```

Then open http://localhost:8080/login.html

You can open `login.html` directly from the file system too, but serving it over
localhost makes the browser's crypto API available, which the password hashing
needs.

## What it does

You make a local account, set a monthly income, and split it into categories you
define yourself. From there:

- A dashboard with pie charts of where your money is going, plus alerts when
  you're close to or over a category budget
- Transactions, bills with a 14 day lookahead, and savings goals
- A budget score from 0 to 100 based on how you're tracking
- A survey that generates a suggested spending breakdown and some advice
- Light and dark mode

The gamified part is mostly the score and the progress bars. The idea was that
budgeting is boring and a number going up is less boring.

## How data is stored

Everything lives in localStorage under keys prefixed `zoomi.v2`:

| Key | Holds |
|---|---|
| `zoomi.v2.users` | accounts and their saved data |
| `zoomi.v2.current` | who is logged in |
| `zoomi.v2.theme` | light or dark |

Nothing is sent anywhere. Clearing your browser data wipes it.

## About the login system

Worth being upfront about this one. Accounts live in localStorage and passwords
are hashed with SHA-256 through the Web Crypto API.

That is not how you would build auth in a real application. SHA-256 is fast,
which is the opposite of what you want for password hashing, and anything in
localStorage can be read by any script running on the page. A real version needs
a server, a slow hash like bcrypt or Argon2, and a session token.

I did it this way because the assignment required it run with no backend, and
because I wanted to understand what a login actually does before reaching for a
library. Writing the tradeoff down here rather than quietly hoping nobody looks.

Don't put real banking details in this. It's a learning project.

## Files

```
index.html      landing page
login.html      sign in and account creation
budget.html     income and category planning
survey.html     the questionnaire
dashboard.html  charts and summary
about.html
styles.css
app.js          all the logic
```

## Things I'd add

Streaks, data export, and a weekly view. Possibly a real backend, which would
let me fix the auth properly.
