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

class NotionConnectorTest {

    private NotionConnector connector;

    @BeforeEach
    void setUp() {
        connector = new NotionConnector(WebClient.builder());
        ReflectionTestUtils.setField(connector, "clientId", "notion-client-id");
        ReflectionTestUtils.setField(connector, "clientSecret", "notion-client-secret");
        ReflectionTestUtils.setField(connector, "redirectUri", "http://localhost:8080/api/saas-connections/oauth/callback/NOTION");
    }

    @Test
    void shouldReturnNotionOAuthUrl() {
        String url = connector.getOAuthAuthorizationUrl("state-123");

        assertTrue(url.startsWith("https://api.notion.com/v1/oauth/authorize"));
        assertTrue(url.contains("client_id=notion-client-id"));
        assertTrue(url.contains("state=state-123"));
        assertTrue(url.contains("redirect_uri="));
        assertTrue(url.contains("response_type=code"));
    }

    @Test
    void shouldValidateTokenWhenUsersMeApiIsReachable() {
        setWebClientOnConnector(jsonClient("{\"object\":\"user\"}"));

        boolean valid = connector.validateToken("token");

        assertTrue(valid);
    }

    @Test
    void shouldDiscoverNotionMemberByEmail() {
        String response = """
                {
                  \"results\": [
                    {
                      \"type\": \"person\",
                      \"person\": { \"email\": \"alice@example.com\" }
                    }
                  ]
                }
                """;
        setWebClientOnConnector(jsonClient(response));

        List<SaaSConnector.DiscoveredPermission> permissions =
                connector.getPermissions("alice@example.com", "token");

        assertEquals(1, permissions.size());
        SaaSConnector.DiscoveredPermission permission = permissions.getFirst();
        assertEquals("MEMBER", permission.permissionType());
        assertEquals(1, permission.workspaceCount());
        assertEquals(SaasType.NOTION, connector.getSaasType());
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
