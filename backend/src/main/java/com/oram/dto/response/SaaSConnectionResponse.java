package com.oram.dto.response;

import com.oram.entity.SaaSConnection.SaaSPlatform;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class SaaSConnectionResponse {
    private Long id;
    private SaaSPlatform platform;
    private Boolean connected;
    private String workspaceId;
    private String workspaceName;
    private String connectedBy;
    private LocalDateTime lastSyncedAt;
    private LocalDateTime updatedAt;
}
