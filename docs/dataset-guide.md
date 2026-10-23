# Manuscript AI — Dataset Manifest & Corpus Guide

## 1. CSV Manifest Specification

Dataset manifests must be UTF-8 encoded CSV files containing the following required columns:

| Column | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `sample_id` | String | Yes | Unique sample identifier (e.g., `smp_phmc_00123`) |
| `image_path` | String | Yes | Path relative to dataset archive root (no `..` or absolute paths) |
| `transcription` | String | Yes | UTF-8 Persian/Arabic ground truth text |
| `language` | String | Yes | Language code (`fa`, `ar`, `ota`) |
| `book_id` | String | No | Source manuscript book reference |
| `manuscript_id` | String | No | Shelfmark / catalog number (e.g. `MS. Or. 5319`) |
| `page_number` | Integer | No | Page or folio sequence index |
| `line_id` | String | No | Line number or segment ID |
| `split` | String | Yes | Split partition: `TRAIN`, `VAL`, or `TEST` |
| `source` | String | No | Sponsoring library or institution |
| `license` | String | No | Dataset copyright / academic reuse license |
| `annotation_status` | String | No | Status (`VERIFIED`, `UNCHECKED`, `DISPUTED`) |

### Example Manifest Snippet
```csv
sample_id,image_path,transcription,language,manuscript_id,split,annotation_status
smp_001,images/f01b_ln1.jpg,به نام خداوند جان و خرد,fa,MS. Houghton 1970,TRAIN,VERIFIED
smp_002,images/f01b_ln2.jpg,کزین برتر اندیشه برنگذرد,fa,MS. Houghton 1970,TRAIN,VERIFIED
smp_003,images/f01b_ln3.jpg,خداوند نام و خداوند جای,fa,MS. Houghton 1970,VAL,VERIFIED
smp_004,images/f01b_ln4.jpg,خداوند روزی ده رهنمای,fa,MS. Houghton 1970,TEST,VERIFIED
```

---

## 2. Preventing Data Leakage via Group-Based Splitting

In historical manuscript HTR, **never perform random row-based splitting** across lines of the same page or scribe. 
- **Scribe & Page Correlation**: Handwritings from the same manuscript share ink consistency, pen angle, and paper texture.
- **Group Splitting Rule**: Datasets must group by `manuscript_id` or `book_id`, placing entire manuscripts or isolated gatherings into either `TRAIN`, `VAL`, or `TEST` partitions.
