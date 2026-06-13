package com.oram.controller;

import com.oram.dto.AuthDto;
import com.oram.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<AuthDto.LoginResponse> login(@Valid @RequestBody AuthDto.LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }
}
