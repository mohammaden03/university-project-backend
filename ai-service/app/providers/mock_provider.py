"""
Mock Deterministic AI Provider for Local Testing and Development

Strictly flags output as is_mock=True and provides deterministic results.
"""

from typing import List
from ..schemas.recognition import RecognitionResponse, BoundingBox

HISTORICAL_PERSIAN_CORPUS = [
    "به نام خداوند جان و خرد",
    "کزین برتر اندیشه برنگذرد",
    "خداوند نام و خداوند جای",
    "خداوند روزی ده رهنمای",
    "منت خدای را عز و جل که طاعتش موجب قربت است",
    "و به شکر اندرش مزید نعمت، هر نفسی که فرو می‌رود ممد حیات است",
    "بیا تا گل برافشانیم و می در ساغر اندازیم",
    "فلک را سقف بشکافیم و طرحی نو دراندازیم",
]

HISTORICAL_ARABIC_CORPUS = [
    "القول في حد الطب وموضوعه وغايته في المعالجة",
    "إن الطب علم يتعرف منه أحوال بدن الإنسان من جهة ما يصح ويزول عن الصحة",
    "بسم الله الرحمن الرحيم وبه نستعين",
    "الحمد لله رب العالمين والصلاة والسلام على رسوله الكريم",
]

class MockProvider:
    def __init__(self):
        self.provider_name = "mock"
        self.is_available = True

    def recognize_line(self, language: str = "fa", model_id: str = "mock-dev") -> RecognitionResponse:
        corpus = HISTORICAL_PERSIAN_CORPUS if language == "fa" else HISTORICAL_ARABIC_CORPUS
        text = corpus[0]
        return RecognitionResponse(
            success=True,
            text=text,
            confidence=0.965,
            provider="mock",
            is_mock=True,
            model_id=model_id,
            model_version="v1.0.0-mock",
            duration_ms=45,
            lines=[
                BoundingBox(
                    line_number=1,
                    ymin=100,
                    xmin=150,
                    ymax=250,
                    xmax=850,
                    text=text,
                    confidence=0.965
                )
            ]
        )

    def recognize_page(self, language: str = "fa", model_id: str = "mock-dev") -> RecognitionResponse:
        corpus = HISTORICAL_PERSIAN_CORPUS[:4] if language == "fa" else HISTORICAL_ARABIC_CORPUS[:4]
        full_text = "\n".join(corpus)
        lines = []
        for idx, line in enumerate(corpus):
            lines.append(
                BoundingBox(
                    line_number=idx + 1,
                    ymin=100 + (idx * 140),
                    xmin=160,
                    ymax=220 + (idx * 140),
                    xmax=840,
                    text=line,
                    confidence=0.97 - (idx * 0.01)
                )
            )

        return RecognitionResponse(
            success=True,
            text=full_text,
            confidence=0.962,
            provider="mock",
            is_mock=True,
            model_id=model_id,
            model_version="v1.0.0-mock",
            duration_ms=120,
            lines=lines
        )
