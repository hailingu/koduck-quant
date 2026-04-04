package com.koduck.repository.credential;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.UserCredential;

/**
 * Repository for user credentials.
 *
 * @author Koduck Team
 */
@Repository
public interface CredentialRepository extends JpaRepository<UserCredential, Long> {

    /**
     * Find credentials by user ID.
     *
     * @param userId the user ID
     * @return the list of credentials
     */
    List<UserCredential> findByUserId(Long userId);

    /**
     * Find credentials by user ID and type.
     *
     * @param userId the user ID
     * @param type the credential type
     * @return the list of credentials
     */
    List<UserCredential> findByUserIdAndType(Long userId, UserCredential.CredentialType type);

    /**
     * Find credentials by user ID and provider.
     *
     * @param userId the user ID
     * @param provider the provider name
     * @return the list of credentials
     */
    List<UserCredential> findByUserIdAndProvider(Long userId, String provider);

    /**
     * Find credential by ID and user ID.
     *
     * @param id the credential ID
     * @param userId the user ID
     * @return the optional credential
     */
    Optional<UserCredential> findByIdAndUserId(Long id, Long userId);

    /**
     * Check if credential exists by user ID and name.
     *
     * @param userId the user ID
     * @param name the credential name
     * @return true if exists, false otherwise
     */
    boolean existsByUserIdAndName(Long userId, String name);

    /**
     * Count credentials by user ID.
     *
     * @param userId the user ID
     * @return the count of credentials
     */
    long countByUserId(Long userId);

    /**
     * Count credentials by user ID and provider.
     *
     * @param userId the user ID
     * @param provider the provider name
     * @return the count of credentials
     */
    @Query("SELECT COUNT(c) FROM UserCredential c WHERE c.userId = :userId AND c.provider = :provider")
    long countByUserIdAndProvider(@Param("userId") Long userId, @Param("provider") String provider);

    /**
     * Count credentials by user ID and type.
     *
     * @param userId the user ID
     * @param type the credential type
     * @return the count of credentials
     */
    long countByUserIdAndType(Long userId, UserCredential.CredentialType type);

    /**
     * Delete credentials by user ID.
     *
     * @param userId the user ID
     */
    void deleteByUserId(Long userId);
}
