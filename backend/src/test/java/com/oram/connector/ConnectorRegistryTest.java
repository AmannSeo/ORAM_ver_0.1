package com.oram.connector;

import com.oram.enums.SaasType;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ConnectorRegistryTest {

    @Test
    void shouldRegisterAndResolveAllSupportedTypes() {
        SaaSConnector slack = Mockito.mock(SaaSConnector.class);
        SaaSConnector github = Mockito.mock(SaaSConnector.class);
        SaaSConnector notion = Mockito.mock(SaaSConnector.class);

        Mockito.when(slack.getSaasType()).thenReturn(SaasType.SLACK);
        Mockito.when(github.getSaasType()).thenReturn(SaasType.GITHUB);
        Mockito.when(notion.getSaasType()).thenReturn(SaasType.NOTION);

        ConnectorRegistry registry = new ConnectorRegistry(List.of(slack, github, notion));
        registry.init();

        assertTrue(registry.getConnector(SaasType.SLACK).isPresent());
        assertTrue(registry.getConnector(SaasType.GITHUB).isPresent());
        assertTrue(registry.getConnector(SaasType.NOTION).isPresent());
        assertEquals(3, registry.getAllConnectors().size());
        assertEquals(3, registry.getSupportedTypes().size());
    }
}
