import type { ReactNode } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  BarChart as AnalyzeIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  FirstPage as FirstPageIcon,
  KeyboardArrowLeft as PrevIcon,
  KeyboardArrowRight as NextIcon,
  LastPage as LastPageIcon,
  PersonOff as ResignIcon,
  WarningAmber as PriorityIcon,
} from '@mui/icons-material';
import StatusChip from '../common/StatusChip';
import { SAAS_BADGE } from '../../constants/saas';
import type { Employee, EmployeeSaasAccount, SaasType } from '../../types';

const AVATAR_COLORS = ['#2563eb', '#059669', '#475569', '#d97706'];

const compactButtonSx = {
  minWidth: 'auto',
  height: 32,
  px: 1.25,
  borderRadius: 1.5,
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap',
  '& .MuiButton-startIcon': { mr: 0.5 },
};

function isPriorityTarget(employee: Employee) {
  const saasCount = employee.connectedSaas?.length ?? 0;
  return (employee.status === 'RESIGNED' && saasCount > 0) || (employee.status === 'ACTIVE' && saasCount >= 3);
}

function renderSaasTooltip(account: EmployeeSaasAccount) {
  const meta = SAAS_BADGE[account.saasType];
  const status = account.accessRevoked ? '회수됨' : account.status === 'RESIGNED' ? '비활성' : '활성';
  return `${meta.label} / ${account.displayName || account.externalUsername || account.externalEmail || '-'} / ${status}`;
}

function displayDepartment(department?: string) {
  if (!department) return '-';
  const normalized = department.trim();
  if (!normalized || normalized === '-') return '-';

  const upper = normalized.toUpperCase();
  if (['SLACK', 'GITHUB', 'NOTION'].some((saas) => upper.includes(saas))) return '-';
  return normalized;
}

