"""
Configuration management for LLM Service
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # API Keys
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    
    # LLM Settings
    default_llm_provider: str = "openai"  # "openai" or "anthropic"
    default_model: str = "gpt-4o-mini"  # or "claude-3-5-sonnet-20241022"
    temperature: float = 0.7
    max_tokens: int = 2000
    
    # RAG Settings
    vectordb_path: str = "/app/data/vectordb"
    documents_path: str = "/app/data/documents"
    chunk_size: int = 1000
    chunk_overlap: int = 200
    top_k_retrieval: int = 3
    
    # Backend Integration
    backend_url: str = "http://backend:3000"
    
    # Server Settings
    debug: bool = False
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance
settings = Settings()
