package com.koduck.repository.auth;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.auth.Role;

/**
 * Repository interface for Role entity operations.
 * Provides methods for querying roles and user-role associations.
 *
 * @author GitHub Copilot
 */
@Repository
public interface RoleRepository extends JpaRepository<Role, Integer> {

    /**
     * Find role by name.
     *
     * @param name role name
     * @return optional containing the role if found
     */
    Optional<Role> findByName(String name);

    /**
     * Check if role exists by name.
     *
     * @param name role name
     * @return true if exists, false otherwise
     */
    boolean existsByName(String name);

    /**
     * Find roles assigned to a user.
     *
     * @param userId user ID
     * @return list of roles
     */
    @Query(value = "SELECT r.* FROM roles r " +
           "INNER JOIN user_roles ur ON r.id = ur.role_id " +
           "WHERE ur.user_id = :userId", nativeQuery = true)
    List<Role> findRolesByUserId(@Param("userId") Long userId);

    /**
     * Find role names assigned to a user.
     *
     * @param userId user ID
     * @return list of role names
     */
    @Query(value = "SELECT r.name FROM roles r " +
           "INNER JOIN user_roles ur ON r.id = ur.role_id " +
           "WHERE ur.user_id = :userId", nativeQuery = true)
    List<String> findRoleNamesByUserId(@Param("userId") Long userId);
}
