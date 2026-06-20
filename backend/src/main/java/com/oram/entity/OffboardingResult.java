package com.oram.entity;

import com.oram.enums.OffboardingStatus;
import com.oram.enums.RiskLevel;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "offboarding_results")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OffboardingResult {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private OffboardingStatus status = OffboardingStatus.PENDING;

    @Column(name = "risk_score")
    private Integer riskScore;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_level", length = 20)
    private RiskLevel riskLevel;

    @Column(name = "analysis_source", length = 30)
    private String analysisSource;

    @Column(name = "analysis_trigger", length = 100)
    private String analysisTrigger;

    @Column(name = "analysis_engine", length = 100)
    private String analysisEngine;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "revoked_all", nullable = false)
    @Builder.Default
    private boolean revokedAll = false;

    @Column(name = "false_positive")
    @Builder.Default
    private boolean falsePositive = false;

    @Column(name = "false_positive_reason", length = 500)
    private String falsePositiveReason;

    @Column(name = "false_positive_at")
    private LocalDateTime falsePositiveAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    @OneToMany(mappedBy = "offboardingResult", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<PermissionRecord> permissions = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
