import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  FirstPage as FirstPageIcon,
  KeyboardArrowLeft as PrevIcon,
  KeyboardArrowRight as NextIcon,
  LastPage as LastPageIcon,
} from '@mui/icons-material';
import { employeeApi } from '../../api';
import { formatDateTime } from '../../utils/format';
import type { AuditLog } from '../../types';

const ACTION_LABELS: Record<string, { label: string; color: 'default' | 'primary' | 'warning' | 'error' | 'success' | 'info' | 'secondary' }> = {
  OFFBOARDING_TRIGGERED: { label: '권한 점검 생성', color: 'warning' },
  AUTO_RISK_ANALYZED: { label: '시스템 감지', color: 'info' },
  REVOKE_ACCESS: { label: '권한 회수', color: 'error' },
  MARK_FALSE_POSITIVE: { label: '오탐 처리', color: 'success' },
};

const PAGE_SIZE = 20;

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? { label: action, color: 'default' as const };
}

function summarizeDetail(log: AuditLog) {
  const detail = log.detail || '';

  if (log.action === 'OFFBOARDING_TRIGGERED' || log.action === 'AUTO_RISK_ANALYZED') {
    const risk = detail.match(/Risk:\s*([^,\s]+)/i)?.[1];
    const reason = detail.match(/Reason:\s*([^,]+)/i)?.[1];
    return `위험도 점검 완료${risk ? ` (${risk})` : ''}${reason ? `, 근거: ${reason}` : ''}`;
  }

  if (log.action === 'REVOKE_ACCESS') {
    const service = detail.match(/Revoked\s+(\w+)\s+access/i)?.[1];
    return service ? `${service} 권한 회수 처리` : 'SaaS 권한 회수 처리';
  }

  if (log.action === 'MARK_FALSE_POSITIVE') {
    const reason = detail.match(/Reason:\s*(.+)$/i)?.[1];
    return reason ? `오탐 처리: ${reason}` : '오탐으로 처리';
  }

  return detail || '-';
}

function targetDisplay(log: AuditLog) {
  if (log.targetLabel && !isUuid(log.targetLabel)) {
    return log.targetLabel;
  }
  if (log.targetType === 'EMPLOYEE' || log.targetType === 'OFFBOARDING_RESULT') {
    return '삭제되었거나 확인할 수 없는 직원';
  }
  return log.targetId || '-';
}

function isUuid(value?: string) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));
}

export default function EmployeeLogPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalElements / PAGE_SIZE));
  const currentPage = page + 1;
  const pageItems = getPageItems(currentPage, totalPages);
  const canGoPrev = page > 0;
  const canGoNext = currentPage < totalPages;

  useEffect(() => {
    setLoading(true);
    setError(null);
    employeeApi
      .getAuditLogs({ page, size: PAGE_SIZE })
      .then((data) => {
        setLogs(data.content);
        setTotalElements(data.totalElements);
      })
      .catch((err) => {
        setLogs([]);
        setTotalElements(0);
        setError(err?.response?.data?.error || '감사 로그를 불러오지 못했습니다. 로그인 상태를 확인하세요.');
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, bgcolor: 'white', overflow: 'hidden' }}>
      {loading && <LinearProgress />}
      {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell sx={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>일시</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>작업자</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>작업</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>대상</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>요약</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary" fontSize={14}>
                    표시할 감사 로그가 없습니다.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {logs.map((log) => {
              const meta = actionLabel(log.action);
              return (
                <TableRow key={log.id} hover>
                  <TableCell sx={{ fontSize: 13, whiteSpace: 'nowrap', color: '#475569' }}>
                    {formatDateTime(log.createdAt)}
                  </TableCell>
                  <TableCell sx={{ fontSize: 13 }}>
                    <Typography fontSize={13} fontWeight={600}>{log.actorName ?? '시스템'}</Typography>
                    {log.actorEmail && (
                      <Typography fontSize={11} color="text.secondary">{log.actorEmail}</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={meta.label}
                      color={meta.color}
                      size="small"
                      sx={{ fontWeight: 700, fontSize: 11 }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: 13, color: '#334155' }}>
                    <Typography fontSize={13} fontWeight={600} noWrap>
                      {targetDisplay(log)}
                    </Typography>
                    {log.targetType && (
                      <Typography fontSize={11} color="text.secondary">
                        {log.targetType}{isUuid(log.targetId) ? ` · ${log.targetId.slice(0, 8)}` : ''}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: 13, color: '#475569', maxWidth: 420 }}>
                    <Typography fontSize={13}>{summarizeDetail(log)}</Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', bgcolor: '#ffffff' }}>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          {totalPages > 1 && (
            <>
              <PageButton disabled={!canGoPrev} onClick={() => setPage(0)} icon={<FirstPageIcon fontSize="small" />} />
              <PageButton disabled={!canGoPrev} onClick={() => setPage(page - 1)} icon={<PrevIcon fontSize="small" />} />
            </>
          )}
          {pageItems.map((item, index) => (
            item === 'ellipsis' ? (
              <Box key={`ellipsis-${index}`} sx={{ width: 28, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>...</Box>
            ) : (
              <PageButton key={item} active={item === currentPage} onClick={() => setPage(item - 1)}>
                {item}
              </PageButton>
            )
          ))}
          {totalPages > 1 && (
            <>
              <PageButton disabled={!canGoNext} onClick={() => setPage(page + 1)} icon={<NextIcon fontSize="small" />} />
              <PageButton disabled={!canGoNext} onClick={() => setPage(totalPages - 1)} icon={<LastPageIcon fontSize="small" />} />
            </>
          )}
        </Stack>
      </Box>
    </Paper>
  );
}

function getPageItems(currentPage: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  if (currentPage >= totalPages - 3) return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
}

function PageButton({
  children,
  icon,
  active,
  disabled,
  onClick,
}: {
  children?: React.ReactNode;
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? 'contained' : 'outlined'}
      disabled={disabled}
      onClick={onClick}
      sx={{
        minWidth: 34,
        width: icon && !children ? 34 : 'auto',
        height: 34,
        px: children ? 1.25 : 0,
        borderRadius: 1.5,
        color: active ? 'white' : '#475569',
        bgcolor: active ? '#334155' : '#f8fafc',
        borderColor: active ? '#334155' : '#e2e8f0',
        fontWeight: 700,
        fontSize: 13,
        boxShadow: active ? '0 6px 14px rgba(15, 23, 42, 0.12)' : 'none',
        '&:hover': {
          bgcolor: active ? '#334155' : '#eef2f7',
          borderColor: active ? '#334155' : '#cbd5e1',
          boxShadow: active ? '0 6px 14px rgba(15, 23, 42, 0.12)' : 'none',
        },
        '&.Mui-disabled': { bgcolor: '#f8fafc', borderColor: '#eef2f7', color: '#cbd5e1' },
      }}
    >
      {icon || children}
    </Button>
  );
}
