package com.oram.connector;

import com.oram.enums.SaasType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeFunction;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SlackConnectorTest {

    private SlackConnector connector;

    @BeforeEach
    void setUp() {
        connector = new SlackConnector(WebClient.builder());
        ReflectionTestUtils.setField(connector, "clientId", "slack-client-id");
        ReflectionTestUtils.setField(connector, "clientSecret", "slack-client-secret");
        ReflectionTestUtils.setField(connector, "redirectUri", "http://localhost:8080/api/saas-connections/oauth/callback/SLACK");
        ReflectionTestUtils.setField(connector, "scopes", "users:read,users:read.email,admin.users:read");
    }

    @Test
    void shouldReturnSlackOAuthUrl() {
        String state = "state-123";

        String url = connector.getOAuthAuthorizationUrl(state);

        assertTrue(url.startsWith("https://slack.com/oauth/v2/authorize"));
        assertTrue(url.contains("client_id=slack-client-id"));
        assertTrue(url.contains("state=state-123"));
        assertTrue(url.contains("redirect_uri="));
        assertTrue(url.contains("scope="));
    }

    @Test
    void shouldValidateTokenWhenSlackAuthTestReturnsOkTrue() {
        setWebClientOnConnector(jsonClient("{\"ok\":true}"));

        boolean valid = connector.validateToken("token");

        assertTrue(valid);
    }

    @Test
    void shouldDiscoverSlackAdminPermissionByEmail() {
        String response = """
                {
                  \"ok\": true,
                  \"user\": {
                    \"is_admin\": true,
                    \"is_owner\": false
                  }
                }
                """;

        setWebClientOnConnector(jsonClient(response));

        List<SaaSConnector.DiscoveredPermission> permissions =
                connector.getPermissions("alice@example.com", "token");

        assertEquals(1, permissions.size());
        SaaSConnector.DiscoveredPermission permission = permissions.getFirst();
        assertEquals("ADMIN", permission.permissionType());
        assertTrue(permission.isAdmin());
        assertFalse(permission.isOwner());
        assertEquals(SaasType.SLACK, connector.getSaasType());
    }

    private void setWebClientOnConnector(WebClient webClient) {
        ReflectionTestUtils.setField(connector, "webClient", webClient);
    }

    private WebClient jsonClient(String body) {
        ExchangeFunction exchangeFunction = request -> Mono.just(
                ClientResponse.create(HttpStatus.OK)
                        .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                        .body(body)
                        .build()
        );
        return WebClient.builder().exchangeFunction(exchangeFunction).build();
    }
}
