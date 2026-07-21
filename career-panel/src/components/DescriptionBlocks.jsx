// Renders a plain-text job description (blank-line paragraphs, "•" bullets)
// as styled sections: short standalone lines become serif section headings,
// bullet-only blocks become proper lists, everything else keeps its line
// breaks via whitespace-pre-line.

function isHeading(block) {
  return (
    !block.includes('\n') &&
    block.length <= 60 &&
    !block.startsWith('•') &&
    !/[.!?]$/.test(block)
  );
}

function isBulletList(block) {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length > 0 && lines.every((l) => l.startsWith('•'));
}

export default function DescriptionBlocks({ text }) {
  const blocks = (text || '')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return (
      <p className="text-[13px] text-muted">
        A detailed description for this role will be shared during the interview.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        if (isHeading(block)) {
          return (
            <h3
              key={i}
              className="font-display text-lg font-semibold text-ink pt-3 first:pt-0"
            >
              {block}
            </h3>
          );
        }
        if (isBulletList(block)) {
          const items = block
            .split('\n')
            .map((l) => l.trim().replace(/^•\s*/, ''))
            .filter(Boolean);
          return (
            <ul key={i} className="space-y-1.5 pl-1">
              {items.map((item, j) => (
                <li key={j} className="flex gap-2.5 text-[13.5px] leading-relaxed text-body">
                  <span className="text-berry shrink-0" aria-hidden="true">
                    •
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line text-[13.5px] leading-relaxed text-body">
            {block}
          </p>
        );
      })}
    </div>
  );
}
