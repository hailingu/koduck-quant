package com.koduck.dto.profile;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * User profile data transfer object.
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProfileDTO {

    /**
     * 用户ID。
     */
    private Long id;

    /**
     * 用户名。
     */
    private String username;

    /**
     * 邮箱地址。
     */
    private String email;

    /**
     * 昵称。
     */
    private String nickname;

    /**
     * 头像URL。
     */
    private String avatarUrl;

    /**
     * Phone number.
     */
    private String phone;

    /**
     * Bio/description.
     */
    private String bio;

    /**
     * Location.
     */
    private String location;

    /**
     * Website URL.
     */
    private String website;

    /**
     * Account creation time.
     */
    private LocalDateTime createdAt;

    /**
     * Last update time.
     */
    private LocalDateTime updatedAt;
}
