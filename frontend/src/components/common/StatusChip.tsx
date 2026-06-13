import { Chip } from '@mui/material';
import type { EmployeeStatus } from '../../types';

interface Props {
  status: EmployeeStatus;
}

export default function StatusChip({ status }: Props) {
  return (
    <Chip
      label={status === 'ACTIVE' ? 'Active' : 'Resigned'}
      color={status === 'ACTIVE' ? 'success' : 'default'}
      size="small"
    />
  );
}
