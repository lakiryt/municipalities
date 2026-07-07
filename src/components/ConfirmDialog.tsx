type Props = {
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

// Stacks on top of whatever modal triggered it (e.g. ColumnModal), hence the
// higher z-index than the standard z-50 used elsewhere.
function ConfirmDialog({ message, confirmLabel = '削除', onConfirm, onCancel }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-white rounded-lg shadow-xl p-6 w-[420px] max-w-[calc(100vw-2rem)]">
        <p className="text-sm text-gray-700 mb-5 whitespace-pre-line">{message}</p>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm" onClick={onCancel}>
            キャンセル
          </button>
          <button className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
