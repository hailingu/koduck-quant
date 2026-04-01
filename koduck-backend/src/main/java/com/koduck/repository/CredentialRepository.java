package com.koduck.repository;

import com.koduck.entity.UserCredential;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 *  Repository
 */
@Repository
public interface CredentialRepository extends JpaRepository<UserCredential, Long> {

    /**
     *  ID 
     */
    List<UserCredential> findByUserId(Long userId);

    /**
     *  ID 
     */
    List<UserCredential> findByUserIdAndType(Long userId, UserCredential.CredentialType type);

    /**
     *  ID 
     */
    List<UserCredential> findByUserIdAndProvider(Long userId, String provider);

    /**
     *  ID  ID 
     */
    Optional<UserCredential> findByIdAndUserId(Long id, Long userId);

    /**
     * 
     */
    boolean existsByUserIdAndName(Long userId, String name);

    /**
     * 
     */
    long countByUserId(Long userId);

    /**
     *  ID 
     */
    @Query("SELECT COUNT(c) FROM UserCredential c WHERE c.userId = :userId AND c.provider = :provider")
    long countByUserIdAndProvider(@Param("userId") Long userId, @Param("provider") String provider);

    /**
     *  ID 
     */
    long countByUserIdAndType(Long userId, UserCredential.CredentialType type);

    /**
     * 
     */
    void deleteByUserId(Long userId);
}
