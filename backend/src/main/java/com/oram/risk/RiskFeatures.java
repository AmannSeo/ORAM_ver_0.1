package com.oram.risk;

import lombok.Builder;
import lombok.Data;

/**
 * Feature vector used as input to the XGBoost risk scoring model.
 *
 * These features are extracted from discovered permissions across all
 * connected SaaS platforms and fed into the risk model.
 */
@Data
@Builder
public class RiskFeatures {

    /** Whether the user is an admin on any connected SaaS platform */
    private boolean isAdmin;

    /** Whether the user is an owner on any connected SaaS platform */
    private boolean isOwner;

    /** Whether the user has any active API tokens / PATs */
    private boolean hasApiToken;

    /** Whether the user has logged in within the past 30 days */
    private boolean recentLogin;

    /** Total number of repositories the user can access */
    private int accessibleRepositories;

    /** Total number of workspaces the user is a member of */
    private int accessibleWorkspaces;

    /** Total number of SaaS platforms where the user was found */
    private int platformCount;
}
