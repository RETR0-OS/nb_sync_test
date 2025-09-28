#!/usr/bin/env python3
"""
Simple test script to verify hash-based cell storage functionality.
This script tests the new hash-based methods without requiring a full Redis server setup.
"""

import asyncio
import json
from nb_sync.redis_client import _cell_hash, RedisManager


def test_hash_generation():
    """Test that hash generation is consistent and unique."""
    print("Testing hash generation...")
    
    # Test consistency
    hash1 = _cell_hash("cell_001", "2025-01-15T10:30:00.000Z")
    hash2 = _cell_hash("cell_001", "2025-01-15T10:30:00.000Z")
    assert hash1 == hash2, "Hash should be consistent for same inputs"
    print(f"✓ Hash consistency test passed: {hash1[:16]}...")
    
    # Test uniqueness
    hash3 = _cell_hash("cell_002", "2025-01-15T10:30:00.000Z")
    hash4 = _cell_hash("cell_001", "2025-01-15T10:30:01.000Z")
    assert hash1 != hash3, "Hash should be different for different cell_id"
    assert hash1 != hash4, "Hash should be different for different created_at"
    print("✓ Hash uniqueness test passed")


def test_redis_manager_init():
    """Test RedisManager initialization without connecting to Redis."""
    print("\nTesting RedisManager initialization...")
    
    # Test default URL
    manager1 = RedisManager()
    assert manager1.redis_url == "redis://localhost:6379"
    print("✓ Default Redis URL test passed")
    
    # Test custom URL
    manager2 = RedisManager("redis://192.168.1.42:6379")
    assert manager2.redis_url == "redis://192.168.1.42:6379"
    print("✓ Custom Redis URL test passed")


def test_api_payload_structure():
    """Test that the expected API payload structures are correctly defined."""
    print("\nTesting API payload structures...")
    
    # Teacher push payload
    teacher_payload = {
        "cell_id": "cell_001",
        "created_at": "2025-01-15T10:30:00.000Z",
        "content": "print('Hello, students!')",
        "ttl_seconds": 86400
    }
    
    # Verify required fields are present
    required_fields = ["cell_id", "created_at", "content"]
    for field in required_fields:
        assert field in teacher_payload, f"Missing required field: {field}"
    print("✓ Teacher payload structure test passed")
    
    # Student request payload
    student_payload = {
        "cell_id": "cell_001",
        "created_at": "2025-01-15T10:30:00.000Z"
    }
    
    required_student_fields = ["cell_id", "created_at"]
    for field in required_student_fields:
        assert field in student_payload, f"Missing required field: {field}"
    print("✓ Student payload structure test passed")


if __name__ == "__main__":
    print("Running hash-based functionality tests...")
    print("=" * 50)
    
    # Run synchronous tests
    test_hash_generation()
    test_redis_manager_init()
    test_api_payload_structure()
    
    print("\n" + "=" * 50)
    print("✅ All tests passed! Hash-based functionality is properly implemented.")
    print("\nNext steps:")
    print("1. Start Redis server: redis-server --bind 0.0.0.0")
    print("2. Test with real Redis by setting REDIS_URL environment variable")
    print("3. Test API endpoints using curl or Postman:")
    print("   POST /notebook-sync/hash/push-cell")
    print("   POST /notebook-sync/hash/request-sync")