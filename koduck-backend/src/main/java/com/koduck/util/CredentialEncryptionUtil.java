package com.koduck.util;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 *  -  AES-256-GCM 
 */
@Component
@Slf4j
public class CredentialEncryptionUtil {

    private static final String ALGORITHM = "AES";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH = 12; // 96 bits
    private static final int GCM_TAG_LENGTH = 16; // 128 bits
    private static final int KEY_LENGTH = 32; // 256 bits

    @Value("${credential.encryption.key:}")
    private String encryptionKeyFromConfig;

    private static SecretKey secretKey;
    private static SecureRandom secureRandom;

    @PostConstruct
    public void init() {
        String keyFromEnv = System.getenv("CREDENTIAL_ENCRYPTION_KEY");
        String keyToUse = (keyFromEnv != null && !keyFromEnv.isEmpty()) 
                ? keyFromEnv 
                : encryptionKeyFromConfig;

        if (keyToUse == null || keyToUse.isEmpty()) {
            log.warn("，（）");
            keyToUse = "KODUCK_DEFAULT_CREDENTIAL_ENCRYPTION_KEY_32BYTES!";
        }

        try {
            byte[] keyBytes = deriveKey(keyToUse);
            secretKey = new SecretKeySpec(keyBytes, ALGORITHM);
            secureRandom = new SecureRandom();
            log.info("");
        } catch (Exception e) {
            log.error("", e);
            throw new RuntimeException("无法初始化凭证加密工具", e);
        }
    }

    /**
     *  256 
     */
    private byte[] deriveKey(String key) throws NoSuchAlgorithmException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(key.getBytes(StandardCharsets.UTF_8));
        return hash;
    }

    /**
     * 
     *
     * @param plainText 
     * @return  Base64 （ IV）
     */
    public static String encrypt(String plainText) {
        if (plainText == null || plainText.isEmpty()) {
            return null;
        }

        try {
            //  IV
            byte[] iv = new byte[GCM_IV_LENGTH];
            secureRandom.nextBytes(iv);

            //  Cipher
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH * 8, iv);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, gcmSpec);

            // 
            byte[] cipherText = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

            //  IV + ciphertext
            ByteBuffer byteBuffer = ByteBuffer.allocate(iv.length + cipherText.length);
            byteBuffer.put(iv);
            byteBuffer.put(cipherText);

            return Base64.getEncoder().encodeToString(byteBuffer.array());
        } catch (Exception e) {
            log.error("", e);
            throw new RuntimeException("加密失败", e);
        }
    }

    /**
     * 
     *
     * @param encryptedText  Base64 （ IV）
     * @return 
     */
    public static String decrypt(String encryptedText) {
        if (encryptedText == null || encryptedText.isEmpty()) {
            return null;
        }

        try {
            byte[] decoded = Base64.getDecoder().decode(encryptedText);

            //  IV
            ByteBuffer byteBuffer = ByteBuffer.wrap(decoded);
            byte[] iv = new byte[GCM_IV_LENGTH];
            byteBuffer.get(iv);

            //  ciphertext
            byte[] cipherText = new byte[byteBuffer.remaining()];
            byteBuffer.get(cipherText);

            //  Cipher
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH * 8, iv);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, gcmSpec);

            // 
            byte[] plainText = cipher.doFinal(cipherText);
            return new String(plainText, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("", e);
            throw new RuntimeException("解密失败，可能是密钥不正确或数据已损坏", e);
        }
    }

    /**
     *  API Key 
     *
     * @param apiKey  API Key
     * @return  API Key（ PK***XXXX）
     */
    public static String maskApiKey(String apiKey) {
        if (apiKey == null || apiKey.isEmpty()) {
            return "***";
        }
        if (apiKey.length() <= 8) {
            return "***";
        }
        return apiKey.substring(0, 4) + "***" + apiKey.substring(apiKey.length() - 4);
    }

    /**
     *  API Secret 
     *
     * @param apiSecret  API Secret
     * @return  API Secret（ ***）
     */
    public static String maskApiSecret(String apiSecret) {
        if (apiSecret == null || apiSecret.isEmpty()) {
            return null;
        }
        return "***";
    }

    /**
     * （）
     *
     * @return Base64 
     */
    public static String generateRandomKey() {
        byte[] key = new byte[KEY_LENGTH];
        SecureRandom random = new SecureRandom();
        random.nextBytes(key);
        return Base64.getEncoder().encodeToString(key);
    }
}
