package com.koduck.security;

import com.koduck.entity.User;
import com.koduck.repository.PermissionRepository;
import com.koduck.repository.RoleRepository;
import com.koduck.repository.UserRepository;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/**
 * UserDetailsService implementation for loading users and authorities.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private static final String USER_ROLES_TABLE_EXISTS_SQL =
            "SELECT COUNT(*) FROM information_schema.tables " +
            "WHERE table_schema = 'public' AND table_name = 'user_roles'";

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final JdbcTemplate jdbcTemplate;

    private volatile Boolean userRolesTableExists;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        // Support loading by userId, username, or email.
        User user;
        try {
            Long userId = Long.parseLong(username);
            user = userRepository.findById(userId)
                    .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
        } catch (NumberFormatException ex) {
            log.trace("Username '{}' is not numeric id: {}", username, ex.getMessage());
            // Fallback to email and username lookup for regular login flow.
            user = userRepository.findByEmail(username)
                    .orElseGet(() -> userRepository.findByUsername(username)
                            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username)));
        }
        List<String> roleNames;
        List<String> permissionCodes;
        if (!hasUserRolesTable()) {
            roleNames = List.of("USER");
            permissionCodes = List.of();
        } else {
            try {
                roleNames = roleRepository.findRoleNamesByUserId(user.getId());
                permissionCodes = permissionRepository.findPermissionCodesByUserId(user.getId());
            } catch (DataAccessException ex) {
                log.warn("Failed to load authorities for userId={}, fallback to ROLE_USER: {}",
                        user.getId(), ex.getMessage());
                roleNames = List.of("USER");
                permissionCodes = List.of();
            }
        }
        List<SimpleGrantedAuthority> authorities = new ArrayList<>(roleNames.stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
            .toList());
        authorities.addAll(permissionCodes.stream()
                .map(SimpleGrantedAuthority::new)
            .toList());
        // Build security principal with domain user and granted authorities.
        return new UserPrincipal(user, authorities);
    }

    private boolean hasUserRolesTable() {
        Boolean cached = userRolesTableExists;
        if (cached != null) {
            return cached;
        }
        boolean exists;
        try {
            Integer count = jdbcTemplate.queryForObject(
                USER_ROLES_TABLE_EXISTS_SQL,
                    Integer.class
            );
            exists = count != null && count > 0;
        } catch (DataAccessException ex) {
            log.warn("Failed to check user_roles table existence in auth flow, assume missing: {}",
                    ex.getMessage());
            exists = false;
        }
        userRolesTableExists = exists;
        return exists;
    }
}
