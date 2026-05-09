# Secure Data Exchange Platform (SDE-Platform) v2

A production-grade, end-to-end encrypted secure data exchange platform built with TypeScript, Node.js, and vanilla Web Crypto.

## Architecture & Security Model

This project implements a "zero-knowledge" messaging model similar to ProtonMail or Signal:

- **End-to-End Encryption (E2EE):** Messages and files are encrypted using ECIES (secp256k1 + AES-GCM-256).
- **Client-Side Key Management:** Each user's private key is encrypted with their password (PBKDF2-HMAC-SHA256 + AES-GCM) *before* leaving the browser. The server never sees the plaintext private key.
- **Untrusted Server:** The Express/Postgres backend acts only as a relay. It stores ciphertext blobs and encrypted keys. It cannot read the content of any message or file.
- **Real-Time:** WebSockets push live `new_message` and `read_receipt` notifications to authenticated clients.

## Tech Stack

- **Backend:** Node.js 20, Express, TypeScript, Prisma (SQLite/PostgreSQL), WebSocket
- **Frontend:** Vanilla JS (ES Modules), Tailwind CSS, Web Crypto API
- **Cryptography:** `@noble/curves/secp256k1`, AES-GCM, PBKDF2, HKDF-SHA256

## Setup & Development

### Local Setup
```bash
git clone https://github.com/fenestbuc/SDE-Platform.git
cd SDE-Platform

npm install
npm run db:migrate   # Setup SQLite dev database
npm run dev          # Start the server with tsx watch
```

The application will be running at `http://localhost:3000`.

### Create Admin Account
```bash
npm run create-admin -- --email admin@example.com --username admin --password "SecurePass123!"
```

### Docker
```bash
docker compose up --build
```

## Deployment (Fly.io)

1. Install `flyctl`.
2. Run `fly launch`.
3. Set secrets: `fly secrets set JWT_SECRET=xyz JWT_REFRESH_SECRET=abc`.
4. Deploy: `fly deploy`.

## License
MIT
