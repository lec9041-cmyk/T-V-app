import { useState, useEffect, useMemo } from 'react';
import { Button } from './components/ui/button';
import { Progress } from './components/ui/progress';
import { Badge } from './components/ui/badge';
import { Switch } from './components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Separator } from './components/ui/separator';
import { QuizModal } from './components/QuizModal';
import { DaySelector } from './components/DaySelector';
import { Play, RotateCcw, Target, TrendingUp, Zap, Volume2, Timer, RefreshCw, Eye, Calendar as CalendarIcon, Home, BookOpen, BarChart3, Settings as SettingsIcon, ChevronDown, Check, Star } from 'lucide-react';

const DAY_CATEGORIES: { [key: number]: string } = {
  1: '채용',
  2: '규직,법률',
  3: '일반사무',
  4: '일반사무',
  5: '일반사무',
  6: '여가,공동체',
  7: '마케팅',
  8: '마케팅',
  9: '경제',
  10: '소정',
  11: '제품개발',
  12: '생산',
  13: '고객서비스',
  14: '여행,공항',
  15: '계약',
  16: '상거래',
  17: '무역,배송',
  18: '숙박,식당',
  19: '수익',
  20: '회계',
  21: '회사동향',
  22: '미팅',
  23: '사원복지',
  24: '인사이동',
  25: '교통',
  26: '은행',
  27: '투자',
  28: '건물,주택',
  29: '환경',
  30: '건강',
};

interface Word {
  day: number;
  no: number; // Word number in the entire list
  english: string;
  korean: string;
  index: number;
  mistakes?: number;
}

interface Stats {
  todayCount: number;
  streak: number;
  totalSolved: number;
  totalCorrect: number;
  xp: number;
  level: number;
  lastStudyDate: string;
  dailyLog: { [date: string]: number };
}

interface QuizSessionProgress {
  solvedCount: number;
  correctCount: number;
  wrongCount: number;
  wrongWords: Word[];
  completed: boolean;
  currentIndex: number;
  remainingWords: Word[];
}

interface Settings {
  orderMode: string;
  shuffleChoices: boolean;
  timerOn: boolean;
  timerMode: string;
  perQSec: string;
  sessionMin: string;
  autoNextMs: string;
  flashRevealDelay: string;
  reinsertLimit: string;
  mcReinsert: boolean;
  speakOnReveal: boolean;
  wrongMark: boolean;
}

const formatDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getPreviousDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return formatDateKey(date);
};

const safeStorage = {
  getItem(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn(`[storage] getItem failed for "${key}"`, error);
      return null;
    }
  },
  setItem(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn(`[storage] setItem failed for "${key}"`, error);
    }
  },
  removeItem(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn(`[storage] removeItem failed for "${key}"`, error);
    }
  },
};

