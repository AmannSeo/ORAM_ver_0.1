package com.oram.connector;

import com.oram.dto.response.DiscoveredPermissionDto;

import java.util.List;

/**
 * Plugin interface for SaaS connectors.
 *
 * New SaaS platforms can be supported by implementing this interface.
 * Each connector is responsible for:
 *  - Connecting / disconnecting using OAuth tokens
 *  - Listing users in the SaaS workspace
 *  - Discovering permissions for a specific user
 *  - Revoking access for a specific user
 */
public interface SaaSConnector {

    /**
     * Platform identifier for this connector.
     */
    String getPlatformName();

    /**
     * Connect to the SaaS platform using a valid OAuth access token.
     *
     * @param accessToken   the OAuth 2.0 access token received from the OAuth callback
     * @param refreshToken  the OAuth 2.0 refresh token (may be null)
     * @param workspaceId   optional workspace/organization identifier
     * @return true if connection succeeded
     */
    boolean connect(String accessToken, String refreshToken, String workspaceId);

    /**
     * Disconnect from the SaaS platform (revoke the stored token).
     *
     * @return true if disconnection succeeded
     */
    boolean disconnect();

    /**
     * Retrieve all users/members in the connected SaaS workspace.
     *
     * @return list of user emails
     */
    List<String> getUsers();

    /**
     * Discover all permissions held by a specific user identified by email.
     *
     * @param email the employee email to look up
     * @return list of discovered permissions
     */
    List<DiscoveredPermissionDto> getPermissions(String email);

    /**
     * Revoke all access for a specific user.
     *
     * @param email the employee email whose access should be revoked
     * @return true if all revocations succeeded
     */
    boolean revokeAccess(String email);

    /**
     * Check whether the connector is currently connected and has a valid token.
     *
     * @return true if connected
     */
    boolean isConnected();
}
