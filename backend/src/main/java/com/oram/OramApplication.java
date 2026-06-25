package com.oram;

import com.oram.enums.UserRole;
import com.oram.service.AuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;

import jakarta.annotation.PostConstruct;
import java.util.TimeZone;

@Slf4j
@EnableScheduling
@SpringBootApplication
public class OramApplication {

    /**
     * 서버 기본 타임존을 KST로 고정.
     * LocalDateTime.now()가 UTC 서버에서도 한국 시각으로 기록/표시되도록 보장합니다.
     */
    @PostConstruct
    void initTimeZone() {
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Seoul"));
        log.info("Default timezone set to Asia/Seoul (KST)");
    }

    public static void main(String[] args) {
        // SpringApplication.run 이전에도 타임존을 고정해 시작 단계 로그/타임스탬프까지 KST로 통일
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Seoul"));
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
