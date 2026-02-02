"""
LLM Service Main Application
Provides LLM and RAG functionality for exercise generation
"""
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import logging

from .config import settings
from .llm_manager import LLMManager
from .rag_manager import RAGManager
from .exercise_generator import ExerciseGenerator

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="LLM Service",
    description="LLM and RAG service for personalized exercise generation",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize managers
llm_manager = LLMManager()
rag_manager = RAGManager()
exercise_generator = ExerciseGenerator(llm_manager, rag_manager)


# Request/Response Models
class HealthResponse(BaseModel):
    status: str
    llm_provider: str
    llm_available: bool
    rag_available: bool


class ChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = None
    use_rag: bool = False


class ChatResponse(BaseModel):
    response: str
    sources: Optional[List[Dict[str, Any]]] = None


class ExerciseRequest(BaseModel):
    user_id: str
    subject: str
    topic: str
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    num_exercises: int = Field(default=5, ge=1, le=20)
    exercise_type: str = Field(default="multiple_choice", 
                               pattern="^(multiple_choice|short_answer|essay|problem_solving)$")


class Exercise(BaseModel):
    question: str
    options: Optional[List[str]] = None
    correct_answer: str
    explanation: str
    difficulty: str
    points: int


class ExerciseResponse(BaseModel):
    exercises: List[Exercise]
    metadata: Dict[str, Any]


class DocumentUploadResponse(BaseModel):
    filename: str
    document_id: str
    status: str
    chunks_created: int


# API Endpoints
@app.get("/", response_model=dict)
async def root():
    """Root endpoint"""
    return {
        "service": "LLM Service",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    llm_available = llm_manager.is_available()
    rag_available = rag_manager.is_available()
    
    return HealthResponse(
        status="healthy" if llm_available else "degraded",
        llm_provider=settings.default_llm_provider,
        llm_available=llm_available,
        rag_available=rag_available
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Simple chat endpoint with optional RAG support
    """
    try:
        if request.use_rag:
            # Use RAG for context-aware responses
            response, sources = await rag_manager.query(
                question=request.message,
                llm_manager=llm_manager
            )
            return ChatResponse(response=response, sources=sources)
        else:
            # Direct LLM query
            response = await llm_manager.generate(
                prompt=request.message,
                system_prompt="You are a helpful assistant for a gamified learning system for children."
            )
            return ChatResponse(response=response)
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing chat request: {str(e)}")


@app.post("/exercises/generate", response_model=ExerciseResponse)
async def generate_exercises(request: ExerciseRequest):
    """
    Generate personalized exercises for a user based on subject and topic
    Uses RAG to retrieve relevant content from uploaded textbooks
    """
    try:
        logger.info(f"Generating {request.num_exercises} {request.exercise_type} exercises "
                   f"for user {request.user_id} on {request.subject}/{request.topic}")
        
        exercises = await exercise_generator.generate_exercises(
            user_id=request.user_id,
            subject=request.subject,
            topic=request.topic,
            difficulty=request.difficulty,
            num_exercises=request.num_exercises,
            exercise_type=request.exercise_type
        )
        
        metadata = {
            "user_id": request.user_id,
            "subject": request.subject,
            "topic": request.topic,
            "difficulty": request.difficulty,
            "exercise_type": request.exercise_type,
            "count": len(exercises)
        }
        
        return ExerciseResponse(exercises=exercises, metadata=metadata)
    
    except Exception as e:
        logger.error(f"Error generating exercises: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating exercises: {str(e)}")


@app.post("/documents/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    subject: str = "general",
    metadata: Optional[str] = None
):
    """
    Upload a textbook or document for RAG processing
    Supports PDF files
    """
    try:
        # Validate file type
        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        # Save and process the document
        result = await rag_manager.add_document(
            file=file,
            subject=subject,
            metadata=metadata
        )
        
        return DocumentUploadResponse(**result)
    
    except Exception as e:
        logger.error(f"Error uploading document: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error uploading document: {str(e)}")


@app.get("/documents/list")
async def list_documents():
    """List all uploaded documents"""
    try:
        documents = await rag_manager.list_documents()
        return {"documents": documents}
    except Exception as e:
        logger.error(f"Error listing documents: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error listing documents: {str(e)}")


@app.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    """Delete a document from the RAG system"""
    try:
        success = await rag_manager.delete_document(document_id)
        if success:
            return {"status": "deleted", "document_id": document_id}
        else:
            raise HTTPException(status_code=404, detail="Document not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting document: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
