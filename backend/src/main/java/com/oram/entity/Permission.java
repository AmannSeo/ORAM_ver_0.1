package com.oram.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "permissions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Permission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "offboarding_result_id", nullable = false)
    private OffboardingResult offboardingResult;

    @Enumerated(EnumType.STRING)
    @Column(name = "platform", nullable = false)
    private SaaSConnection.SaaSPlatform platform;

    @Column(name = "permission_type", nullable = false)
    private String permissionType;

    @Column(name = "permission_detail")
    private String permissionDetail;

    @Column(name = "is_admin")
    @Builder.Default
    private Boolean isAdmin = false;

    @Column(name = "is_owner")
    @Builder.Default
    private Boolean isOwner = false;

    @Column(name = "has_api_token")
    @Builder.Default
    private Boolean hasApiToken = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "revoke_status")
    @Builder.Default
    private RevokeStatus revokeStatus = RevokeStatus.PENDING;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @CreationTimestamp
    @Column(name = "discovered_at", updatable = false)
    private LocalDateTime discoveredAt;

    public enum RevokeStatus {
        PENDING, REVOKED, FAILED, SKIPPED
    }
}
