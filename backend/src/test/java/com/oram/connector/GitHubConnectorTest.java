package com.oram.connector;

import com.oram.enums.SaasType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeFunction;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class GitHubConnectorTest {

    private GitHubConnector connector;

    @BeforeEach
    void setUp() {
        connector = new GitHubConnector(WebClient.builder());
        ReflectionTestUtils.setField(connector, "clientId", "github-client-id");
        ReflectionTestUtils.setField(connector, "clientSecret", "github-client-secret");
        ReflectionTestUtils.setField(connector, "redirectUri", "http://localhost:8080/api/saas-connections/oauth/callback/GITHUB");
        ReflectionTestUtils.setField(connector, "scopes", "read:org,admin:org,user:email");
    }

    @Test
    void shouldReturnGitHubOAuthUrl() {
        String url = connector.getOAuthAuthorizationUrl("state-123");

        assertTrue(url.startsWith("https://github.com/login/oauth/authorize"));
        assertTrue(url.contains("client_id=github-client-id"));
        assertTrue(url.contains("state=state-123"));
        assertTrue(url.contains("redirect_uri="));
        assertTrue(url.contains("scope="));
    }

    @Test
    void shouldValidateTokenWhenUserApiIsReachable() {
        setWebClientOnConnector(routeByPathClient(path -> "{\"login\":\"octocat\"}"));

        boolean valid = connector.validateToken("token");

        assertTrue(valid);
    }

    @Test
    void shouldDiscoverGitHubMembershipByEmail() {
        setWebClientOnConnector(routeByPathClient(path -> {
            if (path.startsWith("/search/users")) {
                return """
                        {
                          \"items\": [
                            { \"login\": \"alice\" }
                          ]
                        }
                        """;
            }
            if (path.equals("/users/alice/orgs")) {
                return """
                        [
                          { \"login\": \"org-1\" },
                          { \"login\": \"org-2\" }
                        ]
                        """;
            }
            return "{}";
        }));

        List<SaaSConnector.DiscoveredPermission> permissions =
                connector.getPermissions("alice@example.com", "token");

        assertEquals(1, permissions.size());
        SaaSConnector.DiscoveredPermission permission = permissions.getFirst();
        assertEquals("MEMBER", permission.permissionType());
        assertEquals(2, permission.workspaceCount());
        assertEquals(SaasType.GITHUB, connector.getSaasType());
    }

    private void setWebClientOnConnector(WebClient webClient) {
        ReflectionTestUtils.setField(connector, "webClient", webClient);
    }

    private WebClient routeByPathClient(java.util.function.Function<String, String> bodyByPath) {
        ExchangeFunction exchangeFunction = request -> {
            String body = bodyByPath.apply(request.url().getPath());
            return Mono.just(
                    ClientResponse.create(HttpStatus.OK)
                            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                            .body(body)
                            .build()
            );
        };
        return WebClient.builder().exchangeFunction(exchangeFunction).build();
    }
}
