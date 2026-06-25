import {
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import type { SaasType } from '../../types';

export default function EmployeeFilterPanel(props: {
  filterStatus: string;
  setFilterStatus: (value: string) => void;
  filterSaas: SaasType | '';
  setFilterSaas: (value: SaasType | '') => void;
  filterDept: string;
  setFilterDept: (value: string) => void;
  departmentOptions: string[];
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
            <Select value={props.filterStatus} label="상태" onChange={(event) => { props.setFilterStatus(event.target.value); props.setPage(0); }}>
              <MenuItem value="">전체</MenuItem>
              <MenuItem value="ACTIVE">재직 중</MenuItem>
              <MenuItem value="RESIGNED">퇴사</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} lg={1.8}>
          <FormControl size="small" fullWidth>
            <InputLabel>SaaS</InputLabel>
            <Select value={props.filterSaas} label="SaaS" onChange={(event) => { props.setFilterSaas(event.target.value as SaasType | ''); props.setPage(0); }}>
              <MenuItem value="">전체</MenuItem>
              <MenuItem value="SLACK">Slack</MenuItem>
              <MenuItem value="GITHUB">GitHub</MenuItem>
              <MenuItem value="NOTION">Notion</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} lg={2.6}>
          <FormControl size="small" fullWidth>
            <InputLabel>부서</InputLabel>
            <Select
              value={props.filterDept}
              label="부서"
              onChange={(event) => { props.setFilterDept(event.target.value); props.setPage(0); }}
            >
              <MenuItem value="">전체</MenuItem>
              {props.departmentOptions.map((department) => (
                <MenuItem key={department} value={department}>{department}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} lg={4.2}>
          <TextField size="small" label="직원 검색" placeholder="이름 또는 이메일" value={props.searchQuery} onChange={(event) => props.setSearchQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && props.runSearch()} fullWidth />
        </Grid>
        <Grid item xs={12} sm={6} lg={1.8}>
          <Button variant="contained" startIcon={<SearchIcon />} onClick={props.runSearch} fullWidth sx={{ height: 40, borderRadius: 2, whiteSpace: 'nowrap' }}>검색</Button>
        </Grid>
      </Grid>
    </Paper>
  );
}
