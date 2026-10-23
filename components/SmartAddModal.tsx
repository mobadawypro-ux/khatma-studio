import React, { useState, useMemo, useEffect } from 'react';
import { Khatma, FeaturedParticipant, ParticipantStats } from '../types';
import {
  MAX_PARTS_PER_PERSON,
  computeSmartAddPlan,
  formatJuzRanges,
  generateId,
  createStandardSlots
} from '../constants';

interface Props {
  khatmas: Khatma[];
  participantsStats: ParticipantStats[];
  initialParticipantName?: string;
  inline?: boolean;
  onClose?: () => void;
  onApplyUpdates: (updatedKhatmas: Khatma[], newKhatmas: Khatma[], summaryMessage: string) => Promise<void>;
  onAddFeatured: (participant: FeaturedParticipant) => Promise<void>;
  onOpenFeaturedManager: () => void;
}

export const SmartAddModal: React.FC<Props> = ({
  khatmas,
  participantsStats,
  initialParticipantName = '',
  inline = false,
  onClose,
  onApplyUpdates,
  onAddFeatured,
  onOpenFeaturedManager
}) => {
  const featuredParticipants = useMemo(
    () => participantsStats.filter(p => p.isFeatured),
    [participantsStats]
  );

  // Top 5 users from database who completed the most parts
  const top5CompletedParticipants = useMemo(
    () =>
      [...participantsStats]
        .filter(p => p.completedParts > 0)
        .sort((a, b) => {
          if (b.completedParts !== a.completedParts) {
            return b.completedParts - a.completedParts;
          }
          return b.totalParts - a.totalParts;
        })
        .slice(0, 5),
    [participantsStats]
  );

  const [participantName, setParticipantName] = useState<string>(initialParticipantName);
  const [showFeaturedQuickList, setShowFeaturedQuickList] = useState<boolean>(false);

  useEffect(() => {
    if (initialParticipantName) {
      setParticipantName(initialParticipantName);
      setHasSearched(false);
    }
  }, [initialParticipantName]);

  // Selected range presets (1-5, 6-10, 11-15, 16-20, 21-25, 26-30)
  const rangePresets = [
    { label: '١-٥', start: 1, end: 5 },
    { label: '٦-١٠', start: 6, end: 10 },
    { label: '١١-١٥', start: 11, end: 15 },
    { label: '١٦-٢٠', start: 16, end: 20 },
    { label: '٢١-٢٥', start: 21, end: 25 },
    { label: '٢٦-٣٠', start: 26, end: 30 }
  ];

  // Active preset ranges (can select multiple ranges: "يمكن اختيار أكثر من نطاق")
  const [selectedRanges, setSelectedRanges] = useState<string[]>([]);

  // Checkboxes matching the exact image text
  const [replaceSlowReaders, setReplaceSlowReaders] = useState<boolean>(false);
  const [markAsCompleted, setMarkAsCompleted] = useState<boolean>(false);

  // Result search state
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [autoCreateKhatmaForRemaining, setAutoCreateKhatmaForRemaining] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Derive active selected Juz from selected ranges
  const activeSelectedJuz = useMemo(() => {
    const juzSet = new Set<number>();
    selectedRanges.forEach(presetLabel => {
      const preset = rangePresets.find(p => p.label === presetLabel);
      if (preset) {
        for (let i = preset.start; i <= preset.end; i++) {
          juzSet.add(i);
        }
      }
    });
    return Array.from(juzSet).sort((a, b) => a - b);
  }, [selectedRanges]);

  const toggleRangePreset = (label: string) => {
    setHasSearched(false);
    setErrorMessage(null);
    setSelectedRanges(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const smartPlan = useMemo(
    () =>
      computeSmartAddPlan(
        khatmas,
        participantName,
        activeSelectedJuz,
        markAsCompleted,
        replaceSlowReaders,
        'AUTO'
      ),
    [khatmas, participantName, activeSelectedJuz, markAsCompleted, replaceSlowReaders]
  );

  const getNextKhatmaNumber = (existing: Khatma[], offset: number = 0): string => {
    const numericNumbers = existing
      .map(k => parseInt(k.number, 10))
      .filter(n => !isNaN(n));
    const maxNum = numericNumbers.length > 0 ? Math.max(...numericNumbers) : 100;
    return String(maxNum + 1 + offset);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = participantName.trim();
    if (!cleanName) {
      setErrorMessage('يرجى إدخال أو اختيار اسم المشارك أولاً.');
      return;
    }

    if (activeSelectedJuz.length === 0) {
      setErrorMessage('يرجى اختيار نطاق أجزاء واحد على الأقل.');
      return;
    }

    setHasSearched(true);
  };

  const handleConfirmAllocation = async () => {
    const cleanName = participantName.trim();
    if (!cleanName || activeSelectedJuz.length === 0) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Auto-save name to featured participants if not already saved
      if (!participantsStats.some(p => p.name === cleanName)) {
        await onAddFeatured({
          id: generateId(),
          name: cleanName,
          createdAt: Date.now()
        });
      }

      const updatedKhatmas = smartPlan.allocations.map(a => a.updatedKhatma);
      const newKhatmas: Khatma[] = [];

      // Create new Khatma if remaining unassigned
      if (autoCreateKhatmaForRemaining && smartPlan.unassignedJuz.length > 0) {
        const remaining = [...smartPlan.unassignedJuz].sort((a, b) => a - b);
        let chunkIndex = 0;
        for (let i = 0; i < remaining.length; i += MAX_PARTS_PER_PERSON) {
          const chunk = remaining.slice(i, i + MAX_PARTS_PER_PERSON);
          const chunkSet = new Set(chunk);
          const nextNum = getNextKhatmaNumber(khatmas, chunkIndex);
          const nowTs = Date.now();
          const slots = createStandardSlots().map(slot =>
            chunkSet.has(slot.startJuz)
              ? {
                  ...slot,
                  reservedBy: cleanName,
                  isCompleted: markAsCompleted,
                  reservedAt: nowTs
                }
              : slot
          );


          newKhatmas.push({
            id: generateId(),
            number: nextNum,
            description: `أُنشئت تلقائياً عبر الإضافة الذكية`,
            createdAt: Date.now() + chunkIndex,
            slots
          });
          chunkIndex++;
        }
      }

      const summaryLines: string[] = [];
      smartPlan.allocations.forEach(alloc => {
        summaryLines.push(
          `• الخاتمة ${alloc.khatma.number}: الأجزاء (${formatJuzRanges(alloc.assignedJuz)}) — حصة المشارك: ${alloc.newUserParts}/${MAX_PARTS_PER_PERSON}`
        );
      });
      newKhatmas.forEach(nk => {
        const assignedInNew = nk.slots
          .filter(s => s.reservedBy === cleanName)
          .map(s => s.startJuz);
        summaryLines.push(
          `• خاتمة جديدة رقم ${nk.number}: الأجزاء (${formatJuzRanges(assignedInNew)}) — حصة المشارك: ${assignedInNew.length}/${MAX_PARTS_PER_PERSON}`
        );
      });

      const statusLabel = markAsCompleted ? 'تمت قراءتها ✅' : 'محجوزة قيد القراءة ⏳';
      const summaryMessage =
        `تم تسكين الأجزاء للمشارك "${cleanName}" (${statusLabel}):\n` +
        summaryLines.join('\n');

      await onApplyUpdates(updatedKhatmas, newKhatmas, summaryMessage);
      setHasSearched(false);
      setSelectedRanges([]);
      if (onClose) onClose();
    } catch (err) {
      console.error('Error in applying allocation:', err);
      setErrorMessage('حدث خطأ أثناء حفظ التسكين. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const rankBadges = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

  const cardContent = (
    <div
      className={`bg-white rounded-[32px] border border-emerald-100/90 overflow-hidden flex flex-col ${
        inline
          ? 'w-full max-w-2xl mx-auto shadow-md mb-8'
          : 'w-full max-w-lg my-auto shadow-2xl'
      }`}
    >
      {/* Top Header matching exact visual title and icon */}
      <div className="p-6 pb-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 text-2xl">⚡</span>
          <h2 className="text-xl sm:text-2xl font-black text-emerald-900">
            الإضافة الذكية والمشاركين المميزين
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Button that hides/shows Featured Participants */}
          <button
            type="button"
            onClick={() => setShowFeaturedQuickList(prev => !prev)}
            className={`text-xs font-black px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
              showFeaturedQuickList
                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
            }`}
          >
            <span>⭐</span>
            <span>المشاركون المميزون ({featuredParticipants.length})</span>
          </button>

          {!inline && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold flex items-center justify-center transition-colors text-sm"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Featured Participants Drawer (Hidden inside the button until clicked) */}
      {showFeaturedQuickList && (
        <div className="mx-6 mt-4 p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
              <span>⭐</span>
              <span>قائمة المشاركين المميزين (اضغط على الاسم لاختياره)</span>
            </span>
            <button
              type="button"
              onClick={onOpenFeaturedManager}
              className="text-[11px] font-black bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-lg transition-colors"
            >
              ⚙️ إضافة / تعديل المميزين
            </button>
          </div>

          {featuredParticipants.length === 0 ? (
            <div className="text-xs font-bold text-amber-800 flex items-center justify-between gap-2 bg-white/80 p-2.5 rounded-xl border border-amber-100">
              <span>لا يوجد مشاركون مميزون مضافون حالياً.</span>
              <button
                type="button"
                onClick={onOpenFeaturedManager}
                className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-lg text-[11px] font-black"
              >
                ➕ إضافة الآن
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {featuredParticipants.map(fp => {
                const isSelected = participantName.trim() === fp.name;
                return (
                  <button
                    key={fp.name}
                    type="button"
                    onClick={() => {
                      setParticipantName(fp.name);
                      setHasSearched(false);
                      setErrorMessage(null);
                    }}
                    className={`text-xs font-black px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-gray-800 border-amber-200 hover:border-emerald-400'
                    }`}
                  >
                    <span>⭐</span>
                    <span>{fp.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                        isSelected
                          ? 'bg-emerald-700 text-emerald-100'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {fp.completedParts} جزء
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Top 5 Users Who Completed the Most Parts (From Database) */}
      {top5CompletedParticipants.length > 0 && (
        <div className="mx-6 mt-4 p-3.5 bg-gradient-to-l from-emerald-50/90 to-teal-50/60 border border-emerald-200/80 rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
              <span>🏆</span>
              <span>أكثر 5 مشاركين إتماماً للأجزاء (من قاعدة البيانات)</span>
            </span>
            <span className="text-[10px] font-bold text-emerald-600">اضغط للاختيار</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {top5CompletedParticipants.map((user, index) => {
              const isSelected = participantName.trim() === user.name;
              return (
                <button
                  key={user.name}
                  type="button"
                  onClick={() => {
                    setParticipantName(user.name);
                    setHasSearched(false);
                    setErrorMessage(null);
                  }}
                  className={`p-2 rounded-xl border text-right transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm scale-[1.02]'
                      : 'bg-white hover:bg-emerald-50/70 text-gray-800 border-emerald-100 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span className="text-xs">{rankBadges[index] || '⭐'}</span>
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                        isSelected
                          ? 'bg-emerald-800 text-emerald-100'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {user.completedParts} جزء
                    </span>
                  </div>
                  <div
                    className={`text-xs font-black truncate mt-1 w-full ${
                      isSelected ? 'text-white' : 'text-gray-800'
                    }`}
                    title={user.name}
                  >
                    {user.name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Subtitle label */}
      <div className="px-6 pt-4 pb-1 text-right">
        <span className="text-base font-black text-gray-600">بحث عن أنسب ختمة</span>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSearch} className="p-6 pt-2 space-y-5">
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between">
            <span>⚠️ {errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-600 font-black"
            >
              ✕
            </button>
          </div>
        )}

        {/* Input 1: اسم المشارك (Input + Droplist) */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-500 text-right">
            اسم المشارك
          </label>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                list="participants-datalist"
                value={participantName}
                onChange={e => {
                  setParticipantName(e.target.value);
                  setHasSearched(false);
                  setErrorMessage(null);
                }}
                placeholder="أدخل الاسم..."
                className="w-full bg-white border border-gray-200 focus:border-emerald-600 rounded-2xl px-5 py-3.5 text-base font-bold text-gray-800 text-right outline-none transition-all shadow-2xs"
              />
              <datalist id="participants-datalist">
                {participantsStats.map(p => (
                  <option key={p.name} value={p.name}>
                    {p.isFeatured ? '⭐ ' : ''}{p.name} (أتم {p.completedParts} جزء)
                  </option>
                ))}
              </datalist>
            </div>

            {participantsStats.length > 0 && (
              <select
                value={participantsStats.some(p => p.name === participantName) ? participantName : ''}
                onChange={e => {
                  if (e.target.value) {
                    setParticipantName(e.target.value);
                    setHasSearched(false);
                    setErrorMessage(null);
                  }
                }}
                className="bg-gray-50 hover:bg-gray-100 border border-gray-200 focus:border-emerald-600 rounded-2xl px-4 py-3.5 text-xs font-black text-gray-700 outline-none cursor-pointer sm:w-52"
              >
                <option value="">📋 اختر من القائمة...</option>
                {top5CompletedParticipants.length > 0 && (
                  <optgroup label="🏆 الأكثر إتماماً للأجزاء (أعلى 5)">
                    {top5CompletedParticipants.map((p, i) => (
                      <option key={`top5-${p.name}`} value={p.name}>
                        {rankBadges[i]} {p.name} ({p.completedParts} جزء مكتمل)
                      </option>
                    ))}
                  </optgroup>
                )}
                {featuredParticipants.length > 0 && (
                  <optgroup label="⭐ المشاركون المميزون">
                    {featuredParticipants.map(p => (
                      <option key={`feat-opt-${p.name}`} value={p.name}>
                        ⭐ {p.name} ({p.completedParts} جزء مكتمل)
                      </option>
                    ))}
                  </optgroup>
                )}
                {participantsStats.length > 0 && (
                  <optgroup label="👥 جميع المشاركين">
                    {participantsStats.map(p => (
                      <option key={`all-opt-${p.name}`} value={p.name}>
                        {p.name} ({p.completedParts} جزء مكتمل)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
          </div>
        </div>

        {/* Quick Range Selector matching exact 2-row layout in screenshot */}
        <div className="space-y-2.5">
          <label className="block text-sm font-bold text-gray-500 text-right">
            اختيار سريع للأجزاء (يمكن اختيار أكثر من نطاق)
          </label>

          {/* Row 1: 1-5, 6-10, 11-15, 16-20 */}
          <div className="grid grid-cols-4 gap-2.5">
            {rangePresets.slice(0, 4).map(preset => {
              const isSelected = selectedRanges.includes(preset.label);
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => toggleRangePreset(preset.label)}
                  className={`h-12 rounded-2xl font-black text-sm sm:text-base transition-all border flex items-center justify-center ${
                    isSelected
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                      : 'bg-white border-emerald-100 text-teal-800 hover:border-emerald-300'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Row 2: 21-25, 26-30 */}
          <div className="grid grid-cols-2 gap-2.5">
            {rangePresets.slice(4, 6).map(preset => {
              const isSelected = selectedRanges.includes(preset.label);
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => toggleRangePreset(preset.label)}
                  className={`h-12 rounded-2xl font-black text-sm sm:text-base transition-all border flex items-center justify-center ${
                    isSelected
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                      : 'bg-white border-emerald-100 text-teal-800 hover:border-emerald-300'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {activeSelectedJuz.length > 0 && (
            <div className="text-xs font-bold text-emerald-700 text-right">
              الأجزاء المختارة: {formatJuzRanges(activeSelectedJuz)} ({activeSelectedJuz.length} أجزاء)
            </div>
          )}
        </div>

        {/* Checkbox 1 (Yellow Box) */}
        <label
          htmlFor="chk-replace-inline"
          className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex items-center justify-end gap-3 shadow-2xs cursor-pointer select-none"
        >
          <span className="text-xs sm:text-sm font-black text-amber-900 leading-relaxed text-right flex-1">
            هذا المشارك أتم القراءة بالفعل (استبدال وتسريع الختمات)
          </span>
          <input
            id="chk-replace-inline"
            type="checkbox"
            checked={replaceSlowReaders}
            onChange={e => {
              setReplaceSlowReaders(e.target.checked);
              setHasSearched(false);
            }}
            className="w-5 h-5 accent-emerald-700 rounded cursor-pointer shrink-0"
          />
        </label>

        {/* Checkbox 2 (Light Green Box) */}
        <div className="flex justify-start">
          <label
            htmlFor="chk-complete-inline"
            className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl px-4 py-3 inline-flex items-center justify-end gap-3 shadow-2xs cursor-pointer select-none"
          >
            <span className="text-xs sm:text-sm font-black text-emerald-900 text-right">
              وضع علامة "مكتمل" على الأجزاء فور التسكين
            </span>
            <input
              id="chk-complete-inline"
              type="checkbox"
              checked={markAsCompleted}
              onChange={e => {
                setMarkAsCompleted(e.target.checked);
                setHasSearched(false);
              }}
              className="w-5 h-5 accent-emerald-700 rounded cursor-pointer shrink-0"
            />
          </label>
        </div>

        {/* Main Action Button */}
        <button
          type="submit"
          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-4 px-6 rounded-2xl text-base sm:text-lg shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2"
        >
          بحث عن الاقتراح الأنسب
        </button>

        {/* Results section shown when searched */}
        {hasSearched && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3 animate-in fade-in duration-200">
            <h3 className="text-xs font-black text-emerald-900 text-right">
              🎯 الاقتراح الأنسب للأجزاء المحددة (الحد الأقصى {MAX_PARTS_PER_PERSON} أجزاء بالخاتمة):
            </h3>

            {smartPlan.allocations.length === 0 && smartPlan.unassignedJuz.length > 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-right space-y-2">
                <div className="text-xs font-bold text-amber-900">
                  لم تتسع الختمات المفتوحة حالياً لهذه الأجزاء ({formatJuzRanges(smartPlan.unassignedJuz)}).
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-emerald-900 bg-white p-2.5 rounded-xl border border-amber-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCreateKhatmaForRemaining}
                    onChange={e => setAutoCreateKhatmaForRemaining(e.target.checked)}
                    className="w-4 h-4 accent-emerald-700 rounded"
                  />
                  <span>إنشاء ختمة جديدة تلقائياً وتسكين الأجزاء فيها</span>
                </label>
                <button
                  type="button"
                  disabled={isSubmitting || !autoCreateKhatmaForRemaining}
                  onClick={handleConfirmAllocation}
                  className="w-full bg-emerald-700 disabled:opacity-50 text-white font-black py-3 rounded-xl text-xs hover:bg-emerald-800 transition-colors mt-2"
                >
                  {isSubmitting ? 'جاري التنفيذ...' : 'تأكيد وإنشاء الخاتمة الجديدة'}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {smartPlan.allocations.map(alloc => (
                  <div
                    key={alloc.khatma.id}
                    className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-right space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-emerald-900 text-sm">
                        الخاتمة رقم {alloc.khatma.number}
                      </span>
                      <span className="bg-emerald-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-lg">
                        حصة المشارك: {alloc.newUserParts} / {MAX_PARTS_PER_PERSON}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-emerald-800">
                      الأجزاء المسكنة: {formatJuzRanges(alloc.assignedJuz)}
                    </div>
                    <div className="text-[11px] font-medium text-gray-500">
                      {alloc.matchReason}
                    </div>
                  </div>
                ))}

                {smartPlan.unassignedJuz.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-right space-y-2">
                    <div className="text-xs font-bold text-amber-900">
                      أجزاء متبقية ({formatJuzRanges(smartPlan.unassignedJuz)}):
                    </div>
                    <label className="flex items-center gap-2 text-xs font-bold text-emerald-900 bg-white p-2 rounded-xl border border-amber-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoCreateKhatmaForRemaining}
                        onChange={e => setAutoCreateKhatmaForRemaining(e.target.checked)}
                        className="w-4 h-4 accent-emerald-700 rounded"
                      />
                      <span>إنشاء ختمة جديدة تلقائياً للأجزاء المتبقية</span>
                    </label>
                  </div>
                )}

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmAllocation}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3.5 px-6 rounded-2xl text-sm shadow-md transition-all"
                >
                  {isSubmitting ? 'جاري التسكين...' : '✅ تأكيد التسكين والتنفيذ الآن'}
                </button>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );

  if (inline) {
    return cardContent;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      {cardContent}
    </div>
  );
};
