package com.koduck.security;
import java.util.ArrayList;
import java.util.List;

import org.springframework.dao.DataAccessException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.koduck.common.constants.RoleConstants;
import com.koduck.entity.User;
import com.koduck.repository.PermissionRepository;
import com.koduck.repository.RoleRepository;
import com.koduck.repository.UserRepository;
import com.koduck.service.support.UserRolesTableChecker;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

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

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final UserRolesTableChecker userRolesTableChecker;

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
        if (!userRolesTableChecker.hasUserRolesTable()) {
            roleNames = List.of(RoleConstants.DEFAULT_USER_ROLE_NAME);
            permissionCodes = List.of();
        } else {
            try {
                roleNames = roleRepository.findRoleNamesByUserId(user.getId());
                permissionCodes = permissionRepository.findPermissionCodesByUserId(user.getId());
            } catch (DataAccessException ex) {
                log.warn("Failed to load authorities for userId={}, fallback to ROLE_USER: {}",
                        user.getId(), ex.getMessage());
                roleNames = List.of(RoleConstants.DEFAULT_USER_ROLE_NAME);
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
}