export default function App() {
  const [currentTab, setCurrentTab] = useState('home');
  const [words, setWords] = useState<Word[]>([]);
  const [selectedDays, setSelectedDays] = useState<number[]>([1]);
  const [selectedRanges, setSelectedRanges] = useState<string[]>(['core', 'basic', '800', '900']); // All ranges by default
  const [stats, setStats] = useState<Stats>({
    todayCount: 0,
    streak: 0,
    totalSolved: 0,
    totalCorrect: 0,
    xp: 0,
    level: 1,
    lastStudyDate: '',
    dailyLog: {},
  });

  const [todayGoal, setTodayGoal] = useState(() => {
    const savedGoal = safeStorage.getItem('toeic_today_goal_v1');
    if (!savedGoal) return 30;
    const parsedGoal = Number(savedGoal);
    return Number.isFinite(parsedGoal) && parsedGoal > 0 ? parsedGoal : 30;
  });
  const [showQuiz, setShowQuiz] = useState(false);
  const [showDaySelector, setShowDaySelector] = useState(false);
  const [quizWords, setQuizWords] = useState<Word[]>([]);
  const [statsPeriod, setStatsPeriod] = useState<'7' | '30' | 'all'>('7');
  const [hasResumeData, setHasResumeData] = useState(false);
  const [wrongWords, setWrongWords] = useState<Word[]>([]);
  const [liveSessionSolved, setLiveSessionSolved] = useState(0);
  const [liveSessionTotal, setLiveSessionTotal] = useState(0);
  const [pendingResumeTotal, setPendingResumeTotal] = useState(0);
  const [isWordsLoading, setIsWordsLoading] = useState(true);

  // Learning settings
  const [mode, setMode] = useState('flash');
  const [direction, setDirection] = useState('en2ko');
  const [count, setCount] = useState('30');
  const [voice, setVoice] = useState('en-US');
  const [wrongFirst, setWrongFirst] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<Settings>({
    orderMode: 'random',
    shuffleChoices: true,
    timerOn: false,
    timerMode: 'perQuestion',
    perQSec: '10',
    sessionMin: '5',
    autoNextMs: '1200',
    flashRevealDelay: '0',
    reinsertLimit: '2',
    mcReinsert: false,
    speakOnReveal: false,
    wrongMark: true,
  });

  // Load data on mount
  useEffect(() => {
    loadStats();
    loadSampleWords();
    checkResumeData();
    loadWrongWords();
  }, []);

  const checkResumeData = () => {
    const resumeData = safeStorage.getItem('toeic_resume_v1');
    if (!resumeData) {
      setHasResumeData(false);
      setPendingResumeTotal(0);
      return;
    }

    try {
      const parsed = JSON.parse(resumeData);
      const remaining = Array.isArray(parsed.remainingWords) ? parsed.remainingWords.length : 0;
      setHasResumeData(remaining > 0);
      setPendingResumeTotal(remaining);
    } catch (e) {
      setHasResumeData(false);
      setPendingResumeTotal(0);
    }
  };

  const loadWrongWords = () => {
    const wrongLog = safeStorage.getItem('toeic_wrong_log_v1');
    if (wrongLog) {
      try {
        const log = JSON.parse(wrongLog);
        const normalized = Array.isArray(log)
          ? log.map((word) => ({ ...word, mistakes: word.mistakes || 1 }))
          : [];
        setWrongWords(normalized);
      } catch (e) {
        setWrongWords([]);
      }
    }
  };

  const updateTodayGoal = (value: string) => {
    const parsedGoal = Number(value);
    if (!Number.isFinite(parsedGoal) || parsedGoal <= 0) return;
    setTodayGoal(parsedGoal);
    safeStorage.setItem('toeic_today_goal_v1', String(parsedGoal));
  };

  const resumeStudy = () => {
    const resumeData = safeStorage.getItem('toeic_resume_v1');
    if (!resumeData) {
      alert('이어서 학습할 데이터가 없습니다.');
      return;
    }

    try {
      const data = JSON.parse(resumeData);
      // Resume with saved settings
      const safeMode = data.mode === 'mc' ? 'mc' : 'flash';
      setMode(safeMode);
      setDirection(data.direction || 'en2ko');
      setCount(data.count?.toString() || '30');
      setSelectedDays(data.days || [1]);
      setSelectedRanges(data.ranges || ['core', 'basic', '800', '900']);
      if (data.settings) {
        setSettings({
          ...settings,
          ...data.settings,
        });
      }

      // Start quiz with remaining words
      if (data.remainingWords && data.remainingWords.length > 0) {
        setLiveSessionSolved(0);
        setLiveSessionTotal(data.remainingWords.length);
        setPendingResumeTotal(0);
        setQuizWords(data.remainingWords);
        setShowQuiz(true);
      } else {
        // If no remaining words, just start new quiz with saved settings
        startQuiz();
      }
    } catch (e) {
      alert('이어서 학습 데이터를 불러오는데 실패했습니다.');
      safeStorage.removeItem('toeic_resume_v1');
      setHasResumeData(false);
    }
  };

  const reviewWrongWords = () => {
    if (wrongWords.length === 0) {
      alert('복습할 오답이 없습니다.');
      return;
    }

    setQuizWords(
      wrongWords
        .slice(0, Math.min(30, wrongWords.length))
        .map(({ mistakes, ...word }) => word)
    );
    setLiveSessionSolved(0);
    setLiveSessionTotal(Math.min(30, wrongWords.length));
    setShowQuiz(true);
  };

  const loadStats = () => {
    const savedStats = safeStorage.getItem('toeic_stats_v2');
    if (savedStats) {
      try {
        const parsed = JSON.parse(savedStats);
        const today = formatDateKey();
        const normalizedStats = {
          todayCount: parsed.todayCount || 0,
          streak: parsed.streak || 0,
          totalSolved: parsed.totalSolved || 0,
          totalCorrect: parsed.totalCorrect || 0,
          xp: parsed.xp || 0,
          level: parsed.level || 1,
          lastStudyDate: parsed.lastStudyDate || '',
          dailyLog: parsed.dailyLog || {},
        };

        if (normalizedStats.lastStudyDate && normalizedStats.lastStudyDate !== today) {
          normalizedStats.todayCount = 0;
        }

        setStats(normalizedStats);
      } catch (error) {
        console.warn('[stats] Failed to parse toeic_stats_v2', error);
      }
    }
  };

  const saveStats = (newStats: Stats) => {
    setStats(newStats);
    safeStorage.setItem('toeic_stats_v2', JSON.stringify(newStats));
  };

  const loadSampleWords = async () => {
    try {
      console.log('CSV 로딩 시작...');

      // Try importing from src/imports first (Figma Make environment)
      let csvText: string;
      try {
        const importedCSV = await import('../imports/toeic_words.csv?raw');
        csvText = importedCSV.default;
        console.log('✅ CSV imported from src/imports/');
      } catch (importError) {
        console.log('⚠️ Import failed, trying fetch from public/');
        const response = await fetch('/toeic_words.csv');
        console.log('Response status:', response.status, response.statusText);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        csvText = await response.text();
      }

      console.log('CSV 텍스트 길이:', csvText.length);

      const lines = csvText.trim().split('\n');
      console.log('CSV 라인 수:', lines.length);

      // Skip header line (day,no,word,meaning)
      const loadedWords: Word[] = lines.slice(1).map((line, index) => {
        // Handle CSV with quoted fields
        const matches = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
        if (!matches || matches.length < 4) return null;

        const day = matches[0].replace(/^DAY/, ''); // "DAY1" -> "1"
        const no = matches[1].trim(); // Word number
        const word = matches[2].replace(/^"|"$/g, ''); // Remove quotes
        const meaning = matches[3].replace(/^"|"$/g, ''); // Remove quotes

        return {
          day: parseInt(day),
          no: parseInt(no),
          english: word,
          korean: meaning,
          index: index,
        };
      }).filter((w): w is Word => w !== null);

      console.log(`✅ 총 ${loadedWords.length}개 단어 로드 완료!`);
      setWords(loadedWords);

      // Auto-select DAY 1 if no days selected
      if (selectedDays.length === 0) {
        setSelectedDays([1]);
      }
    } catch (error) {
      console.error('❌ CSV 로드 실패:', error);
      alert('단어 데이터를 불러오는데 실패했습니다.\n\n에러: ' + error + '\n\n샘플 데이터를 사용합니다.');

      // Fallback to sample data
      const sampleWords: Word[] = [
        { day: 1, no: 1, english: 'resume', korean: '이력서', index: 0 },
        { day: 1, no: 2, english: 'opening', korean: '공석, 결원', index: 1 },
        { day: 1, no: 3, english: 'applicant', korean: '지원자, 신청자', index: 2 },
        { day: 1, no: 4, english: 'requirement', korean: '필요조건, 요건', index: 3 },
        { day: 1, no: 5, english: 'qualified', korean: '자격있는, 적격의', index: 4 },
        { day: 1, no: 6, english: 'candidate', korean: '후보자, 지원자', index: 5 },
        { day: 1, no: 7, english: 'confidence', korean: '확신, 자신', index: 6 },
        { day: 1, no: 8, english: 'professional', korean: '전문적인, 전문가', index: 7 },
        { day: 1, no: 9, english: 'interview', korean: '면접, 면접을 보다', index: 8 },
        { day: 1, no: 10, english: 'hire', korean: '고용하다', index: 9 },
      ];
      setWords(sampleWords);
      setSelectedDays([1]);
    } finally {
      setIsWordsLoading(false);
    }
  };

  const calculateXPForLevel = (level: number) => {
    return 100 * level;
  };

  const getWordNumberRange = (range: string): [number, number] => {
    switch (range) {
      case 'core': return [1, 40];
      case 'basic': return [41, 68];
      case '800': return [69, 136];
      case '900': return [137, 999999];
      default: return [1, 999999];
    }
  };

  const startQuiz = () => {
    if (isWordsLoading) {
      alert('단어 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    if (selectedDays.length === 0) {
      alert('DAY를 먼저 선택해주세요!');
      setShowDaySelector(true);
      return;
    }

    console.log('총 단어 수:', words.length);
    console.log('선택된 DAY:', selectedDays);
    console.log('선택된 범위:', selectedRanges);

    // Filter by selected days
    let filteredWords = words.filter(w => selectedDays.includes(w.day));
    console.log('DAY 필터 후:', filteredWords.length, '개');

    // Filter by selected ranges
    filteredWords = filteredWords.filter(w => {
      return selectedRanges.some(range => {
        const [min, max] = getWordNumberRange(range);
        return w.no >= min && w.no <= max;
      });
    });
    console.log('범위 필터 후:', filteredWords.length, '개');

    if (filteredWords.length === 0) {
      alert('선택한 조건에 맞는 단어가 없습니다.\n\n디버그 정보:\n- 총 단어: ' + words.length + '개\n- 선택 DAY: ' + selectedDays.join(', ') + '\n- 선택 범위: ' + selectedRanges.join(', ') + '\n\n브라우저 콘솔(F12)에서 자세한 정보를 확인하세요.');
      return;
    }

    const selectedWords = filteredWords
      .sort(() => settings.orderMode === 'random' ? Math.random() - 0.5 : 1)
      .slice(0, Math.min(parseInt(count), filteredWords.length));

    setQuizWords(selectedWords);
    setLiveSessionSolved(0);
    setLiveSessionTotal(selectedWords.length);
    setShowQuiz(true);
  };

  const applySessionStats = (progress: QuizSessionProgress) => {
    if (progress.solvedCount <= 0) return;

    const today = formatDateKey();
    const yesterday = getPreviousDateKey(today);
    const gainedXP = progress.correctCount * 10;
    const newXP = stats.xp + gainedXP;
    const xpNeeded = calculateXPForLevel(stats.level);
    let newLevel = stats.level;

    if (newXP >= xpNeeded) {
      newLevel = stats.level + 1;
    }

    const newStreak =
      stats.lastStudyDate === today
        ? stats.streak
        : stats.lastStudyDate === yesterday
        ? stats.streak + 1
        : 1;

    const newStats = {
      ...stats,
      todayCount: stats.todayCount + progress.solvedCount,
      streak: newStreak,
      totalSolved: stats.totalSolved + progress.solvedCount,
      totalCorrect: stats.totalCorrect + progress.correctCount,
      xp: newXP,
      level: newLevel,
      lastStudyDate: today,
      dailyLog: {
        ...stats.dailyLog,
        [today]: (stats.dailyLog[today] || 0) + progress.solvedCount,
      },
    };

    saveStats(newStats);
  };

  const mergeWrongWords = (newWrongWords: Word[]) => {
    if (!newWrongWords || newWrongWords.length === 0) return;

    const countMap = new Map<string, Word>();

    wrongWords.forEach((word) => {
      countMap.set(word.english, {
        ...word,
        mistakes: word.mistakes || 1,
      });
    });

    newWrongWords.forEach((word) => {
      const existing = countMap.get(word.english);
      if (existing) {
        countMap.set(word.english, {
          ...existing,
          mistakes: (existing.mistakes || 1) + 1,
        });
      } else {
        countMap.set(word.english, {
          ...word,
          mistakes: 1,
        });
      }
    });

    const uniqueWrong = Array.from(countMap.values()).sort(
      (a, b) => (b.mistakes || 1) - (a.mistakes || 1)
    );

    setWrongWords(uniqueWrong);
    safeStorage.setItem('toeic_wrong_log_v1', JSON.stringify(uniqueWrong));
  };

  const saveResumeData = (progress: QuizSessionProgress) => {
    if (progress.remainingWords.length === 0) {
      safeStorage.removeItem('toeic_resume_v1');
      setHasResumeData(false);
      setPendingResumeTotal(0);
      return;
    }

    const resumePayload = {
      mode,
      direction,
      count,
      days: selectedDays,
      ranges: selectedRanges,
      settings,
      currentIndex: progress.currentIndex,
      solvedCount: progress.solvedCount,
      correctCount: progress.correctCount,
      wrongCount: progress.wrongCount,
      remainingWords: progress.remainingWords,
      savedAt: new Date().toISOString(),
    };

    safeStorage.setItem('toeic_resume_v1', JSON.stringify(resumePayload));
    setHasResumeData(true);
    setPendingResumeTotal(progress.remainingWords.length);
  };

  const handleQuizProgressSave = (progress: QuizSessionProgress) => {
    applySessionStats(progress);
    mergeWrongWords(progress.wrongWords);
    saveResumeData(progress);
    setLiveSessionSolved(0);
    setLiveSessionTotal(0);
    setShowQuiz(false);
  };

  const handleQuizComplete = (progress: QuizSessionProgress) => {
    applySessionStats(progress);
    mergeWrongWords(progress.wrongWords);

    // Clear resume data on completion
    safeStorage.removeItem('toeic_resume_v1');
    setHasResumeData(false);
    setPendingResumeTotal(0);

    setLiveSessionSolved(0);
    setLiveSessionTotal(0);
    setShowQuiz(false);
  };

  const handleLiveSessionUpdate = (progress: { solvedCount: number; correctCount: number; wrongCount: number }) => {
    setLiveSessionSolved(progress.solvedCount);
  };

  // 저장값(stats.todayCount)은 완료/중간저장 시점에만 갱신하고,
  // 홈 상단 "오늘 목표"에는 퀴즈 진행 중 임시 진행량(liveSessionSolved)만 표시 보정한다.
  const displayedTodayCount = showQuiz
    ? stats.todayCount + liveSessionSolved
    : stats.todayCount;
  const displayedSessionSolved = showQuiz ? liveSessionSolved : 0;
  const displayedSessionTotal = showQuiz
    ? liveSessionTotal
    : hasResumeData
      ? pendingResumeTotal
      : 0;
  const accuracyRate = stats.totalSolved > 0
    ? Math.round((stats.totalCorrect / stats.totalSolved) * 100)
    : 0;

  const wrongWordItems = useMemo(() => {
    return [...wrongWords]
      .sort((a, b) => (b.mistakes || 1) - (a.mistakes || 1))
      .slice(0, 5)
      .map((word) => ({
      key: `${word.day}-${word.no}-${word.english}`,
      word: word.english,
      meaning: word.korean,
      mistakes: word.mistakes || 1,
    }));
  }, [wrongWords]);

  const weaknessItems = useMemo(() => {
    const byCategory = new Map<string, number>();
    wrongWords.forEach((word) => {
      const category = DAY_CATEGORIES[word.day] || `DAY ${word.day}`;
      byCategory.set(category, (byCategory.get(category) || 0) + 1);
    });

    const sorted = Array.from(byCategory.entries())
      .map(([label, count], i) => ({ label, count, color: ['blue', 'purple', 'orange', 'red'][i % 4] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const maxCount = Math.max(...sorted.map((item) => item.count), 1);
    return sorted.map((item) => ({
      ...item,
      intensity: Math.max(10, Math.round((item.count / maxCount) * 100)),
    }));
  }, [wrongWords]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between py-4 md:py-6">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 bg-clip-text text-transparent">
                TOEIC
              </h1>
              <p className="text-xs md:text-sm text-gray-400 mt-0.5 md:mt-1 font-medium">Master Your Vocabulary</p>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <div className="px-2 md:px-4 py-1 md:py-2 rounded-full bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-200/50">
                <span className="text-xs md:text-sm font-bold text-orange-600">{stats.streak}🔥</span>
              </div>
              <div className="px-2 md:px-4 py-1 md:py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200/50">
                <span className="text-xs md:text-sm font-bold text-blue-600">Lv.{stats.level}</span>
              </div>
            </div>
          </div>

          {/* Desktop Tabs */}
          <div className="hidden md:flex items-center gap-1 border-b border-gray-100 -mb-px">
            {[
              { id: 'home', label: '홈', icon: Home },
              { id: 'learn', label: '학습', icon: BookOpen },
              { id: 'stats', label: '통계', icon: BarChart3 },
              { id: 'settings', label: '설정', icon: SettingsIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`
                  group relative px-8 py-3 text-sm font-semibold transition-all duration-300
                  ${currentTab === tab.id ? 'text-black' : 'text-gray-400 hover:text-gray-600'}
                `}
              >
                <div className="flex items-center gap-2">
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </div>
                {currentTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 md:px-8 py-4 md:py-8">
        {currentTab === 'home' && (
          <div className="space-y-5 md:space-y-6 max-w-2xl mx-auto">
            {/* Today Status (Hero) */}
            <div className="text-center py-4 md:py-6">
              <div className="text-xs md:text-sm font-semibold text-gray-500 mb-2">오늘 목표</div>
              <div className="text-5xl md:text-6xl font-bold mb-1 bg-gradient-to-br from-gray-900 to-gray-600 bg-clip-text text-transparent">
                {displayedTodayCount} / {todayGoal}
              </div>
              <div className="text-sm md:text-base text-gray-500 mb-3">일일 목표 진행</div>

              {/* Progress bar */}
              <div className="max-w-md mx-auto">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((displayedTodayCount / todayGoal) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-gray-50 border border-gray-200 p-3 text-left">
                <div className="text-xs font-semibold text-gray-500">현재 학습 범위 진행도</div>
                {displayedSessionTotal > 0 ? (
                  <div className="text-sm font-bold text-gray-900 mt-1">
                    {displayedSessionSolved} / {displayedSessionTotal}
                    {!showQuiz && hasResumeData && ' (이어하기 대기)'}
                  </div>
                ) : (
                  <div className="text-sm text-gray-600 mt-1">진행 중인 세션 없음</div>
                )}
              </div>
            </div>

            {/* Primary CTA */}
            <Button
              size="lg"
              onClick={startQuiz}
              disabled={isWordsLoading}
              className="w-full py-6 md:py-7 text-lg md:text-xl font-bold rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-xl shadow-blue-500/25 hover:shadow-2xl hover:shadow-blue-500/40 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="w-6 h-6 mr-2 fill-current" />
              {isWordsLoading ? '단어 로딩 중...' : '학습 시작'}
            </Button>

            {/* DAY Selection */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-3">학습 DAY 선택</div>
              <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => {
                  const isSelected = selectedDays.includes(day);
                  return (
                    <button
                      key={day}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedDays(selectedDays.filter(d => d !== day));
                        } else {
                          setSelectedDays([...selectedDays, day]);
                        }
                      }}
                      className={`
                        flex-shrink-0 px-4 py-2 rounded-full font-semibold text-sm transition-all duration-200
                        ${isSelected
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }
                      `}
                    >
                      DAY {day}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setShowDaySelector(true)}
                className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-semibold"
              >
                상세 선택 →
              </button>
            </div>

            {/* 7-Day Trend */}
            <div className="rounded-2xl p-5 bg-white border border-gray-200 shadow-sm">
              <div className="text-sm font-semibold text-gray-700 mb-3">최근 학습 흐름</div>
              <div className="flex items-end gap-1.5 h-20">
                {Array.from({ length: 7 }, (_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() - (6 - i));
                  const dateStr = formatDateKey(date);
                  const count = stats.dailyLog[dateStr] || 0;
                  const maxCount = Math.max(...Object.values(stats.dailyLog), 30);
                  const height = maxCount > 0 ? (count / maxCount) * 100 : 0;

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full bg-gray-100 rounded-t-lg overflow-hidden" style={{ height: '60px' }}>
                        <div
                          className="w-full bg-gradient-to-t from-blue-500 to-purple-500 rounded-t-lg transition-all duration-500"
                          style={{ height: `${height}%`, marginTop: `${100 - height}%` }}
                        />
                      </div>
                      <div className="text-[10px] font-medium text-gray-400">
                        {['일','월','화','수','목','금','토'][date.getDay()]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={hasResumeData ? resumeStudy : startQuiz}
                disabled={(!hasResumeData && selectedDays.length === 0) || (!hasResumeData && isWordsLoading)}
                className={`rounded-2xl p-5 bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] text-left shadow-sm ${
                  (!hasResumeData && selectedDays.length === 0) || (!hasResumeData && isWordsLoading) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 mb-3 shadow-md">
                  <Play className="w-5 h-5 text-white" />
                </div>
                <div className="text-sm font-bold text-gray-900">
                  {hasResumeData ? '이어서 학습' : '새로 학습'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {hasResumeData ? '저장된 위치부터' : isWordsLoading ? '단어 로딩 중...' : '지금 바로 시작'}
                </div>
              </button>

              <button
                onClick={reviewWrongWords}
                disabled={wrongWords.length === 0}
                className={`rounded-2xl p-5 bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border border-purple-200 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] text-left shadow-sm ${
                  wrongWords.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 mb-3 shadow-md">
                  <RotateCcw className="w-5 h-5 text-white" />
                </div>
                <div className="text-sm font-bold text-gray-900">오답 복습</div>
                <div className="text-xs text-gray-500 mt-1">
                  {wrongWords.length > 0 ? `${wrongWords.length}개 단어` : '틀린 문제 없음'}
                </div>
              </button>
            </div>

            {/* XP Growth Card */}
            <div className="rounded-2xl p-5 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-bold text-gray-900">단어 성장 Lv.{stats.level}</div>
                  <div className="text-xs text-gray-600 mt-0.5">다음 레벨까지 {calculateXPForLevel(stats.level) - stats.xp} XP</div>
                </div>
                <div className="text-2xl">🌱</div>
              </div>
              <div className="h-2 bg-white/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((stats.xp / calculateXPForLevel(stats.level)) * 100, 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-600 mt-2">{stats.xp} / {calculateXPForLevel(stats.level)} XP</div>
            </div>
          </div>
        )}

        {currentTab === 'learn' && (
          <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
            <div className="text-center mb-6 md:mb-12">
              <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-2 md:mb-4">학습 설정</h2>
              <p className="text-sm md:text-lg text-gray-500">나만의 학습 경험을 만들어보세요</p>
            </div>

            {/* DAY 선택 버튼 */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">선택 DAY</label>
              <button
                onClick={() => setShowDaySelector(true)}
                className="w-full flex items-center justify-between p-4 md:p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 hover:border-blue-300 transition-all duration-200 hover:shadow-lg group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex -space-x-2 flex-shrink-0">
                    {selectedDays.slice(0, 3).map((day) => (
                      <div
                        key={day}
                        className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm border-2 border-white shadow-md"
                      >
                        {day}
                      </div>
                    ))}
                    {selectedDays.length > 3 && (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold text-sm border-2 border-white shadow-md">
                        +{selectedDays.length - 3}
                      </div>
                    )}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="font-bold text-gray-900">
                      {selectedDays.length === 0
                        ? 'DAY를 선택하세요'
                        : selectedDays.length === 1
                        ? `DAY ${selectedDays[0]} · ${DAY_CATEGORIES[selectedDays[0]]}`
                        : `${selectedDays.length}개 DAY`
                      }
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {selectedDays.length > 1 && selectedDays.slice(0, 3).map(d => `${d}·${DAY_CATEGORIES[d]}`).join(', ')}
                      {selectedDays.length > 3 && '...'}
                    </div>
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 text-blue-600 group-hover:translate-y-0.5 transition-transform flex-shrink-0" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2 md:space-y-3">
                <label className="block text-sm font-semibold text-gray-700">학습 모드</label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger className="h-12 md:h-14 rounded-xl border-gray-200 text-sm md:text-base font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flash">플래시카드</SelectItem>
                    <SelectItem value="mc">4지선다</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:space-y-3">
                <label className="block text-sm font-semibold text-gray-700">방향</label>
                <Select value={direction} onValueChange={setDirection}>
                  <SelectTrigger className="h-12 md:h-14 rounded-xl border-gray-200 text-sm md:text-base font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en2ko">영단어 → 뜻</SelectItem>
                    <SelectItem value="ko2en">뜻 → 영단어</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:space-y-3">
                <label className="block text-sm font-semibold text-gray-700">문제수</label>
                <Select value={count} onValueChange={setCount}>
                  <SelectTrigger className="h-12 md:h-14 rounded-xl border-gray-200 text-sm md:text-base font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10문제</SelectItem>
                    <SelectItem value="20">20문제</SelectItem>
                    <SelectItem value="30">30문제</SelectItem>
                    <SelectItem value="50">50문제</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:space-y-3">
                <label className="block text-sm font-semibold text-gray-700">발음</label>
                <Select value={voice} onValueChange={setVoice}>
                  <SelectTrigger className="h-12 md:h-14 rounded-xl border-gray-200 text-sm md:text-base font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-US">미국식 🇺🇸</SelectItem>
                    <SelectItem value="en-GB">영국식 🇬🇧</SelectItem>
                    <SelectItem value="en-AU">호주식 🇦🇺</SelectItem>
                    <SelectItem value="random">토익 랜덤 🎲</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Word Range Selection */}
            <div className="space-y-3 p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200">
              <h4 className="font-bold text-gray-900 mb-3">학습 범위 선택</h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'core', label: '핵심단어', range: '1-40', color: 'blue' },
                  { id: 'basic', label: '기초완성', range: '41-68', color: 'purple' },
                  { id: '800', label: '800+', range: '69-136', color: 'orange' },
                  { id: '900', label: '900+', range: '137~', color: 'green' },
                ].map((range) => {
                  const isSelected = selectedRanges.includes(range.id);
                  return (
                    <button
                      key={range.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedRanges(selectedRanges.filter(r => r !== range.id));
                        } else {
                          setSelectedRanges([...selectedRanges, range.id]);
                        }
                      }}
                      className={`
                        p-4 rounded-xl transition-all duration-200 border-2 text-left
                        ${isSelected
                          ? `bg-gradient-to-br ${
                              range.color === 'blue' ? 'from-blue-500 to-indigo-500' :
                              range.color === 'purple' ? 'from-purple-500 to-pink-500' :
                              range.color === 'orange' ? 'from-orange-500 to-amber-500' :
                              'from-green-500 to-emerald-500'
                            } border-transparent text-white shadow-lg`
                          : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm">{range.label}</span>
                        {isSelected && <Check className="w-4 h-4" />}
                      </div>
                      <div className={`text-xs ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                        {range.range}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              size="lg"
              onClick={startQuiz}
              disabled={selectedRanges.length === 0 || isWordsLoading}
              className="w-full h-14 md:h-16 text-base md:text-lg font-semibold rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-2xl shadow-blue-500/30 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="w-4 h-4 md:w-5 md:h-5 mr-2" />
              {isWordsLoading ? '단어 로딩 중...' : '학습 시작'}
            </Button>

            {/* Favorites Section */}
            {(() => {
              const saved = safeStorage.getItem('toeic_favorites');
              let favoriteWords: string[] = [];
              if (saved) {
                try {
                  const parsed = JSON.parse(saved);
                  favoriteWords = Array.isArray(parsed) ? parsed : [];
                } catch (error) {
                  console.warn('[favorites] Failed to parse toeic_favorites', error);
                }
              }
              if (favoriteWords.length > 0) {
                return (
                  <div className="rounded-2xl p-5 bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-yellow-600 fill-yellow-600" />
                        <h3 className="font-bold text-gray-900">즐겨찾기 단어</h3>
                      </div>
                      <Badge variant="outline" className="bg-white">{favoriteWords.length}개</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {favoriteWords.slice(0, 6).map((word: string, i: number) => {
                        const wordData = words.find(w => w.english === word);
                        return (
                          <div
                            key={i}
                            className="p-3 rounded-xl bg-white border border-yellow-200 hover:border-yellow-300 transition-all duration-200"
                          >
                            <div className="text-sm font-bold text-gray-900">{word}</div>
                            {wordData && (
                              <div className="text-xs text-gray-500 mt-1">{wordData.korean}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {favoriteWords.length > 6 && (
                      <div className="mt-3 text-xs text-center text-yellow-700">
                        +{favoriteWords.length - 6}개 더보기
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })()}

            {/* Stats Pills */}
            <div className="flex gap-2 md:gap-3 flex-wrap">
              <Badge variant="outline" className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-bold border-2">
                오늘 {stats.todayCount}
              </Badge>
              <Badge variant="outline" className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-bold border-2">
                연속 {stats.streak}일
              </Badge>
              <Badge variant="outline" className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-bold border-2">
                XP {stats.xp}/{calculateXPForLevel(stats.level)}
              </Badge>
              <Badge variant="outline" className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-bold border-2 bg-green-50 text-green-700 border-green-300">
                학습 가능 {(() => {
                  const filtered = words.filter(w => selectedDays.includes(w.day) && selectedRanges.some(range => {
                    const [min, max] = getWordNumberRange(range);
                    return w.no >= min && w.no <= max;
                  }));
                  return filtered.length;
                })()}개
              </Badge>
            </div>
          </div>
        )}

        {currentTab === 'stats' && (
          <div className="space-y-5 max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">학습 통계</h2>
              <p className="text-sm text-gray-500">나의 성장 추이</p>
            </div>

            {/* Period Selector */}
            <div className="flex gap-2 justify-center">
              {[
                { id: '7', label: '7일' },
                { id: '30', label: '30일' },
                { id: 'all', label: '최근 30일' },
              ].map((period) => (
                <button
                  key={period.id}
                  onClick={() => setStatsPeriod(period.id as '7' | '30' | 'all')}
                  className={`
                    px-6 py-2 rounded-full font-semibold text-sm transition-all duration-200
                    ${statsPeriod === period.id
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  {period.label}
                </button>
              ))}
            </div>

            {/* Main Progress Graph */}
            <div className="rounded-2xl p-5 bg-white border border-gray-200 shadow-sm">
              <div className="text-sm font-semibold text-gray-700 mb-4">최근 학습 흐름</div>
              <div className="h-40 flex items-end gap-1">
                {(() => {
                  const days = statsPeriod === '7' ? 7 : 30;
                  const data = Array.from({ length: days }, (_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - (days - 1 - i));
                    const dateStr = formatDateKey(date);
                    return {
                      date: dateStr,
                      count: stats.dailyLog[dateStr] || 0,
                    };
                  });
                  const maxCount = Math.max(...data.map(d => d.count), 1);

                  return data.map((d, i) => {
                    const height = (d.count / maxCount) * 100;
                    const isToday = d.date === formatDateKey();

                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-gray-100 rounded-t-lg relative" style={{ height: '120px' }}>
                          <div
                            className={`absolute bottom-0 w-full rounded-t-lg transition-all duration-500 ${
                              isToday
                                ? 'bg-gradient-to-t from-purple-500 to-pink-500'
                                : 'bg-gradient-to-t from-blue-500 to-blue-400'
                            }`}
                            style={{ height: `${height}%` }}
                            title={`${d.date}: ${d.count}개`}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="mt-3 text-xs text-gray-400 text-center">
                {statsPeriod === '7' ? '최근 7일' : '최근 30일'}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 text-center">
                <div className="text-xs font-semibold text-gray-600 mb-1">평균 정답률</div>
                <div className="text-2xl font-bold text-blue-900">{accuracyRate}%</div>
              </div>
              <div className="rounded-2xl p-4 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 text-center">
                <div className="text-xs font-semibold text-gray-600 mb-1">총 학습</div>
                <div className="text-2xl font-bold text-purple-900">{stats.totalSolved}</div>
              </div>
              <div className="rounded-2xl p-4 bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 text-center">
                <div className="text-xs font-semibold text-gray-600 mb-1">연속 학습</div>
                <div className="text-2xl font-bold text-orange-900">{stats.streak}일 🔥</div>
              </div>
            </div>

            {/* Study Heatmap */}
            <div className="rounded-2xl p-5 bg-white border border-gray-200 shadow-sm">
              <div className="text-sm font-semibold text-gray-700 mb-4">학습 달력</div>
              <div className="grid grid-cols-7 gap-1.5">
                {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                  <div key={day} className="text-center text-[10px] font-bold text-gray-400">
                    {day}
                  </div>
                ))}
                {Array.from({ length: 35 }).map((_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() - 34 + i);
                  const dateStr = formatDateKey(date);
                  const count = stats.dailyLog[dateStr] || 0;
                  const intensity = count > 0 ? Math.min(Math.ceil(count / 10), 4) : 0;

                  return (
                    <div
                      key={i}
                      className={`
                        aspect-square rounded transition-all duration-200
                        ${intensity === 0 ? 'bg-gray-100' :
                          intensity === 1 ? 'bg-blue-200' :
                          intensity === 2 ? 'bg-blue-400' :
                          intensity === 3 ? 'bg-blue-600' :
                          'bg-blue-800'
                        }
                      `}
                      title={`${dateStr}: ${count}개`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Weakness Analysis */}
            <div className="rounded-2xl p-5 bg-white border border-gray-200 shadow-sm">
              <div className="text-sm font-semibold text-gray-700 mb-4">오답 많은 영역</div>
              <div className="space-y-3">
                {weaknessItems.length === 0 ? (
                  <div className="text-sm text-gray-500 py-4 text-center">오답 데이터가 쌓이면 영역별 분포가 표시됩니다.</div>
                ) : weaknessItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-24 text-xs font-medium text-gray-700 truncate">{item.label}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2 ${
                          item.color === 'blue' ? 'bg-blue-500' :
                          item.color === 'purple' ? 'bg-purple-500' :
                          item.color === 'orange' ? 'bg-orange-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${item.intensity}%` }}
                      >
                        <span className="text-xs font-bold text-white">{item.count}회</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mistake Analysis */}
            <div className="rounded-2xl p-5 bg-white border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-gray-700">자주 틀린 단어</div>
                <button
                  onClick={reviewWrongWords}
                  disabled={wrongWords.length === 0}
                  className={`text-xs font-semibold ${wrongWords.length === 0 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-700'}`}
                >
                  복습하기 →
                </button>
              </div>
              <div className="space-y-2">
                {wrongWordItems.length === 0 ? (
                  <div className="text-sm text-gray-500 py-4 text-center">아직 저장된 오답이 없습니다.</div>
                ) : wrongWordItems.map((item, i) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-gray-900">{item.word}</div>
                      <div className="text-xs text-gray-500">{item.meaning}</div>
                    </div>
                    <div className="text-xs font-bold text-red-600">×{item.mistakes}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentTab === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
            <div className="text-center mb-6 md:mb-12">
              <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-2 md:mb-4">설정</h2>
              <p className="text-sm md:text-lg text-gray-500">학습 환경을 최적화하세요</p>
            </div>

            <div className="space-y-6 md:space-y-8">
              {/* 오늘 목표량 */}
              <div className="space-y-3 md:space-y-4">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-1 h-5 md:h-6 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full" />
                  오늘 목표량
                </h3>

                <div className="flex items-center justify-between p-4 md:p-6 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="flex-1 pr-4">
                    <div className="font-semibold text-gray-900 mb-1 text-sm md:text-base">일일 목표 문제 수</div>
                    <div className="text-xs md:text-sm text-gray-500">홈 탭 진행도 기준</div>
                  </div>
                  <Select value={String(todayGoal)} onValueChange={updateTodayGoal}>
                    <SelectTrigger className="w-32 md:w-44 h-10 md:h-11 rounded-xl text-xs md:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10문제</SelectItem>
                      <SelectItem value="20">20문제</SelectItem>
                      <SelectItem value="30">30문제</SelectItem>
                      <SelectItem value="50">50문제</SelectItem>
                      <SelectItem value="100">100문제</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* 문제 순서 */}
              <div className="space-y-3 md:space-y-4">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-1 h-5 md:h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
                  문제 순서
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 md:p-6 rounded-2xl bg-gray-50 border border-gray-100">
                    <div className="flex-1 pr-4">
                      <div className="font-semibold text-gray-900 mb-1 text-sm md:text-base">문제 출제 순서</div>
                      <div className="text-xs md:text-sm text-gray-500">순서대로 또는 랜덤</div>
                    </div>
                    <Select value={settings.orderMode} onValueChange={(v) => setSettings({...settings, orderMode: v})}>
                      <SelectTrigger className="w-32 md:w-44 h-10 md:h-11 rounded-xl text-xs md:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="random">랜덤 🔀</SelectItem>
                        <SelectItem value="sequential">순서대로 📖</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-4 md:p-6 rounded-2xl bg-gray-50 border border-gray-100">
                    <div>
                      <div className="font-semibold text-gray-900 mb-1 text-sm md:text-base">4지선다 보기 뒤섞기</div>
                      <div className="text-xs md:text-sm text-gray-500">보기 순서 무작위</div>
                    </div>
                    <Switch checked={settings.shuffleChoices} onCheckedChange={(v) => setSettings({...settings, shuffleChoices: v})} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* 타임어택 */}
              <div className="space-y-3 md:space-y-4">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-1 h-5 md:h-6 bg-gradient-to-b from-orange-500 to-red-500 rounded-full" />
                  타임어택
                </h3>

                <div className="flex items-center justify-between p-4 md:p-6 rounded-2xl bg-gray-50 border border-gray-100">
                  <div>
                    <div className="font-semibold text-gray-900 mb-1 text-sm md:text-base flex items-center gap-2">
                      <Timer className="w-4 h-4" />
                      타임어택 활성화
                    </div>
                    <div className="text-xs md:text-sm text-gray-500">시간 제한</div>
                  </div>
                  <Switch checked={settings.timerOn} onCheckedChange={(v) => setSettings({...settings, timerOn: v})} />
                </div>

                {settings.timerOn && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <div className="text-xs md:text-sm text-gray-500">타이머 모드</div>
                      <Select value={settings.timerMode} onValueChange={(v) => setSettings({...settings, timerMode: v})}>
                        <SelectTrigger className="h-10 rounded-xl text-xs md:text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="perQuestion">문항별</SelectItem>
                          <SelectItem value="session">세션 전체</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs md:text-sm text-gray-500">문항 제한(초)</div>
                      <Select value={settings.perQSec} onValueChange={(v) => setSettings({...settings, perQSec: v})}>
                        <SelectTrigger className="h-10 rounded-xl text-xs md:text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5초</SelectItem>
                          <SelectItem value="10">10초</SelectItem>
                          <SelectItem value="15">15초</SelectItem>
                          <SelectItem value="20">20초</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs md:text-sm text-gray-500">세션 제한(분)</div>
                      <Select value={settings.sessionMin} onValueChange={(v) => setSettings({...settings, sessionMin: v})}>
                        <SelectTrigger className="h-10 rounded-xl text-xs md:text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3분</SelectItem>
                          <SelectItem value="5">5분</SelectItem>
                          <SelectItem value="10">10분</SelectItem>
                          <SelectItem value="15">15분</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 px-4 py-3 shadow-2xl safe-area-pb z-50">
        <div className="grid grid-cols-4 gap-2">
          {[
            { id: 'home', label: '홈', icon: Home },
            { id: 'learn', label: '학습', icon: BookOpen },
            { id: 'stats', label: '통계', icon: BarChart3 },
            { id: 'settings', label: '설정', icon: SettingsIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`
                flex flex-col items-center gap-1 py-2 rounded-xl transition-all duration-200
                ${currentTab === tab.id
                  ? 'bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
                }
              `}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-xs font-bold">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Quiz Modal */}
      {showQuiz && (
        <QuizModal
          words={quizWords}
          mode={mode as 'flash' | 'mc'}
          direction={direction as 'en2ko' | 'ko2en'}
          shuffleChoices={settings.shuffleChoices}
          timerOn={settings.timerOn}
          timerMode={settings.timerMode}
          perQSec={settings.perQSec}
          sessionMin={settings.sessionMin}
          onLiveUpdate={handleLiveSessionUpdate}
          onProgressSave={handleQuizProgressSave}
          onComplete={handleQuizComplete}
        />
      )}

      {/* Day Selector Modal */}
      {showDaySelector && (
        <DaySelector
          selectedDays={selectedDays}
          onDaysChange={setSelectedDays}
          onClose={() => setShowDaySelector(false)}
        />
      )}
    </div>
  );
}
