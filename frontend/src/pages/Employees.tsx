import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  BarChart as AnalyzeIcon,
  Cloud as CloudIcon,
  Delete as DeleteIcon,
  DeleteSweep as DeleteAllIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  People as PeopleIcon,
  PersonOff as ResignIcon,
  Search as SearchIcon,
  Upload as UploadIcon,
  WarningAmber as PriorityIcon,
} from '@mui/icons-material';
import { dashboardApi, employeeApi } from '../api';
import type { DashboardStats, Employee, EmployeeSaasAccount, EmployeeStatus, SaasType } from '../types';
import StatusChip from '../components/common/StatusChip';
import { useAuthStore } from '../store/authStore';

const SAAS_BADGE: Record<SaasType, { short: string; label: string; color: string; bg: string; border: string }> = {
  SLACK: { short: 'SL', label: 'Slack', color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' },
  GITHUB: { short: 'GI', label: 'GitHub', color: '#334155', bg: '#f1f5f9', border: '#cbd5e1' },
  NOTION: { short: 'NO', label: 'Notion', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
};

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

function getEmployeeSourceLabel(employee: Employee) {
  if (employee.employeeId.startsWith('SLACK-')) return 'Slack 동기화';
  if (employee.employeeId.startsWith('GITHUB-')) return 'GitHub 동기화';
  if (employee.employeeId.startsWith('NOTION-')) return 'Notion 동기화';
  if (employee.employeeId.startsWith('CSV-')) return 'CSV 자동 생성';
  return '직접 등록/HR';
}

function isPriorityTarget(employee: Employee) {
  const saasCount = employee.connectedSaas?.length ?? 0;
  return (employee.status === 'RESIGNED' && saasCount > 0) || (employee.status === 'ACTIVE' && saasCount >= 3);
}

function renderSaasTooltip(account: EmployeeSaasAccount) {
  const meta = SAAS_BADGE[account.saasType];
  const status = account.accessRevoked ? '회수됨' : account.status === 'RESIGNED' ? '비활성' : '활성';
  return `${meta.label} / ${account.displayName || account.externalUsername || account.externalEmail || '-'} / ${status}`;
}

export default function Employees() {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'employees' | 'hr'>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>(searchParams.get('status') || '');
  const [filterDept, setFilterDept] = useState('');
  const [filterSaas, setFilterSaas] = useState<SaasType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [analyzingEmployeeId, setAnalyzingEmployeeId] = useState<string | null>(null);
  const [resignDialog, setResignDialog] = useState<Employee | null>(null);
  const [resigningEmployeeId, setResigningEmployeeId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Employee | null>(null);
  const [deleteAllDialog, setDeleteAllDialog] = useState(false);
  const [addDialog, setAddDialog] = useState(false);
  const [editDialog, setEditDialog] = useState<Employee | null>(null);
  const [newEmployee, setNewEmployee] = useState({
    employeeId: '',
    name: '',
    email: '',
    department: '',
    status: 'ACTIVE' as EmployeeStatus,
  });
  const [editEmployee, setEditEmployee] = useState({
    name: '',
    department: '',
    status: 'ACTIVE' as EmployeeStatus,
  });
  const [csvDialog, setCsvDialog] = useState(false);
  const [csvResult, setCsvResult] = useState<{
    importedCount: number;
    skippedCount: number;
    errorCount: number;
    imported: string[];
    skipped: string[];
    errors: string[];
  } | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentPageSaasLinkedCount = useMemo(() => employees.filter((employee) => (employee.connectedSaas?.length ?? 0) > 0).length, [employees]);

  const load = () => {
    setLoading(true);
    employeeApi.getAll({
      status: filterStatus || undefined,
      department: filterDept || undefined,
      saasType: filterSaas || undefined,
      q: searchQuery || undefined,
      page,
      size: rowsPerPage,
    })
      .then((data) => {
        setEmployees(data.content);
        setTotalElements(data.totalElements);
        setError(null);
      })
      .catch((err: any) => {
        setError(err?.response?.data?.error || '직원 목록을 불러오지 못했습니다.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, filterStatus, filterSaas]);

  useEffect(() => {
    dashboardApi.getStats()
      .then(setDashboardStats)
      .catch(() => setDashboardStats(null));
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const runSearch = () => {
    if (page === 0) load();
    else setPage(0);
  };

  const openEditDialog = (employee: Employee) => {
    setEditDialog(employee);
    setEditEmployee({ name: employee.name, department: employee.department, status: employee.status });
  };

  const handleAnalyze = async (employee: Employee) => {
    if (!token) {
      setError('로그인 토큰이 없습니다. 다시 로그인한 뒤 분석을 실행하세요.');
      return;
    }

    setAnalyzingEmployeeId(employee.id);
    setError(null);
    try {
      const result = await employeeApi.analyze(employee.id);
      setSuccessMessage(`${employee.name}님의 오프보딩 권한 재분석이 완료되었습니다.`);
      navigate(`/offboarding/${result.offboardingResultId}`);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        const email = err?.response?.data?.email;
        const role = err?.response?.data?.role;
        setError(`분석 권한이 없습니다. 화면 로그인: ${user?.email || '확인 불가'} / ${user?.role || '확인 불가'}, 서버 인식: ${email || '확인 불가'} / ${role || '확인 불가'}`);
      } else {
        setError(err?.response?.data?.error || '오프보딩 권한 재분석 요청에 실패했습니다.');
      }
    } finally {
      setAnalyzingEmployeeId(null);
    }
  };

  const handleResign = async () => {
    if (!resignDialog) return;
    setResigningEmployeeId(resignDialog.id);
    setError(null);
    try {
      const result = await employeeApi.resign(resignDialog.id);
      setResignDialog(null);
      setSuccessMessage('퇴사 처리와 SaaS 권한 자동 분석이 완료되었습니다.');
      load();
      navigate(`/offboarding/${result.offboardingResultId}`);
    } catch {
      setError('퇴사 처리에 실패했습니다.');
    } finally {
      setResigningEmployeeId(null);
    }
  };

  const handleAddEmployee = async () => {
    try {
      await employeeApi.create(newEmployee);
      setAddDialog(false);
      setNewEmployee({ employeeId: '', name: '', email: '', department: '', status: 'ACTIVE' });
      setSuccessMessage('직원을 등록했습니다.');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || '직원 등록에 실패했습니다.');
    }
  };

  const handleUpdateEmployee = async () => {
    if (!editDialog) return;
    try {
      await employeeApi.update(editDialog.id, editEmployee);
      setEditDialog(null);
      setSuccessMessage('직원 정보를 수정했습니다.');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || '직원 수정에 실패했습니다.');
    }
  };

  const handleDeleteEmployee = async () => {
    if (!deleteDialog) return;
    try {
      await employeeApi.delete(deleteDialog.id);
      setDeleteDialog(null);
      setSuccessMessage('직원을 삭제했습니다.');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || '직원 삭제에 실패했습니다.');
    }
  };

  const handleDeleteAllEmployees = async () => {
    try {
      const result = await employeeApi.deleteAll();
      setDeleteAllDialog(false);
      setPage(0);
      setSuccessMessage(`${result.deletedCount}명의 직원을 삭제했습니다.`);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || '전체 직원 삭제에 실패했습니다.');
    }
  };

  const handleCsvUpload = async (file: File) => {
    setCsvUploading(true);
    try {
      const result = await employeeApi.csvImport(file);
      setCsvResult(result);
      if (result.importedCount > 0) load();
    } catch {
      setError('CSV 가져오기에 실패했습니다.');
      setCsvDialog(false);
    } finally {
      setCsvUploading(false);
    }
  };

  const downloadCsvTemplate = () => {
    const csv = 'employee_id,name,email,department,status\nEMP001,Hong Gil Dong,hong@example.com,Engineering,ACTIVE\nEMP002,Kim Minji,minji@example.com,Security,RESIGNED';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employees-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" gap={2} mb={2.5}>
        <Box>
          <Typography variant="h4" fontWeight={900} sx={{ color: '#0f172a', letterSpacing: 0 }}>
            직원 권한 관리
          </Typography>
          <Typography variant="body2" color="#64748b" mt={0.75}>
            직원별 SaaS 계정, 접근 상태, 오프보딩 조치를 한 화면에서 관리합니다.
          </Typography>
        </Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignSelf={{ xs: 'stretch', lg: 'center' }}
          justifyContent="flex-end"
        >
          <Button
            variant="contained"
            color="inherit"
            startIcon={<AddIcon />}
            onClick={() => setAddDialog(true)}
            sx={{ borderRadius: 2, bgcolor: '#0f172a', color: 'white', whiteSpace: 'nowrap', '&:hover': { bgcolor: '#1e293b' } }}
          >
            직원 등록
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => { setCsvResult(null); setCsvDialog(true); }}
            sx={{ borderRadius: 2, bgcolor: 'white', whiteSpace: 'nowrap' }}
          >
            CSV 가져오기
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteAllIcon />}
            onClick={() => setDeleteAllDialog(true)}
            disabled={totalElements === 0}
            sx={{ borderRadius: 2, bgcolor: 'white', whiteSpace: 'nowrap' }}
          >
            전체 삭제
          </Button>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1} mb={2.5}>
        <Button variant={tab === 'employees' ? 'contained' : 'outlined'} onClick={() => setTab('employees')} sx={{ borderRadius: 2, whiteSpace: 'nowrap' }}>직원 목록</Button>
        <Button variant={tab === 'hr' ? 'contained' : 'outlined'} onClick={() => setTab('hr')} sx={{ borderRadius: 2, whiteSpace: 'nowrap' }}>HR 연동</Button>
      </Stack>

      {tab === 'employees' && (
        <>
          <Grid container spacing={2} mb={2.5}>
            <Grid item xs={12} sm={6} xl={3}><MetricCard label="전체 직원" value={dashboardStats?.totalEmployees ?? totalElements} sub="대시보드와 동일 기준" color="#2563eb" bg="#eff6ff" accent="#3b82f6" icon={<PeopleIcon fontSize="small" />} /></Grid>
            <Grid item xs={12} sm={6} xl={3}><MetricCard label="재직자" value={dashboardStats?.activeEmployees ?? 0} sub="전체 직원 기준" color="#059669" bg="#ecfdf5" accent="#10b981" icon={<PeopleIcon fontSize="small" />} /></Grid>
            <Grid item xs={12} sm={6} xl={3}><MetricCard label="퇴사자" value={dashboardStats?.resignedEmployees ?? 0} sub="오프보딩 대상" color="#475569" bg="#f1f5f9" accent="#94a3b8" icon={<ResignIcon fontSize="small" />} /></Grid>
            <Grid item xs={12} sm={6} xl={3}><MetricCard label="현재 조회 결과" value={totalElements} sub={`현재 페이지 SaaS 보유 ${currentPageSaasLinkedCount}명`} color="#dc2626" bg="#fef2f2" accent="#ef4444" icon={<PriorityIcon fontSize="small" />} /></Grid>
          </Grid>

          <EmployeeVisualSummary
            stats={dashboardStats}
            totalElements={totalElements}
            currentPageLinkedCount={currentPageSaasLinkedCount}
            currentPageCount={employees.length}
          />

          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
          {successMessage && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>{successMessage}</Alert>}

          <FilterPanel
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterSaas={filterSaas}
            setFilterSaas={setFilterSaas}
            filterDept={filterDept}
            setFilterDept={setFilterDept}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            runSearch={runSearch}
            setPage={setPage}
          />

          {loading ? <LinearProgress /> : (
            <EmployeeTable
              employees={employees}
              page={page}
              rowsPerPage={rowsPerPage}
              totalElements={totalElements}
              setPage={setPage}
              openEditDialog={openEditDialog}
              openDeleteDialog={setDeleteDialog}
              openResignDialog={setResignDialog}
              resigningEmployeeId={resigningEmployeeId}
              analyzingEmployeeId={analyzingEmployeeId}
              analyzeEmployee={handleAnalyze}
            />
          )}
        </>
      )}

      {tab === 'hr' && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid #e2e8f0', borderRadius: 3, bgcolor: 'white' }}>
          <Typography variant="h6" fontWeight={900} gutterBottom>HR 이벤트 연동</Typography>
          <Typography color="text.secondary" mb={2}>
            HR 시스템에서 퇴사 이벤트를 ORAM Webhook으로 보내면 오프보딩 분석이 자동으로 시작됩니다.
          </Typography>
          <Box p={2} bgcolor="#0f172a" borderRadius={2} mb={2}>
            <Typography variant="caption" sx={{ color: '#93c5fd', fontFamily: 'monospace', display: 'block' }}>
              POST http://[ORAM_SERVER]/api/hr/webhook
            </Typography>
            <Typography variant="caption" sx={{ color: '#86efac', fontFamily: 'monospace', display: 'block' }}>
              X-ORAM-Webhook-Secret: oram-webhook-secret-poc
            </Typography>
          </Box>
          <Alert severity="success">현재 PoC에서 Webhook 엔드포인트가 활성화되어 있습니다.</Alert>
        </Paper>
      )}

      <EmployeeDialogs
        addDialog={addDialog}
        setAddDialog={setAddDialog}
        newEmployee={newEmployee}
        setNewEmployee={setNewEmployee}
        handleAddEmployee={handleAddEmployee}
        editDialog={editDialog}
        setEditDialog={setEditDialog}
        editEmployee={editEmployee}
        setEditEmployee={setEditEmployee}
        handleUpdateEmployee={handleUpdateEmployee}
        resignDialog={resignDialog}
        setResignDialog={setResignDialog}
        resigningEmployeeId={resigningEmployeeId}
        handleResign={handleResign}
        deleteDialog={deleteDialog}
        setDeleteDialog={setDeleteDialog}
        handleDeleteEmployee={handleDeleteEmployee}
        deleteAllDialog={deleteAllDialog}
        setDeleteAllDialog={setDeleteAllDialog}
        handleDeleteAllEmployees={handleDeleteAllEmployees}
        csvDialog={csvDialog}
        setCsvDialog={setCsvDialog}
        csvResult={csvResult}
        setCsvResult={setCsvResult}
        csvUploading={csvUploading}
        fileInputRef={fileInputRef}
        handleCsvUpload={handleCsvUpload}
        downloadCsvTemplate={downloadCsvTemplate}
      />
    </Box>
  );
}

