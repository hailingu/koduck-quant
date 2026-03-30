package com.koduck.security;
import com.koduck.entity.User;
import com.koduck.repository.PermissionRepository;
import com.koduck.repository.RoleRepository;
import com.koduck.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
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
@Slf4j
public class CustomUserDetailsService implements UserDetailsService {
    @org.springframework.beans.factory.annotation.Autowired
    private UserRepository userRepository;
    @org.springframework.beans.factory.annotation.Autowired
    private RoleRepository roleRepository;
    @org.springframework.beans.factory.annotation.Autowired
    private PermissionRepository permissionRepository;
    @org.springframework.beans.factory.annotation.Autowired
    private JdbcTemplate jdbcTemplate;
    private volatile Boolean userRolesTableExists;
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
        List<SimpleGrantedAuthority> authorities = roleNames.stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                .collect(Collectors.toList());
        authorities.addAll(permissionCodes.stream()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toList()));
        //  UserPrincipal  User 
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
                    "SELECT COUNT(*) FROM information_schema.tables " +
                            "WHERE table_schema = 'public' AND table_name = 'user_roles'",
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
