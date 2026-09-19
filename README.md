<a name="readme-top"></a>

<div align="center">
  <h3 align="center">News Spend Media</h3>

  <p align="center">
    A full-stack monorepo for the News Spend Media platform, featuring a content management system, native mobile app, and backend API server.
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#project-structure">Project structure</a></li>
    <li><a href="#developing">Developing</a></li>
    <li><a href="#license">License</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->

## About The Project

News Spend Media is a comprehensive platform for managing digital media content and user engagement. The monorepo architecture enables seamless sharing of business logic, types, and configuration across multiple applications.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

- [![Next.js][next-shield]][next-url]
- [![React Native][react-native-shield]][react-native-url]
- [![Expo][expo-shield]][expo-url]
- [![Payload CMS][payload-shield]][payload-url]
- [![TypeScript][typescript-shield]][typescript-url]
- [![TailwindCSS][tailwind-shield]][tailwind-url]
- [![Bun][bun-shield]][bun-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Getting Started

### Prerequisites

- [![Node 20+][node-shield]][node-url]
- [![Bun 1.3+][bun-shield]][bun-url]

### Installation

1. Clone this repo

   ```sh
   git clone <repository-url>
   ```

2. Install dependencies

   ```sh
   bun install
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Project Structure

```
├── apps
│   ├── cms          # Payload CMS + Next.js admin and frontend
│   ├── native       # React Native mobile app (iOS & Android)
│   └── server       # Backend API server (Bun-based)
├── packages
│   ├── api          # Shared API/RPC client and contracts
│   ├── auth         # Authentication and authorization
│   ├── config       # Configuration utilities
│   ├── db           # Database schema and migrations (Drizzle ORM)
│   ├── env          # Environment variable validation
│   ├── logger       # Logging utilities
│   ├── mail         # Email services
│   ├── payload      # Shared Payload CMS configuration
│   ├── payload-cpanel-storage # cPanel storage integration
│   ├── transactional # Transactional utilities
│   └── utils        # Shared utility functions
└── tooling
    └── tailwind     # Shared Tailwind CSS configuration
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Apps

### cms

Payload CMS v3 admin interface and Next.js frontend. Manages all content and provides a user-friendly interface for content editors.

- **Framework:** Next.js 16 with Payload CMS 3
- **Styling:** TailwindCSS
- **Features:** Content modeling, live preview, SEO management, redirects, Sentry monitoring

### native

Cross-platform React Native mobile application built with Expo for both iOS and Android.

- **Framework:** React Native with Expo
- **Build:** EAS Build and Submit
- **Features:** Bottom tab navigation, real-time features, secure authentication, offline support

### server

Backend API server providing RESTful and RPC endpoints for the platform.

- **Runtime:** Bun
- **API:** ORPC (Open RPC)
- **Features:** Rate limiting, OpenAPI documentation, OpenTelemetry instrumentation, Sentry error tracking

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Packages

### api

Type-safe RPC client and contracts using ORPC. Shared between mobile app and web.

### auth

Authentication and authorization using Better Auth with Payload CMS integration.

### config

Configuration utilities and constants.

### db

Database schema and migrations using Drizzle ORM with PostgreSQL.

### env

Environment variable validation using Zod. Ensures type safety across the application.

### logger

Structured logging using Pino with optional Sentry integration.

### mail

Email service integration (Resend).

### payload

Shared Payload CMS configuration including collections, fields, hooks, and access control.

### payload-cpanel-storage

Custom cloud storage plugin for Payload using cPanel SFTP.

### transactional

Transactional utilities and patterns.

### utils

Shared utility functions and helpers.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Developing

### CMS

```sh
bun dev --filter @news-spend-media/cms
```

### Native App

```sh
cd apps/native
bun start
```

### Server

```sh
bun dev --filter @news-spend-media/server
```

### Linting & Formatting

```sh
# Run Biomejs linter
bun run lint

# Fix linting issues
bun run lint:fix

# Format code
bun run format:fix

# Typecheck
bun run typecheck
```

### Testing

```sh
# Run all tests
bun test

# Run tests in watch mode
bun test --watch
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

Distributed under the MIT License.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[typescript-shield]: https://img.shields.io/badge/typescript-20232A?style=for-the-badge&logo=typescript&logoColor=358ef1
[typescript-url]: https://www.typescriptlang.org/
[next-shield]: https://img.shields.io/badge/next.js-20232A?style=for-the-badge&logo=nextdotjs&logoColor=white
[next-url]: https://nextjs.org/
[react-native-shield]: https://img.shields.io/badge/react%20native-20232A?style=for-the-badge&logo=react&logoColor=61dafb
[react-native-url]: https://reactnative.dev/
[expo-shield]: https://img.shields.io/badge/expo-20232A?style=for-the-badge&logo=expo&logoColor=000020
[expo-url]: https://expo.dev/
[payload-shield]: https://img.shields.io/badge/Payload%20CMS-20232A?style=for-the-badge&logo=payloadcms&logoColor=white
[payload-url]: https://payloadcms.com/
[tailwind-shield]: https://img.shields.io/badge/tailwindcss-20232A?style=for-the-badge&logo=tailwindcss&logoColor=0ea5e9
[tailwind-url]: https://tailwindcss.com/
[bun-shield]: https://img.shields.io/badge/bun-20232A?style=for-the-badge&logo=bun&logoColor=f471b5
[bun-url]: https://bun.sh/
[node-shield]: https://img.shields.io/badge/node.js-20232A?style=for-the-badge&logo=node.js&logoColor=336633
[node-url]: https://nodejs.org/
