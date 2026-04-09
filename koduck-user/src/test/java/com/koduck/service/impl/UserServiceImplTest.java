package com.koduck.service.impl;

import com.koduck.dto.user.user.UpdateProfileRequest;
import com.koduck.dto.user.user.UserProfileResponse;
import com.koduck.entity.user.Role;
import com.koduck.entity.user.User;
import com.koduck.entity.user.UserStatus;
import com.koduck.repository.user.RoleRepository;
import com.koduck.repository.user.UserRepository;
import com.koduck.repository.user.UserRoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private RoleRepository roleRepository;
    @Mock
    private UserRoleRepository userRoleRepository;

    private UserServiceImpl userService;

    @BeforeEach
    void setUp() {
        userService = new UserServiceImpl(userRepository, roleRepository, userRoleRepository);
    }

    @Test
    void shouldResetEmailVerificationWhenEmailChanged() {
        Long userId = 1001L;
        User existing = User.builder()
                .id(userId)
                .username("demo")
                .email("old@koduck.com")
                .passwordHash("hash")
                .status(UserStatus.ACTIVE)
                .emailVerifiedAt(LocalDateTime.of(2026, 4, 9, 8, 0))
                .build();

        UpdateProfileRequest request = UpdateProfileRequest.builder()
                .email("new@koduck.com")
                .nickname("New Nick")
                .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(existing));
        when(userRepository.existsByEmail("new@koduck.com")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRoleRepository.findRoleIdsByUserId(userId)).thenReturn(List.of(1));
        when(roleRepository.findById(1)).thenReturn(Optional.of(Role.builder()
                .id(1)
                .name("ROLE_USER")
                .description("default")
                .build()));

        UserProfileResponse response = userService.updateProfile(userId, request);

        ArgumentCaptor<User> savedCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(savedCaptor.capture());
        User saved = savedCaptor.getValue();

        assertEquals("new@koduck.com", saved.getEmail());
        assertNull(saved.getEmailVerifiedAt());
        assertEquals("new@koduck.com", response.getEmail());
        assertNull(response.getEmailVerifiedAt());
    }

    @Test
    void shouldKeepAssignRoleIdempotentWhenRoleAlreadyExists() {
        Long userId = 1002L;
        Integer roleId = 2;

        when(userRepository.findById(userId)).thenReturn(Optional.of(User.builder()
                .id(userId)
                .username("admin")
                .email("admin@koduck.com")
                .passwordHash("hash")
                .status(UserStatus.ACTIVE)
                .build()));
        when(roleRepository.existsById(roleId)).thenReturn(true);
        when(userRoleRepository.existsByUserIdAndRoleId(userId, roleId)).thenReturn(true);

        userService.assignRole(userId, roleId);

        verify(userRoleRepository, never()).save(any());
    }

    @Test
    void shouldAggregatePermissionsFromRepositoryForCurrentUser() {
        Long userId = 1003L;
        List<String> aggregatedPermissions = List.of("user:read", "role:write");

        when(userRoleRepository.findPermissionsByUserId(userId)).thenReturn(aggregatedPermissions);

        List<String> result = userService.getCurrentUserPermissions(userId);

        assertEquals(2, result.size());
        assertTrue(result.contains("user:read"));
        assertTrue(result.contains("role:write"));
        verify(userRoleRepository).findPermissionsByUserId(userId);
    }
}
