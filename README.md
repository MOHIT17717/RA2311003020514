# Afford Medical Technologies — Backend Assessment

A backend system built with Node.js and Express covering authentication, structured logging, vehicle maintenance scheduling (0/1 Knapsack), and a scalable notification system.

## Tech Stack

- **Runtime**: Node.js v22
- **Framework**: Express.js
- **HTTP Client**: Axios (for test server API calls)
- **Logging**: Custom structured logging middleware (file + console)

## Project Structure

```
affordmed/
├── server.js                  # Entry point
├── middleware/
│   ├── logger.js              # Structured logging middleware
│   └── authMiddleware.js      # Token verification
├── routes/
│   ├── auth.js                # Registration & token exchange
│   ├── vehicle.js             # Maintenance scheduler (Knapsack)
│   └── notification.js        # Notification system (6 stages)
├── logs/                      # Auto-generated log files
├── .env                       # Environment configuration
├── .gitignore
├── package.json
└── README.md
```

## Setup & Run

```bash
# Install dependencies
npm install

# Start the server
npm start

# Development mode (auto-restart on changes)
npm run dev
```

The server runs on `http://localhost:3000` by default.

## Part 1 — Pre-Test Setup (Authentication)

### Register with Test Server

```
POST /api/auth/register
Content-Type: application/json

{
  "companyName": "MyCompany",
  "ownerName": "Mohit",
  "rollNo": "2021001",
  "ownerEmail": "mohit@example.com",
  "accessCode": "your_access_code"
}
```

Response gives you `clientID` and `clientSecret`.

### Get Access Token

```
POST /api/auth/token
Content-Type: application/json

{
  "companyName": "MyCompany",
  "clientID": "received_client_id",
  "clientSecret": "received_client_secret",
  "ownerName": "Mohit",
  "ownerEmail": "mohit@example.com",
  "rollNo": "2021001"
}
```

Response contains `access_token` (Bearer token) for subsequent requests.

## Part 2 — Logging Middleware

Every request that hits the server is automatically logged with:

- Timestamp
- Request ID (UUID)
- HTTP method & URL
- Response status code
- Response time (ms)

Logs are written to both console (with color coding) and `logs/app.log` file in JSON format.

Custom log function:

```javascript
Log("backend", "ERROR", "service-name", "Human readable message", { extra: "metadata" })
```

## Part 3 — Vehicle Maintenance Scheduler

### Algorithm: 0/1 Knapsack (Dynamic Programming)

**Problem**: Given limited mechanic hours and multiple vehicle tasks (each with a duration and impact score), select tasks that maximize total impact without exceeding available hours.

### Optimal Schedule (DP approach)

```
POST /api/vehicle/schedule
Content-Type: application/json

{
  "mechanicHours": 10,
  "tasks": [
    { "id": "T1", "name": "Oil Change", "duration": 2, "impact": 6 },
    { "id": "T2", "name": "Brake Inspection", "duration": 3, "impact": 8 },
    { "id": "T3", "name": "Tire Rotation", "duration": 1, "impact": 3 },
    { "id": "T4", "name": "Engine Diagnostics", "duration": 4, "impact": 10 }
  ]
}
```

**Time Complexity**: O(n × W) where n = tasks, W = mechanic hours  
**Space Complexity**: O(n × W) for the DP table

### Greedy Alternative (for comparison)

```
POST /api/vehicle/schedule/greedy
```

Sorts by impact/duration ratio. Faster but not always optimal.

### Sample Data

```
GET /api/vehicle/sample
```

Returns a pre-built dataset for testing.

## Part 4 — Notification System (6 Stages)

### Stage 1 — API Design

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/notifications` | Create notification |
| GET | `/api/notifications/:userId` | Get user notifications |
| PATCH | `/api/notifications/:id/read` | Mark as read |
| DELETE | `/api/notifications/:id` | Delete notification |
| POST | `/api/notifications/bulk` | Bulk send |
| GET | `/api/notifications/:userId/top` | Top-K priority |
| GET | `/api/notifications/design/schema` | View DB schema design |

### Stage 2 — Database Design

Schema documented at `GET /api/notifications/design/schema`. Uses PostgreSQL with proper indexing strategy.

### Stage 3 — Query Optimization

- Composite index on `(user_id, created_at DESC)` for time-ordered queries
- Index on `(user_id, read)` for unread filtering
- Compound index on `(user_id, read, priority, created_at DESC)` covering most access patterns

### Stage 4 — Scaling Reads

- **Caching**: In-memory cache (simulates Redis) with TTL-based expiry
- **Pagination**: Cursor-based pagination on all list endpoints
- **Read replicas**: Design supports read replica routing (documented in schema)

### Stage 5 — High Volume Processing

`POST /api/notifications/bulk` processes notifications in batches of 100, simulating queue-based async processing (Kafka/RabbitMQ pattern).

```json
{
  "userIds": ["user1", "user2", "user3", ...],
  "type": "maintenance",
  "title": "Scheduled Maintenance",
  "message": "Your vehicle is due for service",
  "priority": "high"
}
```

### Stage 6 — Priority System (Top-K)

`GET /api/notifications/:userId/top?k=5`

Uses a Min-Heap implementation for O(n log k) extraction of top priority notifications — much more efficient than full sort for large datasets.

## Logging Output

All actions generate structured logs:

```json
{
  "id": "a1b2c3d4",
  "timestamp": "2026-05-02T12:00:00.000Z",
  "source": "backend",
  "level": "INFO",
  "service": "vehicle-scheduler",
  "message": "Scheduling 10 tasks within 8 hours",
  "meta": { "tasksSelected": 5, "maxImpact": 32 }
}
```

## Known Limitations

- Uses in-memory storage (no persistent database) — data resets on server restart
- Cache TTL is fixed at 60 seconds
- Bulk processing simulates queue behavior but runs in-process
- Token validation is basic (no JWT decode/expiry check)
