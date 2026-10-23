"""
Pydantic Schemas for Evaluation & Training Jobs
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class EvaluationPair(BaseModel):
    sample_id: str
    ground_truth: str
    hypothesis: str

class EvaluationRequest(BaseModel):
    model_id: str
    dataset_id: str
    language: str = "fa"
    pairs: List[EvaluationPair]
    normalize_text: bool = True

class EvaluationMetrics(BaseModel):
    cer: float
    wer: float
    total_samples: int
    total_chars: int
    total_words: int
    char_accuracy: float
    word_accuracy: float

class EvaluationResponse(BaseModel):
    success: bool
    model_id: str
    dataset_id: str
    metrics: EvaluationMetrics
    duration_ms: int

class TrainingRequest(BaseModel):
    base_model_id: str
    dataset_id: str
    learning_rate: float = Field(5e-5, gt=0, le=1e-2)
    batch_size: int = Field(16, ge=1, le=128)
    epochs: int = Field(10, ge=1, le=100)
    splits: List[str] = Field(default=["TRAIN", "VAL"])

class TrainingResponse(BaseModel):
    job_id: str
    status: str
    message: str
    hardware: str
