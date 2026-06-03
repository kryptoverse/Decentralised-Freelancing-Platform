# WORQS API & Implementation Guide

## 📡 REST API Endpoints

### Base URL
```
Development:  http://localhost:3000/api
Production:   https://worqs.vercel.app/api
```

---

## 👤 User & Profile APIs

### GET /api/profile/[address]
Fetch freelancer profile and on-chain reputation.

**Parameters:**
- `address` (string, required) - Freelancer's wallet address

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "0x1234...",
    "name": "John Developer",
    "bio": "Web3 smart contract specialist",
    "avatarUrl": "ipfs://Qm...",
    "skills": ["Solidity", "React", "Web3"],
    "completedJobs": 15,
    "totalEarnings": 45000,
    "rating": 4.8,
    "disputedJobs": 1,
    "cancelledJobs": 0,
    "createdAt": "2025-06-15T10:30:00Z",
    "onChainVerified": true
  }
}
```

**Errors:**
- `404 Not Found` - Profile doesn't exist
- `400 Bad Request` - Invalid address format

---

### PUT /api/profile/[address]
Update freelancer profile (off-chain metadata).

**Headers:**
- `Authorization: Bearer {walletSignature}` (optional but recommended)

**Request Body:**
```json
{
  "name": "John Developer",
  "bio": "Updated bio",
  "avatarUrl": "ipfs://Qm...",
  "skills": ["Solidity", "React", "TypeScript"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Profile updated successfully",
    "updatedAt": "2025-06-15T12:00:00Z"
  }
}
```

---

## 💼 Job Board APIs

### GET /api/jobs
Query job listings with optional filters.

**Query Parameters:**
```
GET /api/jobs?
  category=smart-contract&
  budget_min=1000&
  budget_max=50000&
  status=open&
  sort=recent&
  page=1&
  limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "jobId": "job_1234",
        "title": "Smart Contract Audit",
        "description": "Audit ERC-20 token contract...",
        "budget": 5000,
        "currency": "USDT",
        "clientAddress": "0xabcd...",
        "category": "smart-contract",
        "status": "open",
        "createdAt": "2025-06-15T10:00:00Z",
        "applicants": 3,
        "skills": ["Solidity", "Security"]
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20,
    "hasMore": true
  }
}
```

**Errors:**
- `400 Bad Request` - Invalid filters
- `500 Server Error` - Database query failed

---

### GET /api/jobs/[jobId]
Get detailed job information.

**Parameters:**
- `jobId` (string, required) - Unique job identifier

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job_1234",
    "title": "Smart Contract Audit",
    "description": "...",
    "budget": 5000,
    "clientAddress": "0xabcd...",
    "clientName": "TechStartup Inc",
    "escrowAddress": null,
    "status": "open",
    "category": "smart-contract",
    "requirements": ["Solidity", "Security Knowledge"],
    "timeline": "2 weeks",
    "createdAt": "2025-06-15T10:00:00Z",
    "applications": [
      {
        "freelancerAddress": "0x1234...",
        "freelancerName": "John Developer",
        "rating": 4.9,
        "completedJobs": 20,
        "appliedAt": "2025-06-15T11:30:00Z",
        "proposal": "I have 5 years experience..."
      }
    ]
  }
}
```

---

### POST /api/jobs
Create new job posting.

**Authentication Required:** Yes (Client wallet)

**Request Body:**
```json
{
  "title": "Build NFT Marketplace",
  "description": "Need a full-stack NFT marketplace...",
  "budget": 25000,
  "currency": "USDT",
  "category": "full-stack",
  "requirements": ["React", "Solidity", "Web3"],
  "timeline": "4 weeks",
  "attachment": "ipfs://Qm..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job_5678",
    "title": "Build NFT Marketplace",
    "status": "open",
    "createdAt": "2025-06-15T14:00:00Z",
    "clientAddress": "0xabcd...",
    "transactionHash": "0x..."
  }
}
```

**Errors:**
- `401 Unauthorized` - Not authenticated
- `400 Bad Request` - Invalid job data
- `422 Unprocessable Entity` - Budget too high/low

---

### PUT /api/jobs/[jobId]
Update job status or details (client only).

**Request Body:**
```json
{
  "status": "closed",
  "reason": "Position filled"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job_1234",
    "status": "closed",
    "updatedAt": "2025-06-15T15:00:00Z"
  }
}
```

---

## 💰 Escrow & Payment APIs

### GET /api/escrows/[escrowAddress]
Fetch escrow contract state.

