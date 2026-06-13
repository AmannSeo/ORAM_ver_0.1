package com.oram.dto.response;

import com.oram.entity.Employee.EmployeeStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class EmployeeResponse {
    private Long id;
    private String employeeId;
    private String name;
    private String email;
    private String department;
    private EmployeeStatus status;
    private Boolean offboardingTriggered;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime resignedAt;
}
