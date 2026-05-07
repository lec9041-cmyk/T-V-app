import { useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, X, XCircle } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface Word {
  day: number;
  no: number;
  english: string;
  korean: string;
  index: number;
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

interface WrittenExamResultItem {
  word: Word;
  answerText: string;
  autoCorrect: boolean;
  finalCorrect: boolean;
  questionText: string;
  correctAnswer: string;
}

interface WrittenExamModalProps {
  words: Word[];
  direction: 'en2ko' | 'ko2en';
  onComplete: (progress: QuizSessionProgress) => void;
  onClose: () => void;
  onReviewWrongWords: (wrongWords: Word[]) => void;
}

interface ExamItem {
  word: Word;
  answerText: string;
  autoCorrect: boolean | null;
  finalCorrect: boolean | null;
  graded: boolean;
}

const PAGE_SIZE = 5;

const normalizeAnswer = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const getQuestionText = (word: Word, direction: 'en2ko' | 'ko2en') => (
  direction === 'en2ko' ? word.english : word.korean
);

const getCorrectAnswer = (word: Word, direction: 'en2ko' | 'ko2en') => (
  direction === 'en2ko' ? word.korean : word.english
);

const checkAnswer = (word: Word, answerText: string, direction: 'en2ko' | 'ko2en') => {
  const normalizedInput = normalizeAnswer(answerText);

  if (!normalizedInput) return false;

  const correctAnswer = getCorrectAnswer(word, direction);
  const normalizedCorrect = normalizeAnswer(correctAnswer);

  if (direction === 'ko2en') {
    return normalizedInput === normalizedCorrect;
  }

  const candidates = correctAnswer
    .split(/[,/;]/)
    .map(normalizeAnswer)
    .filter(Boolean);

  return normalizedInput === normalizedCorrect || candidates.includes(normalizedInput);
};

export function WrittenExamModal({
  words,
  direction,
  onComplete,
  onClose,
  onReviewWrongWords,
}: WrittenExamModalProps) {
  const [examItems, setExamItems] = useState<ExamItem[]>(() =>
    words.map((word) => ({
      word,
      answerText: '',
      autoCorrect: null,
      finalCorrect: null,
      graded: false,
    }))
  );
  const [currentPage, setCurrentPage] = useState(0);
  const [isGraded, setIsGraded] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [resultItems, setResultItems] = useState<WrittenExamResultItem[]>([]);

  const totalPages = Math.max(1, Math.ceil(examItems.length / PAGE_SIZE));
  const currentPageItems = examItems.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);
  const completedAnswerCount = examItems.filter((item) => item.answerText.trim().length > 0).length;
  const emptyAnswerCount = examItems.length - completedAnswerCount;

  const wrongResultItems = useMemo(() => (
    resultItems.filter((item) => !item.finalCorrect)
  ), [resultItems]);

  const manualEditedCount = examItems.filter((item) => (
    item.autoCorrect !== null && item.finalCorrect !== null && item.autoCorrect !== item.finalCorrect
  )).length;

  const resultSummary = useMemo(() => {
    const total = resultItems.length;
    const correct = resultItems.filter((item) => item.finalCorrect).length;
    const wrong = total - correct;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    return { total, correct, wrong, accuracy };
  }, [resultItems]);

  const updateAnswer = (itemIndex: number, answerText: string) => {
    if (isGraded) return;

    setExamItems((prev) => prev.map((item, index) => (
      index === itemIndex ? { ...item, answerText } : item
    )));
  };

  const gradeExam = () => {
    setExamItems((prev) => prev.map((item) => {
      const autoCorrect = checkAnswer(item.word, item.answerText, direction);

      return {
        ...item,
        autoCorrect,
        finalCorrect: autoCorrect,
        graded: true,
      };
    }));
    setIsGraded(true);
  };

  const setFinalCorrect = (itemIndex: number, finalCorrect: boolean) => {
    if (!isGraded) return;

    setExamItems((prev) => prev.map((item, index) => (
      index === itemIndex ? { ...item, finalCorrect } : item
    )));
  };

  const submitFinal = () => {
    const results = examItems.map((item) => ({
      word: item.word,
      answerText: item.answerText,
      autoCorrect: item.autoCorrect === true,
      finalCorrect: item.finalCorrect === true,
      questionText: getQuestionText(item.word, direction),
      correctAnswer: getCorrectAnswer(item.word, direction),
    }));
    const wrongWords = results.filter((item) => !item.finalCorrect).map((item) => item.word);
    const correctCount = results.filter((item) => item.finalCorrect).length;

    onComplete({
      solvedCount: examItems.length,
      correctCount,
      wrongCount: examItems.length - correctCount,
      wrongWords,
      completed: true,
      currentIndex: words.length,
      remainingWords: [],
    });

    setResultItems(results);
    setIsSubmitted(true);
  };

  const resetExam = () => {
    setExamItems(words.map((word) => ({
      word,
      answerText: '',
      autoCorrect: null,
      finalCorrect: null,
      graded: false,
    })));
    setCurrentPage(0);
    setIsGraded(false);
    setIsSubmitted(false);
    setResultItems([]);
  };

  if (isSubmitted) {
    return (
      <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-3 md:p-4">
        <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
          <div className="p-4 md:p-6 border-b border-gray-100 bg-white flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl md:text-xl font-black text-gray-900">주관식 시험 결과</h2>
              <p className="text-sm text-gray-500 mt-1">수동 보정 결과를 기준으로 통계에 반영했어요.</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-500" aria-label="닫기">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-3 md:p-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div className="rounded-2xl bg-slate-50 border border-gray-200 p-3">
                <div className="text-xs font-bold text-gray-500">총 문제 수</div>
                <div className="text-xl font-black text-gray-900 mt-1">{resultSummary.total}</div>
              </div>
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3">
                <div className="text-xs font-bold text-emerald-600">정답 수</div>
                <div className="text-xl font-black text-emerald-700 mt-1">{resultSummary.correct}</div>
              </div>
              <div className="rounded-2xl bg-rose-50 border border-rose-100 p-3">
                <div className="text-xs font-bold text-rose-600">오답 수</div>
                <div className="text-xl font-black text-rose-700 mt-1">{resultSummary.wrong}</div>
              </div>
              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-3">
                <div className="text-xs font-bold text-blue-600">정답률</div>
                <div className="text-xl font-black text-blue-700 mt-1">{resultSummary.accuracy}%</div>
              </div>
              <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3">
                <div className="text-xs font-bold text-amber-600">미입력 수</div>
                <div className="text-xl font-black text-amber-700 mt-1">{emptyAnswerCount}</div>
              </div>
              <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-3">
                <div className="text-xs font-bold text-indigo-600">수동 수정</div>
                <div className="text-xl font-black text-indigo-700 mt-1">{manualEditedCount}</div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-black text-gray-900 mb-3">오답 목록</h3>
              {wrongResultItems.length === 0 ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-semibold text-emerald-700">
                  오답이 없습니다. 완벽해요!
                </div>
              ) : (
                <div className="space-y-3">
                  {wrongResultItems.map((item) => (
                    <div key={`${item.word.day}-${item.word.no}-${item.word.index}`} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                      <div className="text-xs font-bold text-gray-400">DAY {item.word.day} · #{item.word.no}</div>
                      <div className="text-base font-black text-gray-900 mt-1 break-words">{item.questionText}</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-xs">
                        <div className="rounded-xl bg-rose-50 border border-rose-100 p-2">
                          <span className="font-bold text-rose-600">내 답: </span>
                          <span className="text-gray-800">{item.answerText.trim() || '미입력'}</span>
                        </div>
                        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2">
                          <span className="font-bold text-emerald-600">정답: </span>
                          <span className="text-gray-800">{item.correctAnswer}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 bg-white p-3 md:p-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => onReviewWrongWords(wrongResultItems.map((item) => item.word))} disabled={wrongResultItems.length === 0} className="rounded-xl">
              오답 복습
            </Button>
            <Button variant="outline" onClick={resetExam} className="rounded-xl">
              <RotateCcw className="w-4 h-4 mr-2" />
              다시 시험
            </Button>
            <Button onClick={onClose} className="rounded-xl bg-gray-900 hover:bg-gray-800">
              닫기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-3 md:p-4">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        <div className="p-4 md:p-6 border-b border-gray-100 bg-white flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-xl font-black text-gray-900">주관식 시험</h2>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50">총 {examItems.length}문제</Badge>
              <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">입력 {completedAnswerCount}개</Badge>
              <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50">{currentPage + 1} / {totalPages}페이지</Badge>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-500" aria-label="닫기">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3 md:p-4 space-y-2">
          {currentPageItems.map((item, offset) => {
            const itemIndex = currentPage * PAGE_SIZE + offset;
            const questionText = getQuestionText(item.word, direction);
            const correctAnswer = getCorrectAnswer(item.word, direction);
            const isManualEdited = item.autoCorrect !== null && item.finalCorrect !== null && item.autoCorrect !== item.finalCorrect;

            return (
              <div key={`${item.word.day}-${item.word.no}-${item.word.index}`} className="rounded-2xl bg-gradient-to-br from-white via-slate-50 to-indigo-50/30 border border-gray-200/70 shadow-sm p-3 md:p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(120px,45%)] gap-3 items-center">
                  <div className="min-w-0">
                    <div className="text-[10px] md:text-xs font-bold text-gray-400">{itemIndex + 1}. DAY {item.word.day} · #{item.word.no}</div>
                    <div className="text-base md:text-lg font-black text-gray-900 mt-1 break-words leading-snug">{questionText}</div>
                  </div>
                  <input
                    value={item.answerText}
                    onChange={(event) => updateAnswer(itemIndex, event.target.value)}
                    disabled={isGraded}
                    readOnly={isGraded}
                    placeholder="답 입력"
                    className="min-w-[120px] w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-blue-400 disabled:bg-gray-100 disabled:text-gray-700 disabled:cursor-not-allowed"
                  />
                </div>

                {isGraded && (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge className={item.autoCorrect ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-rose-100 text-rose-700 hover:bg-rose-100'}>
                        {item.autoCorrect ? '자동 정답' : '자동 오답'}
                      </Badge>
                      {isManualEdited && (
                        <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">수동 수정됨</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-white border border-gray-200 p-2 break-words">
                        <span className="font-bold text-gray-500">내 답: </span>
                        <span className="font-semibold text-gray-900">{item.answerText.trim() || '미입력'}</span>
                      </div>
                      <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2 break-words">
                        <span className="font-bold text-emerald-600">정답: </span>
                        <span className="font-semibold text-gray-900">{correctAnswer}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant={item.finalCorrect ? 'default' : 'outline'} onClick={() => setFinalCorrect(itemIndex, true)} className="h-8 rounded-xl px-2 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        정답 처리
                      </Button>
                      <Button size="sm" variant={item.finalCorrect === false ? 'destructive' : 'outline'} onClick={() => setFinalCorrect(itemIndex, false)} className="h-8 rounded-xl px-2 text-xs">
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        오답 처리
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-gray-100 bg-white p-3 md:p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-gray-500">미입력 {emptyAnswerCount}개</div>
          <div className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setCurrentPage((page) => Math.max(page - 1, 0))} disabled={currentPage === 0} className="rounded-xl flex-1 sm:flex-none">
              이전
            </Button>
            {currentPage < totalPages - 1 ? (
              <Button onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages - 1))} className="rounded-xl flex-1 sm:flex-none">
                다음
              </Button>
            ) : isGraded ? (
              <Button onClick={submitFinal} className="rounded-xl flex-1 sm:flex-none bg-gray-900 hover:bg-gray-800">
                최종 제출
              </Button>
            ) : (
              <Button onClick={gradeExam} className="rounded-xl flex-1 sm:flex-none bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                가채점하기
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
