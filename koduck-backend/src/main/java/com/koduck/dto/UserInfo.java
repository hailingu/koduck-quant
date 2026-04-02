package com.koduck.dto;

import java.time.LocalDateTime;
import java.util.List;

import lombok.Data;
import lombok.NoArgsConstructor;

import com.koduck.entity.User;
import com.koduck.util.CollectionCopyUtils;

/**
 * User information DTO.
 *
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
public class UserInfo
{

    /**
     * User ID.
     */
    private Long id;

    /**
     * Username.
     */
    private String username;

    /**
     * Email address.
     */
    private String email;

    /**
     * Nickname.
     */
    private String nickname;

    /**
     * Avatar URL.
     */
    private String avatarUrl;

    /**
     * User status.
     */
    private User.UserStatus status;

    /**
     * Email verification time.
     */
    private LocalDateTime emailVerifiedAt;

    /**
     * Last login time.
     */
    private LocalDateTime lastLoginAt;

    /**
     * List of user roles.
     */
    private List<String> roles;

    /**
     * Creates a new Builder instance.
     *
     * @return a new Builder
     */
    public static Builder builder()
    {
        return new Builder();
    }

    /**
     * Builder class for UserInfo.
     */
    public static final class Builder
    {

        private Long id;
        private String username;
        private String email;
        private String nickname;
        private String avatarUrl;
        private User.UserStatus status;
        private LocalDateTime emailVerifiedAt;
        private LocalDateTime lastLoginAt;
        private List<String> roles;

        /**
         * Sets the user ID.
         *
         * @param id the user ID
         * @return this builder
         */
        public Builder id(Long id)
        {
            this.id = id;
            return this;
        }

        /**
         * Sets the username.
         *
         * @param username the username
         * @return this builder
         */
        public Builder username(String username)
        {
            this.username = username;
            return this;
        }

        /**
         * Sets the email.
         *
         * @param email the email
         * @return this builder
         */
        public Builder email(String email)
        {
            this.email = email;
            return this;
        }

        /**
         * Sets the nickname.
         *
         * @param nickname the nickname
         * @return this builder
         */
        public Builder nickname(String nickname)
        {
            this.nickname = nickname;
            return this;
        }

        /**
         * Sets the avatar URL.
         *
         * @param avatarUrl the avatar URL
         * @return this builder
         */
        public Builder avatarUrl(String avatarUrl)
        {
            this.avatarUrl = avatarUrl;
            return this;
        }

        /**
         * Sets the user status.
         *
         * @param status the status
         * @return this builder
         */
        public Builder status(User.UserStatus status)
        {
            this.status = status;
            return this;
        }

        /**
         * Sets the email verification time.
         *
         * @param emailVerifiedAt the verification time
         * @return this builder
         */
        public Builder emailVerifiedAt(LocalDateTime emailVerifiedAt)
        {
            this.emailVerifiedAt = emailVerifiedAt;
            return this;
        }

        /**
         * Sets the last login time.
         *
         * @param lastLoginAt the last login time
         * @return this builder
         */
        public Builder lastLoginAt(LocalDateTime lastLoginAt)
        {
            this.lastLoginAt = lastLoginAt;
            return this;
        }

        /**
         * Sets the roles list.
         *
         * @param roles the roles
         * @return this builder
         */
        public Builder roles(List<String> roles)
        {
            this.roles = CollectionCopyUtils.copyList(roles);
            return this;
        }

        /**
         * Builds the UserInfo instance.
         *
         * @return the UserInfo
         */
        public UserInfo build()
        {
            UserInfo userInfo = new UserInfo();
            userInfo.setId(id);
            userInfo.setUsername(username);
            userInfo.setEmail(email);
            userInfo.setNickname(nickname);
            userInfo.setAvatarUrl(avatarUrl);
            userInfo.setStatus(status);
            userInfo.setEmailVerifiedAt(emailVerifiedAt);
            userInfo.setLastLoginAt(lastLoginAt);
            userInfo.setRoles(roles);
            return userInfo;
        }
    }

    /**
     * Returns a defensive copy of the roles list.
     *
     * @return the roles list copy
     */
    public List<String> getRoles()
    {
        return CollectionCopyUtils.copyList(roles);
    }

    /**
     * Sets the roles list (defensive copy).
     *
     * @param roles the roles list
     */
    public void setRoles(List<String> roles)
    {
        this.roles = CollectionCopyUtils.copyList(roles);
    }
}
