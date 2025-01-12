'use client';
import { ApiKey, VisibleKeys } from '@/types/api';
import { 
  EyeIcon, 
  ClipboardDocumentIcon, 
  PencilSquareIcon, 
  TrashIcon 
} from '@heroicons/react/24/outline';

interface ApiKeysTableProps {
  apiKeys: ApiKey[];
  visibleKeys: VisibleKeys;
  onToggleVisibility: (keyId: string) => void;
  onCopy: (key: string) => void;
  onEdit: (key: ApiKey) => void;
  onDelete: (key: ApiKey) => void;
}

export function ApiKeysTable({
  apiKeys,
  visibleKeys,
  onToggleVisibility,
  onCopy,
  onEdit,
  onDelete,
}: ApiKeysTableProps) {
  return (
    <table className="w-full">
      <thead>
        <tr className="text-left text-sm">
          <th className="pb-4">NAME</th>
          <th className="pb-4">USAGE</th>
          <th className="pb-4">KEY</th>
          <th className="pb-4">OPTIONS</th>
        </tr>
      </thead>
      <tbody>
        {apiKeys.map((apiKey) => (
          <tr key={apiKey.id} className="border-t dark:border-gray-700">
            <td className="py-4">{apiKey.name}</td>
            <td className="py-4">{apiKey.usage}</td>
            <td className="py-4">
              <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
                {visibleKeys[apiKey.id] 
                  ? apiKey.key
                  : apiKey.key.replace(/(?<=^.{4}).*(?=.{4}$)/g, '•'.repeat(24))}
              </code>
            </td>
            <td className="py-4">
              <div className="flex items-center gap-1">
                <ActionButton
                  icon={<EyeIcon className={`w-5 h-5 ${
                    visibleKeys[apiKey.id]
                      ? 'text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`} />}
                  onClick={() => onToggleVisibility(apiKey.id)}
                  tooltip={visibleKeys[apiKey.id] ? 'Hide Key' : 'Show Key'}
                  ariaLabel={visibleKeys[apiKey.id] ? "Hide API Key" : "Show API Key"}
                />
                <ActionButton
                  icon={<ClipboardDocumentIcon className="w-5 h-5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" />}
                  onClick={() => onCopy(apiKey.key)}
                  tooltip="Copy Key"
                  ariaLabel="Copy API Key"
                />
                <ActionButton
                  icon={<PencilSquareIcon className="w-5 h-5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" />}
                  onClick={() => onEdit(apiKey)}
                  tooltip="Edit Key"
                  ariaLabel="Edit API Key"
                />
                <ActionButton
                  icon={<TrashIcon className="w-5 h-5 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300" />}
                  onClick={() => onDelete(apiKey)}
                  tooltip="Delete Key"
                  ariaLabel="Delete API Key"
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  tooltip: string;
  ariaLabel: string;
}

function ActionButton({ icon, onClick, tooltip, ariaLabel }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg group relative"
      aria-label={ariaLabel}
    >
      {icon}
      <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
        {tooltip}
      </span>
    </button>
  );
} 