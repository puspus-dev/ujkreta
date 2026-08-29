export default function Loading({
  text = "Betöltés..."
}) {
  return (
    <div className="loading">
      <div className="spinner" />

      <span>
        {text}
      </span>
    </div>
  );
}