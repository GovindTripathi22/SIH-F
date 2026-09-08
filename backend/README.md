# UrbanPulse Backend

FastAPI-based central backend for the AI-Powered Mobile Urban Intelligence Platform.

## Features

- **RESTful API** with comprehensive event and issue management
- **PostgreSQL/PostGIS** for geospatial data storage and queries
- **Explainable Priority Engine** with configurable thresholds
- **Multi-pass Verification** for infrastructure issue validation
- **Fleet Management** APIs for bus and route tracking
- **Analytics** endpoints for traffic and road health insights
- **Audit Logging** for all API requests
- **Authentication** architecture ready for implementation

## Architecture

```
backend/
├── app/
│   ├── api/              # API route handlers
│   │   ├── events.py     # Event ingestion and retrieval
│   │   ├── issues.py     # Issue management and spatial queries
│   │   ├── fleet.py      # Bus and route management
│   │   └── analytics.py  # Traffic and road health analytics
│   ├── models/           # SQLAlchemy database models
│   │   ├── event.py      # Raw detection events
│   │   ├── issue.py      # Verified infrastructure issues
│   │   └── bus.py        # Fleet management
│   ├── schemas/          # Pydantic request/response schemas
│   ├── services/         # Business logic
│   │   ├── priority_engine.py  # Explainable priority calculation
│   │   ├── event_service.py    # Event processing
│   │   └── issue_service.py    # Issue management
│   ├── middleware/       # Request/response middleware
│   ├── config.py         # Configuration management
│   ├── database.py       # Database connection
│   └── main.py          # FastAPI application
├── migrations/           # Database migration scripts
├── requirements.txt      # Python dependencies
└── .env.example         # Environment variables template
```

## Setup

### Prerequisites

- Python 3.11+
- PostgreSQL 14+ with PostGIS extension
- Redis (optional, for caching)

### Installation

1. **Clone and navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

5. **Setup PostgreSQL with PostGIS**
   ```bash
   # Create database
   createdb urbanpulse
   
   # Enable PostGIS extension
   psql -d urbanpulse -c "CREATE EXTENSION postgis;"
   
   # Run migrations
   psql -d urbanpulse -f migrations/001_initial_schema.sql
   ```

6. **Run the application**
   ```bash
   uvicorn app.main:app --reload
   ```

The API will be available at `http://localhost:8000`

## API Documentation

Once running, access:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/events` | Create new detection event |
| GET | `/api/v1/events` | List events with filters |
| GET | `/api/v1/events/{id}` | Get specific event |
| GET | `/api/v1/events/stats/summary` | Event statistics |

### Issues

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/issues` | List verified issues |
| GET | `/api/v1/issues/{id}` | Get issue details |
| GET | `/api/v1/issues/nearby` | Spatial query for nearby issues |
| PATCH | `/api/v1/issues/{id}/status` | Update issue status |
| GET | `/api/v1/issues/stats/summary` | Issue statistics |

### Fleet

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/fleet` | Fleet summary |
| GET | `/api/v1/buses` | List all buses |
| GET | `/api/v1/buses/{id}` | Get bus details |
| GET | `/api/v1/routes` | List all routes |
| GET | `/api/v1/routes/{id}` | Get route details |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/analytics/traffic` | Traffic analytics |
| GET | `/api/v1/analytics/road-health` | Road health metrics |
| GET | `/api/v1/analytics/fleet-performance` | Fleet performance |

## Priority Engine

The explainable priority engine calculates issue priority using multiple signals:

### Factors

1. **Confidence** (20% weight) - Detection confidence score
2. **Observations** (25% weight) - Number of independent observations
3. **Bus Diversity** (20% weight) - Number of distinct buses
4. **Recurrence** (15% weight) - Observations per day
5. **Severity** (10% weight) - Infrastructure defect severity
6. **Age** (10% weight) - Days unresolved

### Priority Levels

- **CRITICAL** (85-100): Immediate action required
- **HIGH** (70-84): Schedule within 24-48 hours
- **MEDIUM** (50-69): Schedule within 1 week
- **LOW** (30-49): Add to maintenance queue
- **MONITOR** (0-29): Continue monitoring

### Configuration

All thresholds are configurable via environment variables:

```env
PRIORITY_CONFIDENCE_WEIGHT=0.20
PRIORITY_OBSERVATION_WEIGHT=0.25
PRIORITY_BUS_DIVERSITY_WEIGHT=0.20
PRIORITY_RECURRENCE_WEIGHT=0.15
PRIORITY_SEVERITY_WEIGHT=0.10
PRIORITY_AGE_WEIGHT=0.10
```

## Sample Queries

### Events near location
```sql
SELECT * FROM raw_events 
WHERE ST_DWithin(
    location,
    ST_SetSRID(ST_Point(-74.0059, 40.7128), 4326)::geography,
    50
)
ORDER BY timestamp DESC;
```

### Repeated events in radius
```sql
SELECT 
    event_type,
    COUNT(*) as occurrence_count,
    MIN(timestamp) as first_seen,
    MAX(timestamp) as last_seen
FROM raw_events
WHERE ST_DWithin(
    location,
    ST_SetSRID(ST_Point(-74.0059, 40.7128), 4326)::geography,
    100
)
GROUP BY event_type
HAVING COUNT(*) > 1
ORDER BY occurrence_count DESC;
```

### Issues within time window
```sql
SELECT * FROM verified_issues
WHERE first_observed BETWEEN '2026-09-01' AND '2026-09-08'
AND event_type = 'pothole'
ORDER BY priority_score DESC;
```

## Error Handling

All API endpoints return standardized error responses:

```json
{
  "error": "error_type",
  "message": "Human readable message",
  "detail": "Additional details (in debug mode)"
}
```

## Logging

Logs are structured and include:
- Request/response information
- Processing times
- Error details with stack traces
- Audit trail for status changes

Configure log level via `LOG_LEVEL` environment variable.

## Security

- **CORS**: Configurable origins via `CORS_ORIGINS`
- **Rate Limiting**: Configurable via `RATE_LIMIT_REQUESTS` and `RATE_LIMIT_WINDOW`
- **Authentication**: Architecture ready (implement JWT/OAuth2 as needed)
- **Input Validation**: All inputs validated via Pydantic schemas
- **SQL Injection**: Protected via SQLAlchemy ORM
- **Secrets**: Never expose via environment variables only

## Testing

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=app

# Run specific test file
pytest tests/test_events.py
```

## Development

### Code Formatting

```bash
# Format code
black app/

# Sort imports
isort app/

# Type checking
mypy app/
```

### Database Migrations

```bash
# Create new migration
# Edit migrations/002_xxx.sql

# Apply migration
psql -d urbanpulse -f migrations/002_xxx.sql
```

## Production Deployment

### Environment Variables

Set all required environment variables:

```bash
export DATABASE_URL="postgresql://user:pass@host:5432/urbanpulse"
export SECRET_KEY="your-secret-key"
export DEBUG=False
```

### Run with Gunicorn

```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Docker Deployment

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Monitoring

- Health check endpoint: `GET /health`
- Request/response logging via audit middleware
- Database query logging (enable with `DEBUG=True`)

## License

Proprietary - Bharat Electronics Limited (BEL)

## Support

For issues and questions, contact the development team.
