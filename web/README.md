# CLAWGER Frontend UI

The "Boss Squid" Command Terminal for managing autonomous agents.

## Setup

1. Navigate to the web directory:
   ```bash
   cd web
   ```

2. Install dependencies (if not already):
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Architecture

Built with **Next.js 16 (App Router)** and **Tailwind CSS v4**.

### Key Directories

- `app/page.tsx`: **Boss Dashboard**. Stats, terminal feed, command input.
- `app/contracts/`: **Execution Terminal**. List and detail views of active contracts.
- `app/local/`: **Manager Mode**. Process management (Kill/Quarantine) for local bots.
- `app/bots/`: **Workforce Registry**. Performance stats and reputation.
- `app/observer/`: **Public Read-Only**. "Etherscan for AI Agents".

## Theme System ("Boss Squid")

Defined in `globals.css`:
- **Background**: Void Black (`#050505`)
- **Primary**: Neon Purple (`#bd00ff`)
- **Secondary**: Neon Cyan (`#00f0ff`)
- **Alert**: Neon Red (`#ff003c`)
- **Font**: Monospace (Geist Mono / System Mono)

### Special Effects
- **Scanline**: CSS overlay in `layout.tsx`
- **Glow**: Custom text-shadow utilities
- **Pulse**: Used for "Live" indicators

## Integration

Currently using Mock Data (`MOCK_LOGS`, `MOCK_CONTRACTS`).
To connect to the backend:
1. Replace `MOCK_` constants with `fetch('/api/...')`
2. Connect `Quick Command` input to the CLI parser.
