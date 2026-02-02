"""
Simple test to verify the LLM service structure
Tests that can run without API keys
"""
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def test_imports():
    """Test that all modules can be imported"""
    print("Testing module imports...")
    
    try:
        from config import settings
        print("✓ config.py imports successfully")
        
        from llm_manager import LLMManager
        print("✓ llm_manager.py imports successfully")
        
        from rag_manager import RAGManager
        print("✓ rag_manager.py imports successfully")
        
        from exercise_generator import ExerciseGenerator
        print("✓ exercise_generator.py imports successfully")
        
        from main import app
        print("✓ main.py imports successfully")
        
        return True
    except Exception as e:
        print(f"✗ Import failed: {str(e)}")
        return False

def test_config():
    """Test configuration loading"""
    print("\nTesting configuration...")
    
    try:
        from config import settings
        
        print(f"✓ Default LLM provider: {settings.default_llm_provider}")
        print(f"✓ Default model: {settings.default_model}")
        print(f"✓ Temperature: {settings.temperature}")
        print(f"✓ Max tokens: {settings.max_tokens}")
        print(f"✓ Vectordb path: {settings.vectordb_path}")
        print(f"✓ Documents path: {settings.documents_path}")
        
        return True
    except Exception as e:
        print(f"✗ Config test failed: {str(e)}")
        return False

def test_managers_init():
    """Test that managers can be initialized"""
    print("\nTesting manager initialization...")
    
    try:
        from llm_manager import LLMManager
        from rag_manager import RAGManager
        from exercise_generator import ExerciseGenerator
        
        llm = LLMManager()
        print(f"✓ LLMManager initialized (available: {llm.is_available()})")
        
        rag = RAGManager()
        print(f"✓ RAGManager initialized (available: {rag.is_available()})")
        
        gen = ExerciseGenerator(llm, rag)
        print("✓ ExerciseGenerator initialized")
        
        return True
    except Exception as e:
        print(f"✗ Manager initialization failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_fastapi_app():
    """Test FastAPI app structure"""
    print("\nTesting FastAPI app...")
    
    try:
        from main import app
        
        routes = [route.path for route in app.routes]
        print(f"✓ FastAPI app created with {len(routes)} routes")
        
        expected_routes = [
            "/",
            "/health",
            "/chat",
            "/exercises/generate",
            "/documents/upload",
            "/documents/list",
        ]
        
        for route in expected_routes:
            if route in routes:
                print(f"  ✓ {route}")
            else:
                print(f"  ✗ {route} (missing)")
        
        return True
    except Exception as e:
        print(f"✗ FastAPI test failed: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("=" * 60)
    print("LLM Service - Structure Tests")
    print("=" * 60)
    print()
    
    tests = [
        test_imports,
        test_config,
        test_managers_init,
        test_fastapi_app
    ]
    
    results = []
    for test in tests:
        result = test()
        results.append(result)
        print()
    
    print("=" * 60)
    if all(results):
        print("✨ All tests passed!")
    else:
        print("❌ Some tests failed")
        sys.exit(1)
    print("=" * 60)

if __name__ == "__main__":
    main()
