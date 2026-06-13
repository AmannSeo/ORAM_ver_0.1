package com.oram.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "saas_connections")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SaaSConnection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "platform", nullable = false, unique = true)
    private SaaSPlatform platform;

    @Column(name = "connected")
    @Builder.Default
    private Boolean connected = false;

    /**
     * Encrypted OAuth access token.
     * Stored encrypted using AES-256.
     */
    @Column(name = "access_token", columnDefinition = "TEXT")
    private String accessToken;

    /**
     * Encrypted OAuth refresh token.
     */
    @Column(name = "refresh_token", columnDefinition = "TEXT")
    private String refreshToken;

    @Column(name = "workspace_id")
    private String workspaceId;

    @Column(name = "workspace_name")
    private String workspaceName;

    @Column(name = "connected_by")
    private String connectedBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "last_synced_at")
    private LocalDateTime lastSyncedAt;

    public enum SaaSPlatform {
        SLACK, GITHUB, NOTION
    }
}
