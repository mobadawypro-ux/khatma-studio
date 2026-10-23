
import React, { useState } from 'react';
import { generateId, createStandardSlots } from '../constants';
import { Khatma } from '../types';

interface Props {
  onClose: () => void;
  onSave: (khatma: Khatma) => void;
}

export const NewKhatmaModal: React.FC<Props> = ({ onClose, onSave }) => {
  const [number, setNumber] = useState('');
  const [desc, setDesc] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!number) return;

    const newKhatma: Khatma = {
      id: generateId(),
      number,
      description: desc,
      createdAt: Date.now(),
      slots: createStandardSlots()
    };

    onSave(newKhatma);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-emerald-600 p-4 text-white font-bold text-center">
          إضافة خاتمة جديدة
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رقم الخاتمة</label>
            <input
              autoFocus
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-emerald-500 focus:outline-none transition-colors"
              placeholder="مثلاً: 1022"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">وصف إضافي (اختياري)</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-emerald-500 focus:outline-none transition-colors"
              placeholder="مثلاً: خاتمة شهر رمضان"
              rows={2}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-emerald-200"
            >
              إنشاء
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