**Parameters:**
- `escrowAddress` (string, required) - Smart contract address

**Response:**
```json
{
  "success": true,
  "data": {
    "escrowAddress": "0x9999...",
    "jobId": "job_1234",
    "client": "0xabcd...",
    "freelancer": "0x1234...",
    "amount": 5000,
    "currency": "USDT",
    "delivered": false,
    "approved": false,
    "disputed": false,
    "terminal": false,
    "deliveryUri": null,
    "disputeReasonUri": null,
    "createdAt": "2025-06-15T13:00:00Z",
    "transactionHash": "0x..."
  }
}
```

---

### POST /api/escrows/[escrowAddress]/submit-delivery
Freelancer submits work to escrow.

**Authentication Required:** Yes (Freelancer wallet)

**Request Body:**
```json
{
  "deliveryUri": "ipfs://Qm...",
  "message": "Delivery completed, please review"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Work submitted successfully",
    "transactionHash": "0x...",
    "deliveredAt": "2025-06-15T14:30:00Z"
  }
}
```

---

### POST /api/escrows/[escrowAddress]/approve
Client approves work and triggers payment release.

**Authentication Required:** Yes (Client wallet)

**Request Body:**
```json
{
  "rating": 5,
  "feedback": "Excellent work, very professional"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Work approved, payment released",
    "transactionHash": "0x...",
    "amountTransferred": 5000,
    "approvedAt": "2025-06-15T14:45:00Z"
  }
}
```

---

### POST /api/escrows/[escrowAddress]/cancel
Client cancels job and requests refund.

**Authentication Required:** Yes (Client wallet)

**Request Body:**
```json
{
  "reason": "Found another solution"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Job cancelled, funds returned",
    "transactionHash": "0x...",
    "refundAmount": 5000,
    "cancelledAt": "2025-06-15T14:50:00Z"
  }
}
```

---

## 🤝 Dispute APIs

### GET /api/disputes
Fetch all active disputes (admin only).

**Response:**
```json
{
  "success": true,
  "data": {
    "disputes": [
      {
        "id": "disp_1234",
        "jobId": "job_1234",
        "escrowAddress": "0x9999...",
        "disputerAddress": "0xabcd...",
        "disputeReasonUri": "ipfs://Qm...",
        "status": "open",
        "createdAt": "2025-06-15T15:00:00Z",
        "resolvedAt": null,
        "resolution": null
      }
    ],
    "total": 1
  }
}
```

---

### POST /api/escrows/[escrowAddress]/raise-dispute
Raise a dispute on escrow.

**Authentication Required:** Yes (Client or Freelancer)

**Request Body:**
```json
{
  "reason": "Work does not meet requirements...",
  "evidence": "ipfs://Qm...",
  "proposedResolution": "50% refund"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Dispute raised successfully",
    "disputeId": "disp_1234",
    "reasonUri": "ipfs://Qm...",
    "transactionHash": "0x...",
    "raisedAt": "2025-06-15T15:10:00Z"
  }
}
```

---

### POST /api/escrows/[escrowAddress]/resolve
Resolve dispute with custom payout split (admin only).

**Authentication Required:** Yes (Admin wallet)

**Request Body:**
```json
{
  "payoutBps": 7000,
  "comment": "Partially complete work, 70% to freelancer",
  "evidence": "Reviewed work and found..."
}
```