export default function EmployeeTable(props: {
  employees: Employee[];
  page: number;
  rowsPerPage: number;
  totalElements: number;
  setPage: (value: number) => void;
  openEditDialog: (employee: Employee) => void;
  openDeleteDialog: (employee: Employee) => void;
  openResignDialog: (employee: Employee) => void;
  resigningEmployeeId: string | null;
  analyzingEmployeeId: string | null;
  analyzeEmployee: (employee: Employee) => void;
  openDetailDialog: (employee: Employee) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(props.totalElements / props.rowsPerPage));
  const currentPage = props.page + 1;
  const pageItems = getPageItems(currentPage, totalPages);
  const canGoPrev = props.page > 0;
  const canGoNext = currentPage < totalPages;

  return (
    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflowX: 'hidden', bgcolor: 'white', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' }}>
      <Table sx={{ width: '100%', tableLayout: 'fixed', '& th, & td': { px: 1.1 }, '& td': { overflow: 'hidden', textOverflow: 'ellipsis' } }}>
        <TableHead>
          <TableRow sx={{ bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <HeaderCell width="5%">No.</HeaderCell>
            <HeaderCell width="13%">이름</HeaderCell>
            <HeaderCell width="21%">이메일</HeaderCell>
            <HeaderCell width="12%">부서</HeaderCell>
            <HeaderCell width="12%">연동 SaaS</HeaderCell>
            <HeaderCell width="8%" align="center">상태</HeaderCell>
            <HeaderCell width="29%" align="center">조치</HeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {props.employees.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ py: 7, color: '#94a3b8' }}>조건에 맞는 직원이 없습니다.</TableCell>
            </TableRow>
          )}
          {props.employees.map((employee, index) => (
            <TableRow key={employee.id} hover sx={{ '& td': { borderColor: '#f1f5f9' }, '&:hover': { bgcolor: '#f8fafc' } }}>
              <TableCell>
                <Typography variant="body2" fontWeight={900} color="#64748b">
                  {props.page * props.rowsPerPage + index + 1}
                </Typography>
              </TableCell>
              <TableCell sx={{ py: 1.75 }}>
                <Stack direction="row" spacing={1.5} alignItems="center" minWidth={0}>
                  <Box sx={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: AVATAR_COLORS[index % AVATAR_COLORS.length], color: 'white', fontWeight: 900, flexShrink: 0 }}>
                    {employee.name.slice(0, 1)}
                  </Box>
                  <Box minWidth={0}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Button
                        variant="text"
                        onClick={() => props.openDetailDialog(employee)}
                        sx={{ minWidth: 0, p: 0, color: '#0f172a', fontWeight: 900, textAlign: 'left', justifyContent: 'flex-start', textTransform: 'none' }}
                      >
                        <Typography fontWeight={900} noWrap>{employee.name}</Typography>
                      </Button>
                      {isPriorityTarget(employee) && <PriorityIcon color="error" sx={{ fontSize: 16, flexShrink: 0 }} />}
                    </Stack>
                  </Box>
                </Stack>
              </TableCell>
              <TableCell>
                <Button
                  variant="text"
                  onClick={() => props.openDetailDialog(employee)}
                  sx={{ minWidth: 0, p: 0, color: '#334155', textAlign: 'left', justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  <Typography variant="body2" noWrap>{employee.email}</Typography>
                </Button>
              </TableCell>
              <TableCell>
                <Typography fontWeight={800} noWrap>{displayDepartment(employee.department)}</Typography>
              </TableCell>
              <TableCell><SaaSBadges employee={employee} /></TableCell>
              <TableCell align="center"><StatusChip status={employee.status} /></TableCell>
              <TableCell align="center">
                <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="nowrap">
                  <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => props.openEditDialog(employee)} sx={compactButtonSx}>수정</Button>
                  {employee.status === 'ACTIVE' ? (
                    <Button size="small" variant="outlined" color="warning" startIcon={props.resigningEmployeeId === employee.id ? <CircularProgress size={14} /> : <ResignIcon />} onClick={() => props.openResignDialog(employee)} disabled={props.resigningEmployeeId === employee.id} sx={compactButtonSx}>퇴사</Button>
                  ) : (
                    <Tooltip title={(employee.connectedSaas?.length ?? 0) === 0 ? '재분석할 SaaS 계정이 없습니다.' : '기존 오프보딩 결과를 새로 수집한 SaaS 권한 기준으로 갱신합니다.'}>
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={props.analyzingEmployeeId === employee.id ? <CircularProgress size={14} /> : <AnalyzeIcon />}
                          onClick={() => props.analyzeEmployee(employee)}
                          disabled={props.analyzingEmployeeId === employee.id || (employee.connectedSaas?.length ?? 0) === 0}
                          sx={{ ...compactButtonSx, borderColor: '#bfdbfe', color: '#1d4ed8', bgcolor: '#eff6ff' }}
                        >
                          {props.analyzingEmployeeId === employee.id ? '갱신 중' : '재분석'}
                        </Button>
                      </span>
                    </Tooltip>
                  )}
                  <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => props.openDeleteDialog(employee)} sx={compactButtonSx}>삭제</Button>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          flexWrap: 'wrap',
          bgcolor: '#ffffff',
        }}
      >
        <Typography variant="body2" color="#64748b">
          총 {props.totalElements.toLocaleString()}명 · Page {currentPage} of {totalPages}
        </Typography>

        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <PageButton disabled={!canGoPrev} onClick={() => props.setPage(0)} icon={<FirstPageIcon fontSize="small" />} />
          <PageButton disabled={!canGoPrev} onClick={() => props.setPage(props.page - 1)} icon={<PrevIcon fontSize="small" />} />
          {pageItems.map((item, index) => (
            item === 'ellipsis' ? (
              <Box key={`ellipsis-${index}`} sx={{ width: 28, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>...</Box>
            ) : (
              <PageButton
                key={item}
                active={item === currentPage}
                onClick={() => props.setPage(item - 1)}
              >
                {item}
              </PageButton>
            )
          ))}
          <PageButton disabled={!canGoNext} onClick={() => props.setPage(props.page + 1)} icon={<NextIcon fontSize="small" />} />
          <PageButton disabled={!canGoNext} onClick={() => props.setPage(totalPages - 1)} icon={<LastPageIcon fontSize="small" />} />
        </Stack>
      </Box>
    </TableContainer>
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
  children?: ReactNode;
  icon?: ReactNode;
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
        '&.Mui-disabled': {
          bgcolor: '#f8fafc',
          borderColor: '#eef2f7',
          color: '#cbd5e1',
        },
      }}
    >
      {icon || children}
    </Button>
  );
}

function HeaderCell({ children, align, width }: { children: ReactNode; align?: 'left' | 'center' | 'right'; width?: string }) {
  return (
    <TableCell align={align} sx={{ width, color: '#64748b', fontWeight: 900, letterSpacing: 0.6, fontSize: 12, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {children}
    </TableCell>
  );
}

function SaaSBadges({ employee }: { employee: Employee }) {
  if (!employee.connectedSaas || employee.connectedSaas.length === 0) {
    return <Typography variant="caption" color="#94a3b8">연동 없음</Typography>;
  }
  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      {employee.connectedSaas.map((account) => {
        const meta = SAAS_BADGE[account.saasType];
        const revoked = account.accessRevoked;
        return (
          <Tooltip key={account.id} title={renderSaasTooltip(account)}>
            <Chip
              label={meta.short}
              size="small"
              sx={{
                height: 26,
                minWidth: 30,
                borderRadius: 1,
                fontWeight: 900,
                color: revoked ? '#94a3b8' : meta.color,
                bgcolor: revoked ? '#f1f5f9' : meta.bg,
                border: '1px solid',
                borderColor: revoked ? '#e2e8f0' : meta.border,
              }}
            />
          </Tooltip>
        );
      })}
    </Stack>
  );
}
