package com.oram.dto;

import com.oram.enums.EmployeeStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;
import java.util.UUID;

public class EmployeeDto {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Response {
        private UUID id;
        private String employeeId;
        private String name;
        private String email;
        private String department;
        private EmployeeStatus status;
        private LocalDateTime createdAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateRequest {
        @NotBlank
        private String employeeId;
        @NotBlank
        private String name;
        @NotBlank @Email
        private String email;
        @NotBlank
        private String department;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpdateRequest {
        private String name;
        private String department;
        private EmployeeStatus status;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PageResponse {
        private java.util.List<Response> content;
        private long totalElements;
        private int totalPages;
        private int page;
        private int size;
    }
}
