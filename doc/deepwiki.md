Published Time: 2026-03-11T01:08:32.201356

QinMoMeak/MonoTracker | DeepWiki
===============

Index your code with Devin

[DeepWiki](https://deepwiki.com/)

[DeepWiki](https://deepwiki.com/)
[QinMoMeak/MonoTracker](https://github.com/QinMoMeak/MonoTracker "Open repository")

Index your code with

Devin

Edit Wiki Share

Last indexed: 11 March 2026 ([ccbf8d](https://github.com/QinMoMeak/MonoTracker/commits/ccbf8d25))

*   [Overview](https://deepwiki.com/QinMoMeak/MonoTracker/1-overview)
*   [Getting Started](https://deepwiki.com/QinMoMeak/MonoTracker/2-getting-started)
*   [Installation & Setup](https://deepwiki.com/QinMoMeak/MonoTracker/2.1-installation-and-setup)
*   [Project Structure](https://deepwiki.com/QinMoMeak/MonoTracker/2.2-project-structure)
*   [Architecture](https://deepwiki.com/QinMoMeak/MonoTracker/3-architecture)
*   [System Design](https://deepwiki.com/QinMoMeak/MonoTracker/3.1-system-design)
*   [State Management](https://deepwiki.com/QinMoMeak/MonoTracker/3.2-state-management)
*   [Data Flow Patterns](https://deepwiki.com/QinMoMeak/MonoTracker/3.3-data-flow-patterns)
*   [Core Components](https://deepwiki.com/QinMoMeak/MonoTracker/4-core-components)
*   [App Component](https://deepwiki.com/QinMoMeak/MonoTracker/4.1-app-component)
*   [AddItemModal Component](https://deepwiki.com/QinMoMeak/MonoTracker/4.2-additemmodal-component)
*   [Timeline Component](https://deepwiki.com/QinMoMeak/MonoTracker/4.3-timeline-component)
*   [Features](https://deepwiki.com/QinMoMeak/MonoTracker/5-features)
*   [Item Management](https://deepwiki.com/QinMoMeak/MonoTracker/5.1-item-management)
*   [AI-Assisted Entry](https://deepwiki.com/QinMoMeak/MonoTracker/5.2-ai-assisted-entry)
*   [Statistics & Analytics](https://deepwiki.com/QinMoMeak/MonoTracker/5.3-statistics-and-analytics)
*   [Data Layer](https://deepwiki.com/QinMoMeak/MonoTracker/6-data-layer)
*   [Type System](https://deepwiki.com/QinMoMeak/MonoTracker/6.1-type-system)
*   [Storage Service](https://deepwiki.com/QinMoMeak/MonoTracker/6.2-storage-service)
*   [WebDAV Backup](https://deepwiki.com/QinMoMeak/MonoTracker/6.3-webdav-backup)
*   [Import & Export](https://deepwiki.com/QinMoMeak/MonoTracker/6.4-import-and-export)
*   [AI Integration](https://deepwiki.com/QinMoMeak/MonoTracker/7-ai-integration)
*   [AI Configuration](https://deepwiki.com/QinMoMeak/MonoTracker/7.1-ai-configuration)
*   [Multi-Provider Support](https://deepwiki.com/QinMoMeak/MonoTracker/7.2-multi-provider-support)
*   [AI Service Implementation](https://deepwiki.com/QinMoMeak/MonoTracker/7.3-ai-service-implementation)
*   [Configuration & Theming](https://deepwiki.com/QinMoMeak/MonoTracker/8-configuration-and-theming)
*   [Constants](https://deepwiki.com/QinMoMeak/MonoTracker/8.1-constants)
*   [Themes & Styling](https://deepwiki.com/QinMoMeak/MonoTracker/8.2-themes-and-styling)
*   [Internationalization](https://deepwiki.com/QinMoMeak/MonoTracker/8.3-internationalization)
*   [Deployment](https://deepwiki.com/QinMoMeak/MonoTracker/9-deployment)
*   [Build System](https://deepwiki.com/QinMoMeak/MonoTracker/9.1-build-system)
*   [Web Deployment](https://deepwiki.com/QinMoMeak/MonoTracker/9.2-web-deployment)
*   [Android & Capacitor](https://deepwiki.com/QinMoMeak/MonoTracker/9.3-android-and-capacitor)

Menu

Overview
========

Relevant source files
*   [App.tsx](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx)
*   [README.md](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/README.md)
*   [package.json](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/package.json)

This document provides a high-level introduction to **MonoTracker**, a local-first item tracking application with AI-assisted data entry capabilities. It covers the application's purpose, core features, technology stack, and architectural foundations. For detailed information about specific subsystems, refer to the specialized sections: [Getting Started](https://deepwiki.com/QinMoMeak/MonoTracker/2-getting-started) for installation and setup, [Architecture](https://deepwiki.com/QinMoMeak/MonoTracker/3-architecture) for system design details, [Core Components](https://deepwiki.com/QinMoMeak/MonoTracker/4-core-components) for UI component documentation, and [Features](https://deepwiki.com/QinMoMeak/MonoTracker/5-features) for in-depth feature descriptions.

Purpose and Scope
-----------------

MonoTracker is designed to help users track purchased items and maintain wishlists with minimal friction. The application prioritizes local data ownership while offering cloud backup options, and leverages AI to reduce manual data entry effort. This overview explains what the system does, how it is structured, and what technologies underpin its implementation.

What is MonoTracker
-------------------

MonoTracker is a **local-first item tracking application** that enables users to:

*   Maintain two separate inventories: **owned items** and **wishlist items**
*   Record purchase details including name, price, quantity, category, acquisition channel, and dates
*   Use **AI-powered quick entry** to extract item information from text descriptions and images
*   Analyze spending patterns through **statistics and charts**
*   Export and backup data to CSV, ZIP, and WebDAV-compatible cloud storage

The application runs as both a **Progressive Web App** (PWA) in modern browsers and as a **native Android application** packaged via Capacitor, sharing the same React codebase across platforms.

**Sources:**[README.md 1-52](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/README.md#L1-L52)[metadata.json 1-8](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/metadata.json#L1-L8)

Core Features Summary
---------------------

| Feature Category         | Capabilities                                                 | Key Implementation                                           |
| ------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| **Item Management**      | Create, read, update, delete items; dual view (owned/wishlist); custom categories, statuses, and channels | React state management in [App.tsx](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx) |
| **AI-Assisted Entry**    | Text + image analysis; multi-image recognition; automatic field population (name, price, category, date) | Multi-provider adapter supporting OpenAI, Gemini, Anthropic, and Chinese AI services |
| **Search & Filtering**   | Keyword search; date range filters; price range filters; category/status/channel filters | Advanced filtering logic in [App.tsx](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx) |
| **Statistics**           | Monthly spending trends; ownership duration distribution; channel breakdown; top categories; asset overview | ECharts visualization in Statistics tab                      |
| **Data Portability**     | CSV export/import; ZIP export with images; native share integration | [csvService.ts](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/csvService.ts) and [Capacitor Share plugin](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/Capacitor%20Share%20plugin) |
| **Cloud Backup**         | WebDAV integration; automatic daily backup; manual restore from last 4 versions; optional image inclusion | [webdavService.ts](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/webdavService.ts) with manifest-based versioning |
| **Internationalization** | Chinese, English, Japanese language support; theme switching; dark mode | [constants.ts](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/constants.ts) i18n configuration |

**Sources:**[README.md 5-16](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/README.md#L5-L16)

Technology Stack
----------------

MonoTracker is built on a modern JavaScript stack optimized for both web and mobile deployment:

### Frontend Framework

\`\`\`
React 19.2.3 (UI library with hooks)
├── TypeScript 5.8.2 (type safety)
├── Vite 6.2.0 (build tool and dev server)
└── Tailwind CSS (utility-first styling)
\`\`\`

### Native Integration

\`\`\`
Capacitor 8.0.1 (native bridge)
├── @capacitor/filesystem 8.0.0 (local file access)
├── @capacitor/share 8.0.0 (native sharing)
├── @capacitor/app 8.0.0 (app lifecycle)
└── @capacitor/splash-screen 8.0.0 (app startup)
\`\`\`

### Key Libraries

| Library         | Version | Purpose                               |
| --------------- | ------- | ------------------------------------- |
| `lucide-react`  | 0.562.0 | Icon system                           |
| `echarts`       | 5.6.0   | Statistical charts and visualizations |
| `jszip`         | 3.10.1  | ZIP file generation for data export   |
| `@google/genai` | 1.35.0  | Google Gemini AI integration          |

### Development Tools

| Tool       | Configuration File | Purpose                              |
| ---------- | ------------------ | ------------------------------------ |
| ESLint     | eslint.config.js   | Code quality and linting             |
| TypeScript | tsconfig.json      | Type checking with noEmit flag       |
| Tailwind   | tailwind.config.js | CSS utility framework with dark mode |
| Vite       | vite.config.ts     | Build configuration and optimization |

**Sources:**[package.json 1-46](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/package.json#L1-L46)[README.md 18-29](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/README.md#L18-L29)

<old_str>

### Data Flow Architecture

This diagram shows how data moves through the system, mapping to actual functions and services:

**Data Flow Pattern:**

1.   **Input Stage**: User provides data via `AddItemModal` component with text, images, or manual forms
2.   **AI Processing**: When AI is enabled, `extractItemDetails` (from `geminiService.ts`) parses input using active AI configuration [App.tsx 1157-1167](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L1157-L1167)
3.   **State Update**: `handleSaveItem` (line 886) validates data via `normalizeItem` (line 351) and updates `items` state [App.tsx 886-953](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L886-L953)
4.   **Debounced Persistence**: `useEffect` hook (line 568) debounces state changes by 250ms, then calls `saveState`[App.tsx 568-585](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L568-L585)
5.   **Platform Storage**: `storageService.saveState` writes to LocalStorage (web) or Capacitor Filesystem (Android) [services/storageService.ts](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/services/storageService.ts)
6.   **Cloud Backup**: `handleWebDavUpload` (line 1380) and auto-backup logic (lines 683-707) handle WebDAV synchronization [App.tsx 683-707](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L683-L707)[App.tsx 1380-1405](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L1380-L1405)

**Sources:**[App.tsx 351-375](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L351-L375)[App.tsx 568-585](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L568-L585)[App.tsx 683-707](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L683-L707)[App.tsx 886-953](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L886-L953)[App.tsx 1157-1167](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L1157-L1167)[App.tsx 1380-1405](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L1380-L1405)</old_str>

<new_str>

### High-Level Component Structure

The following diagram maps the major architectural components to their code entities:

**Key Code Entities:**

*   **`App.tsx:19`**: Main `App` component using React hooks for state management [App.tsx 19](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L19-L19)
*   **`App.tsx:21-63`**: Primary state declarations using `useState` hooks [App.tsx 21-63](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L21-L63)
*   **`App.tsx:886-953`**: Item CRUD handlers (`handleSaveItem`, `handleEditItem`, `handleDeleteItem`) [App.tsx 886-1014](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L886-L1014)
*   **`App.tsx:351-375`**: `normalizeItem` function for data validation and sanitization [App.tsx 351-375](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L351-L375)
*   **`storageService.ts`**: Platform-agnostic persistence with `loadState()` and `saveState()` functions [services/storageService.ts](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/services/storageService.ts)
*   **`backupService.ts`**: ZIP generation and CSV import/export functionality [services/backupService.ts](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/services/backupService.ts)
*   **`webdavService.ts`**: WebDAV client functions (`uploadWebDav`, `downloadWebDav`, `existsWebDav`) [services/webdavService.ts](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/services/webdavService.ts)
*   **`aiProviders.ts`**: Multi-provider AI configuration metadata [services/aiProviders.ts](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/services/aiProviders.ts)
*   **`types.ts`**: TypeScript interfaces defining data structures [types.ts](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/types.ts)
*   **`constants.ts`**: Application configuration including `TEXTS`, `THEMES`, `CATEGORY_CONFIG`, and `ICONS`[constants.ts](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/constants.ts)

**Sources:**[App.tsx 1-100](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L1-L100)[App.tsx 351-375](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L351-L375)[App.tsx 886-1014](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L886-L1014)

System Architecture Overview
----------------------------

### High-Level Component Structure

The following diagram maps the major architectural components to their code entities:

**Key Code Entities:**

*   **`index.tsx`**: Application entry point that mounts the React app to the DOM [index.tsx 1-15](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/index.tsx#L1-L15)
*   **`App.tsx`**: Root component containing all state management and orchestrating child components
*   **`types.ts`**: Central type definitions for `Item`, `AppState`, `AiConfig`, and related interfaces
*   **`storageService.ts`**: Abstraction layer for LocalStorage (web) and Capacitor Filesystem (Android)
*   **`constants.ts`**: Configuration constants including categories, icons, i18n strings, and themes

**Sources:**[index.tsx 1-15](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/index.tsx#L1-L15)[README.md 18-29](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/README.md#L18-L29) diagrams from prompt

### Data Flow Architecture

This diagram shows how data moves through the system, mapping to actual functions and services:

**Data Flow Pattern:**

1.   **Input Stage**: User provides data via text, images, or manual forms
2.   **Processing Stage**: AI services (when enabled) parse input and extract structured data into `ItemDetails` interface
3.   **State Update**: Handler functions (`handleAddItem`, `handleEditItem`) modify the React state
4.   **Persistence**: `storageService.saveState` automatically saves to LocalStorage (web) or Capacitor Filesystem (Android)
5.   **Backup**: Optional cloud backup via WebDAV or export via CSV/ZIP

**Sources:** Diagrams from prompt, [README.md 7-8](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/README.md#L7-L8)

Deployment Targets
------------------

MonoTracker supports two deployment modes from a single codebase:

### Web Deployment (Progressive Web App)

**Web Characteristics:**

*   Runs in any modern browser supporting ES modules
*   Uses `localStorage` API for data persistence
*   Loads React and icon libraries from `esm.sh` CDN [index.html](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/index.html)
*   No native device APIs available

**Sources:**[README.md 31-33](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/README.md#L31-L33)[package.json 7-9](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/package.json#L7-L9)

### Android Deployment (Native App)

**Android Characteristics:**

*   Same React codebase wrapped in native shell via Capacitor
*   Uses `@capacitor/filesystem` for native file access at `tracker_state.json`
*   Supports native sharing via `@capacitor/share` plugin
*   Requires camera/microphone permissions for image-based AI features [metadata.json 4-7](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/metadata.json#L4-L7)
*   Builds to APK via Android Gradle wrapper [README.md 35-38](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/README.md#L35-L38)

**Sources:**[package.json 14-18](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/package.json#L14-L18)[README.md 35-38](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/README.md#L35-L38)[metadata.json 1-8](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/metadata.json#L1-L8)

Storage and Backup Strategy
---------------------------

MonoTracker implements a multi-layered persistence strategy to ensure data safety:

| Layer                 | Technology                                           | Purpose                                 | Location                                               |
| --------------------- | ---------------------------------------------------- | --------------------------------------- | ------------------------------------------------------ |
| **Primary**           | React `useState`                                     | In-memory state during runtime          | N/A                                                    |
| **Local Persistence** | LocalStorage (web) or Capacitor Filesystem (Android) | Automatic save on every state change    | `localStorage['trackerState']` or `tracker_state.json` |
| **Cloud Backup**      | WebDAV                                               | Automatic daily backup + manual restore | Remote WebDAV server with 4-version history            |
| **Data Export**       | CSV / ZIP                                            | Manual data portability and archival    | User-initiated downloads                               |

**Key Service Files:**

*   **[storageService.ts](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/storageService.ts)**: Handles `saveState()` and `loadState()` with platform detection
*   **[webdavService.ts](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/webdavService.ts)**: Manages WebDAV uploads, manifest versioning, and restore operations
*   **[csvService.ts](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/csvService.ts)**: Implements CSV parsing and generation for data import/export

**Sources:**[README.md 13-15](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/README.md#L13-L15) diagrams from prompt

AI Integration Architecture
---------------------------

MonoTracker abstracts AI provider selection through a flexible configuration system supporting multiple vendors:

### Supported AI Providers

The following diagram shows the AI provider architecture with code entity mappings:

### Provider Details

| Provider      | Key         | Target Market | Default Model                | API Type          |
| ------------- | ----------- | ------------- | ---------------------------- | ----------------- |
| Disabled      | `disabled`  | N/A           | N/A                          | No API calls      |
| OpenAI        | `openai`    | Global        | `gpt-4o`                     | OpenAI-compatible |
| Google Gemini | `gemini`    | Global        | `gemini-2.0-flash-exp`       | Gemini SDK        |
| Anthropic     | `anthropic` | Global        | `claude-3-5-sonnet-20241022` | OpenAI-compatible |
| DeepSeek      | `deepseek`  | China         | `deepseek-chat`              | OpenAI-compatible |
| Moonshot      | `moonshot`  | China         | `moonshot-v1-8k`             | OpenAI-compatible |
| Qwen          | `qwen`      | China         | `qwen-plus`                  | OpenAI-compatible |
| Zhipu         | `zhipu`     | China         | `glm-4-plus`                 | OpenAI-compatible |
| Doubao        | `doubao`    | China         | `doubao-pro-32k`             | OpenAI-compatible |
| iFlow         | `iflow`     | China         | `generalv3.5`                | OpenAI-compatible |

**AI Configuration Architecture:**

*   **`AiConfig` State**: Stores `provider`, `model`, nested `credentials` map (by provider and model), and `lastModelByProvider`[App.tsx 31](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L31-L31)
*   **Per-Model Credentials**: Each provider/model combination has separate `apiKey` and `baseUrl` storage [App.tsx 454-456](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L454-L456)
*   **Runtime Configuration**: `getActiveAiConfig` (line 1157) flattens nested config into `AiRuntimeConfig` for actual API calls [App.tsx 1157-1167](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L1157-L1167)
*   **Provider Metadata**: `aiProviders.ts` exports `AI_PROVIDERS` array with default models and base URLs [services/aiProviders.ts](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/services/aiProviders.ts)
*   **Legacy Migration**: `buildAiConfig` (line 458) handles migration from old single-credential format [App.tsx 458-483](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L458-L483)

**Sources:**[App.tsx 31](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L31-L31)[App.tsx 444-483](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L444-L483)[App.tsx 1121-1155](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L1121-L1155)[App.tsx 1157-1167](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L1157-L1167)[services/aiProviders.ts](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/services/aiProviders.ts)[README.md 29](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/README.md#L29-L29)[package.json 19](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/package.json#L19-L19)

Project Organization
--------------------

The codebase follows a flat structure with functional separation:

\`\`\`
MonoTracker/
├── index.html              # Web entry point with esm.sh CDN imports
├── index.tsx               # React application mount point (createRoot)
├── App.tsx                 # Root component with centralized state
├── types.ts                # TypeScript interfaces (Item, AppState, AiConfig)
├── constants.ts            # Configuration (TEXTS, THEMES, CATEGORY_CONFIG)
├── components/             # React components
│   ├── AddItemModal.tsx    # Dual-mode item creation (AI + manual)
│   ├── Timeline.tsx        # Infinite scroll timeline display
│   ├── StatsTab.tsx        # Lazy-loaded ECharts analytics
│   ├── Dialog.tsx          # Alert/Confirm/Prompt modals
│   └── SheetModal.tsx      # Bottom sheet UI pattern
├── services/               # Business logic layer
│   ├── storageService.ts   # Platform-agnostic persistence
│   ├── backupService.ts    # ZIP/CSV export and import
│   ├── webdavService.ts    # WebDAV client (upload/download)
│   ├── aiProviders.ts      # AI provider metadata registry
│   └── geminiService.ts    # Gemini SDK integration
├── android/                # Capacitor Android native project
│   ├── app/                # Android app module
│   ├── gradle/             # Gradle build system
│   └── build.gradle        # Version: 1.5.15, versionCode: 34
├── capacitor.config.ts     # Capacitor configuration
├── vite.config.ts          # Vite bundler configuration
├── tailwind.config.js      # Tailwind CSS with dark mode
├── dist/                   # Vite build output (web bundle)
└── doc/                    # Documentation and prototypes
\`\`\`

**Key Directory Purposes:**

*   **Root Level**: Application entry points and core configuration files
*   **`components/`**: Reusable React UI components with specific responsibilities
*   **`services/`**: Business logic abstracted from UI components for testability
*   **`android/`**: Native Android wrapper managed by Capacitor CLI
*   **`dist/`**: Production web build artifacts generated by Vite

For a detailed explanation of the project structure, see [Project Structure](https://deepwiki.com/QinMoMeak/MonoTracker/2.2-project-structure).

**Sources:**[README.md 1-52](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/README.md#L1-L52)[package.json 1-46](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/package.json#L1-L46)[App.tsx 1-18](https://github.com/QinMoMeak/MonoTracker/blob/ccbf8d25/App.tsx#L1-L18)

Next Steps
----------

*   **For installation instructions**, see [Installation & Setup](https://deepwiki.com/QinMoMeak/MonoTracker/2.1-installation-and-setup)
*   **For architectural deep-dives**, see [Architecture](https://deepwiki.com/QinMoMeak/MonoTracker/3-architecture) and its subsections
*   **For component documentation**, see [Core Components](https://deepwiki.com/QinMoMeak/MonoTracker/4-core-components)
*   **For feature implementation details**, see [Features](https://deepwiki.com/QinMoMeak/MonoTracker/5-features)
*   **For data layer specifics**, see [Data Layer](https://deepwiki.com/QinMoMeak/MonoTracker/6-data-layer)
*   **For AI system details**, see [AI Integration](https://deepwiki.com/QinMoMeak/MonoTracker/7-ai-integration)
*   **For deployment guides**, see [Deployment](https://deepwiki.com/QinMoMeak/MonoTracker/9-deployment)

Dismiss
Refresh this wiki

This wiki was recently refreshed. Please wait 7 day s to refresh again.

### On this page

*   [Overview](https://deepwiki.com/QinMoMeak/MonoTracker#overview)
*   [Purpose and Scope](https://deepwiki.com/QinMoMeak/MonoTracker#purpose-and-scope)
*   [What is MonoTracker](https://deepwiki.com/QinMoMeak/MonoTracker#what-is-monotracker)
*   [Core Features Summary](https://deepwiki.com/QinMoMeak/MonoTracker#core-features-summary)
*   [Technology Stack](https://deepwiki.com/QinMoMeak/MonoTracker#technology-stack)
*   [Frontend Framework](https://deepwiki.com/QinMoMeak/MonoTracker#frontend-framework)
*   [Native Integration](https://deepwiki.com/QinMoMeak/MonoTracker#native-integration)
*   [Key Libraries](https://deepwiki.com/QinMoMeak/MonoTracker#key-libraries)
*   [Development Tools](https://deepwiki.com/QinMoMeak/MonoTracker#development-tools)
*   [System Architecture Overview](https://deepwiki.com/QinMoMeak/MonoTracker#system-architecture-overview)
*   [High-Level Component Structure](https://deepwiki.com/QinMoMeak/MonoTracker#high-level-component-structure)
*   [Data Flow Architecture](https://deepwiki.com/QinMoMeak/MonoTracker#data-flow-architecture)
*   [Deployment Targets](https://deepwiki.com/QinMoMeak/MonoTracker#deployment-targets)
*   [Web Deployment (Progressive Web App)](https://deepwiki.com/QinMoMeak/MonoTracker#web-deployment-progressive-web-app)
*   [Android Deployment (Native App)](https://deepwiki.com/QinMoMeak/MonoTracker#android-deployment-native-app)
*   [Storage and Backup Strategy](https://deepwiki.com/QinMoMeak/MonoTracker#storage-and-backup-strategy)
*   [AI Integration Architecture](https://deepwiki.com/QinMoMeak/MonoTracker#ai-integration-architecture)
*   [Supported AI Providers](https://deepwiki.com/QinMoMeak/MonoTracker#supported-ai-providers)
*   [Provider Details](https://deepwiki.com/QinMoMeak/MonoTracker#provider-details)
*   [Project Organization](https://deepwiki.com/QinMoMeak/MonoTracker#project-organization)
*   [Next Steps](https://deepwiki.com/QinMoMeak/MonoTracker#next-steps)

Ask Devin about QinMoMeak/MonoTracker

Fast