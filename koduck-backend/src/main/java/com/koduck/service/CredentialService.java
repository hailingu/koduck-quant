package com.koduck.service;

import java.util.List;

import com.koduck.dto.credential.CreateCredentialRequest;
import com.koduck.dto.credential.CredentialAuditLogResponse;
import com.koduck.dto.credential.CredentialDetailResponse;
import com.koduck.dto.credential.CredentialListResponse;
import com.koduck.dto.credential.CredentialResponse;
import com.koduck.dto.credential.UpdateCredentialRequest;
import com.koduck.dto.credential.VerifyCredentialResponse;

/**
 * User credential service interface.
 *
 * @author Koduck Team
 */
public interface CredentialService {

    /**
     * Get credential list (paginated).
     *
     * @param userId the user ID
     * @param page   the page number
     * @param size   the page size
     * @return the credential list response
     */
    CredentialListResponse getCredentials(Long userId, int page, int size);

    /**
     * Get all credentials (not paginated).
     *
     * @param userId the user ID
     * @return the list of credential responses
     */
    List<CredentialResponse> getAllCredentials(Long userId);

    /**
     * Get a single credential (summary info).
     *
     * @param userId       the user ID
     * @param credentialId the credential ID
     * @return the credential response
     */
    CredentialResponse getCredential(Long userId, Long credentialId);

    /**
     * Get credential detail (includes sensitive information).
     *
     * @param userId       the user ID
     * @param credentialId the credential ID
     * @return the credential detail response
     */
    CredentialDetailResponse getCredentialDetail(Long userId, Long credentialId);

    /**
     * Create a new credential.
     *
     * @param userId  the user ID
     * @param request the create request
     * @return the created credential response
     */
    CredentialResponse createCredential(Long userId, CreateCredentialRequest request);

    /**
     * Update an existing credential.
     *
     * @param userId       the user ID
     * @param credentialId the credential ID
     * @param request      the update request
     * @return the updated credential response
     */
    CredentialResponse updateCredential(Long userId, Long credentialId, UpdateCredentialRequest request);

    /**
     * Delete a credential.
     *
     * @param userId       the user ID
     * @param credentialId the credential ID
     */
    void deleteCredential(Long userId, Long credentialId);

    /**
     * Verify a credential.
     *
     * @param userId       the user ID
     * @param credentialId the credential ID
     * @return the verification response
     */
    VerifyCredentialResponse verifyCredential(Long userId, Long credentialId);

    /**
     * Get audit logs.
     *
     * @param userId the user ID
     * @param page   the page number
     * @param size   the page size
     * @return the list of audit log responses
     */
    List<CredentialAuditLogResponse> getAuditLogs(Long userId, int page, int size);
}
