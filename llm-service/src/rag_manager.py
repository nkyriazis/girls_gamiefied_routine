"""
RAG Manager - Handles document processing and retrieval
"""
import logging
import os
import hashlib
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import shutil

from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from fastapi import UploadFile

from .config import settings

logger = logging.getLogger(__name__)


class RAGManager:
    """Manages document processing and retrieval for RAG"""
    
    def __init__(self):
        self.vectordb_path = Path(settings.vectordb_path)
        self.documents_path = Path(settings.documents_path)
        
        # Create directories if they don't exist
        self.vectordb_path.mkdir(parents=True, exist_ok=True)
        self.documents_path.mkdir(parents=True, exist_ok=True)
        
        # Initialize embeddings
        self.embeddings = None
        if settings.openai_api_key:
            try:
                self.embeddings = OpenAIEmbeddings(
                    openai_api_key=settings.openai_api_key
                )
                logger.info("OpenAI embeddings initialized")
            except Exception as e:
                logger.error(f"Failed to initialize embeddings: {str(e)}")
        
        # Initialize or load vector store
        self.vectorstore = None
        self._init_vectorstore()
        
        # Initialize text splitter
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            length_function=len,
        )
    
    def _init_vectorstore(self):
        """Initialize or load the vector store"""
        if not self.embeddings:
            logger.warning("Cannot initialize vectorstore without embeddings")
            return
        
        try:
            # Try to load existing vectorstore
            if (self.vectordb_path / "chroma.sqlite3").exists():
                self.vectorstore = Chroma(
                    persist_directory=str(self.vectordb_path),
                    embedding_function=self.embeddings
                )
                logger.info("Loaded existing vector store")
            else:
                # Create new vectorstore
                self.vectorstore = Chroma(
                    persist_directory=str(self.vectordb_path),
                    embedding_function=self.embeddings
                )
                logger.info("Created new vector store")
        except Exception as e:
            logger.error(f"Error initializing vectorstore: {str(e)}")
    
    def is_available(self) -> bool:
        """Check if RAG system is available"""
        return self.embeddings is not None and self.vectorstore is not None
    
    async def add_document(
        self,
        file: UploadFile,
        subject: str = "general",
        metadata: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Add a document to the RAG system
        
        Args:
            file: Uploaded PDF file
            subject: Subject category
            metadata: Additional metadata as JSON string
        
        Returns:
            Dictionary with upload status and details
        """
        if not self.is_available():
            raise ValueError("RAG system is not available. Please configure OpenAI API key.")
        
        # Generate document ID
        file_content = await file.read()
        document_id = hashlib.md5(file_content).hexdigest()
        
        # Save the file
        file_path = self.documents_path / f"{document_id}_{file.filename}"
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        logger.info(f"Saved document {file.filename} to {file_path}")
        
        # Load and process the document
        try:
            loader = PyPDFLoader(str(file_path))
            documents = loader.load()
            
            # Add metadata to documents
            doc_metadata = {
                "document_id": document_id,
                "filename": file.filename,
                "subject": subject,
                "source": str(file_path)
            }
            if metadata:
                import json
                doc_metadata.update(json.loads(metadata))
            
            for doc in documents:
                doc.metadata.update(doc_metadata)
            
            # Split documents into chunks
            chunks = self.text_splitter.split_documents(documents)
            logger.info(f"Split document into {len(chunks)} chunks")
            
            # Add to vectorstore
            self.vectorstore.add_documents(chunks)
            logger.info(f"Added {len(chunks)} chunks to vectorstore")
            
            return {
                "filename": file.filename,
                "document_id": document_id,
                "status": "success",
                "chunks_created": len(chunks)
            }
        
        except Exception as e:
            logger.error(f"Error processing document: {str(e)}")
            # Clean up the saved file if processing failed
            if file_path.exists():
                file_path.unlink()
            raise
    
    async def query(
        self,
        question: str,
        llm_manager,
        top_k: Optional[int] = None
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Query the RAG system
        
        Args:
            question: User question
            llm_manager: LLM manager instance
            top_k: Number of documents to retrieve
        
        Returns:
            Tuple of (response, sources)
        """
        if not self.is_available():
            raise ValueError("RAG system is not available")
        
        k = top_k if top_k is not None else settings.top_k_retrieval
        
        # Retrieve relevant documents
        docs = self.vectorstore.similarity_search(question, k=k)
        
        # Build context from retrieved documents
        context = "\n\n".join([doc.page_content for doc in docs])
        
        # Build sources
        sources = [
            {
                "content": doc.page_content[:200] + "...",
                "metadata": doc.metadata
            }
            for doc in docs
        ]
        
        # Generate response using LLM
        system_prompt = """You are a helpful educational assistant. Use the provided context to answer questions accurately. 
If the context doesn't contain enough information, say so clearly."""
        
        prompt = f"""Context:
{context}

Question: {question}

Answer:"""
        
        response = await llm_manager.generate(
            prompt=prompt,
            system_prompt=system_prompt
        )
        
        return response, sources
    
    async def list_documents(self) -> List[Dict[str, Any]]:
        """List all uploaded documents"""
        documents = []
        
        for file_path in self.documents_path.glob("*_*.pdf"):
            doc_id = file_path.name.split("_")[0]
            filename = "_".join(file_path.name.split("_")[1:])
            
            documents.append({
                "document_id": doc_id,
                "filename": filename,
                "path": str(file_path),
                "size": file_path.stat().st_size
            })
        
        return documents
    
    async def delete_document(self, document_id: str) -> bool:
        """Delete a document and its embeddings"""
        try:
            # Find and delete the file
            files = list(self.documents_path.glob(f"{document_id}_*.pdf"))
            if not files:
                return False
            
            for file_path in files:
                file_path.unlink()
                logger.info(f"Deleted document file: {file_path}")
            
            # Delete embeddings from vectorstore
            if self.vectorstore:
                # Get all documents with this document_id
                results = self.vectorstore.get(
                    where={"document_id": document_id}
                )
                
                if results and results['ids']:
                    self.vectorstore.delete(ids=results['ids'])
                    logger.info(f"Deleted {len(results['ids'])} chunks from vectorstore")
            
            return True
        
        except Exception as e:
            logger.error(f"Error deleting document {document_id}: {str(e)}")
            return False
