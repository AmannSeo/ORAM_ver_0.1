package com.oram.dto.response;

import com.oram.entity.SaaSConnection.SaaSPlatform;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DiscoveredPermissionDto {

    private SaaSPlatform platform;
    private String permissionType;
    private String permissionDetail;
    private boolean isAdmin;
    private boolean isOwner;
    private boolean hasApiToken;
    private int accessibleResources;
}
