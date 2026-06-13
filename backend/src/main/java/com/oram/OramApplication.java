package com.oram;

import com.oram.enums.UserRole;
import com.oram.service.AuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@Slf4j
@SpringBootApplication
public class OramApplication {

    public static void main(String[] args) {
        SpringApplication.run(OramApplication.class, args);
    }

    /**
     * 초기 관리자 계정 생성 (최초 실행 시에만)
     * 실제 운영 환경에서는 이 방식 대신 flyway migration 사용을 권장합니다.
     */
    @Bean
    CommandLineRunner initDefaultAdmin(AuthService authService) {
        return args -> {
            try {
                authService.createUser(
                        "admin@oram.local",
                        "Admin1234!",
                        "ORAM Admin",
                        UserRole.ADMIN
                );
                authService.createUser(
                        "security@oram.local",
                        "Security1234!",
                        "Security Manager",
                        UserRole.SECURITY_MANAGER
                );
                authService.createUser(
                        "auditor@oram.local",
                        "Auditor1234!",
                        "Auditor",
                        UserRole.AUDITOR
                );
                log.info("Default users created: admin@oram.local / security@oram.local / auditor@oram.local");
            } catch (IllegalArgumentException e) {
                log.info("Default users already exist, skipping initialization.");
            }
        };
    }
}
