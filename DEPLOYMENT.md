# UrbanPulse — Production & Edge Deployment Guide

This guide details the complete deployment architecture for UrbanPulse across **Transit Fleet Edge Compute Units**, **Central Cloud Backend Services**, and **Municipal Command Centers**.

---

## 1. Edge Hardware & Sensor Deployment

### Transit Edge Unit Specifications

| Subsystem | Specification | Recommended Hardware |
| :--- | :--- | :--- |
| **Compute Processor** | 6-core ARM Cortex-A78AE / Quad 64-bit ARM | NVIDIA Jetson Orin Nano (8GB) / Raspberry Pi 5 (8GB) |
| **AI Accelerator** | Ampere Architecture GPU (40 TOPS INT8) / NPU | Jetson Orin Nano GPU / Hailo-8 M.2 AI Acceleration Module |
| **Camera Sensor** | 1080p HDR Starlight, $\ge 30\text{ FPS}$, Global/Fast-Rolling Shutter | Sony IMX327 / IMX462 sensor, $120^\circ$ FOV lens, IP67 enclosure |
| **GNSS / Positioning** | Multi-constellation GNSS (GPS, GLONASS, Galileo, NavIC) | U-blox NEO-M9N (10 Hz update rate, $<1.5\text{m}$ CEP accuracy) |
| **Cellular Uplink** | 4G LTE Cat 4 / 5G Sub-6GHz with SIM failover | Quectel EC25-E / SIMCom SIM8200 |
| **Power Management** | Wide input $9\text{V} - 36\text{V}$ DC automotive power with ignition sensing | M4-ATX or automotive buck-boost regulator |

### Edge Daemon Systemd Configuration

Create `/etc/systemd/system/urbanpulse-edge.service`:

```ini
[Unit]
Description=UrbanPulse Edge AI Video Inference & Telemetry Daemon
After=network.target gpsd.service

[Service]
Type=simple
User=urbanpulse
WorkingDirectory=/opt/urbanpulse/edge
ExecStart=/opt/urbanpulse/venv/bin/python edge_daemon.py --camera /dev/video0 --baud 115200 --port /dev/ttyUSB0
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

---

## 2. Central Backend Deployment

### Docker Compose Architecture

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  db:
    image: postgis/postgis:15-3.3-alpine
    container_name: urbanpulse-postgis
    environment:
      POSTGRES_DB: urbanpulse
      POSTGRES_USER: urbanpulse_admin
      POSTGRES_PASSWORD: ${DB_PASSWORD:-secure_sih_password_2024}
    ports:
      - "5432:5432"
    volumes:
      - postgis_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U urbanpulse_admin -d urbanpulse"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: urbanpulse-backend
    environment:
      DATABASE_URL: postgresql+asyncpg://urbanpulse_admin:${DB_PASSWORD:-secure_sih_password_2024}@db:5432/urbanpulse
      PORT: 8000
      SECRET_KEY: ${SECRET_KEY:-municipal_jwt_secret_token_key_change_in_prod}
      SPATIAL_CLUSTER_RADIUS_METERS: 15.0
      TEMPORAL_CLUSTER_WINDOW_MINUTES: 120.0
    ports:
      - "8001:8000"
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: urbanpulse-frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgis_data:
```

### Backend Dockerfile (`backend/Dockerfile`)

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Download or verify YOLOv8n weights
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 3. Environment Variables Reference

| Variable | Default Value | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite+aiosqlite:///./urbanpulse.db` | Async database URI (SQLite or PostgreSQL) |
| `PORT` | `8001` | HTTP listening port for backend server |
| `SECRET_KEY` | `urbanpulse-sih-bel-secret-key...` | HMAC-SHA256 secret for signing JWT bearer tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | JWT token validity window (8 hours) |
| `SPATIAL_CLUSTER_RADIUS_METERS` | `15.0` | DBSCAN corridor matching radius |
| `TEMPORAL_CLUSTER_WINDOW_MINUTES` | `120.0` | Multi-pass consensus correlation window |
| `CONFIDENCE_THRESHOLD` | `0.35` | Minimum YOLO detection threshold |
| `APPLY_PRIVACY_BLURRING` | `true` | Enable edge Haar cascade Gaussian blur |

---

## 4. Verification & Health Monitoring

To verify service status across all deployed subsystems:

```bash
# Check subsystem health status
curl -s http://localhost:8001/health | jq .

# Execute deterministic end-to-end integration test
python scripts/e2e_verify.py
```
