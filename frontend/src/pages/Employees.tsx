import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
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
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  DeleteSweep as DeleteAllIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { employeeApi } from '../api';
import PageHeader from '../components/common/PageHeader';
import EmployeeFilterPanel from '../components/employees/EmployeeFilterPanel';
import EmployeeLogPanel from '../components/employees/EmployeeLogPanel';
import EmployeeTable from '../components/employees/EmployeeTable';
import { SAAS_BADGE } from '../constants/saas';
import type { Employee, EmployeeStatus, SaasType } from '../types';
import StatusChip from '../components/common/StatusChip';
import { useAuthStore } from '../store/authStore';

function isDisplayableDepartment(value?: string) {
  if (!value) return false;
  const normalized = value.trim();
  if (!normalized || normalized === '-') return false;

  const upper = normalized.toUpperCase();
  return !['SLACK', 'GITHUB', 'NOTION'].some((saas) => upper.includes(saas));
}

function extractDepartmentOptions(employees: Employee[]) {
  return employees
    .map((employee) => employee.department?.trim())
    .filter((department): department is string => isDisplayableDepartment(department));
}

function displayDepartment(department?: string) {
  return isDisplayableDepartment(department) ? department!.trim() : '-';
}

type EmployeesPageMode = 'active' | 'resigned';

