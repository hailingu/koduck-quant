package com.koduck.repository.user;

import com.koduck.entity.user.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoleRepository extends JpaRepository<Role, Integer> {

    List<Role> findAllByTenantId(String tenantId);

    Optional<Role> findByIdAndTenantId(Integer id, String tenantId);

    Optional<Role> findByTenantIdAndName(String tenantId, String name);

    boolean existsByTenantIdAndName(String tenantId, String name);
}
