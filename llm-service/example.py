#!/usr/bin/env python3
"""
Example usage of the LLM Service API
Demonstrates how to generate exercises and upload documents
"""
import requests
import json
import sys

# Configuration
BASE_URL = "http://localhost:8000"

def check_health():
    """Check service health"""
    print("🔍 Checking service health...")
    response = requests.get(f"{BASE_URL}/health")
    data = response.json()
    
    print(f"✓ Status: {data['status']}")
    print(f"✓ LLM Provider: {data['llm_provider']}")
    print(f"✓ LLM Available: {data['llm_available']}")
    print(f"✓ RAG Available: {data['rag_available']}")
    print()
    
    return data['llm_available']

def generate_exercises():
    """Generate sample exercises"""
    print("📝 Generating exercises...")
    
    request_data = {
        "user_id": "u1",
        "subject": "mathematics",
        "topic": "fractions",
        "difficulty": "medium",
        "num_exercises": 3,
        "exercise_type": "multiple_choice"
    }
    
    response = requests.post(
        f"{BASE_URL}/exercises/generate",
        json=request_data
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Generated {len(data['exercises'])} exercises")
        print(f"✓ Subject: {data['metadata']['subject']}")
        print(f"✓ Topic: {data['metadata']['topic']}")
        print(f"✓ Difficulty: {data['metadata']['difficulty']}")
        print()
        
        # Display first exercise
        if data['exercises']:
            ex = data['exercises'][0]
            print("📚 Sample Exercise:")
            print(f"   Q: {ex['question']}")
            if 'options' in ex:
                for i, opt in enumerate(ex['options']):
                    print(f"   {chr(65+i)}) {opt}")
            print(f"   ✓ Answer: {ex['correct_answer']}")
            print(f"   💡 {ex['explanation']}")
            print(f"   ⭐ Points: {ex['points']}")
            print()
    else:
        print(f"❌ Error: {response.status_code}")
        print(response.text)

def chat_example():
    """Example chat interaction"""
    print("💬 Chat Example...")
    
    request_data = {
        "message": "Explain what fractions are to a 10-year-old",
        "user_id": "u1",
        "use_rag": False
    }
    
    response = requests.post(
        f"{BASE_URL}/chat",
        json=request_data
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✓ Response received:")
        print(f"   {data['response'][:200]}...")
        print()
    else:
        print(f"❌ Error: {response.status_code}")

def list_documents():
    """List uploaded documents"""
    print("📄 Listing documents...")
    
    response = requests.get(f"{BASE_URL}/documents/list")
    
    if response.status_code == 200:
        data = response.json()
        docs = data.get('documents', [])
        print(f"✓ Found {len(docs)} documents")
        
        for doc in docs:
            print(f"   - {doc['filename']} (ID: {doc['document_id'][:8]}...)")
        print()
    else:
        print(f"❌ Error: {response.status_code}")

def main():
    """Main function"""
    print("=" * 60)
    print("LLM Service - Example Usage")
    print("=" * 60)
    print()
    
    try:
        # Check health
        llm_available = check_health()
        
        if not llm_available:
            print("⚠️  LLM service is not fully configured.")
            print("   Please add OPENAI_API_KEY or ANTHROPIC_API_KEY to .env")
            print()
            return
        
        # List documents
        list_documents()
        
        # Generate exercises
        generate_exercises()
        
        # Chat example
        chat_example()
        
        print("=" * 60)
        print("✨ All examples completed successfully!")
        print("=" * 60)
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to LLM service at", BASE_URL)
        print("   Make sure the service is running:")
        print("   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
