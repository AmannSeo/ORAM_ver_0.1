package com.oram.controller;

import com.oram.dto.EmployeeDto;
import com.oram.entity.Employee;
import com.oram.enums.EmployeeStatus;
import com.oram.repository.EmployeeRepository;
import com.oram.service.EmployeeService;
import com.oram.service.OffboardingService;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

/**
 * HR 시스템 연동 Webhook 컨트롤러
 *
 * 기존 HR 시스템(Workday, BambooHR, SAP, 그룹웨어 등)에서
 * 직원 상태 변경 이벤트 발생 시 이 엔드포인트를 호출합니다.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 인증: 헤더에 X-ORAM-Webhook-Secret 포함
 * 기본값: application.yml → oram.webhook.secret
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 외부 HR 시스템 설정 예시:
 *  - Workday: Outbound Studio → Custom Report 이벤트로 POST 호출
 *  - BambooHR: Webhooks 설정 → 직원 상태 변경 시 자동 호출
 *  - 자체 그룹웨어: 퇴사 처리 화면에서 ORAM API 호출 추가
 */
@Slf4j
@RestController
@RequestMapping("/api/hr")
@RequiredArgsConstructor
public class HrWebhookController {

    private final EmployeeRepository employeeRepository;
    private final EmployeeService employeeService;
    private final OffboardingService offboardingService;

    // 실제 운영 시 application.yml에 설정, 환경변수 ${WEBHOOK_SECRET}으로 주입
    private static final String WEBHOOK_SECRET = System.getenv().getOrDefault("ORAM_WEBHOOK_SECRET", "oram-webhook-secret-poc");

    /**
     * HR 시스템 Webhook 수신
     *
     * 요청 예시 (직원 퇴사):
     * POST /api/hr/webhook
     * X-ORAM-Webhook-Secret: oram-webhook-secret-poc
     * {
     *   "event": "EMPLOYEE_STATUS_CHANGED",
     *   "employeeId": "EMP001",          // 사번 (또는 email)
     *   "email": "hong@company.com",     // 이메일 (또는 employeeId)
     *   "status": "RESIGNED",
     *   "name": "홍길동",               // 선택: 신규 직원 자동 등록 시 사용
     *   "department": "Engineering"     // 선택
     * }
     *
     * 응답: { "result": "OFFBOARDING_TRIGGERED", "offboardingResultId": "uuid" }
     */
    @PostMapping("/webhook")
    public ResponseEntity<Map<String, Object>> receiveWebhook(
            @RequestHeader(value = "X-ORAM-Webhook-Secret", required = false) String secret,
            @RequestBody HrWebhookRequest request) {

        // 시크릿 검증
        if (!WEBHOOK_SECRET.equals(secret)) {
            log.warn("HR Webhook: 인증 실패 (잘못된 시크릿)");
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        log.info("HR Webhook 수신: event={}, employeeId={}, email={}, status={}",
                request.getEvent(), request.getEmployeeId(), request.getEmail(), request.getStatus());

        // 이벤트가 RESIGNED가 아닌 경우 (입사, 부서이동 등) - 직원 정보 업데이트만
        if (!"RESIGNED".equalsIgnoreCase(request.getStatus()) &&
            !"EMPLOYEE_RESIGNED".equalsIgnoreCase(request.getEvent())) {

            handleNonResignEvent(request);
            return ResponseEntity.ok(Map.of("result", "ACKNOWLEDGED", "action", "EMPLOYEE_UPDATED_OR_CREATED"));
        }

        // 퇴사 이벤트 처리
        Optional<Employee> employeeOpt = findEmployee(request);

        if (employeeOpt.isEmpty()) {
            // 직원이 없으면 자동 등록 후 오프보딩
            if (request.getEmail() != null && request.getName() != null) {
                log.info("HR Webhook: 신규 직원 자동 등록 후 오프보딩 - {}", request.getEmail());
                EmployeeDto.CreateRequest createReq = new EmployeeDto.CreateRequest(
                        request.getEmployeeId() != null ? request.getEmployeeId() : "EXT-" + System.currentTimeMillis(),
                        request.getName(),
                        request.getEmail(),
                        request.getDepartment() != null ? request.getDepartment() : "Unknown"
                );
                employeeService.createEmployee(createReq);
                employeeOpt = findEmployee(request);
            } else {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "Employee not found. Provide email+name for auto-registration.",
                    "employeeId", request.getEmployeeId() != null ? request.getEmployeeId() : "null",
                    "email", request.getEmail() != null ? request.getEmail() : "null"
                ));
            }
        }

        Employee employee = employeeOpt.get();

        if (employee.getStatus() == EmployeeStatus.RESIGNED) {
            return ResponseEntity.ok(Map.of(
                "result", "SKIPPED",
                "reason", "Employee already resigned",
                "email", employee.getEmail()
            ));
        }

        // 오프보딩 트리거
        java.util.UUID offboardingId = employeeService.resignEmployee(employee.getId());
        log.info("HR Webhook: 오프보딩 시작 - {} → resultId={}", employee.getEmail(), offboardingId);

        return ResponseEntity.ok(Map.of(
            "result", "OFFBOARDING_TRIGGERED",
            "offboardingResultId", offboardingId.toString(),
            "email", employee.getEmail()
        ));
    }

    /**
     * Webhook 연결 상태 테스트
     * GET /api/hr/webhook/ping
     */
    @GetMapping("/webhook/ping")
    public ResponseEntity<Map<String, String>> ping() {
        return ResponseEntity.ok(Map.of(
            "status", "OK",
            "message", "ORAM HR Webhook is ready",
            "webhookUrl", "/api/hr/webhook"
        ));
    }

    private Optional<Employee> findEmployee(HrWebhookRequest request) {
        if (request.getEmail() != null) {
            Optional<Employee> byEmail = employeeRepository.findByEmail(request.getEmail());
            if (byEmail.isPresent()) return byEmail;
        }
        if (request.getEmployeeId() != null) {
            return employeeRepository.findByEmployeeId(request.getEmployeeId());
        }
        return Optional.empty();
    }

    private void handleNonResignEvent(HrWebhookRequest request) {
        // 신규 입사자 자동 등록 (이미 없는 경우만)
        if ("EMPLOYEE_CREATED".equalsIgnoreCase(request.getEvent()) ||
            "ACTIVE".equalsIgnoreCase(request.getStatus())) {
            if (request.getEmail() != null && !employeeRepository.existsByEmail(request.getEmail())) {
                EmployeeDto.CreateRequest createReq = new EmployeeDto.CreateRequest(
                        request.getEmployeeId() != null ? request.getEmployeeId() : "EXT-" + System.currentTimeMillis(),
                        request.getName() != null ? request.getName() : "Unknown",
                        request.getEmail(),
                        request.getDepartment() != null ? request.getDepartment() : "Unknown"
                );
                employeeService.createEmployee(createReq);
                log.info("HR Webhook: 신규 직원 자동 등록 - {}", request.getEmail());
            }
        }
    }

    @Data
    @NoArgsConstructor
    public static class HrWebhookRequest {
        private String event;        // EMPLOYEE_STATUS_CHANGED | EMPLOYEE_CREATED | EMPLOYEE_RESIGNED
        private String employeeId;   // 사번
        private String email;        // 이메일 (employeeId 또는 email 둘 중 하나 필수)
        private String status;       // ACTIVE | RESIGNED
        private String name;         // 이름 (신규 등록 시 필요)
        private String department;   // 부서 (신규 등록 시 선택)
    }
}
