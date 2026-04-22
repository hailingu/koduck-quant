package com.koduck.service.impl;

import com.koduck.config.AvatarStorageProperties;
import com.koduck.config.UserAvatarProperties;
import com.koduck.dto.user.user.AvatarFilePayload;
import com.koduck.dto.user.user.StoredAvatar;
import com.koduck.exception.AvatarNotFoundException;
import com.koduck.exception.AvatarStorageException;
import com.koduck.service.AvatarStorageService;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * 支持 local / s3 两种 provider 的头像存储实现。
 */
@Service
public class AvatarStorageServiceImpl implements AvatarStorageService {

    private static final String AVATAR_URL_PREFIX = "/api/v1/users/avatar-files/";

    private static final Map<String, String> ALLOWED_CONTENT_TYPES = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/gif", ".gif",
            "image/webp", ".webp"
    );

    private final AvatarStorageProperties storageProperties;
    private final UserAvatarProperties userAvatarProperties;
    private volatile S3Client s3Client;

    public AvatarStorageServiceImpl(AvatarStorageProperties storageProperties,
                                    UserAvatarProperties userAvatarProperties) {
        this.storageProperties = storageProperties;
        this.userAvatarProperties = userAvatarProperties;
    }

    @Override
    public StoredAvatar store(String tenantId, Long userId, MultipartFile file) {
        validateFile(file);

        String contentType = normalizeContentType(file);
        String extension = ALLOWED_CONTENT_TYPES.get(contentType);
        String storageKey = buildStorageKey(tenantId, userId, extension);
        byte[] bytes = getBytes(file);

        switch (resolveProvider()) {
            case "local" -> storeLocal(storageKey, bytes);
            case "s3" -> storeS3(storageKey, contentType, bytes);
            default -> throw new AvatarStorageException("不支持的头像存储 provider: " + storageProperties.getProvider());
        }

        return new StoredAvatar(buildAvatarUrl(storageKey), storageKey);
    }

    @Override
    public AvatarFilePayload load(String avatarKey) {
        switch (resolveProvider()) {
            case "local":
                return loadLocal(avatarKey);
            case "s3":
                return loadS3(avatarKey);
            default:
                throw new AvatarStorageException("不支持的头像存储 provider: " + storageProperties.getProvider());
        }
    }

    @Override
    public void deleteByKey(String storageKey) {
        if (!StringUtils.hasText(storageKey)) {
            return;
        }

        switch (resolveProvider()) {
            case "local" -> deleteLocal(storageKey);
            case "s3" -> deleteS3(storageKey);
            default -> throw new AvatarStorageException("不支持的头像存储 provider: " + storageProperties.getProvider());
        }
    }

    @Override
    public String buildAvatarUrl(String storageKey) {
        if (!StringUtils.hasText(storageKey)) {
            return null;
        }
        return AVATAR_URL_PREFIX + storageKey;
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("头像文件不能为空");
        }
        if (file.getSize() > userAvatarProperties.getMaxFileSize().toBytes()) {
            throw new IllegalArgumentException("头像文件不能超过 " + userAvatarProperties.getMaxFileSize());
        }
        normalizeContentType(file);
    }

    private String normalizeContentType(MultipartFile file) {
        String contentType = file.getContentType();
        if (!StringUtils.hasText(contentType)) {
            throw new IllegalArgumentException("无法识别头像文件类型");
        }
        String normalized = contentType.toLowerCase(Locale.ROOT);
        if (!ALLOWED_CONTENT_TYPES.containsKey(normalized)) {
            throw new IllegalArgumentException("头像仅支持 jpg、png、gif、webp 格式");
        }
        return normalized;
    }

    private String buildStorageKey(String tenantId, Long userId, String extension) {
        String safeTenantId = sanitizePathSegment(tenantId);
        return safeTenantId + "/" + userId + "/" + UUID.randomUUID() + extension;
    }

    private byte[] getBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException ex) {
            throw new AvatarStorageException("读取头像文件失败", ex);
        }
    }

    private void storeLocal(String storageKey, byte[] bytes) {
        Path targetPath = resolveLocalPath(storageKey);
        try {
            Files.createDirectories(targetPath.getParent());
            Files.write(targetPath, bytes, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        } catch (IOException ex) {
            throw new AvatarStorageException("保存头像到本地存储失败", ex);
        }
    }

    private AvatarFilePayload loadLocal(String avatarKey) {
        Path targetPath = resolveLocalPath(avatarKey);
        if (!Files.exists(targetPath)) {
            throw new AvatarNotFoundException(avatarKey);
        }
        try {
            byte[] bytes = Files.readAllBytes(targetPath);
            String contentType = Files.probeContentType(targetPath);
            return new AvatarFilePayload(bytes, StringUtils.hasText(contentType) ? contentType : detectContentTypeFromKey(avatarKey));
        } catch (IOException ex) {
            throw new AvatarStorageException("读取本地头像失败", ex);
        }
    }

    private void deleteLocal(String avatarKey) {
        try {
            Files.deleteIfExists(resolveLocalPath(avatarKey));
        } catch (IOException ex) {
            throw new AvatarStorageException("删除本地头像失败", ex);
        }
    }

    private Path resolveLocalPath(String avatarKey) {
        Path root = Paths.get(storageProperties.getLocal().getPath()).toAbsolutePath().normalize();
        Path resolved = root.resolve(avatarKey).normalize();
        if (!resolved.startsWith(root)) {
            throw new IllegalArgumentException("非法头像路径");
        }
        return resolved;
    }

    private void storeS3(String storageKey, String contentType, byte[] bytes) {
        try {
            getOrCreateS3Client().putObject(
                    PutObjectRequest.builder()
                            .bucket(requiredS3Bucket())
                            .key(storageKey)
                            .contentType(contentType)
                            .build(),
                    RequestBody.fromBytes(bytes)
            );
        } catch (Exception ex) {
            throw new AvatarStorageException("保存头像到 S3 失败", ex);
        }
    }

    private AvatarFilePayload loadS3(String avatarKey) {
        try {
            ResponseBytes<GetObjectResponse> objectBytes = getOrCreateS3Client().getObjectAsBytes(
                    GetObjectRequest.builder()
                            .bucket(requiredS3Bucket())
                            .key(avatarKey)
                            .build()
            );
            String contentType = objectBytes.response().contentType();
            return new AvatarFilePayload(objectBytes.asByteArray(),
                    StringUtils.hasText(contentType) ? contentType : detectContentTypeFromKey(avatarKey));
        } catch (NoSuchKeyException ex) {
            throw new AvatarNotFoundException(avatarKey);
        } catch (Exception ex) {
            throw new AvatarStorageException("读取 S3 头像失败", ex);
        }
    }

    private void deleteS3(String avatarKey) {
        try {
            getOrCreateS3Client().deleteObject(DeleteObjectRequest.builder()
                    .bucket(requiredS3Bucket())
                    .key(avatarKey)
                    .build());
        } catch (Exception ex) {
            throw new AvatarStorageException("删除 S3 头像失败", ex);
        }
    }

    private String requiredS3Bucket() {
        if (!StringUtils.hasText(storageProperties.getS3().getBucket())) {
            throw new AvatarStorageException("S3 bucket 未配置");
        }
        return storageProperties.getS3().getBucket();
    }

    private S3Client getOrCreateS3Client() {
        if (s3Client != null) {
            return s3Client;
        }

        synchronized (this) {
            if (s3Client != null) {
                return s3Client;
            }

            if (!StringUtils.hasText(storageProperties.getS3().getRegion())
                    || !StringUtils.hasText(storageProperties.getS3().getAccessKey())
                    || !StringUtils.hasText(storageProperties.getS3().getSecretKey())) {
                throw new AvatarStorageException("S3 存储配置不完整");
            }

            S3ClientBuilder builder = S3Client.builder()
                    .region(Region.of(storageProperties.getS3().getRegion()))
                    .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(
                            storageProperties.getS3().getAccessKey(),
                            storageProperties.getS3().getSecretKey()
                    )))
                    .serviceConfiguration(S3Configuration.builder()
                            .pathStyleAccessEnabled(storageProperties.getS3().isPathStyleAccessEnabled())
                            .build());

            if (StringUtils.hasText(storageProperties.getS3().getEndpoint())) {
                builder.endpointOverride(URI.create(storageProperties.getS3().getEndpoint()));
            }

            s3Client = builder.build();
            return s3Client;
        }
    }

    private String detectContentTypeFromKey(String avatarKey) {
        String lowerKey = avatarKey.toLowerCase(Locale.ROOT);
        if (lowerKey.endsWith(".jpg") || lowerKey.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        if (lowerKey.endsWith(".png")) {
            return "image/png";
        }
        if (lowerKey.endsWith(".gif")) {
            return "image/gif";
        }
        if (lowerKey.endsWith(".webp")) {
            return "image/webp";
        }
        return "application/octet-stream";
    }

    private String sanitizePathSegment(String value) {
        if (!StringUtils.hasText(value)) {
            return "default";
        }
        return value.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private String resolveProvider() {
        return StringUtils.hasText(storageProperties.getProvider())
                ? storageProperties.getProvider().trim().toLowerCase(Locale.ROOT)
                : "local";
    }
}