**Parameters:**
- `payoutBps` (integer) - Basis points for freelancer (10000 = 100%)
  - 10000 = Full payment to freelancer
  - 0 = Full refund to client
  - 7000 = 70% to freelancer, 30% to client

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Dispute resolved",
    "freelancerPayout": 3500,
    "clientRefund": 1500,
    "transactionHash": "0x...",
    "resolvedAt": "2025-06-15T16:00:00Z"
  }
}
```

---

## 💡 Fundraise APIs

### POST /api/fundraises
Create job fundraise for investor funding.

**Authentication Required:** Yes (Freelancer wallet)

**Request Body:**
```json
{
  "escrowAddress": "0x9999...",
  "targetAmount": 2000,
  "currency": "USDT",
  "profitSharePercentage": 50,
  "description": "Need funds for UI designer"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fundraiseId": "fr_1234",
    "fundraiseAddress": "0x8888...",
    "targetAmount": 2000,
    "profitSharePercentage": 50,
    "currentFunded": 0,
    "createdAt": "2025-06-15T13:15:00Z",
    "transactionHash": "0x..."
  }
}
```

---

### GET /api/fundraises/[fundraiseAddress]
Get fundraise details and investor list.

**Response:**
```json
{
  "success": true,
  "data": {
    "fundraiseAddress": "0x8888...",
    "targetAmount": 2000,
    "profitSharePercentage": 50,
    "currentFunded": 1500,
    "status": "active",
    "investors": [
      {
        "address": "0xaaaa...",
        "amount": 1000,
        "investedAt": "2025-06-15T13:30:00Z"
      },
      {
        "address": "0xbbbb...",
        "amount": 500,
        "investedAt": "2025-06-15T13:45:00Z"
      }
    ],
    "escrowAddress": "0x9999...",
    "isCompleted": false
  }
}
```

---

### POST /api/fundraises/[fundraiseAddress]/invest
Investor contributes funds to fundraise.

**Authentication Required:** Yes (Investor wallet)

**Request Body:**
```json
{
  "amount": 1000,
  "currency": "USDT"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Investment confirmed",
    "amount": 1000,
    "investorShare": "50%",
    "transactionHash": "0x...",
    "investedAt": "2025-06-15T14:00:00Z"
  }
}
```

---

### POST /api/fundraises/[fundraiseAddress]/claim
Investor claims payout (after escrow approved).

**Authentication Required:** Yes (Investor wallet)

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Payout claimed",
    "principalReturn": 1000,
    "profitShare": 1500,
    "totalPayout": 2500,
    "transactionHash": "0x...",
    "claimedAt": "2025-06-15T14:15:00Z"
  }
}
```

---

## 🏢 Company Share APIs

### POST /api/companies
Create tokenized company.

**Authentication Required:** Yes (Freelancer wallet)

**Request Body:**
```json
{
  "name": "John's Web3 Agency",
  "ticker": "JWA",
  "totalSupply": 1000000,
  "mandatoryDistributionPercent": 30,
  "description": "Full-stack Web3 development agency"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "companyAddress": "0x7777...",
    "shareTokenAddress": "0x6666...",
    "name": "John's Web3 Agency",
    "totalSupply": 1000000,
    "transactionHash": "0x...",
    "createdAt": "2025-06-15T12:00:00Z"
  }
}
```

---

### GET /api/companies
List all available company shares.

**Query Parameters:**
```
GET /api/companies?
  sort=newest&
  minRating=4&
  page=1&
  limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "companies": [
      {
        "companyAddress": "0x7777...",
        "name": "John's Web3 Agency",
        "founderAddress": "0x1234...",
        "founderName": "John Developer",
        "founderRating": 4.9,
        "totalSupply": 1000000,
        "sharePrice": 0.025,
        "sharesAvailable": 200000,
        "mandatoryDistribution": "30%",
        "vaultBalance": 50000,
        "description": "Full-stack Web3...",
        "createdAt": "2025-06-15T12:00:00Z"
      }
    ],
    "total": 45,
    "page": 1,
    "limit": 20
  }
}
```

---

### GET /api/companies/[companyAddress]
Get company details and vault info.

**Response:**
```json
{
  "success": true,
  "data": {
    "companyAddress": "0x7777...",
    "shareTokenAddress": "0x6666...",
    "name": "John's Web3 Agency",
    "founderAddress": "0x1234...",
    "totalSupply": 1000000,
    "totalShares": 950000,
    "availableShares": 100000,
    "sharePrice": 0.025,
    "totalRaised": 47500,
    "vaultBalance": 50000,
    "mandatoryDistribution": "30%",
    "shareholderCount": 23,
    "description": "...",
    "createdAt": "2025-06-15T12:00:00Z"
  }
}
```

---

### POST /api/companies/[companyAddress]/buy-shares
Buy company shares.

**Authentication Required:** Yes (Investor wallet)

**Request Body:**
```json
{
  "shareAmount": 10000,
  "maxPricePerShare": 0.025,
  "currency": "USDT"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Shares purchased successfully",
    "sharesPurchased": 10000,
    "totalCost": 250,
    "transactionHash": "0x...",
    "purchasedAt": "2025-06-15T14:30:00Z",
    "shareholderPercentage": "1%"
  }
}
```

---

### GET /api/companies/[companyAddress]/dividends
Get dividend payout info for holder.

**Query Parameters:**
- `holderAddress` (string) - Shareholder address

