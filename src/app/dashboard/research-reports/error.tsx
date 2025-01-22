'use client';

export default function Error() {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
        Something went wrong
      </h2>
      <button
        onClick={() => window.location.reload()}
        className="text-blue-600 hover:text-blue-700"
      >
        Try again
      </button>
    </div>
  );
} 