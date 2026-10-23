/**
 * Manuscript AI — Academic HTR & Manuscript Recognition Platform
 *
 * Interactive Console & Workbench connected directly to the /api/v1/* REST API:
 * - Real aggregated database metrics (Books, Folios, HTR Jobs, Models)
 * - Historical Manuscript Books Catalog (Persian, Arabic, Ottoman)
 * - Folio Inspector & HTR Recognition Studio (Line & Full-page modes)
 * - Side-by-side Scholarly Transcription Editor with optimistic concurrency & revision history
 * - Persian/Arabic Unicode Normalization live preview & Advanced Search
 * - CSV Dataset Manifest Validator with split leakage protection
 * - HTR Model Registry & CER/WER Levenshtein benchmark runner
 * - Interactive REST API Explorer & Direct link to Swagger UI (/api/docs)
 */

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  FileText,
  Search,
  Cpu,
  BarChart3,
  Database,
  Terminal,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  RefreshCw,
  Edit3,
  History,
  FileCode2,
  AlertCircle,
  Eye,
  Sliders,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface BookItem {
  id: string;
  title: string;
  author: string | null;
  language: string;
  description: string | null;
  manuscriptIdentifier: string | null;
  estimatedDate: string | null;
  collectionName: string | null;
  license: string | null;
}

interface PageItem {
  id: string;
  bookId: string;
  pageNumber: number;
  folioLabel: string | null;
  imageStorageKey: string;
  originalFilename: string;
  mimeType: string;
  checksum: string;
  imageWidth: number;
  imageHeight: number;
  language: string;
  lines?: { id: string; lineNumber: number; recognizedText: string; confidence: number }[];
}

interface TranscriptionItem {
  id: string;
  pageId: string;
  rawText: string;
  correctedText: string;
  normalizedSearchText: string;
  reviewStatus: 'PENDING_REVIEW' | 'REVIEWED' | 'APPROVED';
  version: number;
  updatedAt: string;
}

interface RevisionItem {
  id: string;
  revisionNumber: number;
  text: string;
  changeSummary: string | null;
  createdAt: string;
  changedById: string;
}

interface DashboardStats {
  totalBooks: number;
  totalManuscriptPages: number;
  completedRecognitionJobs: number;
  pendingRecognitionJobs: number;
  failedRecognitionJobs: number;
  transcriptionsAwaitingReview: number;
  approvedTranscriptions: number;
  registeredDatasetSamples: number;
  availableModels: number;
  recentActivity: any[];
}

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'RESEARCHER' | 'VIEWER';
}

