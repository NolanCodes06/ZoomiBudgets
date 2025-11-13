# ZoomiBudgets
ZoomiBudgets_Beta_V2
A gamified, student-friendly budgeting system built with HTML, CSS, and JavaScript.

ZoomiBudgets_Beta_V2 is a local-only budgeting platform designed for students learning financial literacy, money management, and habit-building.
Everything runs 100% in the browser using localStorage — no servers, no databases, no bank connections.

It blends clean UI, gamified features, and intuitive financial tools, making budgeting feel less stressful and more like a game.

🚀 Features
🔐 Local Account System

Create/login accounts (stored locally in localStorage)

Passwords are hashed using Web Crypto API (fallback included)

User data is synced across every page

📊 Dashboard – “Budgeting as a Game”

Fully adaptive pie charts (Chart.js)

Color-coded categories (user-customizable)

Monthly transaction summary

Spending alerts (approaching or exceeding budget)

Savings goals overview

Upcoming bills (next 14 days)

Personalized survey plan visualization

Budget Score (0–100) based on performance & habits

💸 Budgeting Tools

Monthly income planner

Category-based expense planning

Custom categories with custom colors

Add/edit/remove transactions

Monthly & yearly spending tracking

Bills + reminder system

Savings goals tracker

Net worth snapshot

🎯 Personalized Budget Survey

A deeper survey that gives:

A personalized financial plan

Recommended spending percentages

Savings and lifestyle tips

“Where you can save more” advice

Auto-scroll output for a smoother experience

🎨 UI & Experience

Modern, clean, blurred-gradient styling

Light/Dark mode toggle

Right-side sliding navigation drawer

Persistent theme settings

Responsive layout

🧠 Why this project?

ZoomiBudgets is designed for:

Students learning how to manage money for the first time

Classes teaching budgeting in a hands-on way

Anyone wanting a safe practice environment without real financial risk

It is purposely local-first so students can experiment without connecting any real accounts.

🛠️ Tech Stack
Area	Tech
UI	HTML, CSS (custom design, responsive)
Logic	Vanilla JavaScript
Charts	Chart.js
Storage	localStorage
Security	SHA-256 password hashing (WebCrypto API)
Data Persistence	Fully local, no backend
📁 Project Structure
ZoomiBudgets_Beta_V2/
│── index.html
│── login.html
│── budget.html
│── survey.html
│── dashboard.html
│── about.html
│
├── css/
│   └── styles.css
│
├── js/
│   └── app.js
│
└── README.md
📦 Installation

You can run this directly on your computer — no server required.

Option 1: Open in Browser

Download the project folder

Open index.html OR login.html in Chrome, Firefox, Edge, etc.

Option 2: Run a Local Host (recommended)

Run this in the project folder:

Windows PowerShell
python -m http.server 8080
Mac/Linux
python3 -m http.server 8080
Then visit:
http://localhost:8080/login.html
This also enables secure hashing (crypto.subtle) and prevents redirect issues.

🔧 How Data Is Stored

All content is saved locally using keys like:

Key	Description
zoomi.v2.users	All user accounts + saved data
zoomi.v2.current	Currently logged-in user
zoomi.v2.theme	Light/Dark mode
(more keys inside local state)	
This keeps everything private and offline.

🎮 Gamification Elements

Budgeting Score (0–100)

Spending alerts & warnings

Progress bars for goals

Color customization

Encouraging messages based on performance

“First transaction of the month” and “Daily activity streak” foundation (streak in progress)

📈 Roadmap / Future Plans
Planned for V3

Account streaks system

Achievements & badges

Weekly habit view

Export/import user data

Minimal backend mode (Firebase or Supabase optional)

Social version for group/class comparison

Financial education mini-modules

🧑‍💻 Contributing

This project is student-focused, but contributions, ideas, and improvements are welcome.
Fork it, submit PRs, or open issues with suggestions.

🛡️ Security Disclaimer

ZoomiBudgets is not meant for real banking credentials.
Passwords are hashed, but your data stays on your device only.
For educational use only.

❤️ Credits

Created for students learning budgeting, spending awareness, and financial responsibility.
Built with love, clean code, and way too many late-night redesigns.