**Response:**
```json
{
  "success": true,
  "data": {
    "companyAddress": "0x7777...",
    "holderAddress": "0xaaaa...",
    "sharesHeld": 10000,
    "shareholderPercentage": "1%",
    "accumulatedDividends": 500,
    "lastClaimed": "2025-06-01T12:00:00Z",
    "nextClaimable": "2025-06-15T14:00:00Z",
    "claimable": true
  }
}
```

---

### POST /api/companies/[companyAddress]/claim-dividend
Claim accumulated dividend payout.

**Authentication Required:** Yes (Shareholder wallet)

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Dividend claimed successfully",
    "amount": 500,
    "currency": "USDT",
    "transactionHash": "0x...",
    "claimedAt": "2025-06-15T14:15:00Z",
    "nextClaimableAt": "2025-06-22T14:15:00Z"
  }
}
```

---

## 🤖 Chat APIs

### POST /api/chat
Send message to AI chatbot.

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Help me find React developer jobs"
    }
  ],
  "context": {
    "userType": "freelancer",
    "userAddress": "0x1234...",
    "skills": ["React", "Node.js"]
  }
}
```

**Response (Streaming):**
```json
{
  "success": true,
  "stream": true,
  "data": {
    "id": "msg_1234",
    "message": "I found 5 React developer jobs matching your profile...",
    "suggestions": [
      {
        "jobId": "job_1234",
        "title": "Build Dashboard UI",
        "matchScore": 0.92
      }
    ]
  }
}
```

---

## 🔐 Authentication

### Wallet Signature Verification

Most API endpoints support optional wallet signature authentication:

```typescript
// Frontend
const message = `Sign in to WORQS\nTimestamp: ${Date.now()}`;
const signature = await signer.signMessage(message);

// Send request
const response = await fetch('/api/profile', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${signature}`,
    'X-Address': userAddress,
    'X-Timestamp': Date.now().toString()
  },
  body: JSON.stringify(profileData)
});

// Backend verifies signature
const recoveredAddress = ethers.verifyMessage(message, signature);
if (recoveredAddress.toLowerCase() !== userAddress.toLowerCase()) {
  throw new Error('Signature verification failed');
}
```

---

## 📊 Response Format

All API responses follow standard format:

**Success Response:**
```json
{
  "success": true,
  "data": { /* ... */ },
  "metadata": {
    "timestamp": "2025-06-15T14:30:00Z",
    "requestId": "req_1234"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "User does not have enough USDT",
    "details": "Balance: 100, Required: 5000"
  },
  "metadata": {
    "timestamp": "2025-06-15T14:30:00Z",
    "requestId": "req_1234"
  }
}
```

---

## 🔑 Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `SUCCESS` | 200 | Request successful |
| `BAD_REQUEST` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `BLOCKCHAIN_ERROR` | 500 | Smart contract transaction failed |
| `IPFS_ERROR` | 500 | IPFS upload failed |

---

## 🚦 Rate Limiting

- **Free tier:** 100 requests per minute
- **Authenticated:** 1000 requests per minute
- **Admin:** 10,000 requests per minute

Headers returned on every request:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1654000200
```

---

## 📚 SDK Usage Examples

### JavaScript/TypeScript

```typescript
import { worqsSDK } from 'worqs-sdk';

const sdk = new worqsSDK({
  apiKey: process.env.WORQS_API_KEY,
  chainId: 137, // Polygon
});

// Browse jobs
const jobs = await sdk.jobs.list({
  category: 'smart-contract',
  budget_min: 1000,
  budget_max: 50000,
});

// Submit application
await sdk.jobs.apply(jobId, {
  proposal: 'I have 5 years experience...',
  rate: 150,
});

// Create escrow
const escrow = await sdk.escrows.create({
  freelancerAddress: '0x1234...',
  amount: 5000,
  jobId: 'job_1234',
});

// Submit work
await sdk.escrows.submitDelivery(escrow.address, {
  ipfsUri: 'ipfs://Qm...',
});
```

---

## 🧪 Testing API Endpoints

### Using cURL

```bash
# Get job listings
curl -X GET 'http://localhost:3000/api/jobs?category=smart-contract&budget_min=1000' \
  -H 'Content-Type: application/json'

# Submit proposal
curl -X POST 'http://localhost:3000/api/jobs/job_1234/apply' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJ...' \
  -d '{
    "proposal": "I can help with this",
    "rate": 100
  }'

# Get escrow status
curl -X GET 'http://localhost:3000/api/escrows/0x9999...' \
  -H 'Content-Type: application/json'
```

---

**Last Updated:** 2026-05-21  
**Version:** 1.0

