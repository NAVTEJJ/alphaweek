export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-center px-4">
      <div>
        <div className="text-4xl mb-4">📡</div>
        <h1 className="text-xl font-bold text-white mb-2">You&apos;re offline</h1>
        <p className="text-slate-400 text-sm mb-6">
          Check your connection and try again. Your last viewed data is still available.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
