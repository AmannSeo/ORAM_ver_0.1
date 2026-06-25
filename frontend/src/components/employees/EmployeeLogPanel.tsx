import { useEffect, useState } from 'react';
import {
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
  OFFBOARDING_TRIGGERED: { label: '오프보딩 시작', color: 'warning' },
  AUTO_RISK_ANALYZED: { label: '리스크 분석', color: 'info' },
  REVOKE_ACCESS: { label: '권한 회수', color: 'error' },
  MARK_FALSE_POSITIVE: { label: '오탐 처리', color: 'success' },
};

const PAGE_SIZE = 20;

export default function EmployeeLogPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  useEffect(() => {
    setLoading(true);
    employeeApi
      .getAuditLogs({ page, size: PAGE_SIZE })
      .then((data) => {
        setLogs(data.content);
        setTotalElements(data.totalElements);
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, bgcolor: 'white', overflow: 'hidden' }}>
      {loading && <LinearProgress />}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell sx={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>일시</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>작업자</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>작업 유형</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>대상 직원</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>상세 내용</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary" fontSize={14}>
                    기록된 감사 로그가 없습니다.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {logs.map((log) => {
              const actionMeta = ACTION_LABELS[log.action];
              return (
                <TableRow key={log.id} hover>
                  <TableCell sx={{ fontSize: 13, whiteSpace: 'nowrap', color: '#475569' }}>
                    {formatDateTime(log.createdAt)}
                  </TableCell>
                  <TableCell sx={{ fontSize: 13 }}>
                    <Typography fontSize={13} fontWeight={600}>{log.actorName ?? '-'}</Typography>
                    {log.actorEmail && (
                      <Typography fontSize={11} color="text.secondary">{log.actorEmail}</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {actionMeta ? (
                      <Chip
                        label={actionMeta.label}
                        color={actionMeta.color}
                        size="small"
                        sx={{ fontWeight: 700, fontSize: 11 }}
                      />
                    ) : (
                      <Chip
                        label={log.action}
                        size="small"
                        sx={{ fontWeight: 700, fontSize: 11 }}
                      />
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: 13, color: '#334155', fontFamily: 'monospace' }}>
                    {log.targetId ?? '-'}
                  </TableCell>
                  <TableCell sx={{ fontSize: 13, color: '#475569', maxWidth: 360 }}>
                    {log.detail ?? '-'}
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
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} / 전체 ${count}개`}
      />
    </Paper>
  );
}
