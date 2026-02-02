"""
LLM Manager - Handles interactions with various LLM providers
"""
import logging
from typing import Optional, List, Dict, Any
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic

from .config import settings

logger = logging.getLogger(__name__)


class LLMManager:
    """Manages LLM provider interactions"""
    
    def __init__(self):
        self.openai_client = None
        self.anthropic_client = None
        
        # Initialize OpenAI client if API key is provided
        if settings.openai_api_key:
            self.openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
            logger.info("OpenAI client initialized")
        
        # Initialize Anthropic client if API key is provided
        if settings.anthropic_api_key:
            self.anthropic_client = AsyncAnthropic(api_key=settings.anthropic_api_key)
            logger.info("Anthropic client initialized")
    
    def is_available(self) -> bool:
        """Check if at least one LLM provider is available"""
        return self.openai_client is not None or self.anthropic_client is not None
    
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        provider: Optional[str] = None
    ) -> str:
        """
        Generate text using the specified LLM provider
        
        Args:
            prompt: The user prompt
            system_prompt: Optional system prompt
            temperature: Override default temperature
            max_tokens: Override default max tokens
            provider: Override default provider ("openai" or "anthropic")
        
        Returns:
            Generated text response
        """
        temp = temperature if temperature is not None else settings.temperature
        max_tok = max_tokens if max_tokens is not None else settings.max_tokens
        llm_provider = provider if provider is not None else settings.default_llm_provider
        
        try:
            if llm_provider == "openai" and self.openai_client:
                return await self._generate_openai(prompt, system_prompt, temp, max_tok)
            elif llm_provider == "anthropic" and self.anthropic_client:
                return await self._generate_anthropic(prompt, system_prompt, temp, max_tok)
            else:
                # Fallback to available provider
                if self.openai_client:
                    return await self._generate_openai(prompt, system_prompt, temp, max_tok)
                elif self.anthropic_client:
                    return await self._generate_anthropic(prompt, system_prompt, temp, max_tok)
                else:
                    raise ValueError("No LLM provider is configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY")
        
        except Exception as e:
            logger.error(f"Error generating response with {llm_provider}: {str(e)}")
            raise
    
    async def _generate_openai(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int
    ) -> str:
        """Generate using OpenAI"""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        response = await self.openai_client.chat.completions.create(
            model=settings.default_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        return response.choices[0].message.content
    
    async def _generate_anthropic(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int
    ) -> str:
        """Generate using Anthropic Claude"""
        response = await self.anthropic_client.messages.create(
            model=settings.default_model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt if system_prompt else "",
            messages=[{"role": "user", "content": prompt}]
        )
        
        return response.content[0].text
    
    async def generate_structured(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        response_format: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate structured JSON response
        Currently only supported for OpenAI
        """
        if not self.openai_client:
            raise ValueError("Structured output requires OpenAI provider")
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        # Use JSON mode for structured output
        response = await self.openai_client.chat.completions.create(
            model=settings.default_model,
            messages=messages,
            temperature=settings.temperature,
            max_tokens=settings.max_tokens,
            response_format={"type": "json_object"}
        )
        
        import json
        return json.loads(response.choices[0].message.content)
