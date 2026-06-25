package com.oram.service;

import com.oram.entity.SaasConnection;
import com.oram.repository.SaasConnectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class SaasSyncScheduler {

    private final SaasConnectionRepository connectionRepository;
    private final SaasConnectionService saasConnectionService;

    @Value("${oram.saas-sync.enabled:true}")
    private boolean enabled;

    // 매일 0시, 12시에 자동 동기화 (cron: 초 분 시 일 월 요일)
    @Scheduled(cron = "${oram.saas-sync.cron:0 0 0,12 * * *}")
    public void syncConnectedSaasAccounts() {
        if (!enabled) {
            return;
        }

        List<SaasConnection> connections = connectionRepository.findByConnectedTrue();
        if (connections.isEmpty()) {
            return;
        }

        for (SaasConnection connection : connections) {
            try {
                saasConnectionService.syncConnectedUsers(connection.getSaasType());
                log.info("Scheduled SaaS sync completed: {}", connection.getSaasType());
            } catch (Exception e) {
                log.warn("Scheduled SaaS sync failed for {}: {}", connection.getSaasType(), e.getMessage());
            }
        }
    }
}
