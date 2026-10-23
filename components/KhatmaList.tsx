
import React from 'react';
import { Khatma } from '../types';

interface Props {
  khatmas: Khatma[];
  onSelect: (khatma: Khatma) => void;
  onDelete: (id: string) => void;
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(k.id);
                }}
                className="text-gray-200 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1-1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
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