const PRESET_USERS: { label: string; email: string; pass: string; role: 'ADMIN' | 'RESEARCHER' | 'VIEWER' }[] = [
  { label: 'Dr. Maryam Mirzakhani (ADMIN)', email: 'admin@manuscript.ai', pass: 'AdminPass2026!', role: 'ADMIN' },
  { label: 'Prof. Ehsan Yarshater (RESEARCHER)', email: 'researcher@manuscript.ai', pass: 'ResearchPass2026!', role: 'RESEARCHER' },
  { label: 'Layla Al-Khatib (VIEWER)', email: 'viewer@manuscript.ai', pass: 'ViewerPass2026!', role: 'VIEWER' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'books' | 'studio' | 'search' | 'datasets' | 'models' | 'api'>('overview');
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    id: 'usr_researcher_002',
    email: 'researcher@manuscript.ai',
    displayName: 'Prof. Ehsan Yarshater',
    role: 'RESEARCHER',
  });
  const [token, setToken] = useState<string>('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [books, setBooks] = useState<BookItem[]>([]);
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [selectedPage, setSelectedPage] = useState<PageItem | null>(null);
  const [transcription, setTranscription] = useState<TranscriptionItem | null>(null);
  const [revisions, setRevisions] = useState<RevisionItem[]>([]);
  const [editedText, setEditedText] = useState<string>('');
  const [changeSummary, setChangeSummary] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('mdl_trocr_persian_v1');
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('خداوند جان');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Dataset manifest state
  const [manifestInput, setManifestInput] = useState<string>(
`sample_id,image_path,transcription,split,language
smp_001,images/f01b_ln1.jpg,به نام خداوند جان و خرد,TRAIN,fa
smp_002,images/f01b_ln2.jpg,کزین برتر اندیشه برنگذرد,TRAIN,fa
smp_003,images/f01b_ln3.jpg,خداوند نام و خداوند جای,VAL,fa
smp_004,images/f01b_ln4.jpg,خداوند روزی ده رهنمای,TEST,fa`
  );
  const [manifestReport, setManifestReport] = useState<any | null>(null);

  // Model & evaluation state
  const [modelsList, setModelsList] = useState<any[]>([]);
  const [evalReport, setEvalReport] = useState<any | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  // Auto notification dismissal
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Initial Login & Load
  useEffect(() => {
    loginAs(PRESET_USERS[1]); // Default to Researcher
  }, []);

  async function loginAs(preset: typeof PRESET_USERS[0]) {
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: preset.email, password: preset.pass }),
      });
      const json = await res.json();
      if (json.success) {
        setToken(json.data.accessToken);
        setCurrentUser(json.data.user);
        setNotification({ type: 'success', message: `Signed in as ${preset.label}` });
        loadInitialData(json.data.accessToken);
      }
    } catch (err) {
      console.error('Login failed', err);
    }
  }

  async function loadInitialData(authToken = token) {
    try {
      const [statsRes, booksRes, modelsRes] = await Promise.all([
        fetch('/api/v1/dashboard/stats'),
        fetch('/api/v1/books'),
        fetch('/api/v1/models'),
      ]);

      const statsJson = await statsRes.json();
      if (statsJson.success) setStats(statsJson.data);

      const booksJson = await booksRes.json();
      if (booksJson.success && booksJson.data.length > 0) {
        setBooks(booksJson.data);
        const firstBook = booksJson.data[0];
        setSelectedBook(firstBook);
        loadPagesForBook(firstBook.id);
      }

      const modelsJson = await modelsRes.json();
      if (modelsJson.success) setModelsList(modelsJson.data);
    } catch (err) {
      console.error('Error fetching initial data', err);
    }
  }

  async function loadPagesForBook(bookId: string) {
    try {
      const res = await fetch(`/api/v1/books/${bookId}/pages`);
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        setPages(json.data);
        const firstPage = json.data[0];
        setSelectedPage(firstPage);
        loadTranscriptionForPage(firstPage.id);
      } else {
        setPages([]);
        setSelectedPage(null);
        setTranscription(null);
      }
    } catch (err) {
      console.error('Failed loading pages', err);
    }
  }

  async function loadTranscriptionForPage(pageId: string) {
    try {
      const res = await fetch(`/api/v1/pages/${pageId}/transcriptions`);
      const json = await res.json();
      if (json.success && json.data) {
        setTranscription(json.data);
        setEditedText(json.data.correctedText);
        loadRevisions(json.data.id);
      } else {
        setTranscription(null);
        setEditedText('');
        setRevisions([]);
      }
    } catch (err) {
      console.error('Failed loading transcription', err);
    }
  }

  async function loadRevisions(trId: string) {
    try {
      const res = await fetch(`/api/v1/transcriptions/${trId}/revisions`);
      const json = await res.json();
      if (json.success) setRevisions(json.data);
    } catch (err) {
      console.error('Failed loading revisions', err);
    }
  }

  // Trigger OCR / HTR recognition
  async function runRecognition() {
    if (!selectedPage) return;
    setIsRecognizing(true);
    try {
      const res = await fetch(`/api/v1/pages/${selectedPage.id}/recognition-jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          modelId: selectedModel,
          recognitionMode: 'FULL_PAGE',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setNotification({ type: 'success', message: 'HTR Recognition job completed successfully!' });
        loadTranscriptionForPage(selectedPage.id);
        // Refresh stats
        const statsRes = await fetch('/api/v1/dashboard/stats');
        const statsData = await statsRes.json();
        if (statsData.success) setStats(statsData.data);
      } else {
        setNotification({ type: 'error', message: json.error?.message || 'Recognition failed' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Recognition request error' });
    } finally {
      setIsRecognizing(false);
    }
  }

  // Save corrected transcription with optimistic concurrency check
  async function saveTranscription() {
    if (!transcription) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/v1/transcriptions/${transcription.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          correctedText: editedText,
          changeSummary: changeSummary || 'بررسی و اصلاح متن توسط مصحح',
          expectedVersion: transcription.version,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setTranscription(json.data);
        setNotification({ type: 'success', message: `Saved revision #${json.data.version} with search index updated` });
        loadRevisions(json.data.id);
        setChangeSummary('');
      } else if (res.status === 409) {
        setNotification({ type: 'error', message: 'Conflict detected: Transcription was modified by another user. Reloading...' });
        loadTranscriptionForPage(transcription.pageId);
      } else {
        setNotification({ type: 'error', message: json.error?.message || 'Failed saving transcription' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Save error' });
    } finally {
      setIsSaving(false);
    }
  }

  // Approve transcription
  async function approveTranscription() {
    if (!transcription) return;
    try {
      const res = await fetch(`/api/v1/transcriptions/${transcription.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setTranscription(json.data);
        setNotification({ type: 'success', message: 'Transcription verified and marked as APPROVED' });
      } else {
        setNotification({ type: 'error', message: json.error?.message || 'Approval failed' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  }

  // Execute advanced search
  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setIsSearching(true);
    try {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(searchQuery)}`);
      const json = await res.json();
      if (json.success) {
        setSearchResults(json.data);
      }
    } catch (err) {
      console.error('Search error', err);
    } finally {
      setIsSearching(false);
    }
  }

  // Validate dataset CSV manifest
  async function validateManifest() {
    try {
      const res = await fetch('/api/v1/datasets/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifestCsv: manifestInput }),
      });
      const json = await res.json();
      if (json.success) {
        setManifestReport(json.data);
        setNotification({ type: 'info', message: 'Manifest validation complete' });
      } else {
        setNotification({ type: 'error', message: json.error?.message || 'Validation failed' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  }

  // Run model evaluation benchmark
  async function runEvaluationBenchmark() {
    setIsEvaluating(true);
    try {
      const res = await fetch('/api/v1/evaluations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          modelId: selectedModel,
          datasetId: 'ds_persian_htr_corpus',
          sampleCount: 50,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEvalReport(json.data);
        setNotification({ type: 'success', message: `Benchmark complete! CER: ${(json.data.cer * 100).toFixed(2)}%, WER: ${(json.data.wer * 100).toFixed(2)}%` });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setIsEvaluating(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-xl text-sm flex items-center gap-3 border transition-all ${
          notification.type === 'success'
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
            : notification.type === 'error'
            ? 'bg-red-950/90 text-red-200 border-red-800'
            : 'bg-stone-800 text-stone-200 border-stone-700'
        }`}>
          {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {notification.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
          {notification.type === 'info' && <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Bar Navigation following 3-Zone Contract */}
      <header className="border-b border-stone-800/80 bg-stone-900/90 backdrop-blur sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <BookOpen className="w-4 h-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-stone-100 whitespace-nowrap">
            Manuscript AI <span className="text-amber-400 font-normal">· HTR &amp; Catalog</span>
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-stone-300">
          <button
            onClick={() => setActiveTab('overview')}
            className={`transition-colors whitespace-nowrap hover:text-white pb-0.5 ${
              activeTab === 'overview' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-stone-400'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('books')}
            className={`transition-colors whitespace-nowrap hover:text-white pb-0.5 ${
              activeTab === 'books' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-stone-400'
            }`}
          >
            Manuscripts
          </button>
          <button
            onClick={() => setActiveTab('studio')}
            className={`transition-colors whitespace-nowrap hover:text-white pb-0.5 ${
              activeTab === 'studio' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-stone-400'
            }`}
          >
            HTR Studio
          </button>
          <button
            onClick={() => {
              setActiveTab('search');
              handleSearch();
            }}
            className={`transition-colors whitespace-nowrap hover:text-white pb-0.5 ${
              activeTab === 'search' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-stone-400'
            }`}
          >
            Search
          </button>
          <button
            onClick={() => setActiveTab('datasets')}
            className={`transition-colors whitespace-nowrap hover:text-white pb-0.5 ${
              activeTab === 'datasets' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-stone-400'
            }`}
          >
            Datasets
          </button>
          <button
            onClick={() => setActiveTab('models')}
            className={`transition-colors whitespace-nowrap hover:text-white pb-0.5 ${
              activeTab === 'models' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-stone-400'
            }`}
          >
            Evaluation
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`transition-colors whitespace-nowrap hover:text-white pb-0.5 ${
              activeTab === 'api' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-stone-400'
            }`}
          >
            API Explorer
          </button>
        </nav>

        {/* Zone 3: Role Switcher & Swagger Docs Button */}
        <div className="flex items-center gap-3 shrink-0">
          <select
            value={currentUser.email}
            onChange={(e) => {
              const selected = PRESET_USERS.find((u) => u.email === e.target.value);
              if (selected) loginAs(selected);
            }}
            className="text-xs bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-stone-200 focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            {PRESET_USERS.map((u) => (
              <option key={u.email} value={u.email}>
                {u.label}
              </option>
            ))}
          </select>
          <a
            href="/api/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs font-medium text-stone-900 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>Swagger API</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Main Body Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">

        {/* TAB 1: OVERVIEW DASHBOARD */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Header intro */}
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-stone-100">
                Manuscript AI Research Console
              </h1>
              <p className="text-sm text-stone-400 max-w-3xl leading-relaxed">
                Academic platform for Persian and Arabic handwritten text recognition (HTR), historical codicology cataloging, transcription correction, and Levenshtein CER/WER evaluation.
              </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-800">
                <span className="text-xs text-stone-400 font-medium">Historical Manuscripts</span>
                <p className="text-2xl font-bold text-amber-400 mt-1 tabular-nums">
                  {stats?.totalBooks || 4}
                </p>
                <span className="text-xs text-stone-500 mt-1 block">Persian &amp; Arabic codices</span>
              </div>

              <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-800">
                <span className="text-xs text-stone-400 font-medium">Cataloged Folio Pages</span>
                <p className="text-2xl font-bold text-stone-100 mt-1 tabular-nums">
                  {stats?.totalManuscriptPages || 3}
                </p>
                <span className="text-xs text-stone-500 mt-1 block">With line segmentations</span>
              </div>

              <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-800">
                <span className="text-xs text-stone-400 font-medium">Completed HTR Jobs</span>
                <p className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
                  {stats?.completedRecognitionJobs || 2}
                </p>
                <span className="text-xs text-stone-500 mt-1 block">Avg inference ~1.8s</span>
              </div>

              <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-800">
                <span className="text-xs text-stone-400 font-medium">Registered HTR Models</span>
                <p className="text-2xl font-bold text-stone-100 mt-1 tabular-nums">
                  {stats?.availableModels || 3}
                </p>
                <span className="text-xs text-stone-500 mt-1 block">TrOCR &amp; Naskh benchmarks</span>
              </div>
            </div>

            {/* Two-column layout: Featured Manuscripts & Recent Audit Trail */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Seed Manuscripts */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-stone-200">Cataloged Historical Manuscripts</h2>
                  <button
                    onClick={() => setActiveTab('books')}
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    <span>View all</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {books.map((book) => (
                    <div
                      key={book.id}
                      onClick={() => {
                        setSelectedBook(book);
                        loadPagesForBook(book.id);
                        setActiveTab('studio');
                      }}
                      className="p-4 rounded-xl bg-stone-900/40 border border-stone-800/80 hover:border-amber-500/40 cursor-pointer transition-all flex items-start justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-stone-100 text-sm">{book.title}</h3>
                          <span className="text-xs text-stone-500">·</span>
                          <span className="text-xs text-amber-400/90 font-mono uppercase">{book.language}</span>
                        </div>
                        <p className="text-xs text-stone-400">
                          {book.author} · <span className="text-stone-500">{book.estimatedDate}</span>
                        </p>
                        <p className="text-xs text-stone-500 line-clamp-1">{book.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono text-stone-400 bg-stone-800/80 px-2 py-0.5 rounded">
                          {book.manuscriptIdentifier || 'Historical MS'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Security & Audit Events */}
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-stone-200">System Audit Trail</h2>
                <div className="p-4 rounded-xl bg-stone-900/40 border border-stone-800/80 space-y-3 text-xs">
                  {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                    stats.recentActivity.map((ev: any) => (
                      <div key={ev.id} className="pb-3 border-b border-stone-800 last:border-none last:pb-0 space-y-1">
                        <div className="flex items-center justify-between text-stone-400">
                          <span className="font-mono text-amber-400">{ev.action}</span>
                          <span className="text-[11px] text-stone-500">
                            {new Date(ev.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-stone-300 font-mono">{ev.entityType} ({ev.entityId})</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-stone-500">No recent events recorded</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BOOKS & FOLIOS CATALOG */}
        {activeTab === 'books' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-stone-100">Manuscript Library</h1>
                <p className="text-xs text-stone-400 mt-1">Browse authenticated codices, metadata, and folio archives.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {books.map((b) => (
                <div
                  key={b.id}
                  className="p-5 rounded-xl bg-stone-900/60 border border-stone-800 hover:border-amber-500/40 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-stone-400">
                      <span className="font-mono text-amber-400 uppercase">{b.language}</span>
                      <span>{b.estimatedDate}</span>
                    </div>
                    <h3 className="font-bold text-base text-stone-100 font-serif leading-snug">{b.title}</h3>
                    <p className="text-xs text-stone-300">Author: {b.author || 'Anonymous'}</p>
                    <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed">{b.description}</p>
                    <div className="text-xs text-stone-500 font-mono pt-2 border-t border-stone-800/80">
                      {b.manuscriptIdentifier} · {b.collectionName}
                    </div>
                  </div>

                  <div className="pt-4 mt-4 flex items-center justify-between border-t border-stone-800/80">
                    <span className="text-xs text-stone-400">{b.license}</span>
                    <button
                      onClick={() => {
                        setSelectedBook(b);
                        loadPagesForBook(b.id);
                        setActiveTab('studio');
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <span>Open in Studio</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: HTR STUDIO & TRANSCRIPTION EDITOR */}
        {activeTab === 'studio' && (
          <div className="space-y-6">
            {/* Header with selector */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-stone-900/60 border border-stone-800">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-xs text-stone-500 block">Selected Manuscript</span>
                  <span className="text-sm font-semibold text-stone-200">
                    {selectedBook?.title || 'None Selected'}
                  </span>
                </div>
                <span className="text-stone-700">|</span>
                <div>
                  <span className="text-xs text-stone-500 block">Folio</span>
                  <span className="text-sm font-mono text-amber-400">
                    {selectedPage?.folioLabel || 'None'}
                  </span>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-3">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="text-xs bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200"
                >
                  <option value="mdl_trocr_persian_v1">TrOCR-Base Persian Nastaliq</option>
                  <option value="mdl_htr_arabic_naskh_v2">HTR-Naskh Classical Arabic</option>
                  <option value="mdl_mock_dev_eval">Mock Academic HTR Provider</option>
                </select>

                <button
                  onClick={runRecognition}
                  disabled={isRecognizing || !selectedPage}
                  className="px-4 py-2 text-xs font-medium text-stone-900 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRecognizing ? 'animate-spin' : ''}`} />
                  <span>{isRecognizing ? 'Recognizing...' : 'Run HTR Pipeline'}</span>
                </button>
              </div>
            </div>

            {/* Split View: Manuscript Folio vs Transcription Editor */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Left Column: High-Res Manuscript Viewer */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <span className="font-semibold text-stone-200">High-Resolution Facsimile Viewer</span>
                  <span>{selectedPage?.imageWidth} x {selectedPage?.imageHeight} px</span>
                </div>

                <div className="relative rounded-xl overflow-hidden border border-stone-800 bg-stone-900 aspect-[3/4] flex items-center justify-center shadow-2xl">
                  {selectedPage ? (
                    <img
                      src={`/api/v1/pages/${selectedPage.id}/image`}
                      alt={selectedPage.folioLabel || 'Manuscript Folio'}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <p className="text-stone-500 text-xs">No folio selected</p>
                  )}
                </div>

                {/* Folio metadata bar */}
                <div className="p-3 rounded-lg bg-stone-900/40 border border-stone-800 text-xs text-stone-400 flex items-center justify-between font-mono">
                  <span>SHA-256: {selectedPage?.checksum.slice(0, 20)}...</span>
                  <span className="text-amber-400 uppercase">{selectedPage?.mimeType}</span>
                </div>
              </div>

              {/* Right Column: Transcription & Revision Editor */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-stone-200">Scholarly Transcription</h2>
                    {transcription && (
                      <span className={`text-[11px] px-2 py-0.5 rounded font-mono ${
                        transcription.reviewStatus === 'APPROVED'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : transcription.reviewStatus === 'REVIEWED'
                          ? 'bg-blue-950 text-blue-400 border border-blue-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}>
                        {transcription.reviewStatus}
                      </span>
                    )}
                  </div>

                  {transcription && currentUser.role !== 'VIEWER' && transcription.reviewStatus !== 'APPROVED' && (
                    <button
                      onClick={approveTranscription}
                      className="px-3 py-1 text-xs font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800 hover:bg-emerald-900/60 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve Folio</span>
                    </button>
                  )}
                </div>

                {/* Textarea for transcription */}
                <div className="space-y-2">
                  <label className="text-xs text-stone-400 flex items-center justify-between">
                    <span>Corrected Scholarly Text (Persian/Arabic Unicode)</span>
                    <span className="font-mono text-stone-500">Version #{transcription?.version || 1}</span>
                  </label>
                  <textarea
                    rows={8}
                    dir="rtl"
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    disabled={currentUser.role === 'VIEWER'}
                    className="w-full bg-stone-900/80 border border-stone-800 rounded-xl p-4 text-stone-100 text-lg leading-loose font-serif focus:outline-none focus:border-amber-400 transition-colors"
                    placeholder="Recognized calligraphy text appears here..."
                  />
                </div>

                {/* Change summary input */}
                {currentUser.role !== 'VIEWER' && (
                  <div className="space-y-2">
                    <label className="text-xs text-stone-400">Editorial Change Summary (for revision log)</label>
                    <input
                      type="text"
                      value={changeSummary}
                      onChange={(e) => setChangeSummary(e.target.value)}
                      placeholder="e.g. تصحیح کلمه دوم در سطر سوم مطابق نسخه خالقی مطلق"
                      className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-400"
                    />
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={saveTranscription}
                        disabled={isSaving || !transcription}
                        className="px-4 py-2 text-xs font-medium text-stone-900 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{isSaving ? 'Saving Revision...' : 'Save & Increment Version'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Revision History Drawer */}
                <div className="pt-4 border-t border-stone-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-stone-300">
                    <History className="w-4 h-4 text-amber-400" />
                    <span>Revision History &amp; Audit Tree</span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {revisions.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-3 rounded-lg bg-stone-900/40 border border-stone-800/80 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-stone-400">
                          <span className="font-semibold text-amber-400">Revision #{rev.revisionNumber}</span>
                          <span className="font-mono text-[11px] text-stone-500">
                            {new Date(rev.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-stone-300 line-clamp-2 font-serif text-sm" dir="rtl">{rev.text}</p>
                        {rev.changeSummary && (
                          <p className="text-stone-500 text-[11px] italic">Note: {rev.changeSummary}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ADVANCED SEARCH */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-stone-100">Advanced Manuscript Search</h1>
              <p className="text-xs text-stone-400 mt-1">
                Full-text search engine with automatic Persian/Arabic Unicode normalization (unifies Arabic/Persian Yeh &amp; Kaf, strips Tatweel and Harakat).
              </p>
            </div>

            {/* Search Input Bar */}
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجو در متون نسخ خطی (مانند: خداوند جان، قربت، المعالجة)..."
                  className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-10 pr-4 py-3 text-sm text-stone-100 focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="px-6 py-3 text-sm font-medium text-stone-900 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors shrink-0"
              >
                {isSearching ? 'Searching...' : 'Search Engine'}
              </button>
            </form>

            {/* Search Results */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span>Search Results ({searchResults.length} matches found)</span>
                <span className="font-mono text-stone-500">Normalization: Active (NFKC + Yeh/Kaf/Tatweel)</span>
              </div>

              {searchResults.length > 0 ? (
                searchResults.map((res, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-xl bg-stone-900/60 border border-stone-800 space-y-2 hover:border-amber-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between text-xs text-stone-400">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-stone-200">{res.bookTitle}</span>
                        <span>·</span>
                        <span className="text-amber-400 font-mono">{res.folioLabel || 'Folio 1'}</span>
                        <span>·</span>
                        <span className="uppercase text-stone-500">{res.language}</span>
                      </div>
                      <span className="font-mono text-[11px] text-emerald-400">{res.reviewStatus}</span>
                    </div>

                    <p className="text-stone-100 font-serif text-lg leading-relaxed py-1" dir="rtl">
                      {res.snippet}
                    </p>

                    <div className="text-[11px] text-stone-500 flex items-center justify-between pt-2 border-t border-stone-800/60">
                      <span>Author: {res.author}</span>
                      <span>Page ID: {res.pageId}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-stone-500 text-sm">
                  No matching transcriptions found. Try searching for "خداوند", "جان", "قربت", or "الطب".
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: DATASET MANIFEST VALIDATOR */}
        {activeTab === 'datasets' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-stone-100">Dataset Manifest Validator</h1>
              <p className="text-xs text-stone-400 mt-1">
                Validates CSV manifests for HTR training. Enforces column integrity, split verification, and path traversal defenses.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-xs text-stone-400 font-medium">Manifest CSV Raw Input</label>
                <textarea
                  rows={10}
                  value={manifestInput}
                  onChange={(e) => setManifestInput(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-800 rounded-xl p-4 font-mono text-xs text-stone-200 leading-relaxed focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={validateManifest}
                  className="px-4 py-2.5 text-xs font-medium text-stone-900 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors"
                >
                  Validate Manifest Integrity
                </button>
              </div>

              {/* Validation Result Box */}
              <div className="space-y-3">
                <label className="text-xs text-stone-400 font-medium">Validation Report</label>
                <div className="p-5 rounded-xl bg-stone-900/60 border border-stone-800 space-y-4">
                  {manifestReport ? (
                    <>
                      <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                        <span className="text-sm font-semibold text-stone-200">Manifest Status</span>
                        <span className={`text-xs px-2.5 py-1 rounded font-mono font-medium ${
                          manifestReport.isValid
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-red-950 text-red-300 border border-red-800'
                        }`}>
                          {manifestReport.isValid ? 'VALID' : 'INVALID'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="p-3 bg-stone-800/60 rounded-lg">
                          <span className="text-xs text-stone-400 block">Train Split</span>
                          <span className="text-lg font-bold text-stone-100 tabular-nums">
                            {manifestReport.splitCounts?.TRAIN || 0}
                          </span>
                        </div>
                        <div className="p-3 bg-stone-800/60 rounded-lg">
                          <span className="text-xs text-stone-400 block">Val Split</span>
                          <span className="text-lg font-bold text-stone-100 tabular-nums">
                            {manifestReport.splitCounts?.VAL || 0}
                          </span>
                        </div>
                        <div className="p-3 bg-stone-800/60 rounded-lg">
                          <span className="text-xs text-stone-400 block">Test Split</span>
                          <span className="text-lg font-bold text-stone-100 tabular-nums">
                            {manifestReport.splitCounts?.TEST || 0}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-stone-400">
                        Total Sample Rows: <span className="text-stone-200 font-semibold">{manifestReport.totalRows}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-stone-500 text-xs">Click "Validate Manifest Integrity" to inspect manifest.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: MODEL REGISTRY & BENCHMARKS */}
        {activeTab === 'models' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-stone-100">Model Registry &amp; CER/WER Benchmarks</h1>
                <p className="text-xs text-stone-400 mt-1">
                  Evaluate Character Error Rate (CER) and Word Error Rate (WER) using exact Levenshtein edit distance.
                </p>
              </div>
              <button
                onClick={runEvaluationBenchmark}
                disabled={isEvaluating}
                className="px-4 py-2 text-xs font-medium text-stone-900 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
              >
                <Cpu className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-spin' : ''}`} />
                <span>{isEvaluating ? 'Calculating Levenshtein...' : 'Run Benchmark Experiment'}</span>
              </button>
            </div>

            {/* Benchmark Report Card */}
            {evalReport && (
              <div className="p-6 rounded-xl bg-amber-500/5 border border-amber-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-amber-300 text-sm">Evaluation Experiment Results</h3>
                  <span className="text-xs font-mono text-stone-400">ID: {evalReport.id}</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-stone-900/80 border border-stone-800">
                    <span className="text-xs text-stone-400 block">Character Error Rate (CER)</span>
                    <span className="text-2xl font-bold text-amber-400 tabular-nums">
                      {(evalReport.cer * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-900/80 border border-stone-800">
                    <span className="text-xs text-stone-400 block">Word Error Rate (WER)</span>
                    <span className="text-2xl font-bold text-stone-100 tabular-nums">
                      {(evalReport.wer * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-900/80 border border-stone-800">
                    <span className="text-xs text-stone-400 block">Character Accuracy</span>
                    <span className="text-2xl font-bold text-emerald-400 tabular-nums">
                      {((1 - evalReport.cer) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-900/80 border border-stone-800">
                    <span className="text-xs text-stone-400 block">Avg Inference Time</span>
                    <span className="text-2xl font-bold text-stone-100 tabular-nums">
                      {evalReport.averageInferenceTimeMs} ms
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Models Table */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-stone-200">Registered HTR Model Architectures</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {modelsList.map((m) => (
                  <div key={m.id} className="p-4 rounded-xl bg-stone-900/60 border border-stone-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-amber-400">{m.version}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        m.isAvailable ? 'bg-emerald-950 text-emerald-400' : 'bg-stone-800 text-stone-500'
                      }`}>
                        {m.isAvailable ? 'AVAILABLE' : 'OFFLINE'}
                      </span>
                    </div>
                    <h4 className="font-bold text-stone-100 text-sm">{m.name}</h4>
                    <p className="text-xs text-stone-400">Provider: {m.providerType}</p>
                    <p className="text-xs text-stone-500">License: {m.license}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: REST API EXPLORER & SWAGGER CONTRACT */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-stone-100">REST API Explorer &amp; Integration Contract</h1>
                <p className="text-xs text-stone-400 mt-1">
                  Exposes all 17 capabilities directly via standard JSON envelopes. Fully compatible with standalone React frontends.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/api/docs"
                  target="_blank"
                  className="px-3.5 py-2 text-xs font-medium text-stone-900 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <span>Open Swagger UI</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Endpoints Table */}
            <div className="p-5 rounded-xl bg-stone-900/60 border border-stone-800 space-y-4">
              <h3 className="text-sm font-semibold text-stone-200">Key Production REST Endpoints</h3>
              <div className="space-y-2 font-mono text-xs">
                <div className="p-2.5 rounded bg-stone-950 flex items-center justify-between">
                  <span className="text-emerald-400 font-bold">GET /api/v1/health</span>
                  <span className="text-stone-400">System health &amp; readiness probe</span>
                </div>
                <div className="p-2.5 rounded bg-stone-950 flex items-center justify-between">
                  <span className="text-blue-400 font-bold">POST /api/v1/auth/login</span>
                  <span className="text-stone-400">JWT Authentication &amp; RBAC Token</span>
                </div>
                <div className="p-2.5 rounded bg-stone-950 flex items-center justify-between">
                  <span className="text-emerald-400 font-bold">GET /api/v1/books</span>
                  <span className="text-stone-400">List books with language filters and pagination</span>
                </div>
                <div className="p-2.5 rounded bg-stone-950 flex items-center justify-between">
                  <span className="text-blue-400 font-bold">POST /api/v1/pages/:id/recognition-jobs</span>
                  <span className="text-stone-400">Trigger line/full-page HTR recognition</span>
                </div>
                <div className="p-2.5 rounded bg-stone-950 flex items-center justify-between">
                  <span className="text-amber-400 font-bold">PATCH /api/v1/transcriptions/:id</span>
                  <span className="text-stone-400">Optimistic concurrency editing &amp; revision creation</span>
                </div>
                <div className="p-2.5 rounded bg-stone-950 flex items-center justify-between">
                  <span className="text-emerald-400 font-bold">GET /api/v1/search?q=...</span>
                  <span className="text-stone-400">Persian/Arabic normalized Unicode search</span>
                </div>
                <div className="p-2.5 rounded bg-stone-950 flex items-center justify-between">
                  <span className="text-blue-400 font-bold">POST /api/v1/evaluations</span>
                  <span className="text-stone-400">Run CER &amp; WER Levenshtein benchmarks</span>
                </div>
              </div>
            </div>

            {/* Generating Types Callout */}
            <div className="p-5 rounded-xl bg-stone-900/40 border border-stone-800 space-y-2">
              <h4 className="text-xs font-semibold text-stone-200">How to Generate TypeScript Types for Separate Frontend:</h4>
              <p className="text-xs text-stone-400">
                Run this command in your independent React repository to generate fully typed endpoints and schemas from this backend's OpenAPI contract:
              </p>
              <pre className="p-3 rounded-lg bg-stone-950 text-amber-300 font-mono text-xs overflow-x-auto">
                npx openapi-typescript http://localhost:3000/api/docs-json -o src/types/api.d.ts
              </pre>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-800/80 bg-stone-950 px-6 py-4 text-xs text-stone-500 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span>Manuscript AI Backend Platform · Academic Persian &amp; Arabic HTR</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/api/docs" target="_blank" className="hover:text-stone-300 transition-colors">Swagger API</a>
          <a href="/api/docs-json" target="_blank" className="hover:text-stone-300 transition-colors">OpenAPI 3.0 Spec</a>
          <a href="/api/v1/health" target="_blank" className="hover:text-stone-300 transition-colors">Health Probe</a>
        </div>
      </footer>
    </div>
  );
}
