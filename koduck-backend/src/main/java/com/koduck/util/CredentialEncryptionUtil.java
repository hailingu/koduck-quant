package com.koduck.util;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import com.koduck.exception.CredentialEncryptionException;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;

/**
 * Encrypts and decrypts credential secrets with AES-256-GCM.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Component
@Slf4j
public class CredentialEncryptionUtil {

    private static final String ALGORITHM = "AES";
    private static final String ENV_CREDENTIAL_ENCRYPTION_KEY = "CREDENTIAL_ENCRYPTION_KEY";
    private static final String MASKED_VALUE = "***";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int API_KEY_MIN_MASK_LENGTH = 8;
    private static final int API_KEY_VISIBLE_EDGE_LENGTH = 4;
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 16;
    private static final int KEY_LENGTH = 32;

    /**
     * Encryption key configured via Spring properties.
     */
    @Value("${credential.encryption.key:}")
    private String encryptionKeyFromConfig;

    /**
     * Runtime AES key derived from configuration.
     */
    private SecretKey secretKey;

    /**
     * Secure random source used for GCM initialization vectors.
     */
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    /**
     * Creates the credential encryption utility.
     */
    public CredentialEncryptionUtil() {
        // Default constructor for Spring-managed component initialization.
    }

    /**
     * Initializes the runtime encryption key.
     */
    @PostConstruct
    public void init() {
        final String keyToUse = resolveEncryptionKey();

        try {
            final byte[] keyBytes = deriveKey(keyToUse);
            secretKey = new SecretKeySpec(keyBytes, ALGORITHM);
            log.info("Credential encryption key initialized successfully.");
        } catch (NoSuchAlgorithmException ex) {
            log.error("Failed to initialize credential encryption key.", ex);
            throw new IllegalStateException("Unable to initialize credential encryption utility", ex);
        }
    }

    private String resolveEncryptionKey() {
        String resolvedKey = encryptionKeyFromConfig;
        final String envKey = getEncryptionKeyFromEnvironment();
        if (StringUtils.hasText(envKey)) {
            resolvedKey = envKey;
        } else if (!StringUtils.hasText(encryptionKeyFromConfig)) {
            throw new IllegalStateException(
                    "Missing credential encryption key: configure CREDENTIAL_ENCRYPTION_KEY or credential.encryption.key"
            );
        }
        return resolvedKey;
    }

    /**
     * Returns the encryption key from the process environment.
     *
     * @return environment key or null when absent
     */
    String getEncryptionKeyFromEnvironment() {
        return System.getenv(ENV_CREDENTIAL_ENCRYPTION_KEY);
    }

    /**
     * Derives a 256-bit key from the configured secret.
     *
     * @param key source secret
     * @return derived key bytes
     * @throws NoSuchAlgorithmException when SHA-256 is unavailable
     */
    private byte[] deriveKey(final String key) throws NoSuchAlgorithmException {
        final MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return digest.digest(key.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Encrypts a plain-text credential value.
     *
     * @param plainText source text
     * @return encrypted Base64 payload or null when the source is blank
     */
    public String encrypt(final String plainText) {
        String encrypted = null;
        if (plainText == null || plainText.isEmpty()) {
            return encrypted;
        }

        try {
            final byte[] initVector = new byte[GCM_IV_LENGTH];
            SECURE_RANDOM.nextBytes(initVector);

            final Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            final GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH * 8, initVector);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, gcmSpec);

            final byte[] cipherText = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
            final ByteBuffer byteBuffer = ByteBuffer.allocate(initVector.length + cipherText.length);
            byteBuffer.put(initVector);
            byteBuffer.put(cipherText);
            encrypted = Base64.getEncoder().encodeToString(byteBuffer.array());
        } catch (GeneralSecurityException ex) {
            log.error("Failed to encrypt credential.", ex);
            throw new CredentialEncryptionException("加密失败", ex);
        }
        return encrypted;
    }

    /**
     * Decrypts an encrypted credential value.
     *
     * @param encryptedText Base64 payload including IV
     * @return decrypted plain text or null when the source is blank
     */
    public String decrypt(final String encryptedText) {
        String decrypted = null;
        if (encryptedText == null || encryptedText.isEmpty()) {
            return decrypted;
        }

        try {
            final byte[] decoded = Base64.getDecoder().decode(encryptedText);
            final ByteBuffer byteBuffer = ByteBuffer.wrap(decoded);
            final byte[] initVector = new byte[GCM_IV_LENGTH];
            byteBuffer.get(initVector);

            final byte[] cipherText = new byte[byteBuffer.remaining()];
            byteBuffer.get(cipherText);

            final Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            final GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH * 8, initVector);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, gcmSpec);

            final byte[] plainText = cipher.doFinal(cipherText);
            decrypted = new String(plainText, StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException ex) {
            log.error("Failed to decrypt credential.", ex);
            throw new CredentialEncryptionException("解密失败，可能是密钥不正确或数据已损坏", ex);
        }
        return decrypted;
    }

    /**
     * Masks an API key for display.
     *
     * @param apiKey original API key
     * @return masked API key
     */
    public static String maskApiKey(final String apiKey) {
        String masked = MASKED_VALUE;
        if (apiKey == null || apiKey.isEmpty()) {
            return masked;
        }
        if (apiKey.length() > API_KEY_MIN_MASK_LENGTH) {
            masked = apiKey.substring(0, API_KEY_VISIBLE_EDGE_LENGTH)
                    + MASKED_VALUE
                    + apiKey.substring(apiKey.length() - API_KEY_VISIBLE_EDGE_LENGTH);
        }
        return masked;
    }

    /**
     * Masks an API secret for display.
     *
     * @param apiSecret original API secret
     * @return masked secret or null when the source is blank
     */
    public static String maskApiSecret(final String apiSecret) {
        String masked = null;
        if (apiSecret == null || apiSecret.isEmpty()) {
            return masked;
        }
        masked = MASKED_VALUE;
        return masked;
    }

    /**
     * Generates a random Base64-encoded secret key.
     *
     * @return generated key material
     */
    public static String generateRandomKey() {
        final byte[] key = new byte[KEY_LENGTH];
        SECURE_RANDOM.nextBytes(key);
        return Base64.getEncoder().encodeToString(key);
    }
}
