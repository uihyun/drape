// Deterministic 2-column masonry. Distributes items alternately (0→left,
// 1→right, 2→left, …) into two independently-stacked flex columns. Unlike CSS
// multi-column (`columns: 2`), placement never depends on image heights, so
// it can't reflow/rebalance as photos load — items just sit where their index
// puts them, even with wildly different heights.
export function Masonry({ items = [], getKey, children, className = '' }) {
  const cols = [[], []];
  items.forEach((it, i) => cols[i % 2].push(it));
  return (
    <div className={`masonry ${className}`}>
      {cols.map((col, ci) => (
        <div className="masonry-col" key={ci}>
          {col.map((it, i) => {
            const key = getKey ? getKey(it) : (it?.id ?? `${ci}-${i}`);
            return <div key={key}>{children(it)}</div>;
          })}
        </div>
      ))}
    </div>
  );
}

export default Masonry;
