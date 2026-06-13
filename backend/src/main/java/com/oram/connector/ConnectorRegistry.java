package com.oram.connector;

import com.oram.enums.SaasType;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Plugin Registry: 모든 SaaSConnector 구현체를 자동으로 수집하고 관리합니다.
 * 새로운 커넥터를 @Component로 등록하면 자동으로 이 레지스트리에 추가됩니다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ConnectorRegistry {

    private final List<SaaSConnector> connectors;
    private Map<SaasType, SaaSConnector> connectorMap;

    @PostConstruct
    public void init() {
        connectorMap = connectors.stream()
                .collect(Collectors.toMap(SaaSConnector::getSaasType, Function.identity()));
        log.info("Registered SaaS Connectors: {}", connectorMap.keySet());
    }

    public Optional<SaaSConnector> getConnector(SaasType saasType) {
        return Optional.ofNullable(connectorMap.get(saasType));
    }

    public List<SaaSConnector> getAllConnectors() {
        return connectors;
    }

    public List<SaasType> getSupportedTypes() {
        return connectors.stream().map(SaaSConnector::getSaasType).toList();
    }
}
