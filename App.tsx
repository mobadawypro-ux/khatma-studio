
import React, { useState, useEffect } from 'react';
import { Khatma } from './types';
import { 
  subscribeToKhatmas, 
  addKhatma, 
  updateKhatmaRemote, 
  deleteKhatmaRemote 
} from './services/storage';
import { KhatmaList } from './components/KhatmaList';
import { KhatmaDetail } from './components/KhatmaDetail';
import { NewKhatmaModal } from './components/NewKhatmaModal';
import { rebalanceKhatma, redistributeParticipants, MIN_PARTS_PER_PERSON, MAX_PARTS_PER_PERSON } from './constants';

const App: React.FC = () => {
  const [khatmas, setKhatmas] = useState<Khatma[]>([]);
  const [activeKhatmaId, setActiveKhatmaId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRebalancing, setIsRebalancing] = useState(false);

  // Initialize Real-time Listener
  useEffect(() => {
    const unsubscribe = subscribeToKhatmas((data) => {
      setKhatmas(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateKhatma = async (newKhatma: Khatma) => {
    try {
      await addKhatma(newKhatma);
    } catch (error) {
      console.error("Error adding khatma:", error);
      alert("حدث خطأ أثناء حفظ الخاتمة. يرجى المحاولة مرة أخرى.");
    }
  };

  const handleDeleteKhatma = async (id: string) => {
    try {
      if(confirm('هل أنت متأكد من حذف هذه الخاتمة؟')) {
        await deleteKhatmaRemote(id);
        if (activeKhatmaId === id) setActiveKhatmaId(null);
      }
    } catch (error) {
      console.error("Error deleting khatma:", error);
    }
  };

  const handleUpdateKhatma = async (updated: Khatma) => {
    try {
      await updateKhatmaRemote(updated);
    } catch (error) {
      console.error("Error updating khatma:", error);
    }
  };

  const handleRebalanceAll = async () => {
    const incomplete = khatmas.filter(
      k => k.slots.length > 0 && !k.slots.every(s => s.isCompleted)
    );

    if (incomplete.length === 0) {
      alert('لا توجد ختمات غير مكتملة لإعادة تنسيقها.');
      return;
    }

    const confirmed = confirm(
      `سيتم إعادة تنسيق ${incomplete.length} خاتمة غير مكتملة:\n\n` +
      `📊 القاعدة لكل ختمة:\n` +
      `• الحد الأقصى: ${MAX_PARTS_PER_PERSON} أجزاء لكل شخص (الزائد يُحرّر)\n` +
      `• الحد الأدنى: ${MIN_PARTS_PER_PERSON} أجزاء لكل شخص (من لديه أقل يُحرّر الكل)\n` +
      `• الختمات المكتملة لن تتغير\n\n` +
      `هل تريد المتابعة؟`
    );
    if (!confirmed) return;

    setIsRebalancing(true);
    try {
      let changedKhatmas = 0;
      let freedParts = 0;

      for (const khatma of incomplete) {
        const result = rebalanceKhatma(khatma);
        if (result.changed) {
          await updateKhatmaRemote(result.khatma);
          changedKhatmas++;
          freedParts += result.freedSlots;
        }
      }

      if (changedKhatmas === 0) {
        alert('✅ جميع الختمات غير المكتملة متوافقة مع القواعد بالفعل.\nلم يتم إجراء أي تغيير.');
      } else {
        alert(`✅ اكتملت إعادة التنسيق بنجاح!\n\n📊 النتائج:\n• عدد الختمات المعدلة: ${changedKhatmas}\n• إجمالي الأجزاء المحررة: ${freedParts}`);
      }
    } catch (error) {
      console.error('Error rebalancing khatmas:', error);
      alert('❌ حدث خطأ أثناء إعادة التنسيق. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsRebalancing(false);
    }
  };

  const handleRedistributeParticipants = async () => {
    const incomplete = khatmas.filter(
      k => k.slots.length > 0 && !k.slots.every(s => s.isCompleted)
    );

    if (incomplete.length === 0) {
      alert('لا توجد ختمات غير مكتملة لإعادة التوزيع.');
      return;
    }

    const confirmed = confirm(
      `سيتم جمع وإعادة توزيع جميع المشاركين عبر ${incomplete.length} خاتمة:\n\n` +
      `🔄 العملية:\n` +
      `• جمع جميع المشاركين من جميع الختمات\n` +
      `• توزيعهم بالتسلسل (الختمات الأقدم أولاً)\n` +
      `• الحد الأقصى: ${MAX_PARTS_PER_PERSON} أجزاء لكل مشارك في الختمة\n` +
      `• الأجزاء المكتملة محفوظة\n\n` +
      `⚠️ تحذير: جميع الأجزاء غير المكتملة ستُحرّر وتُعاد توزيعها!\n\n` +
      `هل تريد المتابعة؟`
    );
    if (!confirmed) return;

    setIsRebalancing(true);
    try {
      const result = redistributeParticipants(khatmas);
      let actualChanges = 0;

      // Apply updates
      for (const updatedKhatma of result.khatmas) {
        const original = khatmas.find(k => k.id === updatedKhatma.id);
        if (original && JSON.stringify(original.slots) !== JSON.stringify(updatedKhatma.slots)) {
          await updateKhatmaRemote(updatedKhatma);
          actualChanges++;
        }
      }

      if (actualChanges === 0) {
        alert('✅ جميع المشاركين موزعون بالفعل.\nلم يتم إجراء أي تغيير.');
      } else {
        alert(`✅ اكتملت إعادة التوزيع بنجاح!\n\n📊 النتائج:\n• عدد الختمات المعدلة: ${actualChanges}\n• إجمالي الأجزاء الموزعة: ${result.totalReassigned}`);
      }
    } catch (error) {
      console.error('Error redistributing participants:', error);
      alert('❌ حدث خطأ أثناء إعادة التوزيع. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsRebalancing(false);
    }
  };

  const activeKhatma = khatmas.find(k => k.id === activeKhatmaId);

  return (
    <div className="min-h-screen pb-20">
      {/* Navbar */}
      <nav className="bg-emerald-700 text-white shadow-lg sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-2xl">🕌</div>
             <h1 className="text-xl font-black tracking-tight quran-font">تطبيق الخاتمة</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleRebalanceAll}
              disabled={isRebalancing || isLoading}
              title={`تنسيق كل ختمة على حدة (${MIN_PARTS_PER_PERSON}-${MAX_PARTS_PER_PERSON} أجزاء)`}
              className="bg-amber-400 hover:bg-amber-300 text-emerald-800 font-bold py-2 px-3 sm:px-5 rounded-xl transition-all text-xs sm:text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isRebalancing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{isRebalancing ? 'جاري...' : '⚙️ تنسيق'}</span>
            </button>
            <button
              onClick={handleRedistributeParticipants}
              disabled={isRebalancing || isLoading}
              title={`إعادة توزيع المشاركين بالتسلسل (حد أقصى ${MAX_PARTS_PER_PERSON})`}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 sm:px-5 rounded-xl transition-all text-xs sm:text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isRebalancing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{isRebalancing ? 'جاري...' : '🔀 توزيع'}</span>
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-white text-emerald-700 hover:bg-emerald-50 font-bold py-2 px-4 sm:px-5 rounded-xl transition-all shadow-sm text-xs sm:text-sm"
            >
              ➕ خاتمة جديدة
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto py-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
             <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
             <p className="text-emerald-700 font-medium">جاري التحميل من القاعدة...</p>
          </div>
        ) : activeKhatma ? (
          <KhatmaDetail
            khatma={activeKhatma}
            onUpdate={handleUpdateKhatma}
            onBack={() => setActiveKhatmaId(null)}
          />
        ) : (
          <div className="px-2">
            <div className="text-center py-10">
               <h2 className="text-3xl font-extrabold text-emerald-900 mb-2">مرحباً بك في مجمع الختمات</h2>
               <p className="text-emerald-600 font-medium opacity-80">اختر خاتمة للمشاركة فيها أو ابدأ واحدة جديدة</p>
               <div className="mt-4 inline-flex items-center gap-2 text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100">
                 <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                 متصل بقاعدة البيانات الحية
               </div>
            </div>
            <KhatmaList
              khatmas={khatmas}
              onSelect={(k) => setActiveKhatmaId(k.id)}
              onDelete={handleDeleteKhatma}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      {isModalOpen && (
        <NewKhatmaModal
          onClose={() => setIsModalOpen(false)}
          onSave={handleCreateKhatma}
        />
      )}

      {/* Footer Info */}
      <footer className="fixed bottom-0 w-full bg-white border-t border-gray-100 p-3 text-center text-xs text-gray-400 z-20">
        تطبيق الختمات الجماعي - البيانات محفوظة عبر السحاب (Firebase)
      </footer>
    </div>
  );
};

export default App;
