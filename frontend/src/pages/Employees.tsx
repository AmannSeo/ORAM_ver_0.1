import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, LinearProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Tooltip, TextField, Select, MenuItem,
  FormControl, InputLabel, Dialog, DialogTitle, DialogContent,
  DialogActions, TablePagination,
} from '@mui/material';
import {
  PersonOff as ResignIcon,
  Visibility as ViewIcon,
  Add as AddIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { employeeApi } from '../api';
import type { Employee } from '../types';
import StatusChip from '../components/common/StatusChip';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function Employees() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  // URL 쿼리 파라미터에서 초기 필터 상태 읽기 (대시보드 카드 클릭 시 연동)
  const [filterStatus, setFilterStatus] = useState<string>(searchParams.get('status') || '');
  const [filterDept, setFilterDept] = useState('');
  const [resignDialog, setResignDialog] = useState<Employee | null>(null);
  const [addDialog, setAddDialog] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ employeeId: '', name: '', email: '', department: '' });

  const load = () => {
    setLoading(true);
    employeeApi.getAll({
      status: filterStatus || undefined,
      department: filterDept || undefined,
      page,
      size: rowsPerPage,
    })
      .then((data) => { setEmployees(data.content); setTotalElements(data.totalElements); })
      .catch(() => setError('Failed to load employees'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, filterStatus]);

  const handleResign = async () => {
    if (!resignDialog) return;
    try {
      const result = await employeeApi.resign(resignDialog.id);
      setResignDialog(null);
      load();
      navigate(`/offboarding/${result.offboardingResultId}`);
    } catch {
      setError('Failed to resign employee');
    }
  };

  const handleAddEmployee = async () => {
    try {
      await employeeApi.create(newEmployee);
      setAddDialog(false);
      setNewEmployee({ employeeId: '', name: '', email: '', department: '' });
      load();
    } catch {
      setError('Failed to add employee');
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">직원 관리</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddDialog(true)}>
          직원 등록
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Filters */}
      <Box display="flex" gap={2} mb={2}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select value={filterStatus} label="Status" onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}>
              <MenuItem value="">전체</MenuItem>
              <MenuItem value="ACTIVE">재직 중</MenuItem>
              <MenuItem value="RESIGNED">퇴사</MenuItem>
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Department"
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          InputProps={{ endAdornment: <SearchIcon fontSize="small" /> }}
        />
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
                <TableCell align="center"><strong>작업</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id} hover>
                  <TableCell>{emp.employeeId}</TableCell>
                  <TableCell><strong>{emp.name}</strong></TableCell>
                  <TableCell>{emp.email}</TableCell>
                  <TableCell>{emp.department}</TableCell>
                  <TableCell><StatusChip status={emp.status} /></TableCell>
                  <TableCell align="center">
                    <Tooltip title="View">
                      <IconButton size="small" color="primary" onClick={() => navigate(`/employees/${emp.id}`)}>
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    {emp.status === 'ACTIVE' && (
                      <Tooltip title="Start Offboarding">
                        <IconButton size="small" color="error" onClick={() => setResignDialog(emp)}>
                          <ResignIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[10]}
            component="div"
            count={totalElements}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, p) => setPage(p)}
          />
        </TableContainer>
      )}

      {/* Resign Confirmation Dialog */}
      <Dialog open={Boolean(resignDialog)} onClose={() => setResignDialog(null)}>
        <DialogTitle>오프보딩 확인</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{resignDialog?.name}</strong> ({resignDialog?.email}) 직원을 퇴사 처리하시겠습니까?
            <br />
            오프보딩 워크플로우가 자동으로 시작됩니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResignDialog(null)}>취소</Button>
          <Button variant="contained" color="error" onClick={handleResign}>퇴사 처리</Button>
        </DialogActions>
      </Dialog>

      {/* Add Employee Dialog */}
      <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>직원 등록</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField label="사번" value={newEmployee.employeeId} onChange={(e) => setNewEmployee({ ...newEmployee, employeeId: e.target.value })} size="small" fullWidth />
            <TextField label="이름" value={newEmployee.name} onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })} size="small" fullWidth />
            <TextField label="이메일" type="email" value={newEmployee.email} onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })} size="small" fullWidth />
            <TextField label="부서" value={newEmployee.department} onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })} size="small" fullWidth />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialog(false)}>취소</Button>
          <Button variant="contained" onClick={handleAddEmployee}>등록</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
