
package com.koduck.repository;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.Role;

/**
 * （，）
 */
@Repository
public interface UserRoleRepository extends JpaRepository<Role, Integer> {

    @Modifying
    @Query(value = "INSERT INTO user_roles (user_id, role_id) VALUES (:userId, :roleId) " +
           "ON CONFLICT DO NOTHING", nativeQuery = true)
    void insertUserRole(@Param("userId") Long userId, @Param("roleId") Integer roleId);

    @Modifying
    @Query(value = "DELETE FROM user_roles WHERE user_id = :userId AND role_id = :roleId", nativeQuery = true)
    void deleteUserRole(@Param("userId") Long userId, @Param("roleId") Integer roleId);

    @Modifying
    @Query(value = "DELETE FROM user_roles WHERE user_id = :userId", nativeQuery = true)
    void deleteAllByUserId(@Param("userId") Long userId);

    @Query(value = "SELECT role_id FROM user_roles WHERE user_id = :userId", nativeQuery = true)
    List<Integer> findRoleIdsByUserId(@Param("userId") Long userId);

    @Query(value = "SELECT CASE WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = :userId AND role_id = :roleId) THEN true ELSE false END", nativeQuery = true)
    boolean existsByUserIdAndRoleId(@Param("userId") Long userId, @Param("roleId") Integer roleId);
}
