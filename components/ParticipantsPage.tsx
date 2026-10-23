import React, { useState, useMemo } from 'react';
import { ParticipantStats, FeaturedParticipant } from '../types';
import { formatJuzRanges, generateId, MAX_PARTS_PER_PERSON } from '../constants';

interface Props {
  participantsStats: ParticipantStats[];
  onBack: () => void;
  onSelectKhatma: (khatmaId: string) => void;
  onSelectForSmartAdd: (participantName: string) => void;
  onAddFeatured: (participant: FeaturedParticipant) => Promise<void>;
  onRemoveFeatured: (id: string, name: string) => Promise<void>;
}

type FilterMode = 'ALL' | 'PENDING' | 'COMPLETED' | 'FEATURED';
type SortMode = 'RECENT' | 'COMPLETED' | 'NAME';

export const ParticipantsPage: React.FC<Props> = ({
  participantsStats,
  onBack,
  onSelectKhatma,
  onSelectForSmartAdd,
  onAddFeatured,
  onRemoveFeatured
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('RECENT');

  const formatDateTime = (timestamp: number) => {
    if (!timestamp) return 'غير محدد';
    const d = new Date(timestamp);
    const dateStr = d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    const timeStr = d.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${dateStr} • ${timeStr}`;
  };

  const getLatestParticipantActivity = (p: ParticipantStats): number => {
    if (p.assignments.length === 0) return 0;
    return Math.max(...p.assignments.map(a => a.addedAt || a.khatmaCreatedAt || 0));
  };

  const filteredAndSortedParticipants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = participantsStats.filter(p => {
      if (filterMode === 'PENDING' && p.pendingParts === 0) return false;
      if (filterMode === 'COMPLETED' && p.completedParts === 0) return false;
      if (filterMode === 'FEATURED' && !p.isFeatured) return false;

      if (!q) return true;
      const matchesName = p.name.toLowerCase().includes(q);
      const matchesKhatma = p.assignments.some(a =>
        a.khatmaNumber.toLowerCase().includes(q)
      );
      return matchesName || matchesKhatma;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === 'RECENT') {
        const latestA = getLatestParticipantActivity(a);
        const latestB = getLatestParticipantActivity(b);
        if (latestB !== latestA) return latestB - latestA;
      }
      if (sortMode === 'COMPLETED') {
        if (b.completedParts !== a.completedParts) return b.completedParts - a.completedParts;
        if (b.totalParts !== a.totalParts) return b.totalParts - a.totalParts;
      }
      return a.name.localeCompare(b.name, 'ar');
    });
  }, [participantsStats, searchQuery, filterMode, sortMode]);

  const totalCompletedAll = useMemo(
    () => participantsStats.reduce((sum, p) => sum + p.completedParts, 0),
    [participantsStats]
  );

  const totalPendingAll = useMemo(
    () => participantsStats.reduce((sum, p) => sum + p.pendingParts, 0),
    [participantsStats]
  );

  const shareParticipantReport = (p: ParticipantStats) => {
    let msg = `👤 *سجل المشارك: ${p.name}*\n`;
    msg += `✅ الأجزاء المكتملة: ${p.completedParts}\n`;
    msg += `⏳ قيد القراءة: ${p.pendingParts}\n`;
    msg += `--------------------------\n\n`;

    if (p.assignments.length === 0) {
      msg += `لا توجد أجزاء مسجلة حالياً.`;
    } else {
      p.assignments.forEach(a => {
        const statusText =
          a.pendingJuz.length === 0
            ? '✅ مكتمل بالكامل'
            : a.completedJuz.length > 0
            ? `✅ منجز (${formatJuzRanges(a.completedJuz)}) | ⏳ متبقي (${formatJuzRanges(a.pendingJuz)})`
            : '⏳ قيد القراءة';
        msg += `📖 *الخاتمة رقم ${a.khatmaNumber}*:\n`;
        msg += `• الأجزاء: ${formatJuzRanges(a.allJuz)} (${a.partsCount} أجزاء)\n`;
        msg += `• الحالة: ${statusText}\n`;
        msg += `• تاريخ الإضافة: ${formatDateTime(a.addedAt)}\n\n`;
      });
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="p-4 max-w-5xl mx-auto pb-24 space-y-6">
      {/* Top Bar */}
      <div className="bg-white rounded-3xl p-5 border border-emerald-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 bg-gray-100 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 rounded-2xl transition-colors"
            title="العودة للرئيسية"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 transform rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-emerald-950 flex items-center gap-2">
              <span>👥</span>
              <span>قائمة المشاركين وسجل الأجزاء</span>
            </h2>
            <p className="text-xs font-bold text-gray-500 mt-0.5">
              تفاصيل الأجزاء لكل مشارك، الخاتمة المسكنة فيها، وتاريخ إضافتها
            </p>
          </div>
        </div>

        {/* Summary Counters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-emerald-50 border border-emerald-100 px-3.5 py-2 rounded-2xl text-center">
            <div className="text-[10px] font-bold text-emerald-600">إجمالي المشاركين</div>
            <div className="text-base font-black text-emerald-900">{participantsStats.length}</div>
          </div>
          <div className="bg-teal-50 border border-teal-100 px-3.5 py-2 rounded-2xl text-center">
            <div className="text-[10px] font-bold text-teal-600">أجزاء مكتملة ✅</div>
            <div className="text-base font-black text-teal-900">{totalCompletedAll}</div>
          </div>
          <div className="bg-amber-50 border border-amber-100 px-3.5 py-2 rounded-2xl text-center">
            <div className="text-[10px] font-bold text-amber-700">قيد القراءة ⏳</div>
            <div className="text-base font-black text-amber-900">{totalPendingAll}</div>
          </div>
        </div>
      </div>

      {/* Search, Filter & Sort Bar */}
      <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="🔍 ابحث باسم المشارك أو رقم الخاتمة..."
              className="w-full bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-black text-sm"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 shrink-0">ترتيب حسب:</span>
            <select
              value={sortMode}
              onChange={e => setSortMode(e.target.value as SortMode)}
              className="bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs font-black text-gray-700 outline-none cursor-pointer"
            >
              <option value="RECENT">🕒 الأحدث إضافة</option>
              <option value="COMPLETED">🏆 الأكثر إتماماً للأجزاء</option>
              <option value="NAME">🔤 الترتيب الأبجدي</option>
            </select>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          {[
            { id: 'ALL', label: `الكل (${participantsStats.length})` },
            {
              id: 'PENDING',
              label: `⏳ قيد القراءة (${participantsStats.filter(p => p.pendingParts > 0).length})`
            },
            {
              id: 'COMPLETED',
              label: `✅ أتموا أجزاء (${participantsStats.filter(p => p.completedParts > 0).length})`
            },
            {
              id: 'FEATURED',
              label: `⭐ المميزون (${participantsStats.filter(p => p.isFeatured).length})`
            }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id as FilterMode)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all border ${
                filterMode === tab.id
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Participants Cards List */}
      {filteredAndSortedParticipants.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 text-gray-400 space-y-2">
          <div className="text-4xl">👥</div>
          <div className="text-base font-black text-gray-600">لا يوجد مشاركون مطابقون للبحث</div>
          <p className="text-xs font-bold">جرب تغيير كلمة البحث أو الفلتر المحدد</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAndSortedParticipants.map(participant => (
            <div
              key={participant.name}
              className="bg-white rounded-3xl border border-gray-100 shadow-xs hover:shadow-md transition-all overflow-hidden"
            >
              {/* Participant Header */}
              <div className="p-5 bg-gradient-to-l from-emerald-50/50 via-white to-white border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (participant.isFeatured) {
                        onRemoveFeatured(participant.featuredId || '', participant.name);
                      } else {
                        onAddFeatured({
                          id: generateId(),
                          name: participant.name,
                          createdAt: Date.now()
                        });
                      }
                    }}
                    title={
                      participant.isFeatured
                        ? 'إزالة من المشاركين المميزين'
                        : 'إضافة إلى المشاركين المميزين'
                    }
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg transition-all border ${
                      participant.isFeatured
                        ? 'bg-amber-100 border-amber-300 text-amber-600 shadow-2xs'
                        : 'bg-gray-50 border-gray-200 text-gray-300 hover:text-amber-400'
                    }`}
                  >
                    ⭐
                  </button>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-black text-gray-900">{participant.name}</h3>
                      {participant.isFeatured && (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-lg">
                          مشارك مميز
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-1 text-xs font-bold">
                      <span className="text-gray-500">
                        إجمالي الأجزاء: <strong className="text-gray-800">{participant.totalParts}</strong>
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="text-emerald-700">
                        مكتمل: <strong>{participant.completedParts}</strong> ✅
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="text-amber-700">
                        قيد القراءة: <strong>{participant.pendingParts}</strong> ⏳
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions for Participant */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => shareParticipantReport(participant)}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors"
                    title="مشاركة سجل المشارك عبر واتساب"
                  >
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412 0 6.556-5.338 11.892-11.893 11.892-1.997 0-3.951-.5-5.688-1.448l-6.309 1.656zm6.29-4.143c1.589.943 3.131 1.468 4.86 1.468 5.405 0 9.803-4.398 9.803-9.803 0-2.62-1.022-5.086-2.871-6.938-1.847-1.847-4.31-2.869-6.928-2.869-5.408 0-9.807 4.399-9.807 9.807 0 2.025.621 3.911 1.796 5.483l-.999 3.646 3.746-.983l.004-.011zm11.367-7.374c-.314-.157-1.858-.917-2.146-1.022-.288-.105-.497-.157-.707.157-.21.314-.812 1.022-1 1.23-.188.209-.377.236-.69.079-.314-.157-1.326-.49-2.528-1.561-.933-.833-1.565-1.861-1.748-2.175-.183-.314-.02-.485.137-.641.141-.141.314-.366.471-.55.157-.183.209-.314.314-.524.105-.209.052-.393-.026-.55-.079-.157-.707-1.702-.969-2.33-.255-.612-.513-.529-.707-.539-.183-.01-.393-.012-.602-.012s-.55.079-.838.393c-.288.314-1.1 1.074-1.1 2.618s1.126 3.038 1.283 3.248c.157.209 2.214 3.382 5.362 4.743.749.324 1.335.518 1.791.662.752.239 1.437.205 1.977.125.602-.09 1.858-.759 2.121-1.492.262-.733.262-1.362.183-1.492-.079-.126-.288-.204-.602-.361z" />
                    </svg>
                    <span>تقرير</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectForSmartAdd(participant.name)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <span>⚡</span>
                    <span>إضافة أجزاء</span>
                  </button>
                </div>
              </div>

              {/* Participant Assignments List (Juz, Which Khatma, Date Added) */}
              <div className="p-5">
                {participant.assignments.length === 0 ? (
                  <div className="text-xs font-bold text-gray-400 italic py-2">
                    لا توجد أجزاء مسكنة في أي ختمة حالياً لهذا المشارك.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {participant.assignments.map(assignment => {
                      const isAllDone = assignment.pendingJuz.length === 0;
                      return (
                        <div
                          key={assignment.khatmaId}
                          onClick={() => onSelectKhatma(assignment.khatmaId)}
                          className={`cursor-pointer rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                            isAllDone
                              ? 'bg-emerald-50/40 border-emerald-200/80 hover:border-emerald-400'
                              : 'bg-amber-50/40 border-amber-200/80 hover:border-amber-400'
                          }`}
                        >
                          {/* Top Row: Khatma Number & Status */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="bg-emerald-700 text-white text-xs font-black px-3 py-1 rounded-xl shadow-2xs">
                                📖 الخاتمة {assignment.khatmaNumber}
                              </span>
                              <span className="text-[11px] font-black text-gray-600 bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                                {assignment.partsCount} / {MAX_PARTS_PER_PERSON} أجزاء
                              </span>
                            </div>

                            <span
                              className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${
                                isAllDone
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {isAllDone
                                ? '✅ مكتملة القراءة'
                                : `⏳ متبقي ${assignment.pendingJuz.length} أجزاء`}
                            </span>
                          </div>

                          {/* Middle Row: Detailed Juz Numbers */}
                          <div className="space-y-1.5">
                            <div className="text-xs font-black text-gray-800">
                              الأجزاء المسكنة: ({formatJuzRanges(assignment.allJuz)})
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              {assignment.allJuz.map(juzNum => {
                                const isJuzCompleted = assignment.completedJuz.includes(juzNum);
                                return (
                                  <span
                                    key={juzNum}
                                    className={`text-[11px] font-black px-2 py-0.5 rounded-lg border ${
                                      isJuzCompleted
                                        ? 'bg-emerald-600 text-white border-emerald-700'
                                        : 'bg-white text-amber-900 border-amber-300'
                                    }`}
                                    title={isJuzCompleted ? 'جزء مكتمل' : 'جزء قيد القراءة'}
                                  >
                                    جزء {juzNum} {isJuzCompleted ? '✓' : '⏳'}
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          {/* Bottom Row: Date Added */}
                          <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-[11px] font-bold text-gray-500">
                            <span className="flex items-center gap-1">
                              <span>📅 تاريخ الإضافة:</span>
                              <span className="text-gray-700 font-black">
                                {formatDateTime(assignment.addedAt)}
                              </span>
                            </span>
                            <span className="text-emerald-700 font-black hover:underline">
                              فتح الخاتمة ←
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
