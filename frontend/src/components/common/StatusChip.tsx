import { Chip } from '@mui/material';
import type { EmployeeStatus } from '../../types';

interface Props {
  status: EmployeeStatus;
}

export default function StatusChip({ status }: Props) {
  return (
    <Chip
      label={status === 'ACTIVE' ? '재직 중' : '퇴사'}
      color={status === 'ACTIVE' ? 'success' : 'default'}
      size="small"
      variant={status === 'ACTIVE' ? 'filled' : 'outlined'}
      sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}
    />
  );
}
