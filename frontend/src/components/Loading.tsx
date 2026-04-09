export default function Loading({ text = 'Ładowanie...' }: { text?: string }) {
  return (
    <div className="loading">
      <div className="spinner" />
      {text}
    </div>
  );
}

export function ErrorMsg({ message }: { message: string }) {
  return <div className="error-msg">{message}</div>;
}
