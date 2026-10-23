"""
Pydantic Schemas for AI Recognition & Inference Requests/Responses
"""

from typing import List, Optional, Tuple
from pydantic import BaseModel, Field

class LineRecognitionRequest(BaseModel):
    image_base64: Optional[str] = Field(None, description="Base64-encoded cropped line image")
    image_url: Optional[str] = Field(None, description="URL or storage key of line image")
    language: str = Field("fa", description="Target language ('fa', 'ar', 'ota')")
    model_id: str = Field("trocr-base-persian-nastaliq", description="Model identifier")
    beam_width: int = Field(4, ge=1, le=10)
    temperature: float = Field(0.2, ge=0.0, le=1.0)

class BoundingBox(BaseModel):
    line_number: int
    ymin: int
    xmin: int
    ymax: int
    xmax: int
    text: str
    confidence: float

class PageRecognitionRequest(BaseModel):
    image_base64: Optional[str] = Field(None, description="Base64-encoded full page image")
    image_url: Optional[str] = Field(None, description="URL or storage key of page image")
    language: str = Field("fa", description="Target language ('fa', 'ar', 'ota')")
    model_id: str = Field("trocr-base-persian-nastaliq", description="Model identifier")
    detect_lines: bool = Field(True, description="Enable automatic line segmentation")

class RecognitionResponse(BaseModel):
    success: bool
    text: str
    confidence: float
    provider: str  # 'mock', 'pretrained', 'finetuned'
    is_mock: bool
    model_id: str
    model_version: str
    duration_ms: int
    lines: Optional[List[BoundingBox]] = None
