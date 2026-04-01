package com.koduck.mapper;

import com.koduck.dto.credential.CredentialAuditLogResponse;
import com.koduck.dto.credential.CredentialDetailResponse;
import com.koduck.dto.credential.CredentialResponse;
import com.koduck.entity.CredentialAuditLog;
import com.koduck.entity.UserCredential;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Mapper for credential-related response objects.
 */
@Mapper(componentModel = "spring")
public interface CredentialMapper {

    /**
     * Maps credential entity to masked response DTO.
     *
     * @param credential credential entity
     * @param apiKeyMasked masked API key
     * @param apiSecretMasked masked API secret
     * @return masked credential response
     */
    @Mapping(target = "apiKeyMasked", source = "apiKeyMasked")
    @Mapping(target = "apiSecretMasked", source = "apiSecretMasked")
    CredentialResponse toCredentialResponse(
            UserCredential credential,
            String apiKeyMasked,
            String apiSecretMasked);

    /**
     * Maps credential entity to detailed response DTO.
     *
     * @param credential credential entity
     * @param apiKey decrypted API key
     * @param apiSecret decrypted API secret
     * @return detailed credential response
     */
    @Mapping(target = "apiKey", source = "apiKey")
    @Mapping(target = "apiSecret", source = "apiSecret")
    CredentialDetailResponse toCredentialDetailResponse(
            UserCredential credential,
            String apiKey,
            String apiSecret);

    /**
     * Maps credential audit log entity to response DTO.
     *
     * @param auditLog audit log entity
     * @return audit log response
     */
    CredentialAuditLogResponse toCredentialAuditLogResponse(CredentialAuditLog auditLog);
}
