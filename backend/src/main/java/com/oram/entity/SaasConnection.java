package com.oram.entity;

import com.oram.enums.SaasType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "saas_connections")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SaasConnection {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "saas_type", nullable = false, unique = true, length = 50)
    private SaasType saasType;

    @Column(name = "access_token_encrypted", columnDefinition = "TEXT")
    private String accessTokenEncrypted;

    @Column(name = "refresh_token_encrypted", columnDefinition = "TEXT")
    private String refreshTokenEncrypted;

    @Column(name = "workspace_id")
    private String workspaceId;

    @Column(name = "workspace_name")
    private String workspaceName;

    @Column(name = "account_scope", length = 50)
    @Builder.Default
    private String accountScope = "WORKSPACE";

    @Column(name = "is_connected", nullable = false)
    @Builder.Default
    private boolean connected = false;

    @Column(name = "connected_at")
    private LocalDateTime connectedAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "connected_by")
    private User connectedBy;
}
