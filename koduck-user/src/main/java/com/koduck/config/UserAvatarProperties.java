package com.koduck.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

/**
 * 用户头像业务配置。
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "koduck.user.avatar")
public class UserAvatarProperties {

    private DataSize maxFileSize = DataSize.ofMegabytes(2);
}
