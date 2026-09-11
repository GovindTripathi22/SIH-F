"""Initial schema representing the complete UrbanPulse model architecture

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-09-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from app.models.spatial import SpatialPoint

# revision identifiers, used by Alembic.
revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == 'postgresql'

    if is_postgres:
        op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    # 1. raw_events table
    op.create_table(
        'raw_events',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('event_id', sa.String(length=50), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('location', SpatialPoint(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('bus_id', sa.String(length=50), nullable=False),
        sa.Column('route_id', sa.String(length=50), nullable=False),
        sa.Column('camera_id', sa.String(length=50), nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('validation_score', sa.Float(), nullable=False),
        sa.Column('gps_accuracy_meters', sa.Float(), nullable=True),
        sa.Column('processed', sa.Boolean(), server_default='0', nullable=True),
        sa.Column('frame_reference', sa.Text(), nullable=True),
        sa.Column('metadata_json', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('event_id')
    )
    with op.batch_alter_table('raw_events', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_raw_events_bus_id'), ['bus_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_raw_events_event_id'), ['event_id'], unique=True)
        batch_op.create_index(batch_op.f('ix_raw_events_event_type'), ['event_type'], unique=False)
        batch_op.create_index(batch_op.f('ix_raw_events_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_raw_events_processed'), ['processed'], unique=False)
        batch_op.create_index(batch_op.f('ix_raw_events_route_id'), ['route_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_raw_events_timestamp'), ['timestamp'], unique=False)

    # 2. event_observations table
    op.create_table(
        'event_observations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('raw_event_id', sa.Integer(), nullable=False),
        sa.Column('issue_id', sa.String(length=50), nullable=False),
        sa.Column('observation_confidence', sa.Float(), nullable=False),
        sa.Column('gps_adjusted', sa.Boolean(), server_default='0', nullable=True),
        sa.Column('adjusted_latitude', sa.Float(), nullable=True),
        sa.Column('adjusted_longitude', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('event_observations', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_event_observations_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_event_observations_issue_id'), ['issue_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_event_observations_raw_event_id'), ['raw_event_id'], unique=False)

    # 3. verified_issues table
    op.create_table(
        'verified_issues',
        sa.Column('issue_id', sa.String(length=50), nullable=False),
        sa.Column('location', SpatialPoint(), nullable=True),
        sa.Column('centroid_latitude', sa.Float(), nullable=False),
        sa.Column('centroid_longitude', sa.Float(), nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False),
        sa.Column('priority', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='PENDING', nullable=False),
        sa.Column('verification_state', sa.String(length=30), server_default='CANDIDATE', nullable=False),
        sa.Column('observation_count', sa.Integer(), server_default='1', nullable=False),
        sa.Column('distinct_bus_count', sa.Integer(), server_default='1', nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('verification_score', sa.Float(), nullable=False),
        sa.Column('priority_score', sa.Float(), nullable=False),
        sa.Column('first_observed', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_observed', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cluster_radius_meters', sa.Float(), server_default='15.0', nullable=True),
        sa.Column('priority_reasons', sa.Text(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_by', sa.String(length=100), nullable=True),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('metadata_json', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('issue_id')
    )
    with op.batch_alter_table('verified_issues', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_verified_issues_centroid_latitude'), ['centroid_latitude'], unique=False)
        batch_op.create_index(batch_op.f('ix_verified_issues_centroid_longitude'), ['centroid_longitude'], unique=False)
        batch_op.create_index(batch_op.f('ix_verified_issues_event_type'), ['event_type'], unique=False)
        batch_op.create_index(batch_op.f('ix_verified_issues_issue_id'), ['issue_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_verified_issues_priority'), ['priority'], unique=False)
        batch_op.create_index(batch_op.f('ix_verified_issues_severity'), ['severity'], unique=False)
        batch_op.create_index(batch_op.f('ix_verified_issues_status'), ['status'], unique=False)
        batch_op.create_index(batch_op.f('ix_verified_issues_verification_state'), ['verification_state'], unique=False)

    # 4. issue_status_history table
    op.create_table(
        'issue_status_history',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('issue_id', sa.String(length=50), nullable=False),
        sa.Column('old_status', sa.String(length=20), nullable=True),
        sa.Column('new_status', sa.String(length=20), nullable=False),
        sa.Column('changed_by', sa.String(length=100), nullable=False),
        sa.Column('change_reason', sa.Text(), nullable=True),
        sa.Column('changed_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('issue_status_history', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_issue_status_history_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_issue_status_history_issue_id'), ['issue_id'], unique=False)

    # 5. buses table
    op.create_table(
        'buses',
        sa.Column('bus_id', sa.String(length=50), nullable=False),
        sa.Column('registration_number', sa.String(length=50), nullable=False),
        sa.Column('bus_type', sa.String(length=50), server_default='diesel', nullable=True),
        sa.Column('capacity', sa.Integer(), server_default='50', nullable=True),
        sa.Column('camera_id', sa.String(length=50), nullable=False),
        sa.Column('camera_status', sa.String(length=20), server_default='ONLINE', nullable=True),
        sa.Column('current_route_id', sa.String(length=50), nullable=True),
        sa.Column('current_status', sa.String(length=20), server_default='ACTIVE', nullable=True),
        sa.Column('current_latitude', sa.Float(), nullable=True),
        sa.Column('current_longitude', sa.Float(), nullable=True),
        sa.Column('current_location', SpatialPoint(), nullable=True),
        sa.Column('last_ping', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_speed_kmh', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('total_events_detected', sa.Integer(), server_default='0', nullable=True),
        sa.Column('total_distance_km', sa.Float(), server_default='0.0', nullable=True),
        sa.PrimaryKeyConstraint('bus_id')
    )
    with op.batch_alter_table('buses', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_buses_bus_id'), ['bus_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_buses_current_route_id'), ['current_route_id'], unique=False)

    # 6. routes table
    op.create_table(
        'routes',
        sa.Column('route_id', sa.String(length=50), nullable=False),
        sa.Column('route_number', sa.String(length=50), nullable=False),
        sa.Column('route_name', sa.String(length=200), nullable=False),
        sa.Column('start_location', SpatialPoint(), nullable=True),
        sa.Column('end_location', SpatialPoint(), nullable=True),
        sa.Column('start_latitude', sa.Float(), nullable=True),
        sa.Column('start_longitude', sa.Float(), nullable=True),
        sa.Column('end_latitude', sa.Float(), nullable=True),
        sa.Column('end_longitude', sa.Float(), nullable=True),
        sa.Column('distance_km', sa.Float(), nullable=True),
        sa.Column('estimated_duration_minutes', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='1', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('route_id')
    )
    with op.batch_alter_table('routes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_routes_route_id'), ['route_id'], unique=False)

    # 7. bus_telemetry table
    op.create_table(
        'bus_telemetry',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('bus_id', sa.String(length=50), nullable=False),
        sa.Column('route_id', sa.String(length=50), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('location', SpatialPoint(), nullable=True),
        sa.Column('speed_kmh', sa.Float(), nullable=True),
        sa.Column('heading', sa.Float(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('bus_telemetry', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_bus_telemetry_bus_id'), ['bus_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_bus_telemetry_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_bus_telemetry_route_id'), ['route_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_bus_telemetry_timestamp'), ['timestamp'], unique=False)


def downgrade() -> None:
    op.drop_table('bus_telemetry')
    op.drop_table('routes')
    op.drop_table('buses')
    op.drop_table('issue_status_history')
    op.drop_table('verified_issues')
    op.drop_table('event_observations')
    op.drop_table('raw_events')
