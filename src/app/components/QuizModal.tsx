import { useState, useEffect, useRef } from 'react';
import { Volume2, X, Star, BookOpen } from 'lucide-react';

interface Word {
  day: number;
  no: number;
  english: string;
  korean: string;
  index: number;
}

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

interface QuizModalProps {
  words: Word[];
  mode: 'flash' | 'mc';
  direction: 'en2ko' | 'ko2en';
  shuffleChoices: boolean;
  timerOn: boolean;
  timerMode: string;
  perQSec: string;
  sessionMin: string;
  onLiveUpdate?: (stats: {
    solvedCount: number;
    correctCount: number;
    wrongCount: number;
  }) => void;
  onProgressSave: (stats: {
    solvedCount: number;
    correctCount: number;
    wrongCount: number;
    wrongWords: Word[];
    completed: boolean;
    currentIndex: number;
    remainingWords: Word[];
  }) => void;
  onComplete: (stats: {
    solvedCount: number;
    correctCount: number;
    wrongCount: number;
    wrongWords: Word[];
    completed: boolean;
    currentIndex: number;
    remainingWords: Word[];
  }) => void;
}

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
};

export function QuizModal({
  words,
  mode,
  direction,
  shuffleChoices,
  timerOn,
  timerMode,
  perQSec,
  sessionMin,
  onLiveUpdate,
  onProgressSave,
  onComplete,
}: QuizModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [perQuestionLeft, setPerQuestionLeft] = useState<number>(0);
  const [sessionLeft, setSessionLeft] = useState<number>(0);
  const solvedCountRef = useRef(0);
  const correctCountRef = useRef(0);
  const wrongCountRef = useRef(0);
  const wrongWordsRef = useRef<Word[]>([]);
  const isFinalizedRef = useRef(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const saved = safeStorage.getItem('toeic_favorites');
    if (!saved) {
      return new Set();
    }

    try {
      const parsed = JSON.parse(saved);
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.warn('[favorites] Failed to parse toeic_favorites', error);
      return new Set();
    }
  });

  const currentWord = words[currentIndex];
  const question = direction === 'en2ko' ? currentWord?.english : currentWord?.korean;
  const answer = direction === 'en2ko' ? currentWord?.korean : currentWord?.english;
  const normalizedTimerMode = timerMode === 'perQ' ? 'perQuestion' : timerMode;
  const perQuestionSeconds = Math.max(1, parseInt(perQSec || '10'));
  const sessionSeconds = Math.max(60, parseInt(sessionMin || '5') * 60);
  const emitLiveUpdate = () => {
    onLiveUpdate?.({
      solvedCount: solvedCountRef.current,
      correctCount: correctCountRef.current,
      wrongCount: wrongCountRef.current,
    });
  };

  useEffect(() => {
    if (mode === 'mc' && currentWord) {
      generateChoices();
    }
  }, [currentIndex, mode, shuffleChoices]);

  useEffect(() => {
    if (!timerOn) return;
    if (normalizedTimerMode === 'session') {
      setSessionLeft(sessionSeconds);
    }
  }, [timerOn, normalizedTimerMode, sessionSeconds]);

  useEffect(() => {
    if (!timerOn || normalizedTimerMode !== 'perQuestion') return;
    setPerQuestionLeft(perQuestionSeconds);
  }, [timerOn, normalizedTimerMode, perQuestionSeconds, currentIndex]);

  useEffect(() => {
    if (!timerOn || normalizedTimerMode !== 'session') return;
    if (sessionLeft <= 0) return;

    const intervalId = window.setInterval(() => {
      setSessionLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [timerOn, normalizedTimerMode, sessionLeft]);

  useEffect(() => {
    if (!timerOn || normalizedTimerMode !== 'perQuestion') return;
    if (perQuestionLeft <= 0) return;

    const intervalId = window.setInterval(() => {
      setPerQuestionLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [timerOn, normalizedTimerMode, perQuestionLeft]);

  useEffect(() => {
    if (!timerOn || isFinalizedRef.current) return;

    if (normalizedTimerMode === 'session' && sessionLeft === 0) {
      isFinalizedRef.current = true;
      // Session 타이머 만료는 "완주"가 아니라 "중간 저장 후 종료" 정책으로 처리한다.
      // 남은 문제는 toeic_resume_v1에 저장되어 이어하기로 재개할 수 있다.
      onProgressSave(buildProgressPayload(false));
    }
  }, [timerOn, normalizedTimerMode, sessionLeft]);

  useEffect(() => {
    if (!timerOn || isFinalizedRef.current) return;
    if (normalizedTimerMode !== 'perQuestion' || perQuestionLeft !== 0) return;
    if (mode === 'mc' && selectedAnswer !== null) return;

    solvedCountRef.current += 1;
    wrongCountRef.current += 1;
    setWrongCount(wrongCountRef.current);
    wrongWordsRef.current = [...wrongWordsRef.current, currentWord];
    emitLiveUpdate();
    nextQuestion();
  }, [timerOn, normalizedTimerMode, perQuestionLeft, selectedAnswer, mode, currentWord]);

  const generateChoices = () => {
    const correctAnswer = answer;
    const otherWords = words.filter((w, i) => i !== currentIndex);
    const randomWords = otherWords
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(w => direction === 'en2ko' ? w.korean : w.english);

    const allChoices = [correctAnswer, ...randomWords];
    setChoices(shuffleChoices ? allChoices.sort(() => Math.random() - 0.5) : allChoices);
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window && direction === 'en2ko') {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.85;
      speechSynthesis.speak(utterance);
    }
  };

  const openNaverDict = (word: string) => {
    window.open(
      `https://en.dict.naver.com/#/search?query=${encodeURIComponent(word)}`,
      '_blank'
    );
  };

  const toggleFavorite = (word: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(word)) {
      newFavorites.delete(word);
    } else {
      newFavorites.add(word);
    }
    setFavorites(newFavorites);
    safeStorage.setItem('toeic_favorites', JSON.stringify(Array.from(newFavorites)));
  };

  const handleFlashReveal = () => {
    setIsRevealed(true);
    // Auto-play pronunciation when revealing
    if (direction === 'en2ko') {
      setTimeout(() => speak(currentWord.english), 300);
    }
  };

  const handleFlashAnswer = (knowIt: boolean) => {
    if (isFinalizedRef.current) return;
    solvedCountRef.current += 1;
    if (knowIt) {
      correctCountRef.current += 1;
      setScore(correctCountRef.current);
    } else {
      wrongCountRef.current += 1;
      setWrongCount(wrongCountRef.current);
      // Record wrong word
      wrongWordsRef.current = [...wrongWordsRef.current, currentWord];
    }
    emitLiveUpdate();
    nextQuestion();
  };

  const handleFlashDontKnow = () => {
    if (isFinalizedRef.current) return;
    if (!isRevealed) return;
    handleFlashAnswer(false);
  };

  const handleMCAnswer = (choice: string) => {
    solvedCountRef.current += 1;
    setSelectedAnswer(choice);
    const correct = choice === answer;
    setIsCorrect(correct);

    if (correct) {
      correctCountRef.current += 1;
      setScore(correctCountRef.current);
    } else {
      wrongCountRef.current += 1;
      setWrongCount(wrongCountRef.current);
      // Record wrong word
      wrongWordsRef.current = [...wrongWordsRef.current, currentWord];
    }
    emitLiveUpdate();

    setTimeout(() => {
      nextQuestion();
    }, 1200);
  };

  const buildProgressPayload = (completed: boolean) => {
    const hasAnsweredCurrent = mode === 'mc' && selectedAnswer !== null;
    const resumeIndex = completed ? words.length : currentIndex + (hasAnsweredCurrent ? 1 : 0);
    const remainingWords = words.slice(resumeIndex);

    return {
      solvedCount: solvedCountRef.current,
      correctCount: correctCountRef.current,
      wrongCount: wrongCountRef.current,
      wrongWords: wrongWordsRef.current,
      completed,
      currentIndex: resumeIndex,
      remainingWords,
    };
  };

  const handleCloseWithProgressSave = () => {
    if (isFinalizedRef.current) return;
    isFinalizedRef.current = true;
    onProgressSave(buildProgressPayload(false));
  };

  const nextQuestion = () => {
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsRevealed(false);
      setSelectedAnswer(null);
      setIsCorrect(null);
    } else {
      if (isFinalizedRef.current) return;
      isFinalizedRef.current = true;
      onComplete(buildProgressPayload(true));
    }
  };


  if (!currentWord) return null;

  const formatTime = (totalSec: number) => {
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-gray-100">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200">
                <span className="text-sm font-bold text-purple-700">
                  DAY{currentWord.day} · {DAY_CATEGORIES[currentWord.day]}
                </span>
              </div>
              <div className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                <span className="text-sm font-bold text-blue-700">{currentIndex + 1} / {words.length}</span>
              </div>
              <div className="px-4 py-2 rounded-full bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
                <span className="text-sm font-bold text-green-700">✓ {score}</span>
              </div>
              <div className="px-4 py-2 rounded-full bg-gradient-to-r from-red-50 to-rose-50 border border-red-200">
                <span className="text-sm font-bold text-red-700">✗ {wrongCount}</span>
              </div>
              {timerOn && normalizedTimerMode === 'perQuestion' && (
                <div className="px-4 py-2 rounded-full bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200">
                  <span className="text-sm font-bold text-orange-700">문항 {formatTime(perQuestionLeft)}</span>
                </div>
              )}
              {timerOn && normalizedTimerMode === 'session' && (
                <div className="px-4 py-2 rounded-full bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200">
                  <span className="text-sm font-bold text-orange-700">세션 {formatTime(sessionLeft)}</span>
                </div>
              )}
            </div>
            <button
              onClick={handleCloseWithProgressSave}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200 ml-4"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500"
              style={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 md:p-8">
          {mode === 'flash' ? (
            <div className="space-y-6 md:space-y-8">
              <div
                className={`
                  relative rounded-3xl overflow-hidden
                  bg-gradient-to-br from-white via-slate-50 to-blue-50/30
                  border border-gray-200/50 shadow-2xl
                  transition-all duration-300
                  ${!isRevealed
                    ? 'cursor-pointer hover:shadow-3xl hover:scale-[1.01] active:scale-[0.99]'
                    : 'shadow-xl'
                  }
                `}
                onClick={!isRevealed ? handleFlashReveal : undefined}
              >
                {/* Decorative gradient orbs */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl -mr-24 -mt-24" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-pink-400/20 to-orange-400/20 rounded-full blur-3xl -ml-24 -mb-24" />

                {/* Content */}
                <div className="relative z-10 flex flex-col items-center justify-center px-6 py-16 md:px-12 md:py-24">
                  <div className="text-center space-y-6 md:space-y-8 w-full max-w-2xl">
                    {/* Question */}
                    <div className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight bg-gradient-to-br from-gray-900 via-gray-700 to-gray-600 bg-clip-text text-transparent leading-tight">
                      {question}
                    </div>

                    {/* Answer (revealed) */}
                    {isRevealed && (
                      <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
                        <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
                          {answer}
                        </div>
                      </div>
                    )}
                    {/* Tap hint (not revealed) */}
                    {!isRevealed && (
                      <div className="pt-8 md:pt-12 flex flex-col items-center gap-3 opacity-60">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg animate-pulse">
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </div>
                        <p className="text-xs md:text-sm font-semibold text-gray-500">카드를 탭하여 뜻 확인</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isRevealed && (
                <div className="grid grid-cols-2 gap-3 md:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <button
                      onClick={handleFlashDontKnow}
                      className="group relative h-20 sm:h-24 md:h-28 rounded-2xl overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-rose-100 opacity-100 group-hover:opacity-90 transition-opacity" />
                      <div className="relative h-full flex flex-col items-center justify-center gap-1.5 md:gap-2">
                        <div className="text-2xl md:text-3xl">😵</div>
                        <span className="text-base md:text-lg font-bold text-red-700">몰라요</span>
                      </div>
                    </button>

                    <button
                      onClick={() => handleFlashAnswer(true)}
                      className="group relative h-20 sm:h-24 md:h-28 rounded-2xl overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-green-100 opacity-100 group-hover:opacity-90 transition-opacity" />
                      <div className="relative h-full flex flex-col items-center justify-center gap-1.5 md:gap-2">
                        <div className="text-2xl md:text-3xl">🎉</div>
                        <span className="text-base md:text-lg font-bold text-green-700">알아요</span>
                      </div>
                    </button>
                </div>
              )}
            </div>
          ) : mode === 'mc' ? (
            <div className="space-y-6 md:space-y-8">
              <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-white via-slate-50 to-indigo-50/30 border border-gray-200/50 shadow-2xl p-8 md:p-12">
                <div className="absolute top-0 right-0 w-32 h-32 md:w-48 md:h-48 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl -mr-16 md:-mr-24 -mt-16 md:-mt-24" />
                <div className="relative z-10 text-center">
                  <div className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight bg-gradient-to-br from-gray-900 via-gray-700 to-gray-600 bg-clip-text text-transparent leading-tight px-2">
                    {question}
                  </div>
                </div>
              </div>

              <div className="space-y-3 md:space-y-4">
                {choices.map((choice, index) => {
                  const isSelected = selectedAnswer === choice;
                  const isCorrectChoice = choice === answer;
                  const showCorrect = selectedAnswer && isCorrectChoice;
                  const showWrong = isSelected && !isCorrect;

                  return (
                    <button
                      key={index}
                      onClick={() => !selectedAnswer && handleMCAnswer(choice)}
                      disabled={!!selectedAnswer}
                      className={`
                        w-full group relative rounded-2xl p-4 md:p-6 text-left transition-all duration-300
                        ${!selectedAnswer
                          ? 'bg-white hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                          : ''
                        }
                        ${showCorrect
                          ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-green-400 shadow-lg shadow-green-200/50'
                          : ''
                        }
                        ${showWrong
                          ? 'bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-400 shadow-lg shadow-red-200/50'
                          : ''
                        }
                        ${selectedAnswer && !isSelected && !isCorrectChoice
                          ? 'bg-gray-50 border-2 border-gray-200 opacity-50'
                          : ''
                        }
                      `}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className={`
                          text-base md:text-lg font-bold flex-1
                          ${showCorrect ? 'text-green-700' : ''}
                          ${showWrong ? 'text-red-700' : ''}
                          ${!selectedAnswer ? 'text-gray-900 group-hover:text-blue-700' : ''}
                          ${selectedAnswer && !isSelected && !isCorrectChoice ? 'text-gray-500' : ''}
                        `}>
                          {choice}
                        </span>
                        {showCorrect && (
                          <div className="flex items-center gap-2 text-green-600 flex-shrink-0">
                            <span className="text-xl md:text-2xl">✓</span>
                          </div>
                        )}
                        {showWrong && (
                          <div className="flex items-center gap-2 text-red-600 flex-shrink-0">
                            <span className="text-xl md:text-2xl">✗</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Action buttons */}
          <div className="flex gap-2 md:gap-3 mt-6 md:mt-8">
            <button
              onClick={() => speak(currentWord.english)}
              className="flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <Volume2 className="w-4 h-4 text-gray-600" />
              <span className="text-xs md:text-sm font-semibold text-gray-700">발음</span>
            </button>
            <button
              onClick={() => toggleFavorite(currentWord.english)}
              className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-3 rounded-xl border transition-all duration-200 hover:scale-105 active:scale-95 ${
                favorites.has(currentWord.english)
                  ? 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <Star className={`w-4 h-4 ${favorites.has(currentWord.english) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-600'}`} />
              <span className={`text-xs md:text-sm font-semibold ${favorites.has(currentWord.english) ? 'text-yellow-700' : 'text-gray-700'}`}>
                즐겨찾기
              </span>
            </button>
            <button
              onClick={() => openNaverDict(currentWord.english)}
              className="flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <BookOpen className="w-4 h-4 text-gray-600" />
              <span className="text-xs md:text-sm font-semibold text-gray-700">사전</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
