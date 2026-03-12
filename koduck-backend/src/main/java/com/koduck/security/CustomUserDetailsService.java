package com.koduck.security;

import com.koduck.entity.User;
import com.koduck.repository.PermissionRepository;
import com.koduck.repository.RoleRepository;
import com.koduck.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

/**
 *  UserDetailsService（，）
 */
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        //  userId  username  email 
        User user;
        try {
            Long userId = Long.parseLong(username);
            user = userRepository.findById(userId)
                    .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
        } catch (NumberFormatException e) {
            // 
            user = userRepository.findByEmail(username)
                    .orElseGet(() -> userRepository.findByUsername(username)
                            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username)));
        }

        // （）
        List<String> roleNames = roleRepository.findRoleNamesByUserId(user.getId());
        List<String> permissionCodes = permissionRepository.findPermissionCodesByUserId(user.getId());

        List<SimpleGrantedAuthority> authorities = roleNames.stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                .collect(Collectors.toList());

        authorities.addAll(permissionCodes.stream()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toList()));

        //  UserPrincipal  User 
        return new UserPrincipal(user, authorities);
    }
}
