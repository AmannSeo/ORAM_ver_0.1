import { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Button, LinearProgress, Alert, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Tooltip, TextField, Select, MenuItem,
  FormControl, InputLabel, Dialog, DialogTitle, DialogContent,
  DialogActions, TablePagination, Chip, List, ListItem, ListItemText,
  Divider, CircularProgress, Grid, Card, CardContent,
  Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import {
  PersonOff as ResignIcon, Add as AddIcon,
  Search as SearchIcon, Upload as UploadIcon, Download as DownloadIcon,
  ExpandMore as ExpandIcon, Delete as DeleteIcon, DeleteSweep as DeleteAllIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { employeeApi } from '../api';
import type { Employee, EmployeeStatus } from '../types';
import StatusChip from '../components/common/StatusChip';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function Employees() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>(searchParams.get('status') || '');
  const [filterDept, setFilterDept] = useState('');
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
    importedCount: number; skippedCount: number; errorCount: number;
    imported: string[]; skipped: string[]; errors: string[];
  } | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    employeeApi.getAll({ status: filterStatus || undefined, department: filterDept || undefined, page, size: rowsPerPage })
      .then(data => { setEmployees(data.content); setTotalElements(data.totalElements); })
      .catch(() => setError('직원 목록을 불러오지 못했습니다'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, filterStatus]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const handleResign = async () => {
    if (!resignDialog) return;
    setResigningEmployeeId(resignDialog.id);
    setError(null);
    try {
      const result = await employeeApi.resign(resignDialog.id);
      setResignDialog(null);
      setSuccessMessage('퇴사 처리와 오프보딩 분석이 완료되었습니다. 결과 화면으로 이동합니다.');
      load();
      navigate(`/offboarding/${result.offboardingResultId}`);
    } catch {
      setError('퇴사 처리에 실패했습니다');
    } finally {
      setResigningEmployeeId(null);
    }
  };

  const handleAddEmployee = async () => {
    try {
      await employeeApi.create(newEmployee);
      setAddDialog(false);
      setNewEmployee({ employeeId: '', name: '', email: '', department: '', status: 'ACTIVE' });
      load();
    } catch { setError('직원 등록에 실패했습니다'); }
  };

  const openEditDialog = (employee: Employee) => {
    setEditDialog(employee);
    setEditEmployee({
      name: employee.name,
      department: employee.department,
      status: employee.status,
    });
  };

  const handleUpdateEmployee = async () => {
    if (!editDialog) return;
    try {
      await employeeApi.update(editDialog.id, editEmployee);
      setEditDialog(null);
      setSuccessMessage('직원 정보가 수정되었습니다');
      load();
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setError('직원 수정은 Admin 계정으로만 가능합니다');
      } else {
        setError(err?.response?.data?.error || '직원 수정에 실패했습니다');
      }
    }
  };

  const handleDeleteEmployee = async () => {
    if (!deleteDialog) return;
    try {
      await employeeApi.delete(deleteDialog.id);
      setDeleteDialog(null);
      setSuccessMessage('직원이 삭제되었습니다');
      load();
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setError('직원 삭제는 Admin 계정으로만 가능합니다');
      } else {
        setError(err?.response?.data?.error || '직원 삭제에 실패했습니다');
      }
    }
  };

  const handleDeleteAllEmployees = async () => {
    try {
      const result = await employeeApi.deleteAll();
      setDeleteAllDialog(false);
      setPage(0);
      setSuccessMessage(`${result.deletedCount}명의 직원이 삭제되었습니다`);
      load();
    } catch (err: any) {
      if (err?.response?.status === 403) {
        const serverEmail = err?.response?.data?.email;
        const serverRole = err?.response?.data?.role;
        setError(
          serverEmail
            ? `전체 삭제 권한이 없습니다. 서버는 현재 계정을 ${serverEmail} / ${serverRole}로 인식하고 있습니다. Admin 계정으로 다시 로그인해 주세요.`
            : '전체 삭제 권한이 없습니다. Admin 계정으로 다시 로그인해 주세요.'
        );
      } else if (err?.response?.status === 404) {
        setError('서버에 전체 삭제 기능이 아직 반영되지 않았습니다. 백엔드 배포를 확인해 주세요.');
      } else if (err?.response?.status === 405) {
        setError('서버와 프론트의 전체 삭제 API 방식이 다릅니다. 백엔드/프론트 배포 상태를 확인해 주세요.');
      } else {
        setError(err?.response?.data?.error || '전체 직원 삭제에 실패했습니다');
      }
    }
  };

  const handleCsvUpload = async (file: File) => {
    setCsvUploading(true);
    try {
      const result = await employeeApi.csvImport(file);
      setCsvResult(result);
      if (result.importedCount > 0) load();
    } catch { setError('CSV 가져오기에 실패했습니다'); setCsvDialog(false); }
    finally { setCsvUploading(false); }
  };

  const downloadCsvTemplate = () => {
    const csv = `employee_id,name,email,department,status\nEMP001,Name,user1@example.com,Department,ACTIVE\nEMP002,Name,user2@example.com,Department,RESIGNED`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'employees-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      {/* 헤더 */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4" fontWeight="bold">직원 관리 & HR 연동</Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteAllIcon />}
            onClick={() => setDeleteAllDialog(true)}
            disabled={totalElements === 0}
          >
            전체 삭제
          </Button>
          <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => { setCsvResult(null); setCsvDialog(true); }}>
            CSV 가져오기
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddDialog(true)}>
            직원 등록
          </Button>
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="직원 목록" />
        <Tab label="🔗 HR 시스템 연동" />
      </Tabs>

      {/* ═══ 탭 0: 직원 목록 ═══ */}
      {tab === 0 && (
        <Box>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
          {successMessage && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>{successMessage}</Alert>}

          {/* 필터 */}
          <Box display="flex" gap={2} mb={2}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>상태</InputLabel>
              <Select value={filterStatus} label="상태" onChange={e => { setFilterStatus(e.target.value); setPage(0); }}>
                <MenuItem value="">전체</MenuItem>
                <MenuItem value="ACTIVE">재직 중</MenuItem>
                <MenuItem value="RESIGNED">퇴사</MenuItem>
              </Select>
            </FormControl>
            <TextField size="small" label="부서" value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load()}
              InputProps={{ endAdornment: <SearchIcon fontSize="small" /> }} />
          </Box>

          {loading ? <LinearProgress /> : (
            <TableContainer component={Paper} elevation={2}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell><strong>사번</strong></TableCell>
                    <TableCell><strong>이름</strong></TableCell>
                    <TableCell><strong>이메일</strong></TableCell>
                    <TableCell><strong>부서</strong></TableCell>
                    <TableCell><strong>상태</strong></TableCell>
                    <TableCell align="center"><strong>수정</strong></TableCell>
                    <TableCell align="center"><strong>오프보딩</strong></TableCell>
                    <TableCell align="center"><strong>삭제</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {employees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        직원이 없습니다. "직원 등록" 또는 "CSV 가져오기"로 추가하세요.
                      </TableCell>
                    </TableRow>
                  )}
                  {employees.map(emp => (
                    <TableRow key={emp.id} hover>
                      <TableCell>{emp.employeeId}</TableCell>
                      <TableCell><strong>{emp.name}</strong></TableCell>
                      <TableCell>{emp.email}</TableCell>
                      <TableCell>{emp.department}</TableCell>
                      <TableCell><StatusChip status={emp.status} /></TableCell>
                      <TableCell align="center">
                        <Tooltip title="직원 정보 수정">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={() => openEditDialog(emp)}
                          >
                            수정
                          </Button>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        {emp.status === 'ACTIVE' ? (
                          <Tooltip title="권한 회수">
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              startIcon={resigningEmployeeId === emp.id ? <CircularProgress size={15} color="inherit" /> : <ResignIcon />}
                              onClick={() => setResignDialog(emp)}
                              disabled={resigningEmployeeId === emp.id}
                            >
                              {resigningEmployeeId === emp.id ? '처리 중...' : '권한 회수'}
                            </Button>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.disabled">-</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="직원 삭제">
                          <Button
                            size="small"
                            color="error"
                            variant="text"
                            startIcon={<DeleteIcon />}
                            onClick={() => setDeleteDialog(emp)}
                          >
                            삭제
                          </Button>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination rowsPerPageOptions={[10]} component="div"
                count={totalElements} rowsPerPage={rowsPerPage} page={page}
                onPageChange={(_, p) => setPage(p)} />
            </TableContainer>
          )}
        </Box>
      )}

      {/* ═══ 탭 1: HR 연동 ═══ */}
      {tab === 1 && (
        <Box>
          <Alert severity="info" sx={{ mb: 3 }}>
            <strong>HR 시스템 연동이란?</strong> 기존 HR 시스템(Workday, BambooHR, 그룹웨어 등)이 직원 퇴사를 처리할 때
            ORAM에 자동으로 신호를 보내 오프보딩이 즉시 시작됩니다. <strong>매번 CSV 업로드 없이 자동화</strong>됩니다.
          </Alert>

          <Typography variant="h6" fontWeight="bold" gutterBottom>연동 방식 비교</Typography>
          <Grid container spacing={2} mb={4}>
            {[
              { title: 'Webhook (권장)', badge: '⚡ 추천', color: 'success', desc: 'HR 시스템 퇴사 처리 시 즉시 알림 → 실시간 자동 오프보딩', pros: ['실시간', '수동 작업 없음'], cons: ['초기 개발 설정 필요'] },
              { title: 'CSV 업로드', badge: '📂 간단', color: 'warning', desc: '직원 데이터 CSV 내보내기 → ORAM 업로드 (위 버튼 사용)', pros: ['설정 불필요', '즉시 사용 가능'], cons: ['수동 작업', '최대 1일 지연'] },
              { title: 'API 직접 연동', badge: '🔌 고급', color: 'info', desc: 'Workday/BambooHR API ↔ ORAM 직접 연결 (자동 동기화)', pros: ['완전 자동화', '양방향'], cons: ['API 계약 및 개발 공수'] },
            ].map(item => (
              <Grid item xs={12} md={4} key={item.title}>
                <Card variant="outlined" sx={{ height: '100%', borderColor: `${item.color}.main`, borderWidth: item.color === 'success' ? 2 : 1 }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="subtitle1" fontWeight="bold">{item.title}</Typography>
                      <Chip label={item.badge} size="small" color={item.color as 'success'|'warning'|'info'} />
                    </Box>
                    <Typography variant="body2" color="text.secondary" mb={2}>{item.desc}</Typography>
                    {item.pros.map(p => <Typography key={p} variant="caption" display="block" color="success.main">✓ {p}</Typography>)}
                    {item.cons.map(c => <Typography key={c} variant="caption" display="block" color="text.secondary">• {c}</Typography>)}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Typography variant="h6" fontWeight="bold" gutterBottom>🔧 Webhook 설정 가이드</Typography>

          <Accordion defaultExpanded variant="outlined" sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography fontWeight="bold">ORAM Webhook 엔드포인트 정보</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box p={2} bgcolor="grey.900" borderRadius={1} mb={2}>
                <Typography variant="caption" sx={{ color: '#61afef', fontFamily: 'monospace', display: 'block' }}>POST http://[ORAM서버]/api/hr/webhook</Typography>
                <Typography variant="caption" sx={{ color: '#98c379', fontFamily: 'monospace', display: 'block' }}>X-ORAM-Webhook-Secret: oram-webhook-secret-poc</Typography>
              </Box>
              <Box p={2} bgcolor="grey.900" borderRadius={1}>
                <Typography component="pre" variant="caption" sx={{ color: '#abb2bf', fontFamily: 'monospace', whiteSpace: 'pre' }}>
{`{
  "event": "EMPLOYEE_STATUS_CHANGED",
  "employeeId": "EMP001",
  "email": "hong@company.com",
  "status": "RESIGNED"
}`}
                </Typography>
              </Box>
            </AccordionDetails>
          </Accordion>

          <Accordion variant="outlined" sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography fontWeight="bold">각 HR 시스템별 설정</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {[
                { system: 'Workday', method: 'Workday Studio → Outbound Integration → Business Process Event (Terminate Employee) → ORAM URL 등록' },
                { system: 'BambooHR', method: '설정 → Webhooks → 새 Webhook → "Employee Status Changed" → ORAM URL 입력' },
                { system: '국내 그룹웨어 (더존, EHR 등)', method: '인사 퇴사 처리 화면 → 후처리 로직에 ORAM API 호출 추가 (개발팀 협조)' },
                { system: '자체 개발 HR 시스템', method: '퇴사 처리 Service에 HTTP POST 코드 추가 → ORAM Webhook URL 호출' },
              ].map(item => (
                <Box key={item.system} mb={2} p={2} bgcolor="grey.50" borderRadius={1}>
                  <Typography variant="subtitle2" fontWeight="bold" color="primary">{item.system}</Typography>
                  <Typography variant="body2" color="text.secondary">{item.method}</Typography>
                </Box>
              ))}
            </AccordionDetails>
          </Accordion>

          <Accordion variant="outlined" sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography fontWeight="bold">연결 테스트 (curl)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box p={2} bgcolor="grey.900" borderRadius={1}>
                <Typography component="pre" variant="caption" sx={{ color: '#98c379', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
{`# 연결 확인
curl -X GET http://localhost:8080/api/hr/webhook/ping \\
  -H "X-ORAM-Webhook-Secret: oram-webhook-secret-poc"

# 퇴사 이벤트 테스트
curl -X POST http://localhost:8080/api/hr/webhook \\
  -H "Content-Type: application/json" \\
  -H "X-ORAM-Webhook-Secret: oram-webhook-secret-poc" \\
  -d '{"event":"EMPLOYEE_STATUS_CHANGED","email":"hong@company.com","status":"RESIGNED"}'`}
                </Typography>
              </Box>
            </AccordionDetails>
          </Accordion>

          <Alert severity="success">
            <strong>현재 PoC 상태:</strong> Webhook 엔드포인트 활성화 완료.
            HR 시스템에서 위 URL로 퇴사 이벤트를 전송하면 즉시 오프보딩이 시작됩니다.
          </Alert>
        </Box>
      )}

      {/* ═══ 공통 다이얼로그 ═══ */}

      {/* 퇴사 확인 */}
      <Dialog
        open={Boolean(resignDialog)}
        onClose={() => {
          if (!resigningEmployeeId) setResignDialog(null);
        }}
      >
        <DialogTitle>오프보딩 확인</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{resignDialog?.name}</strong> ({resignDialog?.email}) 직원을 퇴사 처리하시겠습니까?
            <br />오프보딩 워크플로우가 자동으로 시작됩니다.
          </Typography>
          {resigningEmployeeId && (
            <Alert severity="info" sx={{ mt: 2 }}>
              SaaS 권한을 조회하고 AI 위험도를 계산하는 중입니다. 연결된 SaaS 수에 따라 몇 초 정도 걸릴 수 있습니다.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResignDialog(null)} disabled={Boolean(resigningEmployeeId)}>취소</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleResign}
            disabled={Boolean(resigningEmployeeId)}
            startIcon={resigningEmployeeId ? <CircularProgress size={16} color="inherit" /> : <ResignIcon />}
          >
            {resigningEmployeeId ? '오프보딩 생성 중...' : '퇴사 처리'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 삭제 확인 */}
      <Dialog open={Boolean(deleteDialog)} onClose={() => setDeleteDialog(null)}>
        <DialogTitle>직원 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{deleteDialog?.name}</strong> ({deleteDialog?.email}) 직원을 삭제하시겠습니까?
            <br />삭제한 직원 정보는 목록과 통계에서 제거됩니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(null)}>취소</Button>
          <Button variant="contained" color="error" onClick={handleDeleteEmployee}>삭제</Button>
        </DialogActions>
      </Dialog>

      {/* 전체 삭제 확인 */}
      <Dialog open={deleteAllDialog} onClose={() => setDeleteAllDialog(false)}>
        <DialogTitle>전체 직원 삭제</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            현재 등록된 모든 직원 정보가 삭제됩니다.
          </Alert>
          <Typography>
            현재 필터 조건과 관계없이 등록된 모든 직원을 삭제하시겠습니까?
            <br />삭제 후에는 직원 목록과 대시보드 통계에서도 제거됩니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteAllDialog(false)}>취소</Button>
          <Button variant="contained" color="error" onClick={handleDeleteAllEmployees}>전체 삭제</Button>
        </DialogActions>
      </Dialog>

      {/* 직원 등록 */}
      <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>직원 등록</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField label="사번" value={newEmployee.employeeId} onChange={e => setNewEmployee({ ...newEmployee, employeeId: e.target.value })} size="small" fullWidth />
            <TextField label="이름" value={newEmployee.name} onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })} size="small" fullWidth />
            <TextField label="이메일" type="email" value={newEmployee.email} onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })} size="small" fullWidth />
            <TextField label="부서" value={newEmployee.department} onChange={e => setNewEmployee({ ...newEmployee, department: e.target.value })} size="small" fullWidth />
            <FormControl size="small" fullWidth>
              <InputLabel>상태</InputLabel>
              <Select
                value={newEmployee.status}
                label="상태"
                onChange={e => setNewEmployee({ ...newEmployee, status: e.target.value as EmployeeStatus })}
              >
                <MenuItem value="ACTIVE">활성</MenuItem>
                <MenuItem value="RESIGNED">비활성</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialog(false)}>취소</Button>
          <Button variant="contained" onClick={handleAddEmployee}>등록</Button>
        </DialogActions>
      </Dialog>

      {/* 직원 수정 */}
      <Dialog open={Boolean(editDialog)} onClose={() => setEditDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>직원 수정</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField label="사번" value={editDialog?.employeeId || ''} size="small" fullWidth disabled />
            <TextField label="이메일" value={editDialog?.email || ''} size="small" fullWidth disabled />
            <TextField
              label="이름"
              value={editEmployee.name}
              onChange={e => setEditEmployee({ ...editEmployee, name: e.target.value })}
              size="small"
              fullWidth
            />
            <TextField
              label="부서"
              value={editEmployee.department}
              onChange={e => setEditEmployee({ ...editEmployee, department: e.target.value })}
              size="small"
              fullWidth
            />
            <FormControl size="small" fullWidth>
              <InputLabel>상태</InputLabel>
              <Select
                value={editEmployee.status}
                label="상태"
                onChange={e => setEditEmployee({ ...editEmployee, status: e.target.value as EmployeeStatus })}
              >
                <MenuItem value="ACTIVE">활성</MenuItem>
                <MenuItem value="RESIGNED">비활성</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(null)}>취소</Button>
          <Button variant="contained" onClick={handleUpdateEmployee}>저장</Button>
        </DialogActions>
      </Dialog>

      {/* CSV 가져오기 */}
      <Dialog open={csvDialog} onClose={() => { setCsvDialog(false); setCsvResult(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>📂 CSV로 직원 일괄 가져오기</DialogTitle>
        <DialogContent>
          {!csvResult ? (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                기존 HR 시스템에서 직원 데이터를 CSV로 내보낸 후 업로드하세요.
                이미 등록된 직원(이메일/사번 중복)은 자동으로 건너뜁니다.
              </Alert>
              <Box p={2} bgcolor="grey.100" borderRadius={1} mb={2}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>CSV 형식</Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block', color: 'text.secondary' }}>employee_id,name,email,department,status</Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block', color: 'text.secondary' }}>EMP001,Name,user1@example.com,Department,ACTIVE</Typography>
                <Typography variant="caption" color="text.disabled" display="block" mt={0.5}>* status 생략 시 ACTIVE 처리</Typography>
              </Box>
              <Button size="small" startIcon={<DownloadIcon />} variant="outlined" onClick={downloadCsvTemplate} sx={{ mb: 2 }}>
                CSV 템플릿 다운로드
              </Button>
              <input type="file" accept=".csv,text/csv" ref={fileInputRef} style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvUpload(f); e.target.value = ''; }} />
              <Box border="2px dashed" borderColor="primary.main" borderRadius={2} p={4} textAlign="center"
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'primary.50' } }}
                onClick={() => fileInputRef.current?.click()}>
                {csvUploading ? (
                  <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
                    <CircularProgress size={32} /><Typography variant="body2">업로드 중...</Typography>
                  </Box>
                ) : (
                  <>
                    <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                    <Typography variant="body1" fontWeight="bold">클릭하여 CSV 파일 선택</Typography>
                    <Typography variant="caption" color="text.secondary">최대 5MB, UTF-8</Typography>
                  </>
                )}
              </Box>
            </>
          ) : (
            <>
              <Alert severity={csvResult.errorCount === 0 ? 'success' : 'warning'} sx={{ mb: 2 }}>
                <strong>CSV 처리 완료</strong>
                <Box display="flex" flexWrap="wrap" gap={1} mt={1}>
                  <Chip label={`성공 ${csvResult.importedCount}명`} size="small" color="success" />
                  <Chip label={`중복/건너뜀 ${csvResult.skippedCount}명`} size="small" variant="outlined" />
                  <Chip label={`실패 ${csvResult.errorCount}건`} size="small" color={csvResult.errorCount > 0 ? 'error' : 'default'} />
                </Box>
              </Alert>
              {csvResult.imported.length > 0 && (
                <Box mb={2}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>추가된 직원</Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {csvResult.imported.map(e => <Chip key={e} label={e} size="small" color="success" />)}
                  </Box>
                </Box>
              )}
              {csvResult.skipped.length > 0 && (
                <Box mb={2}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    중복으로 건너뜀 ({csvResult.skippedCount}명)
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {csvResult.skipped.map(e => <Chip key={e} label={e} size="small" variant="outlined" />)}
                  </Box>
                </Box>
              )}
              {csvResult.errors.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" fontWeight="bold" color="error" gutterBottom>
                    실패한 행과 이유 ({csvResult.errorCount}건)
                  </Typography>
                  <List dense sx={{ bgcolor: 'error.50', borderRadius: 1, px: 1 }}>
                    {csvResult.errors.map((e, i) => (
                      <ListItem key={i} disablePadding>
                        <ListItemText
                          primary={<Typography variant="caption" color="error">{e}</Typography>}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCsvDialog(false); setCsvResult(null); }}>닫기</Button>
          {csvResult && <Button variant="outlined" onClick={() => setCsvResult(null)}>다시 업로드</Button>}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
