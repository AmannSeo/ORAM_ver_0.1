package com.oram.entity;

import com.oram.enums.SaasType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "permission_records")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PermissionRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "offboarding_result_id", nullable = false)
    private OffboardingResult offboardingResult;

    @Enumerated(EnumType.STRING)
    @Column(name = "saas_type", nullable = false, length = 50)
    private SaasType saasType;

    @Column(name = "permission_type", nullable = false, length = 100)
    private String permissionType;

    @Column(name = "resource_name", length = 255)
    private String resourceName;

    // XGBoost features
    @Column(name = "is_admin")
    @Builder.Default
    private boolean admin = false;

    @Column(name = "is_owner")
    @Builder.Default
    private boolean owner = false;

    @Column(name = "has_api_token")
    @Builder.Default
    private boolean hasApiToken = false;

    @Column(name = "recent_login")
    @Builder.Default
    private boolean recentLogin = false;

    @Column(name = "repo_count")
    @Builder.Default
    private int repoCount = 0;

    @Column(name = "workspace_count")
    @Builder.Default
    private int workspaceCount = 0;

    @CreationTimestamp
    @Column(name = "discovered_at", updatable = false)
    private LocalDateTime discoveredAt;
}
