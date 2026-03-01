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
  } catch {
    return iso;
  }
}

export function PriceChart({ snapshots }: PriceChartProps) {
  if (snapshots.length === 0) {
    return (
      <div>
        <p
          style={{
            color: '#888',
            fontSize: 13,
            margin: 0,
            padding: '16px 0',
          }}
        >
          No check history.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid #eee',
          background: '#fff',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
          }}
        >
          <thead>
            <tr style={{ background: '#fafafa', borderBottom: '1px solid #eee' }}>
              <th
                style={{
                  padding: '12px 14px',
                  textAlign: 'left',
                  color: '#888',
                  fontWeight: 600,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Date checked
              </th>
              <th
                style={{
                  padding: '12px 14px',
                  textAlign: 'left',
                  color: '#888',
                  fontWeight: 600,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Date range
              </th>
              <th
                style={{
                  padding: '12px 14px',
                  textAlign: 'left',
                  color: '#888',
                  fontWeight: 600,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Total price
              </th>
              <th
                style={{
                  padding: '12px 14px',
                  textAlign: 'left',
                  color: '#888',
                  fontWeight: 600,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((row, i) => {
              const prev = snapshots[i - 1];
              const change =
                row.total_price != null && prev?.total_price != null
                  ? row.total_price - prev.total_price
                  : null;
              const changeColor =
                change == null
                  ? '#999'
                  : change > 0
                    ? '#c62828'
                    : change < 0
                      ? '#2e7d32'
                      : '#616161';
              const changeText =
                change == null
                  ? '—'
                  : change > 0
                    ? `+$${change.toLocaleString()}`
                    : change < 0
                      ? `-$${Math.abs(change).toLocaleString()}`
                      : '+$0';
              return (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: i < snapshots.length - 1 ? '1px solid #f0f0f0' : 'none',
                  }}
                >
                  <td style={{ padding: '12px 14px', color: '#444' }}>
                    {formatDate(row.checked_at)}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#444' }}>
                    {row.date_range === 'no-available-dates'
                      ? 'No available dates'
                      : row.date_range}
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: '#222' }}>
                    {row.total_price != null
                      ? `$${row.total_price.toLocaleString()}`
                      : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', color: changeColor, fontWeight: 500 }}>
                    {changeText}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
