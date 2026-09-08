"""
Pytest session configuration and database lifecycle fixture.
"""

import pytest
import os
import asyncio
from app.database import init_db, close_db

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Ensure database schema is created and seeded before tests run"""
    asyncio.run(init_db())
    yield
    asyncio.run(close_db())
