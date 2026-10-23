
import React, { useState, useEffect } from 'react';
import { MAX_PARTS_PER_PERSON } from '../constants';
import { Khatma, KhatmaSlot } from '../types';

interface Props {
  khatma: Khatma;
  onUpdate: (updatedKhatma: Khatma) => void;
  onBack: () => void;
}

interface SlotGroup {
  reservedBy: string;
  isCompleted: boolean;
  slots: KhatmaSlot[];
  displayRange: string;
}

export const KhatmaDetail: React.FC<Props> = ({ khatma, onUpdate, onBack }) => {
  const [editSlotId, setEditSlotId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  
  const [bulkName, setBulkName] = useState('');
  const [rangeStart, setRangeStart] = useState<number | string>(1);
  const [rangeEnd, setRangeEnd] = useState<number | string>(1);

  useEffect(() => {
    const firstAvailable = khatma.slots.find(s => !s.reservedBy);
    if (firstAvailable) {
      setRangeStart(firstAvailable.startJuz);
      setRangeEnd(firstAvailable.startJuz);
    }
  }, [khatma.id]);

  const getGroupedSlots = (): SlotGroup[] => {
    const groups: SlotGroup[] = [];
    let currentGroup: SlotGroup | null = null;
    const sortedSlots = [...khatma.slots].sort((a, b) => a.startJuz - b.startJuz);

    sortedSlots.forEach((slot) => {
      if (!slot.reservedBy) {
        groups.push({
          reservedBy: '',
          isCompleted: false,
          slots: [slot],
          displayRange: `الجزء ${slot.startJuz}`
        });
        currentGroup = null;
        return;
      }

      if (currentGroup && 
          currentGroup.reservedBy === slot.reservedBy && 
          currentGroup.isCompleted === slot.isCompleted) {
        currentGroup.slots.push(slot);
        const start = currentGroup.slots[0].startJuz;
        const end = slot.startJuz;
        currentGroup.displayRange = start === end ? `الجزء ${start}` : `الأجزاء ${start} - ${end}`;
      } else {
        const newGroup = {
          reservedBy: slot.reservedBy,
          isCompleted: slot.isCompleted,
          slots: [slot],
          displayRange: `الجزء ${slot.startJuz}`
        };
        groups.push(newGroup);
        currentGroup = newGroup;
      }
    });

    return groups;
  };

  const shareOnWhatsApp = () => {
    const groups = getGroupedSlots();
    const completionRate = Math.round((khatma.slots.filter(s => s.isCompleted).length / 30) * 100);
    
    let message = `📖 *تقرير الخاتمة رقم ${khatma.number}*\n`;
    message += `📊 نسبة الإنجاز: ${completionRate}%\n`;
    if (khatma.description) message += `📝 ${khatma.description}\n`;
    message += `--------------------------\n\n`;

    message += `*الأجزاء المحجوزة:*\n`;
    groups.filter(g => g.reservedBy).forEach(g => {
      const status = g.isCompleted ? '✅ تم' : '⏳ جاري القراءة';
      message += `• ${g.displayRange}: ${g.reservedBy} [${status}]\n`;
    });

    const unreserved = groups.filter(g => !g.reservedBy);
    if (unreserved.length > 0) {
      message += `\n*الأجزاء المتبقية للحجز:*\n`;
      unreserved.forEach(g => {
        message += `• ${g.displayRange}\n`;
      });
      message += `\n👉 شارك معنا لحجز الأجزاء المتبقية!`;
    } else {
      message += `\n✅ جميع الأجزاء محجوزة بفضل الله.`;
    }

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const toggleGroupComplete = (group: SlotGroup) => {
    const slotIds = group.slots.map(s => s.id);
    const newStatus = !group.isCompleted;
    const updatedSlots = khatma.slots.map(s => 
      slotIds.includes(s.id) ? { ...s, isCompleted: newStatus } : s
    );
    onUpdate({ ...khatma, slots: updatedSlots });
  };

  const startReservation = (slot: KhatmaSlot) => {
    setEditSlotId(slot.id);
    setTempName(slot.reservedBy);
  };

  const getAssignedPartsForUser = (name: string, excludedSlotId?: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return 0;

    return khatma.slots.filter(slot =>
      slot.reservedBy &&
      slot.reservedBy.trim() === trimmedName &&
      slot.id !== excludedSlotId
    ).length;
  };

  const saveReservation = (slotId: string) => {
    const name = tempName.trim();

    if (!name) {
      alert('يرجى إدخال اسم القارئ');
      return;
    }

    const alreadyAssigned = getAssignedPartsForUser(name, slotId);
    if (alreadyAssigned >= MAX_PARTS_PER_PERSON) {
      alert(`هذا المستخدم وصل إلى الحد الأقصى (${MAX_PARTS_PER_PERSON}) أجزاء في هذه الخاتمة.`);
      return;
    }

    const updatedSlots = khatma.slots.map(s => 
      s.id === slotId ? { ...s, reservedBy: name } : s
    );
    onUpdate({ ...khatma, slots: updatedSlots });
    setEditSlotId(null);
  };

  const handleBulkReserve = (e: React.FormEvent) => {
    e.preventDefault();
    const start = Number(rangeStart);
    const end = Number(rangeEnd);
    const name = bulkName.trim();

    if (!name || isNaN(start) || isNaN(end) || start < 1 || end > 30 || start > end) {
      alert("يرجى التأكد من الاسم ونطاق الأجزاء");
      return;
    }

    const alreadyAssigned = getAssignedPartsForUser(name);
    const remainingCapacity = Math.max(MAX_PARTS_PER_PERSON - alreadyAssigned, 0);

    if (remainingCapacity === 0) {
      alert(`هذا المستخدم وصل إلى الحد الأقصى (${MAX_PARTS_PER_PERSON}) أجزاء في هذه الخاتمة.`);
      return;
    }

    let assignedCount = 0;
    const updatedSlots = khatma.slots.map(slot => {
      if (assignedCount >= remainingCapacity) return slot;
      if (slot.startJuz >= start && slot.startJuz <= end && !slot.reservedBy) {
        assignedCount++;
        return { ...slot, reservedBy: name };
      }
      return slot;
    });

    if (assignedCount === 0) {
      alert("هذه الأجزاء محجوزة مسبقاً أو النطاق خارج الحدود");
    } else {
      onUpdate({ ...khatma, slots: updatedSlots });
      setBulkName('');
      alert(`تم حجز ${assignedCount} أجزاء بنجاح. الحد الأقصى لكل مستخدم في هذه الخاتمة هو ${MAX_PARTS_PER_PERSON}.`);
    }
  };

  const getCompletionPercentage = () => Math.round((khatma.slots.filter(s => s.isCompleted).length / khatma.slots.length) * 100);
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();
  const groupedData = getGroupedSlots();

  return (
    <div className="p-4 max-w-4xl mx-auto pb-24">
      {/* Header with Share Action */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md z-20 py-4 mb-6 -mx-4 px-4 border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transform rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          <div className="text-center flex-1">
            <h2 className="text-2xl font-black text-emerald-900 leading-none">خاتمة {khatma.number}</h2>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-emerald-600 font-bold text-xs">{getCompletionPercentage()}% منجز</span>
              <span className="text-gray-300">•</span>
              <span className="text-gray-400 font-medium text-[10px]">{khatma.slots.filter(s => s.reservedBy).length} محجوز</span>
            </div>
          </div>
          <button 
            onClick={shareOnWhatsApp}
            className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 p-3 rounded-2xl transition-all flex items-center gap-2 group border border-emerald-100"
            title="مشاركة التقرير عبر واتساب"
          >
            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412 0 6.556-5.338 11.892-11.893 11.892-1.997 0-3.951-.5-5.688-1.448l-6.309 1.656zm6.29-4.143c1.589.943 3.131 1.468 4.86 1.468 5.405 0 9.803-4.398 9.803-9.803 0-2.62-1.022-5.086-2.871-6.938-1.847-1.847-4.31-2.869-6.928-2.869-5.408 0-9.807 4.399-9.807 9.807 0 2.025.621 3.911 1.796 5.483l-.999 3.646 3.746-.983l.004-.011zm11.367-7.374c-.314-.157-1.858-.917-2.146-1.022-.288-.105-.497-.157-.707.157-.21.314-.812 1.022-1 1.23-.188.209-.377.236-.69.079-.314-.157-1.326-.49-2.528-1.561-.933-.833-1.565-1.861-1.748-2.175-.183-.314-.02-.485.137-.641.141-.141.314-.366.471-.55.157-.183.209-.314.314-.524.105-.209.052-.393-.026-.55-.079-.157-.707-1.702-.969-2.33-.255-.612-.513-.529-.707-.539-.183-.01-.393-.012-.602-.012s-.55.079-.838.393c-.288.314-1.1 1.074-1.1 2.618s1.126 3.038 1.283 3.248c.157.209 2.214 3.382 5.362 4.743.749.324 1.335.518 1.791.662.752.239 1.437.205 1.977.125.602-.09 1.858-.759 2.121-1.492.262-.733.262-1.362.183-1.492-.079-.126-.288-.204-.602-.361z" />
            </svg>
            <span className="hidden sm:inline font-black text-xs">تقرير</span>
          </button>
        </div>
        <div className="mt-4 w-full bg-emerald-50 rounded-full h-2 px-[2px] py-[2px] border border-emerald-100">
          <div 
            className="bg-emerald-500 h-full rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
            style={{ width: `${getCompletionPercentage()}%` }}
          ></div>
        </div>
      </div>

      {/* Bulk Reservation Section */}
      <div className="bg-gradient-to-br from-emerald-50/50 to-white rounded-3xl p-6 border-2 border-emerald-100 mb-8 shadow-sm">
        <h3 className="text-lg font-black text-emerald-800 mb-4 flex items-center gap-2">
          <span className="bg-emerald-500 text-white w-6 h-6 rounded-lg flex items-center justify-center text-[10px]">⚡</span> 
          حجز سريع لأجزاء متعددة
        </h3>
        <form onSubmit={handleBulkReserve} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">الاسم</label>
            <input
              type="text"
              value={bulkName}
              onChange={(e) => setBulkName(e.target.value)}
              placeholder="اسم الشخص..."
              className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm focus:border-emerald-500 outline-none transition-all bg-white font-bold"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:col-span-2">
            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">من جزء</label>
              <input
                type="number"
                min="1"
                max="30"
                value={rangeStart}
                onFocus={handleInputFocus}
                onChange={(e) => setRangeStart(e.target.value)}
                className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm focus:border-emerald-500 outline-none transition-all bg-white font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">إلى جزء</label>
              <input
                type="number"
                min="1"
                max="30"
                value={rangeEnd}
                onFocus={handleInputFocus}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm focus:border-emerald-500 outline-none transition-all bg-white font-bold"
              />
            </div>
          </div>
          <button
            type="submit"
            className="bg-emerald-600 text-white font-black py-2 px-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 text-sm h-[52px] active:scale-95"
          >
            تأكيد الحجز
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {groupedData.map((group, idx) => {
          const isReserved = !!group.reservedBy;
          return (
            <div 
              key={`${group.reservedBy}-${idx}`}
              className={`relative overflow-hidden rounded-3xl transition-all border-2 
                ${group.isCompleted 
                  ? 'bg-gray-50/50 border-gray-100 opacity-70' 
                  : isReserved 
                    ? 'bg-white border-emerald-100 shadow-md ring-4 ring-emerald-50/20' 
                    : 'bg-white border-gray-50 hover:border-emerald-100 shadow-sm'
                }`}
            >
              <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-4 sm:w-48 shrink-0">
                  <div className={`w-14 h-14 flex flex-col items-center justify-center rounded-2xl font-black shadow-inner
                    ${group.isCompleted ? 'bg-gray-200 text-gray-500' : isReserved ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    <span className="text-xl leading-none">{group.slots.length > 1 ? group.slots.length : group.slots[0].startJuz}</span>
                    <span className="text-[8px] uppercase mt-1 opacity-60 font-black">{group.slots.length > 1 ? 'أجزاء' : 'جزء'}</span>
                  </div>
                  <div>
                    <div className="text-sm font-black text-gray-800 leading-tight">{group.displayRange}</div>
                    <div className="text-[10px] text-gray-400 font-bold">الحالة: {group.isCompleted ? 'منجز' : isReserved ? 'محجوز' : 'متاح'}</div>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  {!isReserved ? (
                    editSlotId === group.slots[0].id ? (
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          className="w-full border-2 border-emerald-300 rounded-2xl px-4 py-2 text-sm focus:outline-none font-bold"
                          value={tempName}
                          placeholder="اسم القارئ..."
                          onChange={(e) => setTempName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveReservation(group.slots[0].id)}
                        />
                        <button 
                          onClick={() => saveReservation(group.slots[0].id)}
                          className="bg-emerald-500 text-white px-5 py-2 rounded-2xl text-sm font-black hover:bg-emerald-600"
                        >
                          حفظ
                        </button>
                      </div>
                    ) : (
                      <div 
                        className="cursor-pointer group flex items-center gap-3 p-3 -m-3 rounded-2xl hover:bg-emerald-50 transition-colors text-gray-300 italic text-sm font-bold"
                        onClick={() => startReservation(group.slots[0])}
                      >
                        <span className="bg-gray-100 w-6 h-6 rounded-lg flex items-center justify-center text-xs group-hover:bg-emerald-500 group-hover:text-white transition-colors">+</span>
                        <span>حجز هذا الجزء</span>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col">
                      <span className="text-[10px] text-emerald-600 font-black mb-1 flex items-center gap-1">
                         <span className="w-1 h-1 bg-emerald-600 rounded-full animate-pulse"></span>
                         بواسطة:
                      </span>
                      <span className="text-lg font-black text-gray-800 truncate">{group.reservedBy}</span>
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {isReserved && (
                    <button
                      onClick={() => toggleGroupComplete(group)}
                      className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-black transition-all shadow-sm active:scale-95
                        ${group.isCompleted 
                          ? 'bg-gray-200 text-gray-500' 
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                    >
                      {group.isCompleted ? 'إلغاء الإتمام' : `تم الإتمام (${group.slots.length})`}
                    </button>
                  )}
                  {isReserved && !group.isCompleted && (
                    <button 
                      onClick={() => {
                        const slotIds = group.slots.map(s => s.id);
                        const updatedSlots = khatma.slots.map(s => slotIds.includes(s.id) ? { ...s, reservedBy: '' } : s);
                        onUpdate({ ...khatma, slots: updatedSlots });
                      }}
                      className="p-3 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                      title="إلغاء الحجز"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
