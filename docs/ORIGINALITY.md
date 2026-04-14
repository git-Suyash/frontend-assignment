# Originality

## Statement

All application logic was written for this assessment. No code was copied from tutorials, StackOverflow, or third-party boilerplate beyond what is inherent to framework conventions.

---

## Third-Party Libraries

| Library | Version | Purpose |
|---|---|---|
| `react` | ^19.2.4 | UI rendering, hooks, concurrent features |
| `react-dom` | ^19.2.4 | DOM rendering |
| `react-router-dom` | ^7.14.0 | Client-side routing, lazy page loading |
| `react-window` | ^2.2.7 | Virtualized list rendering for 600-item cart |
| `tailwindcss` | ^4.2.2 | Utility-first CSS framework |
| `@tailwindcss/vite` | ^4.2.2 | Vite plugin for Tailwind CSS v4 |
| `vite` | ^8.0.4 | Build tool and dev server |
| `vite-plugin-pwa` | ^1.2.0 | Service worker generation and PWA manifest injection |
| `workbox-window` | ^7.4.0 | Workbox runtime for service worker communication |
| `@vitejs/plugin-react` | ^6.0.1 | React Fast Refresh for Vite |
| `babel-plugin-react-compiler` | ^1.0.0 | React Compiler for automatic memoisation |
| `@rolldown/plugin-babel` | ^0.2.2 | Babel integration for the React Compiler preset |
| `typescript` | ~6.0.2 | Static type checking |
| `eslint` | ^9.39.4 | Linting |

---

## API Sources

| API | Base URL | Used For |
|---|---|---|
| Fake Store API | `https://fakestoreapi.com` | Product catalog, categories, and price freshness checks |
| JSONPlaceholder | `https://jsonplaceholder.typicode.com/posts` | Simulated order submission endpoint (returns a synthetic order ID) |
