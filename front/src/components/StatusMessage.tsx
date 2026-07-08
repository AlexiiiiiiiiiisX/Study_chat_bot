export function StatusMessage({ type, message }: { type: "error" | "success" | "info"; message: string | null }) {
  if (!message) return null;
  return <p className={`status-message ${type}`}>{message}</p>;
}
