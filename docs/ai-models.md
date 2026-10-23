# Manuscript AI — AI Models, HTR Architecture & Evaluation

## 1. Supported Model Families

### A. TrOCR-Base Persian Nastaliq (`trocr-base-persian-nastaliq`)
- **Base Architecture**: Transformer-based Vision Encoder-Decoder (`microsoft/trocr-base-stage1`).
- **Encoder**: ViT (Vision Transformer) with patch size 16x16, receiving preprocessed line crops.
- **Decoder**: RoBERTa-style causal language model with custom Persian subword tokenizer.
- **Target Calligraphy**: Historical Persian Nastaliq and Shekasteh Nastaliq (15th–19th Century CE).
- **License**: Apache 2.0.
- **Pretrained Weights**: `./storage/models/trocr_persian_nastaliq_v1.2.pt`.

### B. HTR Classical Arabic Naskh (`htr-classical-arabic-naskh`)
- **Base Architecture**: ResNet-34 Feature Extractor + Bidirectional GRU + Connectionist Temporal Classification (CTC).
- **Target Calligraphy**: Classical Arabic Naskh, Thuluth, and Maghrebi scripts.
- **License**: MIT.
- **Pretrained Weights**: `./storage/models/htr_naskh_arabic_v2.pt`.

### C. Deterministic Mock Provider (`mock-dev-eval`)
- **Purpose**: Fast deterministic execution in hermetic CI test runners and local development without GPU access.
- **Contract Enforcement**: Returns `is_mock: true` and `provider: 'mock'` on every response. Never fabricates fake AI claims.

---

## 2. Historical Calligraphy Preprocessing

Persian and Arabic historical manuscripts feature unique challenges:
1. **Curved Baseline & Non-linear Baselines**: Nastaliq words cascade diagonally from top-right to bottom-left. Line segmentation must use polygon bounding envelopes rather than simple rectangular bounding boxes.
2. **Ligatures & Sub-words**: Multiple letters fuse into complex typographic ligatures (*Tarkib*).
3. **Parchment Aging & Ink Bleed-Through**: Contrast adaptive thresholding and Sauvola binarization are applied to suppress ink bleed from reverse folios.

---

## 3. Evaluation Metrics: CER & WER

The platform calculates exact Levenshtein edit distance:
- **Character Error Rate (CER)**:
  $$\text{CER} = \frac{S + D + I}{N}$$
  Where $S$ is substitutions, $D$ is deletions, $I$ is insertions, and $N$ is the total characters in the ground truth.
- **Word Error Rate (WER)**:
  $$\text{WER} = \frac{S_w + D_w + I_w}{N_w}$$
  Where substitutions, deletions, and insertions are calculated on space-delimited word tokens.
