import { useEffect, useState } from 'react';
import {
  Alert,
  Chip,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material';
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
      <TablePagination
        component="div"
        count={totalElements}
        page={page}
        rowsPerPage={PAGE_SIZE}
        rowsPerPageOptions={[PAGE_SIZE]}
        onPageChange={(_, newPage) => setPage(newPage)}
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} / 전체 ${count}건`}
      />
    </Paper>
  );
}
