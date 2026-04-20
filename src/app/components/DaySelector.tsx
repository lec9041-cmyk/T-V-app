import { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { X, Check, Shuffle } from 'lucide-react';

interface DaySelectorProps {
  selectedDays: number[];
  onDaysChange: (days: number[]) => void;
  onClose: () => void;
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

export function DaySelector({ selectedDays, onDaysChange, onClose }: DaySelectorProps) {
  const [localSelected, setLocalSelected] = useState<number[]>(selectedDays);

  const totalDays = 30; // Total days available
  const days = Array.from({ length: totalDays }, (_, i) => i + 1);

  const toggleDay = (day: number) => {
    if (localSelected.includes(day)) {
      setLocalSelected(localSelected.filter(d => d !== day));
    } else {
      setLocalSelected([...localSelected, day]);
    }
  };

  const selectAll = () => {
    setLocalSelected(days);
  };

  const clearAll = () => {
    setLocalSelected([]);
  };

  const selectRandom = (count: number = 5) => {
    const shuffled = [...days].sort(() => Math.random() - 0.5);
    setLocalSelected(shuffled.slice(0, count));
  };

  const handleConfirm = () => {
    onDaysChange(localSelected);
    onClose();
  };

  const getDayCategory = (day: number) => {
    // Just for visual variety
    if (day <= 10) return 'core';
    if (day <= 20) return 'basic';
    return '800';
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'core': return 'from-blue-500 to-indigo-500';
      case 'basic': return 'from-purple-500 to-pink-500';
      case '800': return 'from-orange-500 to-amber-500';
      case '900': return 'from-green-500 to-emerald-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getCategoryBg = (category: string) => {
    switch (category) {
      case 'core': return 'from-blue-50 to-indigo-50';
      case 'basic': return 'from-purple-50 to-pink-50';
      case '800': return 'from-orange-50 to-amber-50';
      case '900': return 'from-green-50 to-emerald-50';
      default: return 'from-gray-50 to-gray-100';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">DAY 선택</h2>
              <p className="text-sm text-gray-500 mt-1">
                학습할 DAY를 선택하세요 ({localSelected.length}개 선택됨)
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={selectAll}
              className="rounded-full"
            >
              전체 선택
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={clearAll}
              className="rounded-full"
            >
              전체 해제
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => selectRandom(5)}
              className="rounded-full"
            >
              <Shuffle className="w-3 h-3 mr-1" />
              랜덤 5개
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => selectRandom(10)}
              className="rounded-full"
            >
              <Shuffle className="w-3 h-3 mr-1" />
              랜덤 10개
            </Button>
          </div>
        </div>

        {/* Day Grid */}
        <div className="flex-1 overflow-auto p-6 md:p-8">
          {/* Category Groups */}
          <div className="space-y-8">
            {[
              { name: 'DAY 1-10', range: [1, 10], category: 'core' },
              { name: 'DAY 11-20', range: [11, 20], category: 'basic' },
              { name: 'DAY 21-30', range: [21, totalDays], category: '800' },
            ].map((group) => {
              const groupDays = days.filter(d => d >= group.range[0] && d <= group.range[1]);
              const selectedInGroup = groupDays.filter(d => localSelected.includes(d)).length;

              return (
                <div key={group.category}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">{group.name}</h3>
                    <Badge variant="outline" className="font-semibold">
                      {selectedInGroup} / {groupDays.length}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                    {groupDays.map((day) => {
                      const isSelected = localSelected.includes(day);
                      const category = getDayCategory(day);
                      const categoryName = DAY_CATEGORIES[day] || '';

                      return (
                        <button
                          key={day}
                          onClick={() => toggleDay(day)}
                          className={`
                            relative rounded-2xl transition-all duration-200 p-4 min-h-[80px] flex flex-col items-center justify-center gap-1
                            ${isSelected
                              ? `bg-gradient-to-br ${getCategoryColor(category)} shadow-lg shadow-${category === 'core' ? 'blue' : category === 'basic' ? 'purple' : category === '800' ? 'orange' : 'green'}-200/50 scale-105`
                              : `bg-gradient-to-br ${getCategoryBg(category)} hover:scale-105 border-2 border-gray-200 hover:border-gray-300`
                            }
                          `}
                        >
                          <span className={`text-lg md:text-xl font-black ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                            DAY{day}
                          </span>
                          <span className={`text-xs font-semibold ${isSelected ? 'text-white/90' : 'text-gray-600'}`}>
                            {categoryName}
                          </span>
                          {isSelected && (
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center">
                              <Check className="w-4 h-4 text-green-600" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 md:p-8 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{localSelected.length}개</span> DAY 선택됨
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="rounded-xl"
              >
                취소
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={localSelected.length === 0}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                확인
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
