import { Chip } from '@mui/material';
import type { RiskLevel } from '../../types';

const RISK_CONFIG: Record<RiskLevel, { label: string; color: 'success' | 'info' | 'warning' | 'error' }> = {
  LOW:      { label: 'Low',      color: 'success' },
  MEDIUM:   { label: 'Medium',   color: 'info' },
  HIGH:     { label: 'High',     color: 'warning' },
  CRITICAL: { label: 'Critical', color: 'error' },
};

interface Props {
  level?: RiskLevel;
  score?: number;
}

export default function RiskBadge({ level, score }: Props) {
  if (!level) return <Chip label="N/A" size="small" />;
  const { label, color } = RISK_CONFIG[level];
  const displayLabel = score !== undefined ? `${label} (${score})` : label;
  if (level === 'LOW') {
    return (
      <Chip
        label={displayLabel}
        size="small"
        variant="filled"
        sx={{
          bgcolor: '#dcfce7',
          color: '#166534',
          border: '1px solid #86efac',
          fontWeight: 800,
        }}
      />
    );
  }
  return <Chip label={displayLabel} color={color} size="small" variant="filled" />;
}
