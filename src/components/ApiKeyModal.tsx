'use client';
import { useState } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; limit: number; monthlyLimit: boolean }) => void;
  title: string;
  initialData?: {
    name: string;
    limit: number;
    monthlyLimit: boolean;
  };
}

export function ApiKeyModal({ isOpen, onClose, onSave, title, initialData }: ModalProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [limit, setLimit] = useState(initialData?.limit || 1000);
  const [monthlyLimit, setMonthlyLimit] = useState(initialData?.monthlyLimit || false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-6">{title}</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block mb-2">
              Key Name — <span className="text-gray-500">A unique name to identify this key</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="default"
              className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.checked)}
                className="rounded"
              />
              <span>Limit monthly usage*</span>
            </label>
            {monthlyLimit && (
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700"
              />
            )}
            <p className="text-sm text-gray-500 mt-2">
              * If the combined usage of all your keys exceeds your plan's limit, all requests will be rejected.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-4 mt-8">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ name, limit, monthlyLimit })}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
} 