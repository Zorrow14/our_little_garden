/** A five-petal flower mark, used on the envelope sticker and the progress row. */
export default function FlowerGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse key={angle} cx="12" cy="6.4" rx="3.3" ry="4.9" transform={`rotate(${angle} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="2.4" />
    </svg>
  );
}
