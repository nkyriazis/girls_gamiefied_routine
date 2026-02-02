"""
Exercise Generator - Generates personalized exercises using LLM and RAG
"""
import logging
import json
from typing import List, Dict, Any

from .llm_manager import LLMManager
from .rag_manager import RAGManager

logger = logging.getLogger(__name__)


class ExerciseGenerator:
    """Generates personalized exercises for students"""
    
    def __init__(self, llm_manager: LLMManager, rag_manager: RAGManager):
        self.llm_manager = llm_manager
        self.rag_manager = rag_manager
    
    async def generate_exercises(
        self,
        user_id: str,
        subject: str,
        topic: str,
        difficulty: str = "medium",
        num_exercises: int = 5,
        exercise_type: str = "multiple_choice"
    ) -> List[Dict[str, Any]]:
        """
        Generate exercises for a user on a specific topic
        
        Args:
            user_id: User ID
            subject: Subject area (e.g., "math", "science", "language")
            topic: Specific topic within the subject
            difficulty: Difficulty level ("easy", "medium", "hard")
            num_exercises: Number of exercises to generate
            exercise_type: Type of exercise
        
        Returns:
            List of exercise dictionaries
        """
        logger.info(f"Generating {num_exercises} {exercise_type} exercises for {subject}/{topic}")
        
        # Retrieve relevant context from RAG if available
        context = ""
        if self.rag_manager.is_available():
            try:
                search_query = f"Educational content about {topic} in {subject} for {difficulty} level"
                docs = self.rag_manager.vectorstore.similarity_search(search_query, k=3)
                
                if docs:
                    context = "\n\n".join([doc.page_content for doc in docs])
                    logger.info(f"Retrieved {len(docs)} relevant document chunks")
            except Exception as e:
                logger.warning(f"Could not retrieve RAG context: {str(e)}")
        
        # Build the prompt based on exercise type
        prompt = self._build_exercise_prompt(
            subject=subject,
            topic=topic,
            difficulty=difficulty,
            num_exercises=num_exercises,
            exercise_type=exercise_type,
            context=context
        )
        
        system_prompt = """You are an expert educational content creator specializing in creating engaging, 
age-appropriate exercises for children. Generate high-quality educational exercises that are clear, accurate, 
and aligned with educational standards. Always respond with valid JSON."""
        
        # Generate exercises using LLM
        try:
            response = await self.llm_manager.generate_structured(
                prompt=prompt,
                system_prompt=system_prompt
            )
            
            # Parse and validate exercises
            exercises = self._parse_exercises(response, exercise_type, difficulty)
            
            logger.info(f"Successfully generated {len(exercises)} exercises")
            return exercises
        
        except Exception as e:
            logger.error(f"Error generating exercises: {str(e)}")
            # Return fallback exercises
            return self._generate_fallback_exercises(
                subject, topic, difficulty, num_exercises, exercise_type
            )
    
    def _build_exercise_prompt(
        self,
        subject: str,
        topic: str,
        difficulty: str,
        num_exercises: int,
        exercise_type: str,
        context: str
    ) -> str:
        """Build the LLM prompt for exercise generation"""
        
        difficulty_descriptions = {
            "easy": "suitable for beginners, simple concepts, straightforward questions",
            "medium": "intermediate level, requires understanding of core concepts",
            "hard": "advanced level, requires deep understanding and application"
        }
        
        difficulty_desc = difficulty_descriptions.get(difficulty, "medium level")
        
        context_section = ""
        if context:
            context_section = f"""
## Reference Material
Use the following educational content as reference for creating the exercises:

{context}
"""
        
        if exercise_type == "multiple_choice":
            format_instructions = """
Each exercise should have:
- "question": The question text
- "options": Array of 4 option strings (labeled A, B, C, D)
- "correct_answer": The correct option letter (A, B, C, or D)
- "explanation": Brief explanation of the correct answer
- "difficulty": The difficulty level
- "points": Star points awarded (easy: 5-10, medium: 10-15, hard: 15-25)
"""
        elif exercise_type == "short_answer":
            format_instructions = """
Each exercise should have:
- "question": The question text
- "correct_answer": The expected answer
- "explanation": Brief explanation and grading guidance
- "difficulty": The difficulty level
- "points": Star points awarded (easy: 5-10, medium: 10-15, hard: 15-25)
"""
        elif exercise_type == "problem_solving":
            format_instructions = """
Each exercise should have:
- "question": The problem statement
- "correct_answer": The solution
- "explanation": Step-by-step solution explanation
- "difficulty": The difficulty level
- "points": Star points awarded (easy: 5-10, medium: 10-15, hard: 15-25)
"""
        else:  # essay
            format_instructions = """
Each exercise should have:
- "question": The essay prompt
- "correct_answer": Key points that should be covered
- "explanation": Grading rubric and what to look for
- "difficulty": The difficulty level
- "points": Star points awarded (easy: 5-10, medium: 10-15, hard: 15-25)
"""
        
        prompt = f"""Generate {num_exercises} {exercise_type} exercises for the following:

## Subject
{subject}

## Topic
{topic}

## Difficulty Level
{difficulty} - {difficulty_desc}

{context_section}

## Requirements
1. Exercises should be age-appropriate for children
2. Questions should be clear and unambiguous
3. Content should be educationally sound and accurate
4. Make exercises engaging and relevant to real-world scenarios when possible
5. Ensure appropriate difficulty progression

## Format
Return your response as a JSON object with this structure:
{{
  "exercises": [
    {format_instructions}
  ]
}}

Generate the exercises now:"""
        
        return prompt
    
    def _parse_exercises(
        self,
        response: Dict[str, Any],
        exercise_type: str,
        difficulty: str
    ) -> List[Dict[str, Any]]:
        """Parse and validate LLM response"""
        
        if "exercises" not in response:
            raise ValueError("Response missing 'exercises' field")
        
        exercises = response["exercises"]
        validated = []
        
        for ex in exercises:
            # Ensure all required fields are present
            validated_ex = {
                "question": ex.get("question", ""),
                "correct_answer": ex.get("correct_answer", ""),
                "explanation": ex.get("explanation", ""),
                "difficulty": difficulty,
                "points": ex.get("points", 10)
            }
            
            # Add options for multiple choice
            if exercise_type == "multiple_choice":
                validated_ex["options"] = ex.get("options", [])
            
            validated.append(validated_ex)
        
        return validated
    
    def _generate_fallback_exercises(
        self,
        subject: str,
        topic: str,
        difficulty: str,
        num_exercises: int,
        exercise_type: str
    ) -> List[Dict[str, Any]]:
        """Generate simple fallback exercises if LLM fails"""
        
        logger.warning("Using fallback exercise generation")
        
        points_map = {"easy": 5, "medium": 10, "hard": 15}
        points = points_map.get(difficulty, 10)
        
        exercises = []
        for i in range(num_exercises):
            if exercise_type == "multiple_choice":
                ex = {
                    "question": f"Sample question {i+1} about {topic} in {subject}",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "correct_answer": "A",
                    "explanation": "This is a sample exercise. Please configure LLM API keys for personalized content.",
                    "difficulty": difficulty,
                    "points": points
                }
            else:
                ex = {
                    "question": f"Sample question {i+1} about {topic} in {subject}",
                    "correct_answer": "Sample answer",
                    "explanation": "This is a sample exercise. Please configure LLM API keys for personalized content.",
                    "difficulty": difficulty,
                    "points": points
                }
            exercises.append(ex)
        
        return exercises
