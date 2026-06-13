package com.oram.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "offboarding_results")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OffboardingResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private OffboardingStatus status = OffboardingStatus.PENDING;

    @Column(name = "risk_score")
    private Integer riskScore;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_level")
    private RiskLevel riskLevel;

    @Column(name = "total_permissions")
    @Builder.Default
    private Integer totalPermissions = 0;

    @Column(name = "revoked_permissions")
    @Builder.Default
    private Integer revokedPermissions = 0;

    @CreationTimestamp
    @Column(name = "initiated_at", updatable = false)
    private LocalDateTime initiatedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @OneToMany(mappedBy = "offboardingResult", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Permission> permissions = new ArrayList<>();

    public enum OffboardingStatus {
        PENDING, IN_PROGRESS, COMPLETED, FAILED
    }

    public enum RiskLevel {
        LOW, MEDIUM, HIGH, CRITICAL
    }
}