function MetricCard({ label, value, sub, color, bg, accent, icon }: {
  label: string;
  value: number;
  sub: string;
  color: string;
  bg: string;
  accent: string;
  icon: ReactNode;
}) {
  return (
    <Card
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        borderRadius: 3,
        bgcolor: 'white',
        minHeight: 96,
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
        transition: 'transform 160ms ease, box-shadow 160ms ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 14px 28px rgba(15, 23, 42, 0.08)' },
        '&:before': { content: '""', position: 'absolute', left: 0, top: 0, width: 4, height: '100%', bgcolor: accent },
      }}
    >
      <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
          <Box>
            <Typography variant="caption" color="#64748b" fontWeight={700}>{label}</Typography>
            <Typography variant="h5" fontWeight={700} color="#0f172a" mt={0.25}>
              {value}
              <Typography component="span" ml={0.5} color="#94a3b8" fontSize={13}>명</Typography>
            </Typography>
          </Box>
          <Box sx={{ width: 34, height: 34, borderRadius: 1.5, bgcolor: bg, color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{icon}</Box>
        </Stack>
        <Typography variant="caption" color="#94a3b8" mt={0.75} display="block">{sub}</Typography>
      </CardContent>
    </Card>
  );
}

function EmployeeVisualSummary({
  stats,
  totalElements,
  currentPageLinkedCount,
  currentPageCount,
}: {
  stats: DashboardStats | null;
  totalElements: number;
  currentPageLinkedCount: number;
  currentPageCount: number;
}) {
  const total = Math.max(stats?.totalEmployees ?? totalElements, 0);
  const active = stats?.activeEmployees ?? 0;
  const resigned = stats?.resignedEmployees ?? 0;
  const linkedRatio = currentPageCount > 0 ? Math.round((currentPageLinkedCount / currentPageCount) * 100) : 0;

  return (
    <Grid container spacing={2} mb={2.5}>
      <Grid item xs={12} md={4}>
        <SummaryBar
          label="직원 상태"
          value={`${active} 재직 / ${resigned} 퇴사`}
          ratio={total > 0 ? Math.round((active / total) * 100) : 0}
          color="#2563eb"
          helper="전체 직원 기준 재직 비율"
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <SummaryBar
          label="현재 페이지 SaaS 연동"
          value={`${currentPageLinkedCount} / ${currentPageCount}명`}
          ratio={linkedRatio}
          color="#059669"
          helper="현재 조회 페이지 기준"
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <SummaryBar
          label="퇴사자 비율"
          value={`${resigned}명`}
          ratio={total > 0 ? Math.round((resigned / total) * 100) : 0}
          color="#dc2626"
          helper="권한 회수 검토 대상 비율"
        />
      </Grid>
    </Grid>
  );
}

