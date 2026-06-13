package com.oram.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-256-GCM 암호화 설정 (OAuth 토큰 보호)
 */
@Slf4j
@Configuration
public class EncryptionConfig {

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 128;

    @Value("${oram.encryption.secret-key}")
    private String base64SecretKey;

    @Bean
    public TokenEncryptor tokenEncryptor() {
        return new TokenEncryptor(base64SecretKey);
    }

    public static class TokenEncryptor {
        private final SecretKey secretKey;
        private final SecureRandom secureRandom = new SecureRandom();

        public TokenEncryptor(String base64Key) {
            byte[] keyBytes = Base64.getDecoder().decode(base64Key);
            // Ensure key is 32 bytes for AES-256
            byte[] key32 = new byte[32];
            System.arraycopy(keyBytes, 0, key32, 0, Math.min(keyBytes.length, 32));
            this.secretKey = new SecretKeySpec(key32, "AES");
        }

        public String encrypt(String plainText) {
            if (plainText == null) return null;
            try {
                byte[] iv = new byte[GCM_IV_LENGTH];
                secureRandom.nextBytes(iv);

                Cipher cipher = Cipher.getInstance(ALGORITHM);
                GCMParameterSpec paramSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
                cipher.init(Cipher.ENCRYPT_MODE, secretKey, paramSpec);

                byte[] cipherText = cipher.doFinal(plainText.getBytes());

                // Prepend IV to ciphertext
                byte[] combined = new byte[iv.length + cipherText.length];
                System.arraycopy(iv, 0, combined, 0, iv.length);
                System.arraycopy(cipherText, 0, combined, iv.length, cipherText.length);

                return Base64.getEncoder().encodeToString(combined);
            } catch (Exception e) {
                throw new RuntimeException("Token encryption failed", e);
            }
        }

        public String decrypt(String encryptedText) {
            if (encryptedText == null) return null;
            try {
                byte[] combined = Base64.getDecoder().decode(encryptedText);

                byte[] iv = new byte[GCM_IV_LENGTH];
                byte[] cipherText = new byte[combined.length - GCM_IV_LENGTH];
                System.arraycopy(combined, 0, iv, 0, iv.length);
                System.arraycopy(combined, iv.length, cipherText, 0, cipherText.length);

                Cipher cipher = Cipher.getInstance(ALGORITHM);
                GCMParameterSpec paramSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
                cipher.init(Cipher.DECRYPT_MODE, secretKey, paramSpec);

                return new String(cipher.doFinal(cipherText));
            } catch (Exception e) {
                throw new RuntimeException("Token decryption failed", e);
            }
        }
    }
}
