import type { PriceSnapshot } from '../api';

type PriceChartProps = {
  snapshots: PriceSnapshot[];
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  catch {
    return iso;
  }
}

export function PriceChart({ snapshots }: PriceChartProps) {
  return (
    <div style={{ marginTop: 16 }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>
        Price history
      </h4>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 14,
        }}
      >
        <thead>
          <tr style={{ borderBottom: '1px solid #eee', textAlign: 'left' }}>
            <th style={{ padding: '6px 8px' }}>Date checked</th>
            <th style={{ padding: '6px 8px' }}>Date range</th>
            <th style={{ padding: '6px 8px' }}>Total price</th>
            <th style={{ padding: '6px 8px' }}>Change</th>
          </tr>
        </thead>
        <tbody>
          {snapshots.map((row, i) => {
            const prev = snapshots[i - 1];
            const change =
              row.total_price != null && prev?.total_price != null
                ? row.total_price - prev.total_price
                : null;
            return (
              <tr key={row.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '6px 8px' }}>{formatDate(row.checked_at)}</td>
                <td style={{ padding: '6px 8px' }}>{row.date_range}</td>
                <td style={{ padding: '6px 8px' }}>
                  {row.total_price != null ? `$${row.total_price}` : '—'}
                </td>
                <td style={{ padding: '6px 8px' }}>
                  {change != null ? (
                    <span style={{ color: change >= 0 ? '#c00' : '#080' }}>
                      {change >= 0 ? '+' : ''}{change}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
