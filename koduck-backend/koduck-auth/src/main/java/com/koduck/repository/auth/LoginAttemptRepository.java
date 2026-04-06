package com.koduck.repository.auth;

import java.time.LocalDateTime;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.auth.LoginAttempt;

/**
 * 登录尝试记录仓库，提供登录尝试数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface LoginAttemptRepository extends JpaRepository<LoginAttempt, Long> {

    /**
     * 统计指定标识符的失败登录尝试次数。
     *
     * @param identifier 用户标识符
     * @param type 登录类型
     * @param since 时间阈值
     * @return 失败尝试次数
     */
    @Query("SELECT COUNT(la) FROM LoginAttempt la "
            + "WHERE la.identifier = :identifier "
            + "AND la.type = :type AND la.success = false "
            + "AND la.createdAt > :since")
    long countFailedAttempts(@Param("identifier") String identifier,
                             @Param("type") String type,
                             @Param("since") LocalDateTime since);

    /**
     * 根据 IP 地址统计失败登录尝试次数。
     *
     * @param ipAddress IP 地址
     * @param since 时间阈值
     * @return 失败尝试次数
     */
    @Query("SELECT COUNT(la) FROM LoginAttempt la "
            + "WHERE la.ipAddress = :ipAddress "
            + "AND la.success = false AND la.createdAt > :since")
    long countFailedAttemptsByIp(@Param("ipAddress") String ipAddress,
                                 @Param("since") LocalDateTime since);
}
