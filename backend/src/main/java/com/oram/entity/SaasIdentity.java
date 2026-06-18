package com.oram.entity;

import com.oram.enums.EmployeeStatus;
import com.oram.enums.SaasType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "saas_identities",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_saas_identity_external", columnNames = {"saas_type", "external_user_id"})
        },
        indexes = {
                @Index(name = "idx_saas_identity_employee", columnList = "employee_id"),
                @Index(name = "idx_saas_identity_email", columnList = "external_email")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SaasIdentity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id")
    private Employee employee;

    @Enumerated(EnumType.STRING)
    @Column(name = "saas_type", nullable = false, length = 50)
    private SaasType saasType;

    @Column(name = "external_user_id", nullable = false, length = 255)
    private String externalUserId;

    @Column(name = "external_username", length = 255)
    private String externalUsername;

    @Column(name = "external_email", length = 255)
    private String externalEmail;

    @Column(name = "display_name", length = 255)
    private String displayName;

    @Column(length = 100)
    private String department;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private EmployeeStatus status = EmployeeStatus.ACTIVE;

    @Column(name = "last_synced_at")
    private LocalDateTime lastSyncedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
