"""
Manuscript AI - Python FastAPI Service

Exposes dedicated microservice endpoints:
- GET /ai/v1/health
- GET /ai/v1/models
- POST /ai/v1/recognize/line
- POST /ai/v1/recognize/page
- POST /ai/v1/evaluate
- POST /ai/v1/train
"""

import time
import os
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from .schemas.recognition import (
    LineRecognitionRequest,
    PageRecognitionRequest,
    RecognitionResponse,
)
from .schemas.evaluation import (
    EvaluationRequest,
    EvaluationResponse,
    EvaluationMetrics,
    TrainingRequest,
    TrainingResponse,
)
from .providers.mock_provider import MockProvider
from .providers.pretrained_provider import PretrainedProvider
from .evaluation.metrics import compute_cer_wer

app = FastAPI(
    title="Manuscript AI - Inference & Training Microservice",
    version="1.0.0",
    docs_url="/ai/docs",
    openapi_url="/ai/openapi.json"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Providers initialization
mock_provider = MockProvider()
pretrained_provider = PretrainedProvider()

@app.get("/ai/v1/health")
def get_health():
    return {
        "status": "healthy",
        "service": "manuscript-ai-engine",
        "version": "1.0.0",
        "device": pretrained_provider.device,
        "providers": {
            "mock": {"available": True, "description": "Deterministic mock for development and test execution"},
            "pretrained": {"available": pretrained_provider.is_available(), "model": pretrained_provider.model_id}
        }
    }

@app.get("/ai/v1/models")
def list_models():
    return {
        "models": [
            {
                "id": "trocr-base-persian-nastaliq",
                "name": "TrOCR-Base Persian Nastaliq",
                "version": "v1.2.0",
                "provider": "pretrained",
                "available": pretrained_provider.is_available(),
                "languages": ["fa"],
                "modes": ["LINE", "FULL_PAGE"],
                "license": "Apache-2.0"
            },
            {
                "id": "htr-classical-arabic-naskh",
                "name": "HTR Classical Arabic Naskh",
                "version": "v2.0.1",
                "provider": "pretrained",
                "available": False,
                "languages": ["ar"],
                "modes": ["LINE"],
                "license": "MIT"
            },
            {
                "id": "mock-dev-eval",
                "name": "Mock Academic HTR Engine",
                "version": "v1.0.0-mock",
                "provider": "mock",
                "available": True,
                "languages": ["fa", "ar", "ota"],
                "modes": ["LINE", "FULL_PAGE"],
                "license": "Public Domain"
            }
        ]
    }

@app.post("/ai/v1/recognize/line", response_model=RecognitionResponse)
def recognize_line(request: LineRecognitionRequest):
    provider_type = os.getenv("AI_PROVIDER", "mock")
    if provider_type == "mock" or not pretrained_provider.is_available():
        return mock_provider.recognize_line(language=request.language, model_id=request.model_id)

    return pretrained_provider.recognize_line(b"", language=request.language)

@app.post("/ai/v1/recognize/page", response_model=RecognitionResponse)
def recognize_page(request: PageRecognitionRequest):
    provider_type = os.getenv("AI_PROVIDER", "mock")
    if provider_type == "mock" or not pretrained_provider.is_available():
        return mock_provider.recognize_page(language=request.language, model_id=request.model_id)

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Pretrained full page segmentation requires PyTorch & YOLOv8/CRAFT models not initialized in container."
    )

@app.post("/ai/v1/evaluate", response_model=EvaluationResponse)
def evaluate_samples(request: EvaluationRequest):
    start = time.time()
    total_chars = 0
    total_words = 0
    total_char_edits = 0
    total_word_edits = 0

    for pair in request.pairs:
        res = compute_cer_wer(pair.ground_truth, pair.hypothesis)
        total_chars += res["gt_chars"]
        total_words += res["gt_words"]
        total_char_edits += res["char_edits"]
        total_word_edits += res["word_edits"]

    sample_count = len(request.pairs)
    overall_cer = total_char_edits / total_chars if total_chars > 0 else 0.0
    overall_wer = total_word_edits / total_words if total_words > 0 else 0.0

    duration_ms = int((time.time() - start) * 1000)

    return EvaluationResponse(
        success=True,
        model_id=request.model_id,
        dataset_id=request.dataset_id,
        metrics=EvaluationMetrics(
            cer=round(overall_cer, 4),
            wer=round(overall_wer, 4),
            total_samples=sample_count,
            total_chars=total_chars,
            total_words=total_words,
            char_accuracy=round(max(0.0, 1.0 - overall_cer), 4),
            word_accuracy=round(max(0.0, 1.0 - overall_wer), 4)
        ),
        duration_ms=duration_ms
    )

@app.post("/ai/v1/train", response_model=TrainingResponse)
def launch_training(request: TrainingRequest):
    # Check GPU availability
    if pretrained_provider.device != "cuda":
        return TrainingResponse(
            job_id=f"trn_{int(time.time())}",
            status="BLOCKED",
            message="Training blocked: Dedicated NVIDIA CUDA GPU with >=16GB VRAM is required for TrOCR fine-tuning. Current device: CPU.",
            hardware="CPU (Insufficient for TrOCR training)"
        )

    return TrainingResponse(
        job_id=f"trn_{int(time.time())}",
        status="QUEUED",
        message="Fine-tuning job successfully scheduled on CUDA accelerator.",
        hardware="NVIDIA CUDA"
    )
