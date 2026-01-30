# VeriCert Backend

Public verification service for AcadCert academic credentials.

## Features

- 🔍 Public PDF verification endpoint
- 🔒 Cryptographic signature validation
- 📊 Real-time verification results
- 🛡️ Security scanning and validation
- ⚡ Fast response times

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Fastify
- **PDF Processing:** pdf-lib, pdfjs-dist
- **Validation:** Custom PDF security scanner

## API Endpoints

### POST /api/verify
Upload a PDF and verify its authenticity.

**Request:**
- Content-Type: multipart/form-data
- Body: PDF file

**Response:**
```json
{
  "status": "ACTIVE",
  "valid": true,
  "message": "Valid Document",
  "verification": {
    "cryptographicIntegrity": true,
    "issuingAuthority": true,
    "revocationStatus": true
  },
  "document": {
    "type": "Certificate",
    "issuedAt": "2026-01-30",
    "recipientEmail": "student@example.com"
  },
  "institution": {
    "name": "University Name",
    "status": "ACTIVE"
  }
}
```

## Setup
```bash
npm install
cp .env.example .env
npm run dev
```

## Environment Variables
```
PORT=3003
ACADCERT_API_URL=http://localhost:3000
```

## Related Repos

- [AcadCert Backend](https://github.com/MiserableTaco/academic-backend)
- [VeriCert Frontend](https://github.com/MiserableTaco/vericert-frontend)
