import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  Tooltip,
  IconButton,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Add, Edit, PersonOff, Refresh } from '@mui/icons-material';
import { Employee, EmployeeRequest, EmployeeStatus } from '../types';
import { employeesApi, offboardingApi } from '../services/api';

const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 1, employeeId: 'EMP001', name: 'Alice Johnson', email: 'alice@company.com',
    department: 'Engineering', status: 'ACTIVE', offboardingTriggered: false,
    createdAt: '2024-01-15T09:00:00', updatedAt: '2024-01-15T09:00:00', resignedAt: null,
  },
  {
    id: 2, employeeId: 'EMP002', name: 'Bob Smith', email: 'bob@company.com',
    department: 'Sales', status: 'RESIGNED', offboardingTriggered: true,
    createdAt: '2024-02-01T09:00:00', updatedAt: '2025-06-01T09:00:00', resignedAt: '2025-06-01T09:00:00',
  },
  {
    id: 3, employeeId: 'EMP003', name: 'Charlie Brown', email: 'charlie@company.com',
    department: 'HR', status: 'ACTIVE', offboardingTriggered: false,
    createdAt: '2024-03-10T09:00:00', updatedAt: '2024-03-10T09:00:00', resignedAt: null,
  },
  {
    id: 4, employeeId: 'EMP004', name: 'Diana Prince', email: 'diana@company.com',
    department: 'Engineering', status: 'RESIGNED', offboardingTriggered: false,
    createdAt: '2023-11-20T09:00:00', updatedAt: '2025-05-20T09:00:00', resignedAt: '2025-05-20T09:00:00',
  },
];

const DEPARTMENTS = ['Engineering', 'Sales', 'HR', 'Marketing', 'Finance', 'Operations'];

const statusChip = (status: EmployeeStatus) => (
  <Chip
    label={status}
    color={status === 'ACTIVE' ? 'success' : 'error'}
    size="small"
    variant="outlined"
  />
);

const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeRequest>({
    employeeId: '', name: '', email: '', department: DEPARTMENTS[0], status: 'ACTIVE',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchEmployees = () => {
    setLoading(true);
    employeesApi
      .getAll()
      .then((res) => setEmployees(res.data))
      .catch(() => setEmployees(MOCK_EMPLOYEES))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchEmployees(); }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ employeeId: '', name: '', email: '', department: DEPARTMENTS[0], status: 'ACTIVE' });
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditTarget(emp);
    setForm({ employeeId: emp.employeeId, name: emp.name, email: emp.email, department: emp.department, status: emp.status });
    setError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editTarget) {
        await employeesApi.update(editTarget.id, form);
      } else {
        await employeesApi.create(form);
      }
      setDialogOpen(false);
      fetchEmployees();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  const handleOffboard = async (employeeId: number) => {
    try {
      await offboardingApi.initiate(employeeId);
      fetchEmployees();
      alert('Offboarding initiated. View results in the Offboarding page.');
    } catch {
      alert('Failed to initiate offboarding');
    }
  };

  const columns: GridColDef[] = [
    { field: 'employeeId', headerName: 'ID', width: 90 },
    { field: 'name', headerName: 'Name', width: 180, flex: 1 },
    { field: 'email', headerName: 'Email', width: 220, flex: 1 },
    { field: 'department', headerName: 'Department', width: 140 },
    {
      field: 'status', headerName: 'Status', width: 110,
      renderCell: (params) => statusChip(params.value),
    },
    {
      field: 'offboardingTriggered', headerName: 'Offboarded', width: 110,
      renderCell: (params) => (
        <Chip label={params.value ? 'Yes' : 'No'} color={params.value ? 'warning' : 'default'} size="small" />
      ),
    },
    {
      field: 'actions', headerName: 'Actions', width: 140, sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => openEdit(params.row)}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          {params.row.status === 'RESIGNED' && !params.row.offboardingTriggered && (
            <Tooltip title="Start Offboarding">
              <IconButton size="small" color="error" onClick={() => handleOffboard(params.row.id)}>
                <PersonOff fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Employees</Typography>
          <Typography variant="body2" color="text.secondary">Manage employee records and trigger offboarding</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<Refresh />} onClick={fetchEmployees} variant="outlined">
            Refresh
          </Button>
          <Button startIcon={<Add />} onClick={openCreate} variant="contained">
            Add Employee
          </Button>
        </Box>
      </Box>

      <Box sx={{ height: 550, bgcolor: 'white', borderRadius: 2, boxShadow: 1 }}>
        <DataGrid
          rows={employees}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          disableRowSelectionOnClick
        />
      </Box>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editTarget ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Employee ID" value={form.employeeId} required
            onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
            disabled={!!editTarget}
          />
          <TextField
            label="Full Name" value={form.name} required
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            label="Email" type="email" value={form.email} required
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <TextField
            label="Department" select value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          >
            {DEPARTMENTS.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
          </TextField>
          <TextField
            label="Status" select value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as EmployeeStatus })}
          >
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="RESIGNED">Resigned</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? <CircularProgress size={18} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Employees;
