
import React from 'react';
import { Khatma, KhatmaSlot } from '../types';

interface Props {
  khatmas: Khatma[];
  onSelect: (khatma: Khatma) => void;
  onDelete: (id: string) => void;
}

interface SlotGroup {
  reservedBy: string;
  isCompleted: boolean;
  slots: KhatmaSlot[];
  displayRange: string;
}

export const KhatmaList: React.FC<Props> = ({ khatmas, onSelect, onDelete }) => {
  if (khatmas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <div className="text-6xl mb-4">📖</div>
        <p className="text-lg font-bold">لا توجد ختمات حالياً. ابدأ بإنشاء واحدة!</p>
      </div>
    );
  }

  // Helper to format juz numbers into ranges (e.g., [1,2,3,5] -> "1-3, 5")
  const formatJuzSummary = (juzList: number[]) => {
    if (juzList.length === 0) return "";
    juzList.sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = juzList[0];
    let end = juzList[0];

    for (let i = 1; i <= juzList.length; i++) {
      if (i < juzList.length && juzList[i] === end + 1) {
        end = juzList[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        if (i < juzList.length) {
          start = juzList[i];
          end = juzList[i];
        }
      }
    }
    return ranges.join('، ');
  };

  const getGroupedSlots = (khatma: Khatma): SlotGroup[] => {
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

      if (
        currentGroup &&
        currentGroup.reservedBy === slot.reservedBy &&
        currentGroup.isCompleted === slot.isCompleted
      ) {
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

  const shareOnWhatsApp = (khatma: Khatma) => {
    const groups = getGroupedSlots(khatma);
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

  const getPendingReadersInfo = (k: Khatma) => {
    const readerMap: Record<string, number[]> = {};
    k.slots.forEach(s => {
      if (s.reservedBy && !s.isCompleted) {
        if (!readerMap[s.reservedBy]) {
          readerMap[s.reservedBy] = [];
        }
        readerMap[s.reservedBy].push(s.startJuz);
      }
    });

    return Object.entries(readerMap).map(([name, juzList]) => ({
      name,
      summary: formatJuzSummary(juzList)
    }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
      {khatmas.sort((a, b) => b.createdAt - a.createdAt).map((k) => {
        const pendingReaders = getPendingReadersInfo(k);
        const completionRate = Math.round((k.slots.filter(s => s.isCompleted).length / 30) * 100);
        
        return (
          <div
            key={k.id}
            className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all cursor-pointer relative group flex flex-col"
            onClick={() => onSelect(k)}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="bg-emerald-100 text-emerald-800 w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg">
                {k.number}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    shareOnWhatsApp(k);
                  }}
                  title="مشاركة تقرير الخاتمة عبر واتساب"
                  className="bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white px-3 py-2 rounded-2xl transition-all flex items-center gap-1.5 border border-emerald-100 shadow-2xs"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412 0 6.556-5.338 11.892-11.893 11.892-1.997 0-3.951-.5-5.688-1.448l-6.309 1.656zm6.29-4.143c1.589.943 3.131 1.468 4.86 1.468 5.405 0 9.803-4.398 9.803-9.803 0-2.62-1.022-5.086-2.871-6.938-1.847-1.847-4.31-2.869-6.928-2.869-5.408 0-9.807 4.399-9.807 9.807 0 2.025.621 3.911 1.796 5.483l-.999 3.646 3.746-.983l.004-.011zm11.367-7.374c-.314-.157-1.858-.917-2.146-1.022-.288-.105-.497-.157-.707.157-.21.314-.812 1.022-1 1.23-.188.209-.377.236-.69.079-.314-.157-1.326-.49-2.528-1.561-.933-.833-1.565-1.861-1.748-2.175-.183-.314-.02-.485.137-.641.141-.141.314-.366.471-.55.157-.183.209-.314.314-.524.105-.209.052-.393-.026-.55-.079-.157-.707-1.702-.969-2.33-.255-.612-.513-.529-.707-.539-.183-.01-.393-.012-.602-.012s-.55.079-.838.393c-.288.314-1.1 1.074-1.1 2.618s1.126 3.038 1.283 3.248c.157.209 2.214 3.382 5.362 4.743.749.324 1.335.518 1.791.662.752.239 1.437.205 1.977.125.602-.09 1.858-.759 2.121-1.492.262-.733.262-1.362.183-1.492-.079-.126-.288-.204-.602-.361z" />
                  </svg>
                  <span className="font-black text-xs">تقرير</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(k.id);
                  }}
                  className="text-gray-200 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
                  title="حذف الخاتمة"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1-1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            <h3 className="text-xl font-black text-gray-800 mb-1">الخاتمة {k.number}</h3>
            {k.description && <p className="text-gray-400 text-xs mb-4 line-clamp-1">{k.description}</p>}
            
            {/* Progress Section */}
            <div className="mb-4">
              <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1 px-1">
                <span>الإنجاز</span>
                <span>{completionRate}%</span>
              </div>
              <div className="w-full bg-gray-50 rounded-full h-2 overflow-hidden border border-gray-100">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-700 shadow-[0_0_8px_rgba(16,185,129,0.3)]" 
                  style={{ width: `${completionRate}%` }}
                ></div>
              </div>
            </div>

            {/* Pending Readers List */}
            <div className="flex-1 mt-2">
              <div className="text-[10px] font-black text-emerald-600 mb-2 uppercase tracking-widest">بانتظار الإتمام:</div>
              {pendingReaders.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {pendingReaders.slice(0, 5).map((reader, i) => (
                    <div key={i} className="flex flex-col bg-orange-50 rounded-xl p-2 border border-orange-100">
                      <span className="text-orange-800 text-[11px] font-black">{reader.name}</span>
                      <span className="text-orange-600 text-[9px] font-bold mt-0.5">الأجزاء: {reader.summary}</span>
                    </div>
                  ))}
                  {pendingReaders.length > 5 && (
                    <span className="text-gray-400 text-[10px] text-center font-bold">... و {pendingReaders.length - 5} آخرين</span>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-gray-300 italic">
                  {k.slots.every(s => s.isCompleted) ? "✨ اكتملت بفضل الله" : "لا يوجد قراء بانتظارهم حالياً"}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-50 flex justify-between items-center">
              <span className="text-[10px] font-bold text-gray-300">
                {new Date(k.createdAt).toLocaleDateString('ar-EG')}
              </span>
              <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
                 <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                 <span className="text-[10px] font-bold text-gray-500">{k.slots.filter(s => s.reservedBy).length} / 30 محجوز</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

