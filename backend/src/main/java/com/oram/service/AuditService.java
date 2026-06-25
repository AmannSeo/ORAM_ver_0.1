package com.oram.service;

import com.oram.entity.AuditLog;
import com.oram.entity.User;
import com.oram.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(User user, String action, String targetType, String targetId, String detail) {
        log(user, action, targetType, targetId, detail, null);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(User user, String action, String targetType, String targetId, String detail, String targetLabel) {
        try {
            AuditLog entry = AuditLog.builder()
                    .user(user)
                    .action(action)
                    .targetType(targetType)
                    .targetId(targetId)
                    .targetLabel(targetLabel)
                    .detail(detail)
                    .ipAddress(getClientIp())
                    .build();
            auditLogRepository.save(entry);
            log.debug("Audit: action={}, target={}/{}, detail={}", action, targetType, targetId, detail);
        } catch (Exception e) {
            log.warn("Failed to save audit log: {}", e.getMessage());
        }
    }

    private String getClientIp() {
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.currentRequestAttributes();
            String ip = attrs.getRequest().getHeader("X-Forwarded-For");
            return (ip != null && !ip.isEmpty()) ? ip.split(",")[0].trim()
                    : attrs.getRequest().getRemoteAddr();
        } catch (Exception e) {
            return "unknown";
        }
    }
}
