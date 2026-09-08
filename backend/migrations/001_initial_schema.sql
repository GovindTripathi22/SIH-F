-- UrbanPulse Database Schema
-- PostgreSQL with PostGIS extension

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Raw Events Table
CREATE TABLE raw_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(50) UNIQUE NOT NULL,
    
    -- Location
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    
    -- Timestamps
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Source information
    bus_id VARCHAR(50) NOT NULL,
    route_id VARCHAR(50) NOT NULL,
    camera_id VARCHAR(50) NOT NULL,
    
    -- Detection details
    event_type VARCHAR(100) NOT NULL,
    confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    validation_score FLOAT NOT NULL CHECK (validation_score >= 0 AND validation_score <= 1),
    
    -- GPS quality
    gps_accuracy_meters FLOAT CHECK (gps_accuracy_meters >= 0),
    
    -- Processing status
    processed BOOLEAN DEFAULT FALSE,
    
    -- Additional metadata
    frame_reference TEXT,
    metadata_json TEXT
);

-- Indexes for raw_events
CREATE INDEX idx_raw_events_timestamp ON raw_events(timestamp);
CREATE INDEX idx_raw_events_bus_id ON raw_events(bus_id);
CREATE INDEX idx_raw_events_route_id ON raw_events(route_id);
CREATE INDEX idx_raw_events_event_type ON raw_events(event_type);
CREATE INDEX idx_raw_events_processed ON raw_events(processed);
CREATE INDEX idx_raw_events_location ON raw_events USING GIST(location);

-- Verified Issues Table
CREATE TABLE verified_issues (
    issue_id VARCHAR(50) PRIMARY KEY,
    
    -- Location
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    centroid_latitude DECIMAL(9,6),
    centroid_longitude DECIMAL(9,6),
    
    -- Event details
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    
    -- Evidence metrics
    observation_count INTEGER NOT NULL CHECK (observation_count >= 0),
    distinct_bus_count INTEGER NOT NULL CHECK (distinct_bus_count >= 0),
    confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    verification_score FLOAT NOT NULL CHECK (verification_score >= 0 AND verification_score <= 1),
    priority_score FLOAT NOT NULL CHECK (priority_score >= 0 AND priority_score <= 100),
    
    -- Temporal information
    first_observed TIMESTAMP WITH TIME ZONE NOT NULL,
    last_observed TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Spatial clustering
    cluster_radius_meters FLOAT,
    
    -- Priority explanation
    priority_reasons TEXT,
    
    -- Resolution information
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(100),
    resolution_notes TEXT,
    
    -- Additional metadata
    metadata_json TEXT
);

-- Indexes for verified_issues
CREATE INDEX idx_verified_issues_location ON verified_issues USING GIST(location);
CREATE INDEX idx_verified_issues_event_type ON verified_issues(event_type);
CREATE INDEX idx_verified_issues_severity ON verified_issues(severity);
CREATE INDEX idx_verified_issues_priority ON verified_issues(priority);
CREATE INDEX idx_verified_issues_status ON verified_issues(status);
CREATE INDEX idx_verified_issues_first_observed ON verified_issues(first_observed);

-- Event Observations Table
CREATE TABLE event_observations (
    id SERIAL PRIMARY KEY,
    raw_event_id INTEGER REFERENCES raw_events(id) ON DELETE CASCADE,
    issue_id VARCHAR(50) REFERENCES verified_issues(issue_id) ON DELETE CASCADE,
    
    -- Observation details
    observation_confidence FLOAT NOT NULL CHECK (observation_confidence >= 0 AND observation_confidence <= 1),
    gps_adjusted BOOLEAN DEFAULT FALSE,
    adjusted_latitude DECIMAL(9,6),
    adjusted_longitude DECIMAL(9,6),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for event_observations
CREATE INDEX idx_event_observations_raw_event_id ON event_observations(raw_event_id);
CREATE INDEX idx_event_observations_issue_id ON event_observations(issue_id);

-- Issue Status History Table
CREATE TABLE issue_status_history (
    id SERIAL PRIMARY KEY,
    issue_id VARCHAR(50) REFERENCES verified_issues(issue_id) ON DELETE CASCADE,
    
    -- Status change
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    
    -- Who made the change
    changed_by VARCHAR(100) NOT NULL,
    change_reason TEXT,
    
    -- Timestamp
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for issue_status_history
CREATE INDEX idx_issue_status_history_issue_id ON issue_status_history(issue_id);
CREATE INDEX idx_issue_status_history_changed_at ON issue_status_history(changed_at);

-- Buses Table
CREATE TABLE buses (
    bus_id VARCHAR(50) PRIMARY KEY,
    
    -- Bus details
    registration_number VARCHAR(50) NOT NULL,
    bus_type VARCHAR(50),
    capacity INTEGER,
    
    -- Camera information
    camera_id VARCHAR(50) NOT NULL,
    camera_status VARCHAR(20) DEFAULT 'ONLINE',
    
    -- Current status
    current_route_id VARCHAR(50),
    current_status VARCHAR(20) DEFAULT 'ACTIVE',
    current_latitude DECIMAL(9,6),
    current_longitude DECIMAL(9,6),
    current_location GEOGRAPHY(POINT, 4326),
    
    -- Last update
    last_ping TIMESTAMP WITH TIME ZONE,
    last_speed_kmh FLOAT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Statistics
    total_events_detected INTEGER DEFAULT 0,
    total_distance_km FLOAT DEFAULT 0.0
);

-- Indexes for buses
CREATE INDEX idx_buses_current_route_id ON buses(current_route_id);
CREATE INDEX idx_buses_current_status ON buses(current_status);
CREATE INDEX idx_buses_current_location ON buses USING GIST(current_location);

-- Routes Table
CREATE TABLE routes (
    route_id VARCHAR(50) PRIMARY KEY,
    
    -- Route details
    route_number VARCHAR(50) NOT NULL,
    route_name VARCHAR(200) NOT NULL,
    
    -- Route geometry
    start_location GEOGRAPHY(POINT, 4326),
    end_location GEOGRAPHY(POINT, 4326),
    start_latitude DECIMAL(9,6),
    start_longitude DECIMAL(9,6),
    end_latitude DECIMAL(9,6),
    end_longitude DECIMAL(9,6),
    
    -- Route metadata
    distance_km FLOAT,
    estimated_duration_minutes INTEGER,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for routes
CREATE INDEX idx_routes_is_active ON routes(is_active);

-- Bus Telemetry Table
CREATE TABLE bus_telemetry (
    id SERIAL PRIMARY KEY,
    bus_id VARCHAR(50) REFERENCES buses(bus_id) ON DELETE CASCADE,
    route_id VARCHAR(50) REFERENCES routes(route_id) ON DELETE CASCADE,
    
    -- Location
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    
    -- Telemetry
    speed_kmh FLOAT,
    heading FLOAT,
    
    -- Timestamp
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for bus_telemetry
CREATE INDEX idx_bus_telemetry_bus_id ON bus_telemetry(bus_id);
CREATE INDEX idx_bus_telemetry_route_id ON bus_telemetry(route_id);
CREATE INDEX idx_bus_telemetry_timestamp ON bus_telemetry(timestamp);
CREATE INDEX idx_bus_telemetry_location ON bus_telemetry USING GIST(location);

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_verified_issues_updated_at BEFORE UPDATE ON verified_issues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_buses_updated_at BEFORE UPDATE ON buses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
