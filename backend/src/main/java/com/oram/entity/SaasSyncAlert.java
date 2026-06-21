package com.oram.entity;

import com.oram.enums.SaasSyncAlertStatus;
import com.oram.enums.SaasType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "saas_sync_alerts",
        indexes = {
                @Index(name = "idx_saas_sync_alert_status", columnList = "status"),
                @Index(name = "idx_saas_sync_alert_saas", columnList = "saas_type"),
                @Index(name = "idx_saas_sync_alert_external", columnList = "saas_type, external_user_id")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SaasSyncAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "saas_type", nullable = false, length = 50)
    private SaasType saasType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id")
    private Employee employee;

    @Column(name = "external_user_id", nullable = false, length = 255)
    private String externalUserId;

    @Column(name = "external_username", length = 255)
    private String externalUsername;

    @Column(name = "external_email", length = 255)
    private String externalEmail;

    @Column(name = "display_name", length = 255)
    private String displayName;

    @Column(nullable = false, length = 100)
    private String reason;

    @Column(columnDefinition = "TEXT")
    private String detail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private SaasSyncAlertStatus status = SaasSyncAlertStatus.OPEN;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
