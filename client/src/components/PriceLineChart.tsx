import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { PriceSnapshot } from '../api';

const PRIMARY = '#0069A6';

type PriceLineChartProps = {
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

export function PriceLineChart({ snapshots, title }: PriceLineChartProps) {
  const data = snapshots
    .filter((s) => s.total_price != null)
    .map((s) => ({
      checked_at: s.checked_at,
      dateLabel: formatDate(s.checked_at),
      price: s.total_price as number,
    }));

  if (data.length === 0) {
    return (
      <div style={{ marginTop: 16 }}>
        {title && (
          <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>{title}</h4>
        )}
        <p style={{ color: '#666', fontSize: 14 }}>No price data to chart.</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      {title && (
        <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>{title}</h4>
      )}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            dataKey="price"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            formatter={(value: number) => [`$${value}`, 'Price']}
            labelFormatter={(_, payload) =>
              payload?.[0]?.payload?.dateLabel ?? ''
            }
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke={PRIMARY}
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Price"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
