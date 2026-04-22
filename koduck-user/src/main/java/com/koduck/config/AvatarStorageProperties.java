package com.koduck.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 头像对象存储配置。
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "storage.avatar")
public class AvatarStorageProperties {

    private String provider = "local";

    private final Local local = new Local();

    private final S3 s3 = new S3();

    @Getter
    @Setter
    public static class Local {

        private String path = "/data/avatars";

        private String baseUrl = "/api/v1/users/avatar-files";
    }

    @Getter
    @Setter
    public static class S3 {

        private String bucket;

        private String region;

        private String accessKey;

        private String secretKey;

        private String endpoint;

        private boolean pathStyleAccessEnabled = true;
    }
}
