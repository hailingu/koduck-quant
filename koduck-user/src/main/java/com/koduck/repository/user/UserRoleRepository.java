package com.koduck.repository.user;

import com.koduck.entity.user.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserRoleRepository extends JpaRepository<UserRole, Long> {

    boolean existsByUserIdAndRoleId(Long userId, Integer roleId);

    List<UserRole> findByUserId(Long userId);

    @Modifying
    void deleteByUserIdAndRoleId(Long userId, Integer roleId);

    @Query("SELECT ur.roleId FROM UserRole ur WHERE ur.userId = :userId")
    List<Integer> findRoleIdsByUserId(@Param("userId") Long userId);

    @Query("SELECT DISTINCT p.code FROM UserRole ur " +
           "JOIN RolePermission rp ON rp.roleId = ur.roleId " +
           "JOIN Permission p ON p.id = rp.permissionId " +
           "WHERE ur.userId = :userId")
    List<String> findPermissionsByUserId(@Param("userId") Long userId);
}
