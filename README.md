# Dongato (دنگاتو)

> Real-time bilateral expense tracker and fair cost-sharing platform designed specifically for shared student flats, dorms, and roommate living.

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Realtime-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Overview

**Dongato (دنگاتو)** replaces chaotic spreadsheets and informal messaging group tallies with an immutable, zero-sum bilateral ledger. Unlike generic group splitting tools that pool debt into a single opaque pot, Dongato maintains exact pairwise balances between every pair of roommates, supports real-time multi-client synchronization, and provides offline-capable progressive web application (PWA) utilities.

### Key Architectural Invariants

- **Direct P2P Bilateral Ledger**: Balances are calculated per roommate pair ($A \leftrightarrow B$). Each expense splits shares cleanly into bilateral obligations without artificial triangular debts.
- **Zero-Balance Invariant for Joining**: New roommates joining a room start strictly with an empty balance ($0$). Past settled expenses remain attributed to historical participants.
- **Soft-Delete Safeguards**: Members cannot leave or be deactivated if they hold an unsettled non-zero balance with any other roommate. Inactive members retain their past transaction history while being excluded from future splits.
- **Two-Step Bilateral Settlements**: A debtor requests settlement; the creditor reviews and marks it as confirmed or rejected, ensuring accountability.
- **Immutable Audit Trail**: Every expense addition, edit, deletion, or settlement transition emits an immutable log entry in the room activity feed.
- **Zero-Cloud Local Fallback**: The client detects Supabase connectivity automatically. If disconnected or unconfigured, it seamlessly drops into an offline LocalStorage engine without breaking the user experience.

---

## Features

- **Split Types & Dynamic Allocation**: Equal splits, custom per-member shares, category tagging, and live per-person share estimation.
- **Receipt & Invoice Attachments**: Upload receipt images up to 5MB directly to Supabase Storage with instant image preview and an in-app lightbox modal viewer.
- **Financial CSV Export**: Client-side financial reporting engine generating UTF-8 BOM CSV exports for both expenses and settlement logs, guaranteed to open cleanly in Microsoft Excel.
- **Real-Time Synchronization**: Live updates powered by Supabase PostgreSQL change-data-capture (CDC) channels.
- **PWA & Offline Shell**: Service worker caching and installable web app manifest with RTL-first layout and Persian typography (`Vazirmatn`).
- **Dark Slate Aesthetic**: Tailwind-driven `#0b132b` palette with vibrant emerald status indicators and Persian numeric formatting.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19 (Hooks, Context, Functional Components) |
| **Language & Tooling** | TypeScript 5.8, Vite 6, PostCSS, ESLint 9 |
| **Styling** | Tailwind CSS 3.4, Vazirmatn Font, Lucide React Icons |
| **Backend & Database** | Supabase (PostgreSQL 15, Row Level Security, Storage, Realtime) |
| **Offline & Storage** | Service Worker Cache API, LocalStorage State Fallback |

---

## Project Structure

```text
Dongato/
├── public/
│   ├── favicon.svg             # App favicon
│   ├── icon-192.svg            # PWA badge (192x192)
│   ├── icon-512.svg            # PWA splash icon (512x512)
│   ├── manifest.json           # Web App Manifest
│   └── sw.js                   # Service Worker (App Shell caching)
├── src/
│   ├── components/             # React UI components
│   │   ├── ActivityFeed.tsx        # Audit log history
│   │   ├── AddExpenseModal.tsx     # Expense creation with receipt upload
│   │   ├── EditExpenseModal.tsx    # Expense mutation dialog
│   │   ├── ExpenseList.tsx         # Expense feed & Lightbox modal
│   │   ├── JoinRoomModal.tsx       # Room onboarding / invite code flow
│   │   ├── PairwiseBreakdown.tsx   # Bilateral debt matrix
│   │   ├── PendingSettlements.tsx  # Settlement confirmation workflow
│   │   ├── RoomHeader.tsx          # Navigation, user switcher & CSV CTA
│   │   ├── RoomSettingsModal.tsx   # Admin settings & report downloads
│   │   └── SettleUpModal.tsx       # Settlement request form
│   ├── data/                   # Default initial state & mock data
│   ├── lib/
│   │   ├── calculations.ts     # P2P ledger math & balance algorithms
│   │   ├── export.ts           # Client-side UTF-8 BOM CSV exporter
│   │   └── supabase.ts         # Supabase client initializer
│   ├── services/
│   │   ├── api.ts              # Hybrid API (Supabase Cloud + LocalStorage)
│   │   └── realtime.ts         # WebSocket subscription listener
│   ├── types/
│   │   └── index.ts            # TypeScript contracts and domain models
│   ├── App.tsx                 # Root application controller
│   ├── index.css               # Global styles & Tailwind base
│   └── main.tsx                # Entry point & SW registration
├── supabase/
│   └── schema.sql              # Relational schema, DDL, RLS, and Storage bucket
└── package.json
```

---

## Quickstart

### Prerequisites

- Node.js 18+ or 20+
- `pnpm` (recommended) or `npm`

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/SirAmiRTey/Dongato.git
   cd Dongato
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. (Optional) Configure Supabase:
   Copy `.env.example` to `.env` and fill in your Supabase project credentials:
   ```bash
   cp .env.example .env
   ```
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
   > **Note**: If `.env` is omitted, the application automatically runs in local preview mode with full feature parity stored in `localStorage`.

4. Apply Database Migrations (if using Supabase):
   Execute the contents of `supabase/schema.sql` in your Supabase SQL Editor. This provisions:
   - Tables: `rooms`, `members`, `expenses`, `splits`, `settlements`, `activity_logs`
   - Row Level Security (RLS) policies
   - Realtime publication subscriptions
   - `receipts` storage bucket with 5MB size guards

5. Start the development server:
   ```bash
   pnpm run dev
   ```

6. Build for production:
   ```bash
   pnpm run build
   pnpm run preview
   ```

---

## License

This project is licensed under the MIT License.
