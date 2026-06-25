import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  InputAdornment,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Download as DownloadIcon,
  FirstPage as FirstPageIcon,
  KeyboardArrowLeft as PrevIcon,
  KeyboardArrowRight as NextIcon,
  LastPage as LastPageIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { employeeApi } from '../../api';
import { formatDateTime } from '../../utils/format';
import { analysisTriggerLabel } from '../../utils/riskLabels';
import type { AuditLog } from '../../types';

const ACTION_LABELS: Record<string, { label: string; color: 'default' | 'primary' | 'warning' | 'error' | 'success' | 'info' | 'secondary' }> = {
  OFFBOARDING_TRIGGERED: { label: '권한 점검 생성', color: 'warning' },
  AUTO_RISK_ANALYZED: { label: '시스템 감지', color: 'info' },
  REVOKE_ACCESS: { label: '권한 회수', color: 'error' },
  MARK_FALSE_POSITIVE: { label: '오탐 처리', color: 'success' },
};

const DEFAULT_PAGE_SIZE = 20;

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? { label: action, color: 'default' as const };
}

function summarizeDetail(log: AuditLog) {
  const detail = log.detail || '';

  if (log.action === 'OFFBOARDING_TRIGGERED' || log.action === 'AUTO_RISK_ANALYZED') {
    const risk = detail.match(/Risk:\s*([^,\s]+)/i)?.[1];
    const reason = detail.match(/Reason:\s*([^,]+)/i)?.[1];
    const riskText = risk ? readableRisk(risk) : '';
    const reasonText = reason ? analysisTriggerLabel(reason, true) : '';
    return ['권한 회수 대상 위험도 분석 완료', riskText, reasonText].filter(Boolean).join(' · ');
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

function readableRisk(value: string) {
  const match = value.match(/^(\d+(?:\.\d+)?)\/([A-Z]+)/i);
  if (!match) return value;
  const levelLabel: Record<string, string> = {
    LOW: '낮음',
    MEDIUM: '보통',
    HIGH: '높음',
    CRITICAL: '긴급',
  };
  return `${levelLabel[match[2].toUpperCase()] || match[2]} 위험도 (${match[1]}점)`;
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

export default function EmployeeLogPanel({
  title = '감사 로그',
  description = '권한 점검 생성, AI 자동 감지, 권한 회수, 오탐 처리처럼 직원 권한 관리에서 발생한 주요 처리 이력을 기록합니다.',
  initialQuery = '',
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  title?: string;
  description?: string;
  initialQuery?: string;
  pageSize?: number;
}) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalElements / pageSize));
  const currentPage = page + 1;
  const pageItems = getPageItems(currentPage, totalPages);
  const canGoPrev = page > 0;
  const canGoNext = currentPage < totalPages;
  const filteredLogs = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return logs;
    return logs.filter((log) => [
      formatDateTime(log.createdAt),
      log.actorName,
      log.actorEmail,
      actionLabel(log.action).label,
      targetDisplay(log),
      log.targetType,
      summarizeDetail(log),
      log.detail,
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(keyword)));
  }, [logs, query]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    employeeApi
      .getAuditLogs({ page, size: pageSize })
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
  }, [page, pageSize]);

  const downloadCsv = () => {
    const rows = [
      ['일시', '작업자', '작업자 이메일', '작업', '대상 이메일', '대상 이름', '요약'],
      ...filteredLogs.map((log) => [
        formatDateTime(log.createdAt),
        log.actorName || '시스템',
        log.actorEmail || '',
        actionLabel(log.action).label,
        targetParts(log).primary,
        targetParts(log).secondary,
        summarizeDetail(log),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `oram-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, bgcolor: 'white', overflow: 'hidden' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'flex-start' }} gap={1.5}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700} color="#0f172a">{title}</Typography>
            <Typography variant="body2" color="#64748b" mt={0.25}>
              {description}
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <TextField
              size="small"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="이름, 이메일, 부서, 작업, 요약 검색"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: { xs: '100%', sm: 280 } }}
            />
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={downloadCsv}
              disabled={filteredLogs.length === 0}
              sx={{ height: 40, borderRadius: 2, whiteSpace: 'nowrap' }}
            >
              엑셀 다운로드
            </Button>
          </Stack>
        </Stack>
      </Box>
      {loading && <LinearProgress />}
      {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
      <TableContainer>
        <Table size="small" sx={{ tableLayout: 'fixed', '& th, & td': { px: 1.25 }, '& td': { overflow: 'hidden', textOverflow: 'ellipsis' } }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell sx={{ width: '14%', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>일시</TableCell>
              <TableCell sx={{ width: '13%', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>작업자</TableCell>
              <TableCell sx={{ width: '11%', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>작업</TableCell>
              <TableCell sx={{ width: '24%', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>대상</TableCell>
              <TableCell sx={{ width: '38%', fontWeight: 700, fontSize: 13 }}>요약</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && filteredLogs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary" fontSize={14}>
                    {query ? '검색 조건에 맞는 감사 로그가 없습니다.' : '표시할 감사 로그가 없습니다.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {filteredLogs.map((log) => {
              const meta = actionLabel(log.action);
              const target = targetParts(log);
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
                      {target.primary}
                    </Typography>
                    <Typography fontSize={11} color="text.secondary" noWrap>
                      {target.secondary}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: 13, color: '#475569' }}>
                    <Typography fontSize={13} noWrap>{summarizeDetail(log)}</Typography>
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

function targetParts(log: AuditLog) {
  const raw = targetDisplay(log);
  const [namePart, emailPart] = raw.split('/').map((part) => part.trim());
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (emailPart && emailRegex.test(emailPart)) {
    return { primary: emailPart, secondary: namePart || '이름 없음' };
  }
  if (emailRegex.test(namePart)) {
    return { primary: namePart, secondary: '이름 없음' };
  }
  if (raw === '삭제되었거나 확인할 수 없는 직원') {
    return { primary: '확인 불가', secondary: raw };
  }
  return { primary: raw, secondary: log.targetType === 'OFFBOARDING_RESULT' ? '권한 회수 대상' : '직원' };
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
