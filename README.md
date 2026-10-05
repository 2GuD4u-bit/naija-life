# NAIJA LIFE

An original Nigerian city life simulator prototype. It runs in a modern browser and saves progress in that browser's local storage.

## Play

Open `index.html` in Chrome or Edge, create a character, and explore.

- **WASD / arrow keys:** walk or drive
- **Shift:** sprint
- **E:** enter a building, talk to a neighbor, or leave an interior
- **F:** enter or exit a nearby vehicle
- **G:** attempt a street crime near an NPC
- **Click a building:** walk near it; press **E** at the entrance
- **Touchscreens:** use the on-screen directional and action buttons

## Phone and time

The in-game phone opens an iPhone-style home screen with working in-game app views for jobs, messages, social meetups, salary, tickets, games, Nollywood, sports, food delivery, banking, clothes, news, housing, cars, health, investments, business, family, city services, police, ads, and settings. App actions use the simulator's game systems and saved character data.

The clock and date follow the device's live clock, formatted for the `Africa/Lagos` time zone. The HUD and phone status bar update while the game is open. The simulator's needs and business income also update as real time passes; it does not speed up or change the device clock.

## Working systems

- Procedurally drawn isometric low-poly city with raised building walls and roofs, roads, yards, trees, traffic, residents, landmark labels, minimap, and simple interiors
- Character setup, walking, building entry, vehicle driving, fuel, damage, traffic, and collision health loss
- Wandering NPCs, conversations, friendships, and reputation
- Food shopping and consumption; health, hunger, energy, happiness, fitness, intelligence, driving, and reputation
- Jobs, wages, rent, bank deposits and withdrawals, transfers, vehicle purchases, repairs, medical care, and business management
- Police wanted level, pursuit, arrest, and fines
- Ten-step opening story, changing weather, phone, map, inventory, and local save/load

## Server-backed accounts, economy, and payments

Run the development server with Node.js 24 or later from this folder using `node backend/server.js`, then open `http://localhost:8787`. Players create or sign into an account in **Phone → Bank**. In account mode, cash and bank balances come from the server; earning, spending, job shifts, mission rewards, rent, investments, and business income use server rules and a transaction ledger. Character progress remains saved on the device.

The backend includes server-priced purchase requests, Paystack bank-transfer and OxaPay crypto adapters, signed webhooks followed by provider-side verification, the requested transaction states, and idempotent wallet crediting. Copy `backend/.env.example` to `backend/.env`. Choose the real package prices/credit amounts before setting `PAYMENT_PACKAGES_JSON`; keep provider keys on the server. Paystack webhooks must point to `/api/payments/webhooks/paystack`; OxaPay's callback URL is built from `PUBLIC_API_URL`.

**Live purchases are disabled by default.** No package prices, provider keys, or hosted HTTPS backend have been configured. The database is a local SQLite development store; production needs durable hosting, backups, account recovery, and payment reconciliation. GitHub Pages can host the static preview but cannot run provider verification or keep secrets, so a payment-enabled public build needs a backend host.

This is a single-player browser prototype. NPCs use simple wandering, traffic uses a simple loop, and visuals use original canvas drawing and emoji placeholders.

## Publish a shareable link with GitHub Pages

This folder includes a GitHub Actions workflow that deploys the site whenever code is pushed to the repository's `main` branch.

1. Create a GitHub repository named `naija-life` (a public repository works with GitHub Free).
2. Upload the contents of this folder to the repository root, including `.github/workflows/pages.yml` and `.nojekyll`.
3. In the repository, open **Settings → Pages** and set the publishing source to **GitHub Actions**.
4. Wait for the Pages workflow to finish. GitHub will show the public website URL in the workflow and Pages settings. It will usually look like `https://YOUR-USERNAME.github.io/naija-life/`.

The website link lets friends open the current build. Game saves are stored in each visitor's browser, so this version does not sync one player's live save between different people or devices. GitHub Pages serves the site publicly; do not put private information in the project.
