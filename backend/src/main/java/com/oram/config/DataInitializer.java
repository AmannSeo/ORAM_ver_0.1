package com.oram.config;

import com.oram.entity.SaaSConnection;
import com.oram.entity.User;
import com.oram.repository.SaaSConnectionRepository;
import com.oram.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Arrays;
import java.util.List;

/**
 * Seeds initial data for local development / demo purposes.
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class DataInitializer {

    private final UserRepository userRepository;
    private final SaaSConnectionRepository saaSConnectionRepository;
    private final PasswordEncoder passwordEncoder;

    @Bean
    public ApplicationRunner initializeData() {
        return args -> {
            seedUsers();
            seedSaaSConnections();
        };
    }

    private void seedUsers() {
        if (userRepository.count() > 0) {
            return;
        }

        List<User> users = List.of(
                User.builder()
                        .username("admin")
                        .email("admin@oram.io")
                        .password(passwordEncoder.encode("Admin1234!"))
                        .fullName("ORAM Administrator")
                        .role(User.UserRole.ADMIN)
                        .build(),
                User.builder()
                        .username("security_mgr")
                        .email("security@oram.io")
                        .password(passwordEncoder.encode("Security1234!"))
                        .fullName("Security Manager")
                        .role(User.UserRole.SECURITY_MANAGER)
                        .build(),
                User.builder()
                        .username("auditor")
                        .email("auditor@oram.io")
                        .password(passwordEncoder.encode("Auditor1234!"))
                        .fullName("Security Auditor")
                        .role(User.UserRole.AUDITOR)
                        .build()
        );

        userRepository.saveAll(users);
        log.info("Seeded {} default users", users.size());
    }

    private void seedSaaSConnections() {
        if (saaSConnectionRepository.count() > 0) {
            return;
        }

        Arrays.stream(SaaSConnection.SaaSPlatform.values()).forEach(platform ->
                saaSConnectionRepository.save(
                        SaaSConnection.builder()
                                .platform(platform)
                                .connected(false)
                                .build()
                )
        );

        log.info("Seeded SaaS connection records for all platforms");
    }
}
