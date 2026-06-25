import { Box } from '@mui/material';
import PageHeader from '../components/common/PageHeader';
import EmployeeLogPanel from '../components/employees/EmployeeLogPanel';

export default function AuditLogs() {
  return (
    <Box sx={{ width: '100%' }}>
      <PageHeader
        title="감사 로그"
        description="직원 권한 점검, AI 감지, 권한 회수, 오탐 처리 이력을 확인하고 감사용 파일로 내려받습니다."
      />
      <EmployeeLogPanel />
    </Box>
  );
}
