package com.koduck.service;

import java.util.List;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.koduck.entity.auth.User;
import com.koduck.repository.auth.RoleRepository;
import com.koduck.repository.auth.UserRepository;
import com.koduck.repository.auth.UserRoleRepository;
import com.koduck.security.AuthUserPrincipal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Implementation of Spring Security's UserDetailsService.
 * <p>
 * Loads user-specific data during authentication.
 *
 * @author Koduck Team
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final RoleRepository roleRepository;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsername(username)
                .orElseGet(() -> findByIdIfNumeric(username).orElseThrow(
                        () -> new UsernameNotFoundException("User not found: " + username)));

        // Get role IDs for user, then fetch role names
        List<Integer> roleIds = userRoleRepository.findRoleIdsByUserId(user.getId());
        List<String> roles = roleIds.stream()
                .map(roleId -> roleRepository.findById(roleId)
                        .map(role -> role.getName())
                        .orElse("ROLE_USER"))
                .toList();

        return AuthUserPrincipal.from(user, roles);
    }

    private java.util.Optional<User> findByIdIfNumeric(String username) {
        try {
            return userRepository.findById(Long.valueOf(username));
        }
        catch (NumberFormatException ex) {
            return java.util.Optional.empty();
        }
    }
}