function SummaryBar({
  label,
  value,
  ratio,
  color,
  helper,
}: {
  label: string;
  value: string;
  ratio: number;
  color: string;
  helper: string;
}) {
  return (
    <Paper elevation={0} sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 3, bgcolor: 'white' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={1}>
        <Typography variant="body2" fontWeight={800} color="#334155">{label}</Typography>
        <Typography variant="body2" fontWeight={900} color="#0f172a">{value}</Typography>
      </Stack>
      <Box sx={{ height: 8, borderRadius: 99, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
        <Box sx={{ width: `${Math.max(0, Math.min(100, ratio))}%`, height: '100%', bgcolor: color, borderRadius: 99 }} />
      </Box>
      <Stack direction="row" justifyContent="space-between" mt={0.75}>
        <Typography variant="caption" color="#64748b">{helper}</Typography>
        <Typography variant="caption" fontWeight={800} color={color}>{ratio}%</Typography>
      </Stack>
    </Paper>
  );
}

function FilterPanel(props: {
  filterStatus: string;
  setFilterStatus: (value: string) => void;
  filterSaas: SaasType | '';
  setFilterSaas: (value: SaasType | '') => void;
  filterDept: string;
  setFilterDept: (value: string) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  runSearch: () => void;
  setPage: (value: number) => void;
}) {
  return (
    <Paper elevation={0} sx={{ p: 2, mb: 2.5, border: '1px solid #e2e8f0', borderRadius: 3, bgcolor: 'white', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' }}>
      <Grid container spacing={1.5} alignItems="flex-end">
        <Grid item xs={12} sm={6} lg={1.6}>
          <FormControl size="small" fullWidth>
            <InputLabel>상태</InputLabel>
            <Select value={props.filterStatus} label="상태" onChange={(e) => { props.setFilterStatus(e.target.value); props.setPage(0); }}>
              <MenuItem value="">전체</MenuItem>
              <MenuItem value="ACTIVE">재직 중</MenuItem>
              <MenuItem value="RESIGNED">퇴사</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} lg={1.8}>
          <FormControl size="small" fullWidth>
            <InputLabel>SaaS</InputLabel>
            <Select value={props.filterSaas} label="SaaS" onChange={(e) => { props.setFilterSaas(e.target.value as SaasType | ''); props.setPage(0); }}>
              <MenuItem value="">전체</MenuItem>
              <MenuItem value="SLACK">Slack</MenuItem>
              <MenuItem value="GITHUB">GitHub</MenuItem>
              <MenuItem value="NOTION">Notion</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} lg={2.6}>
          <TextField size="small" label="부서" placeholder="부서명 입력" value={props.filterDept} onChange={(e) => props.setFilterDept(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && props.runSearch()} fullWidth />
        </Grid>
        <Grid item xs={12} sm={6} lg={4.2}>
          <TextField size="small" label="직원 검색" placeholder="이름 또는 이메일" value={props.searchQuery} onChange={(e) => props.setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && props.runSearch()} fullWidth />
        </Grid>
        <Grid item xs={12} sm={6} lg={1.8}>
          <Button variant="contained" startIcon={<SearchIcon />} onClick={props.runSearch} fullWidth sx={{ height: 40, borderRadius: 2, whiteSpace: 'nowrap' }}>검색</Button>
        </Grid>
      </Grid>
    </Paper>
  );
}

function EmployeeTable(props: {
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
}) {
  return (
    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflowX: 'auto', bgcolor: 'white', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' }}>
      <Table sx={{ minWidth: 1520, tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow sx={{ bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <HeaderCell width="5%">NO.</HeaderCell>
            <HeaderCell width="11%">이름</HeaderCell>
            <HeaderCell width="18%">이메일</HeaderCell>
            <HeaderCell width="13%">사번</HeaderCell>
            <HeaderCell width="8%">상태</HeaderCell>
            <HeaderCell width="11%">부서</HeaderCell>
            <HeaderCell width="12%">등록 원천</HeaderCell>
            <HeaderCell width="10%">연동 SaaS</HeaderCell>
            <HeaderCell width="10%">계정 상태</HeaderCell>
            <HeaderCell width="16%" align="right">조치</HeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {props.employees.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} align="center" sx={{ py: 7, color: '#94a3b8' }}>조건에 맞는 직원이 없습니다.</TableCell>
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
                      <Typography fontWeight={900} noWrap>{employee.name}</Typography>
                      {isPriorityTarget(employee) && <PriorityIcon color="error" sx={{ fontSize: 16, flexShrink: 0 }} />}
                    </Stack>
                  </Box>
                </Stack>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="#334155" noWrap>{employee.email}</Typography>
              </TableCell>
              <TableCell>
                <Typography sx={{ fontFamily: 'monospace', fontSize: 13, color: '#475569' }} noWrap>{employee.employeeId}</Typography>
              </TableCell>
              <TableCell><StatusChip status={employee.status} /></TableCell>
              <TableCell>
                <Typography fontWeight={800} noWrap>{employee.department || '부서 미수집'}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="#64748b" noWrap>{getEmployeeSourceLabel(employee)}</Typography>
              </TableCell>
              <TableCell><SaaSBadges employee={employee} /></TableCell>
              <TableCell><AccountState employee={employee} /></TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={0.75} justifyContent="flex-end" flexWrap="nowrap">
                  <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => props.openEditDialog(employee)} sx={compactButtonSx}>수정</Button>
                  {employee.status === 'ACTIVE' ? (
                    <Button size="small" variant="outlined" color="warning" startIcon={props.resigningEmployeeId === employee.id ? <CircularProgress size={14} /> : <ResignIcon />} onClick={() => props.openResignDialog(employee)} disabled={props.resigningEmployeeId === employee.id} sx={compactButtonSx}>퇴사</Button>
                  ) : (
                    <>
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
                    </>
                  )}
                  <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => props.openDeleteDialog(employee)} sx={compactButtonSx}>삭제</Button>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination rowsPerPageOptions={[10]} component="div" count={props.totalElements} rowsPerPage={props.rowsPerPage} page={props.page} onPageChange={(_, nextPage) => props.setPage(nextPage)} />
    </TableContainer>
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

function AccountState({ employee }: { employee: Employee }) {
  const count = employee.connectedSaas?.length ?? 0;
  if (employee.status === 'RESIGNED') {
    return (
      <Box>
        <Typography variant="body2" fontWeight={900} color="error.main" noWrap>접근 차단 필요</Typography>
        <Typography variant="caption" color="#94a3b8" noWrap>{count}개 계정 활성</Typography>
      </Box>
    );
  }
  return (
    <Box>
      <Typography variant="body2" fontWeight={900} color="#0f172a" noWrap>정상</Typography>
      <Typography variant="caption" color="#94a3b8" noWrap>{count}개 계정 연동</Typography>
    </Box>
  );
}

function EmployeeDialogs(props: any) {
  const {
    addDialog, setAddDialog, newEmployee, setNewEmployee, handleAddEmployee,
    editDialog, setEditDialog, editEmployee, setEditEmployee, handleUpdateEmployee,
    resignDialog, setResignDialog, resigningEmployeeId, handleResign,
    deleteDialog, setDeleteDialog, handleDeleteEmployee,
    deleteAllDialog, setDeleteAllDialog, handleDeleteAllEmployees,
    csvDialog, setCsvDialog, csvResult, setCsvResult, csvUploading,
    fileInputRef, handleCsvUpload, downloadCsvTemplate,
  } = props;

  return (
    <>
      <Dialog open={Boolean(resignDialog)} onClose={() => !resigningEmployeeId && setResignDialog(null)}>
        <DialogTitle>퇴사 처리 및 자동 권한 분석</DialogTitle>
        <DialogContent>
          <Typography><strong>{resignDialog?.name}</strong> 계정을 퇴사자로 변경하면 ORAM이 연결된 SaaS 권한을 자동 수집하고 잔여 접근 위험도를 계산합니다.</Typography>
          {resigningEmployeeId && <Alert severity="info" sx={{ mt: 2 }}>연결된 SaaS 권한을 수집하고 오프보딩 위험도를 계산하는 중입니다.</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResignDialog(null)} disabled={Boolean(resigningEmployeeId)}>취소</Button>
          <Button variant="contained" color="error" onClick={handleResign} disabled={Boolean(resigningEmployeeId)}>{resigningEmployeeId ? '자동 분석 중...' : '퇴사 처리'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteDialog)} onClose={() => setDeleteDialog(null)}>
        <DialogTitle>직원 삭제</DialogTitle>
        <DialogContent><Typography><strong>{deleteDialog?.name}</strong> 직원을 삭제하시겠습니까?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(null)}>취소</Button>
          <Button variant="contained" color="error" onClick={handleDeleteEmployee}>삭제</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteAllDialog} onClose={() => setDeleteAllDialog(false)}>
        <DialogTitle>전체 직원 삭제</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>등록된 모든 직원 정보가 삭제됩니다.</Alert>
          <Typography>현재 필터 조건과 관계없이 모든 직원을 삭제하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteAllDialog(false)}>취소</Button>
          <Button variant="contained" color="error" onClick={handleDeleteAllEmployees}>전체 삭제</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>직원 등록</DialogTitle>
        <DialogContent><EmployeeForm employee={newEmployee} setEmployee={setNewEmployee} /></DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialog(false)}>취소</Button>
          <Button variant="contained" onClick={handleAddEmployee}>등록</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editDialog)} onClose={() => setEditDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>직원 정보 수정</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="사번" value={editDialog?.employeeId || ''} size="small" fullWidth disabled />
            <TextField label="이메일" value={editDialog?.email || ''} size="small" fullWidth disabled />
            <EmployeeForm employee={editEmployee} setEmployee={setEditEmployee} hideEmployeeId hideEmail />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(null)}>취소</Button>
          <Button variant="contained" onClick={handleUpdateEmployee}>저장</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={csvDialog} onClose={() => { setCsvDialog(false); setCsvResult(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>CSV로 직원 일괄 가져오기</DialogTitle>
        <DialogContent>
          {!csvResult ? (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>직원 데이터를 CSV로 업로드합니다. 중복 이메일이나 사번은 자동으로 건너뜁니다.</Alert>
              <Box p={2} bgcolor="grey.100" borderRadius={1} mb={2}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>CSV 형식</Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block' }}>employee_id,name,email,department,status</Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block' }}>EMP001,Hong Gil Dong,hong@example.com,Engineering,ACTIVE</Typography>
              </Box>
              <Button size="small" startIcon={<DownloadIcon />} variant="outlined" onClick={downloadCsvTemplate} sx={{ mb: 2 }}>CSV 템플릿 다운로드</Button>
              <input type="file" accept=".csv,text/csv" ref={fileInputRef} style={{ display: 'none' }} onChange={(event) => { const file = event.target.files?.[0]; if (file) handleCsvUpload(file); event.target.value = ''; }} />
              <Box border="2px dashed" borderColor="primary.main" borderRadius={2} p={4} textAlign="center" sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'primary.50' } }} onClick={() => fileInputRef.current?.click()}>
                {csvUploading ? <CircularProgress size={32} /> : <><UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} /><Typography fontWeight="bold">클릭하여 CSV 파일 선택</Typography><Typography variant="caption" color="text.secondary">최대 5MB, UTF-8</Typography></>}
              </Box>
            </>
          ) : (
            <>
              <Alert severity={csvResult.errorCount === 0 ? 'success' : 'warning'} sx={{ mb: 2 }}>
                <strong>CSV 처리 완료</strong>
                <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
                  <Chip label={`성공 ${csvResult.importedCount}명`} size="small" color="success" />
                  <Chip label={`중복/건너뜀 ${csvResult.skippedCount}명`} size="small" variant="outlined" />
                  <Chip label={`실패 ${csvResult.errorCount}건`} size="small" color={csvResult.errorCount > 0 ? 'error' : 'default'} />
                </Stack>
              </Alert>
              {csvResult.errors.length > 0 && <List dense>{csvResult.errors.map((message: string, index: number) => <ListItem key={index} disablePadding><ListItemText primary={<Typography variant="caption" color="error">{message}</Typography>} /></ListItem>)}</List>}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCsvDialog(false); setCsvResult(null); }}>닫기</Button>
          {csvResult && <Button variant="outlined" onClick={() => setCsvResult(null)}>다시 업로드</Button>}
        </DialogActions>
      </Dialog>
    </>
  );
}

function EmployeeForm({ employee, setEmployee, hideEmployeeId, hideEmail }: any) {
  return (
    <Stack spacing={2} mt={1}>
      {!hideEmployeeId && <TextField label="사번" value={employee.employeeId} onChange={(event) => setEmployee({ ...employee, employeeId: event.target.value })} size="small" fullWidth />}
      <TextField label="이름" value={employee.name} onChange={(event) => setEmployee({ ...employee, name: event.target.value })} size="small" fullWidth />
      {!hideEmail && <TextField label="이메일" type="email" value={employee.email} onChange={(event) => setEmployee({ ...employee, email: event.target.value })} size="small" fullWidth />}
      <TextField label="부서" value={employee.department} onChange={(event) => setEmployee({ ...employee, department: event.target.value })} size="small" fullWidth />
      <FormControl size="small" fullWidth>
        <InputLabel>상태</InputLabel>
        <Select value={employee.status} label="상태" onChange={(event) => setEmployee({ ...employee, status: event.target.value as EmployeeStatus })}>
          <MenuItem value="ACTIVE">재직 중</MenuItem>
          <MenuItem value="RESIGNED">퇴사</MenuItem>
        </Select>
      </FormControl>
    </Stack>
  );
}
