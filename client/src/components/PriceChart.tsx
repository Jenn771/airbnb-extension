import type { PriceSnapshot } from '../api';

type PriceChartProps = {
  snapshots: PriceSnapshot[];
  title?: string;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function PriceChart({ snapshots, title }: PriceChartProps) {
  if (snapshots.length === 0) {
    return (
      <div style={{ marginTop: 16 }}>
        {title && (
          <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>{title}</h4>
        )}
        <p style={{ color: '#666', fontSize: 14 }}>No check history.</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      {title && (
        <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>
          Check history
          {title ? ` — ${title}` : ''}
        </h4>
      )}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 14,
          background: '#fff',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <thead>
          <tr style={{ borderBottom: '1px solid #eee', textAlign: 'left', background: '#fafafa' }}>
            <th style={{ padding: '10px 12px' }}>Date checked</th>
            <th style={{ padding: '10px 12px' }}>Date range</th>
            <th style={{ padding: '10px 12px' }}>Total price</th>
            <th style={{ padding: '10px 12px' }}>Change</th>
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
                <td style={{ padding: '8px 12px' }}>{formatDate(row.checked_at)}</td>
                <td style={{ padding: '8px 12px' }}>{row.date_range}</td>
                <td style={{ padding: '8px 12px' }}>
                  {row.total_price != null ? `$${row.total_price}` : '—'}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  {change != null ? (
                    <span
                      style={{
                        color: change >= 0 ? '#e53935' : '#2e7d32',
                        fontWeight: 500,
                      }}
                    >
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
