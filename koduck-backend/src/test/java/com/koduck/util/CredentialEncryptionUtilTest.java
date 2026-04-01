package com.koduck.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Unit tests for {@link CredentialEncryptionUtil} initialization behavior.
 */
class CredentialEncryptionUtilTest {

    private static final String ENCRYPTION_KEY = "configured-encryption-key";
    private static final String SAMPLE_PLAIN_TEXT = "plain-text";

    @Test
    @DisplayName("shouldThrowWhenEncryptionKeyMissing")
    void shouldThrowWhenEncryptionKeyMissing() {
        TestableCredentialEncryptionUtil credentialEncryptionUtil = new TestableCredentialEncryptionUtil(null);
        ReflectionTestUtils.setField(credentialEncryptionUtil, "encryptionKeyFromConfig", " ");

        IllegalStateException exception = assertThrows(IllegalStateException.class, credentialEncryptionUtil::init);

        assertEquals(
                "Missing credential encryption key: configure CREDENTIAL_ENCRYPTION_KEY or credential.encryption.key",
                exception.getMessage()
        );
    }

    @Test
    @DisplayName("shouldUseConfiguredKeyWhenEnvironmentKeyMissing")
    void shouldUseConfiguredKeyWhenEnvironmentKeyMissing() {
        TestableCredentialEncryptionUtil credentialEncryptionUtil = new TestableCredentialEncryptionUtil(null);
        ReflectionTestUtils.setField(credentialEncryptionUtil, "encryptionKeyFromConfig", ENCRYPTION_KEY);

        credentialEncryptionUtil.init();

        String encryptedText = credentialEncryptionUtil.encrypt(SAMPLE_PLAIN_TEXT);
        assertNotNull(encryptedText);
        assertEquals(SAMPLE_PLAIN_TEXT, credentialEncryptionUtil.decrypt(encryptedText));
    }

    private static final class TestableCredentialEncryptionUtil extends CredentialEncryptionUtil {

        private final String encryptionKeyFromEnvironment;

        private TestableCredentialEncryptionUtil(String encryptionKeyFromEnvironment) {
            this.encryptionKeyFromEnvironment = encryptionKeyFromEnvironment;
        }

        @Override
        String getEncryptionKeyFromEnvironment() {
            return encryptionKeyFromEnvironment;
        }
    }
}