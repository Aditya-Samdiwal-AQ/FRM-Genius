export function ProvenanceMeta({ parts }: { parts: string[] }) {
  return (
    <p className="provenance">
      {parts.map((part, i) => (
        <span key={part}>
          {i > 0 && <span className="mx-1.5">·</span>}
          {part}
        </span>
      ))}
    </p>
  );
}
