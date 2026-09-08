# Security Architecture

## Overview

UrbanPulse implements security controls across three layers: Device, Backend, and Data. All controls are designed to be demonstrable in the prototype while being production-ready.

## Device Security

### Unique Identity
- Each bus has a unique `bus_id` (e.g., `BUS-KA01-001`)
- Device identity is established during fleet registration
- Identity is included in all event payloads

### Authentication
- Device-to-server authentication via API keys
- Each bus has a unique `camera_id` for source verification
- Firmware version tracking for update management

### Secure Transmission
- All API communication over HTTPS/TLS
- Event payloads include source verification fields
- No raw video transmitted (only event metadata)

## Backend Security

### Authentication Architecture
```
ADMIN → Full system access
TRAFFIC_AUTHORITY → Issue management, analytics
PUBLIC_WORKS → Issue assignment, status updates
TRANSPORT_OPERATOR → Fleet monitoring, route management
VIEWER → Read-only dashboard access
```

### Authorization
- Role-based access control (RBAC)
- API endpoints protected by role requirements
- Audit logging for all state-changing operations

### Rate Limiting
- Configurable per-endpoint rate limits
- Default: 100 requests per 60-second window
- Prevents abuse and DoS

### Input Validation
- All inputs validated via Pydantic schemas
- Coordinate range validation (-90 to 90, -180 to 180)
- Confidence scores bounded (0 to 1)
- Enum validation for event types, priorities, statuses

### Secure Secrets
- All secrets via environment variables
- No secrets in source code
- `.env` file excluded from version control
- Database credentials not exposed in API responses

## Data Security

### Encryption in Transit
- HTTPS/TLS for all API communication
- Secure WebSocket connections for real-time updates
- Certificate validation enforced

### Controlled Access
- Database access restricted to backend services
- No direct database access from frontend
- API gateway controls all data flow

### Audit Logs
- All API requests logged with timestamps
- Status changes tracked with user attribution
- Issue lifecycle fully auditable
- Logs include: request ID, client IP, duration, status code

## Privacy Controls

### Passenger Privacy
- **No passenger analytics**: System does not track or identify passengers
- Camera focus is on road surface, not vehicle interiors
- Detection models trained only on road defects and vehicles (exterior)

### Face Blurring
- When required by local regulations, face blurring can be enabled
- Applied at edge before any data leaves the device
- Configurable per deployment region

### License Plate Protection
- ANPR (Automatic Number Plate Recognition) is an **ADVANCED MODULE**
- Not part of core pipeline
- When enabled, plate data is:
  - Encrypted at rest
  - Accessible only to authorized investigation roles
  - Automatically deleted after retention period
  - Never exposed in standard dashboards

### Raw Video Storage
- **Minimized**: Raw video is NOT stored centrally
- Only event metadata and selected frames are transmitted
- Edge devices may store video temporarily (configurable retention)
- Default retention: 24 hours on edge, then auto-delete

### Data Retention
- Configurable retention policies per data type:
  - Raw events: 90 days
  - Verified issues: Until resolved + 1 year
  - Audit logs: 2 years
  - Telemetry data: 30 days
- Retention policies enforced automatically

## Role-Based Access Control

### ADMIN
- Full system configuration
- User management
- System monitoring
- Audit log access
- Emergency overrides

### TRAFFIC_AUTHORITY
- View all issues and analytics
- Assign issues to teams
- Update issue status
- Access traffic analytics
- Generate reports

### PUBLIC_WORKS
- View assigned issues
- Update issue status (IN_PROGRESS, RESOLVED)
- Add resolution notes
- View own team's assignments

### TRANSPORT_OPERATOR
- View fleet status
- Monitor bus locations
- Access route analytics
- View fleet performance metrics
- Cannot access issue details

### VIEWER
- Read-only dashboard access
- View public issue map
- Access summary statistics
- Cannot modify any data

## Security Demonstration

### What Can Be Demonstrated
1. ✅ Role-based UI (different views per role)
2. ✅ Audit trail in issue status changes
3. ✅ Input validation error messages
4. ✅ Rate limiting responses (429 status)
5. ✅ HTTPS enforcement
6. ✅ Environment-based configuration
7. ✅ No secrets in code

### What Requires Production Setup
1. ⏳ JWT/OAuth2 authentication (architecture ready)
2. ⏳ Real certificate management
3. ⏳ Database encryption at rest
4. ⏳ Intrusion detection systems
5. ⏳ Penetration testing

## Compliance Considerations

### Data Protection
- GDPR-ready architecture (data minimization, right to deletion)
- Location data handled with appropriate controls
- Consent mechanisms for data collection (bus operator agreements)

### Industry Standards
- Follows OWASP Top 10 mitigation guidelines
- Secure by default configuration
- Defense in depth approach

## Security Configuration

```env
# Authentication
SECRET_KEY=<long-random-string>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60

# Privacy
FACE_BLUR_ENABLED=false
ANPR_ENABLED=false
RAW_VIDEO_RETENTION_HOURS=24
EVENT_RETENTION_DAYS=90
```

## Security Testing Checklist

- [ ] All API endpoints require authentication
- [ ] Role-based access control enforced
- [ ] Input validation on all endpoints
- [ ] Rate limiting active
- [ ] Audit logging functional
- [ ] No secrets in source code
- [ ] HTTPS enforced
- [ ] CORS properly configured
- [ ] SQL injection protected (via ORM)
- [ ] XSS protected (React default)
- [ ] CSRF protection (if applicable)
- [ ] Error messages don't leak internals
- [ ] File upload validation (if applicable)
- [ ] Session management secure
- [ ] Password policies enforced (if applicable)

## Incident Response

### Detection
- Audit logs monitored for anomalies
- Failed authentication attempts tracked
- Unusual API patterns flagged

### Response
- Compromised API keys can be rotated
- User accounts can be disabled
- Emergency mode can restrict all write operations

### Recovery
- Database backups maintained
- Event buffer provides offline resilience
- System can be restored from known-good state
