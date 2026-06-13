package com.oram.dto.response;

import com.oram.entity.Permission.RevokeStatus;
import com.oram.entity.SaaSConnection.SaaSPlatform;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class PermissionResponse {
    private Long id;
    private SaaSPlatform platform;
    private String permissionType;
    private String permissionDetail;
    private Boolean isAdmin;
    private Boolean isOwner;
    private Boolean hasApiToken;
    private RevokeStatus revokeStatus;
    private LocalDateTime revokedAt;
    private LocalDateTime discoveredAt;
}
