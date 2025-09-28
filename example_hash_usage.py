#!/usr/bin/env python3
"""
Example usage of the hash-based cell sync functionality.

This script demonstrates how teachers and students would interact 
with the new hash-based API endpoints.
"""

import json
import requests
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8888/notebook-sync"
TEACHER_TOKEN = "your-teacher-token"  # Replace with actual auth token
STUDENT_TOKEN = "your-student-token"  # Replace with actual auth token


def teacher_push_cell_example():
    """Example of teacher pushing a cell using hash-based storage."""
    print("📚 Teacher: Pushing cell content...")
    
    # Cell data to push
    cell_data = {
        "cell_id": "lesson_1_cell_001",
        "created_at": datetime.now().isoformat() + "Z",
        "content": """
# Lesson 1: Introduction to Python
print("Welcome to the Python programming lesson!")

# Variables and data types
name = "Student"
age = 20
height = 5.8

print(f"Hello, {name}! You are {age} years old and {height} feet tall.")
        """.strip(),
        "ttl_seconds": 86400  # 24 hours
    }
    
    print(f"Cell ID: {cell_data['cell_id']}")
    print(f"Created At: {cell_data['created_at']}")
    print(f"Content preview: {cell_data['content'][:50]}...")
    
    # Example of what the HTTP request would look like
    example_request = f"""
curl -X POST {BASE_URL}/hash/push-cell \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {TEACHER_TOKEN}" \\
  -d '{json.dumps(cell_data, indent=2)}'
    """.strip()
    
    print("\nExample HTTP request:")
    print(example_request)
    
    # Expected response
    expected_response = {
        "type": "push_confirmed_hash",
        "cell_id": cell_data["cell_id"],
        "created_at": cell_data["created_at"],
        "hash_key": "a1b2c3d4",  # First 8 characters of actual hash
        "teacher_id": "teacher123"
    }
    
    print(f"\nExpected response:")
    print(json.dumps(expected_response, indent=2))
    
    return cell_data


def student_request_sync_example(cell_data):
    """Example of student requesting cell sync using hash-based retrieval."""
    print("\n🎓 Student: Requesting cell sync...")
    
    # Request data (only needs cell_id and created_at)
    request_data = {
        "cell_id": cell_data["cell_id"],
        "created_at": cell_data["created_at"]
    }
    
    print(f"Requesting cell: {request_data['cell_id']}")
    print(f"With timestamp: {request_data['created_at']}")
    
    # Example HTTP request
    example_request = f"""
curl -X POST {BASE_URL}/hash/request-sync \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {STUDENT_TOKEN}" \\
  -d '{json.dumps(request_data, indent=2)}'
    """.strip()
    
    print("\nExample HTTP request:")
    print(example_request)
    
    # Expected response
    expected_response = {
        "type": "cell_sync_hash",
        "cell_id": cell_data["cell_id"],
        "content": cell_data["content"],
        "created_at": cell_data["created_at"],
        "student_id": "student456"
    }
    
    print(f"\nExpected response:")
    print(json.dumps(expected_response, indent=2))


def network_configuration_example():
    """Example of setting up Redis for networked teacher-student operation."""
    print("\n🌐 Network Configuration Example:")
    print("=" * 50)
    
    print("1. Teacher setup (IP: 192.168.1.42):")
    print("   # Start Redis server accessible from network")
    print("   redis-server --bind 0.0.0.0 --port 6379")
    print("")
    print("   # Set environment variable (optional)")
    print("   export REDIS_URL='redis://0.0.0.0:6379'")
    print("")
    
    print("2. Student setup:")
    print("   # Point to teacher's Redis server")
    print("   export REDIS_URL='redis://192.168.1.42:6379'")
    print("")
    
    print("3. Both teacher and students start JupyterLab:")
    print("   jupyter lab --ip=0.0.0.0 --port=8888")
    

def main():
    print("Hash-Based Cell Sync Example")
    print("=" * 40)
    
    # Teacher workflow
    cell_data = teacher_push_cell_example()
    
    # Student workflow
    student_request_sync_example(cell_data)
    
    # Network setup
    network_configuration_example()
    
    print("\n" + "=" * 40)
    print("✨ Key Benefits of Hash-Based Approach:")
    print("• No session management required")
    print("• Direct cell-to-cell synchronization")
    print("• Deterministic key generation")
    print("• Works across network with shared Redis")
    print("• Backwards compatible with existing session APIs")


if __name__ == "__main__":
    main()