import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

export default function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }} gap={2} mb={2.5}>
      <Box>
        <Typography variant="h4" fontWeight={700} sx={{ color: '#0f172a', letterSpacing: 0 }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="#64748b" mt={0.75}>
            {description}
          </Typography>
        )}
      </Box>
      {actions}
    </Stack>
  );
}
