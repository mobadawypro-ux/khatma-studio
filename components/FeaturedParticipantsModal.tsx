import React, { useState } from 'react';
import { FeaturedParticipant, ParticipantStats } from '../types';
import { generateId, MAX_PARTS_PER_PERSON } from '../constants';

interface Props {
  participantsStats: ParticipantStats[];
  onClose: () => void;
  onAddFeatured: (participant: FeaturedParticipant) => Promise<void>;
  onRemoveFeatured: (id: string, name: string) => Promise<void>;
  onSelectForSmartAdd: (participantName: string) => void;
}

export const FeaturedParticipantsModal: React.FC<Props> = ({
  participantsStats,
  onClose,
  onAddFeatured,
  onRemoveFeatured,
  onSelectForSmartAdd
}) => {
  const [newName, setNewName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const featuredList = participantsStats.filter(p => p.isFeatured);
  const nonFeaturedList = participantsStats.filter(p => !p.isFeatured);

  const filteredFeatured = featuredList.filter(p =>
    p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const filteredNonFeatured = nonFeaturedList.filter(p =>
    p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = newName.trim();
    if (!raw) return;

    setIsAdding(true);
    try {
      // Support adding multiple names separated by comma or newline
      const names = raw
        .split(/[,،\n]+/)
        .map(n => n.trim())
        .filter(Boolean);

      for (const name of names) {
        await onAddFeatured({
          id: generateId(),
          name,
          createdAt: Date.now()
        });
      }
      setNewName('');
    } finally {
      setIsAdding(false);
    }
  };

  const handlePromoteAllExisting = async () => {
    if (nonFeaturedList.length === 0) return;
    setIsAdding(true);
    try {
      for (const p of nonFeaturedList) {
        await onAddFeatured({
          id: generateId(),
          name: p.name,
          createdAt: Date.now()
        });
      }
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col border border-amber-100">
        {/* Header */}
        <div className="bg-gradient-to-l from-amber-500 to-amber-600 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-xl shadow-inner">
              ⭐
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black">قائمة المشاركين المميزين</h2>
              <p className="text-amber-100 text-xs font-medium">
                أضف القراء الدائمين والمميزين لاختيارهم بسرعة من القائمة المنسدلة في الإضافة الذكية
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* Add New Featured Participant Form */}
          <form
            onSubmit={handleAddSubmit}
            className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-3"
          >
            <label className="block text-xs font-black text-amber-900">
              ➕ إضافة مشارك مميز جديد (يمكنك إدخال أكثر من اسم مفصولين بفاصلة)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="مثال: محمد أحمد، عبد الرحمن علي..."
                className="flex-1 bg-white border-2 border-amber-200 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm font-bold outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={isAdding || !newName.trim()}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black px-5 py-2.5 rounded-xl text-sm transition-colors shadow-xs shrink-0"
              >
                ⭐ إضافة للمميزين
              </button>
            </div>
          </form>

          {/* Search Filter */}
          {participantsStats.length > 4 && (
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="🔍 ابحث عن اسم مشارك..."
                className="w-full bg-gray-50 border border-gray-200 focus:border-emerald-500 rounded-2xl px-4 py-2.5 text-sm font-bold outline-none"
              />
            </div>
          )}

          {/* Featured Participants Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                <span>⭐ المشاركون المميزون</span>
                <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-black">
                  {featuredList.length}
                </span>
              </h3>
            </div>

            {filteredFeatured.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400 text-xs font-bold">
                لا يوجد مشاركون مميزون حالياً. أضف أسماء القراء بالأعلى أو قم بترقية القراء الحاليين بالأسفل!
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {filteredFeatured.map(participant => (
                  <div
                    key={participant.name}
                    className="bg-white border border-amber-200/80 hover:border-amber-400 rounded-2xl p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-amber-500 text-base">⭐</span>
                        <span className="font-black text-gray-900 text-sm">
                          {participant.name}
                        </span>
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black px-2 py-0.5 rounded-lg">
                          منجز: {participant.completedParts} جزء
                        </span>
                        {participant.pendingParts > 0 && (
                          <span className="bg-orange-50 text-orange-700 border border-orange-200 text-[11px] font-bold px-2 py-0.5 rounded-lg">
                            قيد القراءة: {participant.pendingParts}
                          </span>
                        )}
                      </div>

                      {participant.activeKhatmas.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[10px] text-gray-400 font-bold">الختمات الحالية:</span>
                          {participant.activeKhatmas.map(ak => (
                            <span
                              key={ak.khatmaId}
                              className="text-[10px] font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md"
                            >
                              خاتمة {ak.khatmaNumber} ({ak.partsCount}/{MAX_PARTS_PER_PERSON})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onSelectForSmartAdd(participant.name)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                      >
                        <span>✨</span>
                        <span>إضافة ذكية</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onRemoveFeatured(participant.featuredId || '', participant.name)
                        }
                        title="إزالة من المميزين"
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Existing Participants from Khatmas (Not yet featured) */}
          {nonFeaturedList.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-black text-gray-600">
                  👥 مشاركون في الختمات الحالية ({filteredNonFeatured.length})
                </h3>
                <button
                  type="button"
                  onClick={handlePromoteAllExisting}
                  disabled={isAdding}
                  className="text-xs font-black text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1 rounded-xl transition-colors"
                >
                  ⭐ إضافة الكل للمميزين
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredNonFeatured.map(participant => (
                  <div
                    key={participant.name}
                    className="bg-gray-50 border border-gray-200 rounded-2xl p-3 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-gray-800 text-xs truncate">
                        {participant.name}
                      </div>
                      <div className="text-[10px] text-gray-500 font-bold">
                        منجز: {participant.completedParts} • حالي: {participant.pendingParts}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onAddFeatured({
                            id: generateId(),
                            name: participant.name,
                            createdAt: Date.now()
                          })
                        }
                        className="bg-amber-100 hover:bg-amber-200 text-amber-800 text-[11px] font-black px-2.5 py-1.5 rounded-xl transition-colors"
                        title="ترقية إلى مشارك مميز"
                      >
                        ⭐ تمييز
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectForSmartAdd(participant.name)}
                        className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-black px-2.5 py-1.5 rounded-xl transition-colors"
                        title="إضافة ذكية لهذا المشارك"
                      >
                        ✨
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-black py-2.5 px-6 rounded-xl text-sm transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