export default function Employees({ mode = 'active' }: { mode?: EmployeesPageMode }) {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const pageMode: EmployeesPageMode = mode;
  const fixedStatus = pageMode === 'resigned' ? 'RESIGNED' : 'ACTIVE';
  const isResignedPage = pageMode === 'resigned';
  const [tab, setTab] = useState<'employees' | 'hr' | 'log'>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>(fixedStatus);
  const [filterDept, setFilterDept] = useState('');
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [filterSaas, setFilterSaas] = useState<SaasType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [analyzingEmployeeId, setAnalyzingEmployeeId] = useState<string | null>(null);
  const [resignDialog, setResignDialog] = useState<Employee | null>(null);
  const [resigningEmployeeId, setResigningEmployeeId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Employee | null>(null);
  const [detailDialog, setDetailDialog] = useState<Employee | null>(null);
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

  useEffect(() => {
    setFilterStatus(fixedStatus);
    setFilterDept('');
    setPage(0);
    setTab('employees');
  }, [fixedStatus]);

  const load = (overrides?: { page?: number }) => {
    const requestPage = overrides?.page ?? page;
    setLoading(true);
    employeeApi.getAll({
      status: filterStatus || undefined,
      department: filterDept || undefined,
      saasType: filterSaas || undefined,
      q: searchQuery || undefined,
      page: requestPage,
      size: rowsPerPage,
    })
      .then((data) => {
        setEmployees(data.content);
        setTotalElements(data.totalElements);
        const nextDepartments = extractDepartmentOptions(data.content);
        if (nextDepartments.length > 0) {
          setDepartmentOptions((current) => Array.from(new Set([...current, ...nextDepartments])).sort());
        }
        setError(null);
      })
      .catch((err: any) => {
        setError(err?.response?.data?.error || '직원 목록을 불러오지 못했습니다.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, filterStatus, filterDept, filterSaas]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const runSearch = () => {
    if (page === 0) load({ page: 0 });
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
      setSuccessMessage('퇴사 처리와 SaaS 권한 점검이 완료되었습니다.');
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
      <PageHeader
        title={isResignedPage ? '퇴직자 목록' : '직원 권한 관리'}
        description={isResignedPage ? '퇴사 처리된 직원과 남아 있는 SaaS 접근 권한 상태를 확인합니다.' : '재직자 기준으로 SaaS 계정, 접근 상태, 퇴사 처리를 관리합니다.'}
        actions={!isResignedPage ? (
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
        ) : undefined}
      />

      <Stack direction="row" spacing={1} mb={2.5} flexWrap="wrap" useFlexGap>
        <Button
          variant={!isResignedPage && tab === 'employees' ? 'contained' : 'outlined'}
          onClick={() => { setTab('employees'); navigate('/employees'); }}
          sx={{ borderRadius: 2, whiteSpace: 'nowrap' }}
        >
          직원 목록
        </Button>
        <Button
          variant={isResignedPage ? 'contained' : 'outlined'}
          onClick={() => navigate('/resigned-employees')}
          sx={{ borderRadius: 2, whiteSpace: 'nowrap' }}
        >
          퇴직자 목록
        </Button>
        <Button variant={tab === 'hr' ? 'contained' : 'outlined'} onClick={() => setTab('hr')} sx={{ borderRadius: 2, whiteSpace: 'nowrap' }}>HR 연동</Button>
        <Button variant={tab === 'log' ? 'contained' : 'outlined'} onClick={() => setTab('log')} sx={{ borderRadius: 2, whiteSpace: 'nowrap' }}>로그</Button>
      </Stack>

      {tab === 'employees' && (
        <>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
          {successMessage && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>{successMessage}</Alert>}

          <EmployeeFilterPanel
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterSaas={filterSaas}
            setFilterSaas={setFilterSaas}
            filterDept={filterDept}
            setFilterDept={setFilterDept}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            departmentOptions={departmentOptions}
            runSearch={runSearch}
            setPage={setPage}
            showStatusFilter={false}
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
              openDetailDialog={setDetailDialog}
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

      {tab === 'log' && <EmployeeLogPanel />}

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
        detailDialog={detailDialog}
        setDetailDialog={setDetailDialog}
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

function EmployeeDetail({ employee }: { employee: Employee }) {
  const connected = employee.connectedSaas ?? [];

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: '#2563eb',
            color: 'white',
            fontWeight: 900,
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          {employee.name.slice(0, 1)}
        </Box>
        <Box minWidth={0}>
          <Typography variant="h6" fontWeight={900} noWrap>{employee.name}</Typography>
          <Typography variant="body2" color="#64748b" noWrap>{employee.email}</Typography>
        </Box>
      </Stack>

      <Grid container spacing={1.5}>
        <DetailItem label="사번" value={employee.employeeId} mono />
        <DetailItem label="상태" value={<StatusChip status={employee.status} />} />
        <DetailItem label="부서" value={displayDepartment(employee.department)} />
        <DetailItem label="등록일" value={formatDetailDate(employee.createdAt)} />
        <DetailItem label="연동 SaaS 수" value={`${connected.length}개`} />
      </Grid>

      <Box>
        <Typography variant="subtitle2" fontWeight={900} mb={1}>SaaS 연동 계정</Typography>
        {connected.length === 0 ? (
          <Alert severity="info">연동된 SaaS 계정이 없습니다.</Alert>
        ) : (
          <Stack spacing={1}>
            {connected.map((account) => {
              const meta = SAAS_BADGE[account.saasType];
              const status = account.accessRevoked ? '회수됨' : account.status === 'RESIGNED' ? '비활성' : '활성';
              return (
                <Paper key={account.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
                      <Chip
                        label={meta.short}
                        size="small"
                        sx={{ color: meta.color, bgcolor: meta.bg, border: '1px solid', borderColor: meta.border, fontWeight: 900 }}
                      />
                      <Box minWidth={0}>
                        <Typography variant="body2" fontWeight={800} noWrap>{meta.label}</Typography>
                        <Typography variant="caption" color="#64748b" noWrap>
                          {account.displayName || account.externalUsername || account.externalEmail || '-'}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label={status} color={account.accessRevoked ? 'default' : account.status === 'RESIGNED' ? 'warning' : 'success'} variant="outlined" />
                      {account.externalEmail && <Typography variant="caption" color="#64748b">{account.externalEmail}</Typography>}
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}

function DetailItem({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <Grid item xs={12} sm={6}>
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, height: '100%' }}>
        <Typography variant="caption" color="#64748b" display="block" mb={0.5}>{label}</Typography>
        <Box sx={{ fontFamily: mono ? 'monospace' : undefined, color: '#0f172a', fontWeight: 700 }}>
          {value}
        </Box>
      </Paper>
    </Grid>
  );
}

function formatDetailDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ko-KR');
}

function EmployeeDialogs(props: any) {
  const {
    addDialog, setAddDialog, newEmployee, setNewEmployee, handleAddEmployee,
    editDialog, setEditDialog, editEmployee, setEditEmployee, handleUpdateEmployee,
    resignDialog, setResignDialog, resigningEmployeeId, handleResign,
    deleteDialog, setDeleteDialog, handleDeleteEmployee,
    detailDialog, setDetailDialog,
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
          <Button variant="contained" color="error" onClick={handleResign} disabled={Boolean(resigningEmployeeId)}>{resigningEmployeeId ? '권한 점검 중...' : '퇴사 처리'}</Button>
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

      <Dialog open={Boolean(detailDialog)} onClose={() => setDetailDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>직원 상세 정보</DialogTitle>
        <DialogContent dividers>
          {detailDialog && <EmployeeDetail employee={detailDialog} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialog(null)}>닫기</Button>
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
