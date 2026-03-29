# 🚗 TTS-AWPMS — Automotive & Vehicle Park Management System

A modern, responsive web application for managing vehicle rental operations — including fleet tracking, contract management, customer records, and user administration.

---

## 📌 Project Overview

**TTS-AWPMS** (Automotive & Vehicle Park Management System) is a frontend web application built for businesses that manage vehicle rental fleets. It provides an intuitive dashboard for operators to handle day-to-day rental workflows: tracking vehicle availability, creating and monitoring rental contracts, managing customers and staff, and viewing system notifications — all in one place.

---

## 🎥 Demo

> 🚧 Demo link coming soon...

---

## 🛠️ Tech Stack

| Category           | Technology                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Framework          | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)           |
| Build Tool         | [Vite](https://vitejs.dev/)                                                              |
| Styling            | [Tailwind CSS v4](https://tailwindcss.com/)                                              |
| UI Components      | [Radix UI](https://www.radix-ui.com/) + [Lucide React](https://lucide.dev/)              |
| State Management   | [Zustand](https://zustand-demo.pmnd.rs/)                                                 |
| Server State       | [TanStack React Query v5](https://tanstack.com/query)                                    |
| Data Tables        | [TanStack React Table v8](https://tanstack.com/table)                                    |
| Forms & Validation | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)                |
| Routing            | [React Router v7](https://reactrouter.com/)                                              |
| HTTP Client        | [Axios](https://axios-http.com/)                                                         |
| Date Utilities     | [date-fns](https://date-fns.org/) + [React Day Picker](https://react-day-picker.js.org/) |
| Notifications      | [Sonner](https://sonner.emilkowal.ski/)                                                  |

---

## ✨ Features

- 🔐 **Authentication** — Login with protected routes and role-based access control
- 🚙 **Vehicle Management** — Track fleet with status (at yard / renting / maintenance), specs, and daily rates
- 📋 **Contract Management** — Create and manage rental contracts with customer assignment and status tracking
- 👥 **Customer Management** — Maintain customer records and rental history
- 👤 **User Management** — Manage staff accounts with role and permission control
- 🔔 **Notifications** — In-app notification center for system alerts
- 🏢 **Company Settings** — Configure company-level information
- 📊 **Dashboard** — Overview of key operational metrics

---

## 📁 Project Structure

```
fe-tts-awpms/
├── public/
├── src/
│   ├── api/                  # Axios instance + per-module API functions
│   │   ├── axios.ts
│   │   ├── auth.api.ts
│   │   ├── contracts.api.ts
│   │   ├── customers.api.ts
│   │   ├── users.api.ts
│   │   ├── vehicles.api.ts
│   │   ├── company.api.ts
│   │   └── notifications.api.ts
│   ├── assets/               # Static assets (images, icons, etc.)
│   ├── components/
│   │   ├── layout/           # AppLayout, Sidebar, Topbar
│   │   └── ui/               # Reusable UI primitives (Button, Input, Dialog, ...)
│   ├── hooks/                # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useDebounce.ts
│   │   └── usePermission.ts
│   ├── lib/
│   │   └── utils.ts          # Utility helpers (cn, etc.)
│   ├── pages/                # Feature-based page components
│   │   ├── auth/
│   │   ├── contracts/
│   │   ├── customers/
│   │   ├── dashboard/
│   │   ├── notifications/
│   │   ├── settings/
│   │   ├── users/
│   │   └── vehicles/
│   ├── router/               # Route definitions + ProtectedRoute
│   ├── stores/               # Zustand stores (auth, notifications)
│   ├── types/                # TypeScript type definitions per domain
│   ├── utils/                # Constants, formatters, helpers, query keys
│   ├── index.css
│   └── main.tsx
├── .env
├── .env.example
├── index.html
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

---

## 🚀 Installation

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [npm](https://www.npmjs.com/) v9 or higher

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-username/fe-tts-awpms.git
cd fe-tts-awpms

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Then edit .env with your values

# 4. Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## 🔑 Environment Variables

Create a `.env` file at the project root based on `.env.example`:

```env
# Base URL for the backend API
VITE_API_BASE_URL=http://localhost:3000/api
```

> All Vite environment variables must be prefixed with `VITE_` to be accessible in the browser.

---

## 📜 Available Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the development server         |
| `npm run build`   | Type-check and build for production  |
| `npm run preview` | Preview the production build locally |
| `npm run lint`    | Run ESLint across the codebase       |

---

## 🔮 Future Improvements

- [ ] Add a reporting/analytics module with charts (e.g., Recharts or Chart.js)
- [ ] Implement dark mode support
- [ ] Add pagination and advanced filtering to all list pages
- [ ] Introduce unit and integration tests (Vitest + React Testing Library)
- [ ] Add internationalization (i18n) support for multiple languages
- [ ] Improve mobile responsiveness across all pages
- [ ] Implement real-time notifications via WebSocket

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

> Built with ❤️ using React + TypeScript + Vite
