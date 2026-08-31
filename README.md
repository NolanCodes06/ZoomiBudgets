# ZoomiBudgets

Live demo: https://nolancodes06.github.io/ZoomiBudgets/

A budgeting app for students that runs entirely in your browser. No server, no
database, no bank connections. Everything saves to localStorage on your own
machine.

This is the build I kept working on after the class was over. The original was a
group final project my freshman year at UTSA, where I wrote the application and
my teammates handled the proposal and the presentation. That version is on the
`group-build` branch. This one is mine, and it is roughly twice the code.

The idea I was chasing: budgeting is boring, and the apps that exist assume you
have a salary and a mortgage. A college student has a shift schedule, textbook
costs, four subscriptions they forgot about, and a month where rent lands before
the paycheck. So the app is built around that, and there is a level and an XP
bar to make opening it feel less like a chore.

## Running it

Serve the folder locally:

```
python -m http.server 8080
```

Then open http://localhost:8080/login.html

Opening `login.html` straight off the file system mostly works, but serving it
over localhost gives you a secure context, which the password hashing needs. See
the note on the login below.

## What it does

You make a local account, take a short survey, and it builds you a starting plan.
From there:

| Page | What it's for |
|---|---|
| Home | daily check-ins, the thing that drives the streak |
| Dashboard | charts, XP, level, streak, high level stats |
| Budget | planned vs actual, logging expenses |
| Categories | define and edit your own spending categories |
| Subscriptions | the recurring stuff that quietly adds up |
| Class Costs | textbooks, fees, lab kits, per semester |
| Emergency Fund | a separate target from your normal savings |
| Achievements | what you have unlocked |
| Broke Student Mode | a stripped down view for when the number is bad |
| Resources & Aid | mockup of a school aid hub plugged into the budget |

Charts are Chart.js, pulled from a CDN.

## The gamified part

XP comes from actually using it. Completing the survey is 100, logging your first
expense is 50, any expense after that is 10, setting an emergency fund target is
40, and daily and weekly challenges are 75 and 150. Levels use a curve of
`100 * level^1.3`, so early levels come fast and then slow down.

There are 7 achievements right now: first expense, ten expenses, expenses
spanning 30 days, emergency fund set, survey completed, and 3 and 7 day streaks.

None of this is deep. It is a progress bar and a number going up. That was the
whole point, because a budget you never open does nothing.

There is also a "blur money" toggle that hides every dollar figure on the page,
for using it somewhere public.

## How data is stored

Everything is in localStorage under keys prefixed `zoomi.prelaunch`:

| Key | Holds |
|---|---|
| `zoomi.prelaunch.users` | accounts and all of their data |
| `zoomi.prelaunch.currentUser` | who is logged in |
| `zoomi.prelaunch.theme` | light or dark |
| `zoomi.prelaunch.privacy` | whether money is blurred |

Nothing is sent anywhere. Clearing your browser data wipes all of it.

## About the login system

Same caveat as the earlier version, plus one more that is worse.

Accounts live in localStorage and passwords are hashed with SHA-256 through the
Web Crypto API. SHA-256 is fast, which is the opposite of what you want for
password hashing, and anything in localStorage can be read by any script on the
page. A real version needs a server, a slow hash like bcrypt or Argon2, and a
session token.

The extra problem: Web Crypto only exists in a secure context. Open the app off
the file system and `crypto.subtle` is not there, so the code falls back to a
hash function I wrote that is not cryptographically anything. It exists so the
demo does not break. It is not security.

I built it this way because the assignment required it run with no backend, and
because I wanted to understand what a login actually does before reaching for a
library. Writing the tradeoff down here rather than quietly hoping nobody looks.

Do not put real banking details in this. It is a learning project.

## Files

```
index.html          home and daily check-ins
login.html          sign in and account creation
dashboard.html      charts, XP, stats
budget.html         planned vs actual
survey.html         first time setup
categories.html     custom categories
subscriptions.html  recurring costs
classes.html        per semester class costs
emergency.html      emergency fund
achievements.html   unlocked achievements
broke.html          broke student mode
aid.html            aid resources mockup
css/styles.css
js/app.js           all the logic
assets/logo.png
```

## Branches

- `main` is this build
- `group-build` is the version my group turned in
- `V1` is the first working version, kept for reference

## Things I'd add

More achievements, a weekly view, data export, and a real backend, which would
let me fix the auth properly instead of writing a section explaining why it is
broken.
