package com.koduck.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import com.koduck.dto.credential.CredentialAuditLogResponse;
import com.koduck.dto.credential.CredentialDetailResponse;
import com.koduck.dto.credential.CredentialResponse;
import com.koduck.entity.credential.CredentialAuditLog;
import com.koduck.entity.auth.UserCredential;

/**
 * Mapper for credential-related response objects.
 *
 * @author Koduck Team
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
    @Mapping(target = "enabled", source = "credential.isActive")
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
    @Mapping(target = "enabled", source = "credential.isActive")
    @Mapping(target = "extraConfig", source = "credential.additionalConfig")
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
