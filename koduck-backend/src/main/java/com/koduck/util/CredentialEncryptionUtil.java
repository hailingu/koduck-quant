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
 * 凭证加密工具类 - 使用 AES-256-GCM 加密
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
            log.warn("未配置凭证加密密钥，将使用默认密钥（仅用于开发环境）");
            keyToUse = "KODUCK_DEFAULT_CREDENTIAL_ENCRYPTION_KEY_32BYTES!";
        }

        try {
            byte[] keyBytes = deriveKey(keyToUse);
            secretKey = new SecretKeySpec(keyBytes, ALGORITHM);
            secureRandom = new SecureRandom();
            log.info("凭证加密工具初始化完成");
        } catch (Exception e) {
            log.error("凭证加密工具初始化失败", e);
            throw new RuntimeException("无法初始化凭证加密工具", e);
        }
    }

    /**
     * 从密钥字符串派生 256 位密钥
     */
    private byte[] deriveKey(String key) throws NoSuchAlgorithmException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(key.getBytes(StandardCharsets.UTF_8));
        return hash;
    }

    /**
     * 加密文本
     *
     * @param plainText 明文
     * @return 加密后的 Base64 字符串（包含 IV）
     */
    public static String encrypt(String plainText) {
        if (plainText == null || plainText.isEmpty()) {
            return null;
        }

        try {
            // 生成随机 IV
            byte[] iv = new byte[GCM_IV_LENGTH];
            secureRandom.nextBytes(iv);

            // 初始化 Cipher
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH * 8, iv);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, gcmSpec);

            // 加密
            byte[] cipherText = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

            // 组合 IV + ciphertext
            ByteBuffer byteBuffer = ByteBuffer.allocate(iv.length + cipherText.length);
            byteBuffer.put(iv);
            byteBuffer.put(cipherText);

            return Base64.getEncoder().encodeToString(byteBuffer.array());
        } catch (Exception e) {
            log.error("加密失败", e);
            throw new RuntimeException("加密失败", e);
        }
    }

    /**
     * 解密文本
     *
     * @param encryptedText 加密后的 Base64 字符串（包含 IV）
     * @return 明文
     */
    public static String decrypt(String encryptedText) {
        if (encryptedText == null || encryptedText.isEmpty()) {
            return null;
        }

        try {
            byte[] decoded = Base64.getDecoder().decode(encryptedText);

            // 提取 IV
            ByteBuffer byteBuffer = ByteBuffer.wrap(decoded);
            byte[] iv = new byte[GCM_IV_LENGTH];
            byteBuffer.get(iv);

            // 提取 ciphertext
            byte[] cipherText = new byte[byteBuffer.remaining()];
            byteBuffer.get(cipherText);

            // 初始化 Cipher
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH * 8, iv);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, gcmSpec);

            // 解密
            byte[] plainText = cipher.doFinal(cipherText);
            return new String(plainText, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("解密失败", e);
            throw new RuntimeException("解密失败，可能是密钥不正确或数据已损坏", e);
        }
    }

    /**
     * 对 API Key 进行脱敏处理
     *
     * @param apiKey 原始 API Key
     * @return 脱敏后的 API Key（如 PK***XXXX）
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
     * 对 API Secret 进行脱敏处理
     *
     * @param apiSecret 原始 API Secret
     * @return 脱敏后的 API Secret（如 ***）
     */
    public static String maskApiSecret(String apiSecret) {
        if (apiSecret == null || apiSecret.isEmpty()) {
            return null;
        }
        return "***";
    }

    /**
     * 生成安全的随机密钥（用于初始化配置）
     *
     * @return Base64 编码的随机密钥
     */
    public static String generateRandomKey() {
        byte[] key = new byte[KEY_LENGTH];
        SecureRandom random = new SecureRandom();
        random.nextBytes(key);
        return Base64.getEncoder().encodeToString(key);
    }
}
