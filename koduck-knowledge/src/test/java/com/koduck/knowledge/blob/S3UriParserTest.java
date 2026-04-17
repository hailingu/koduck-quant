package com.koduck.knowledge.blob;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.koduck.knowledge.exception.KnowledgeException;
import org.junit.jupiter.api.Test;

class S3UriParserTest {

    private final S3UriParser parser = new S3UriParser();

    @Test
    void shouldParseValidUri() {
        final BlobLocation location = parser.parse("s3://bucket/path/to/file.json");
        assertEquals("s3://bucket/path/to/file.json", location.uri());
        assertEquals("bucket", location.bucket());
        assertEquals("path/to/file.json", location.key());
    }

    @Test
    void shouldRejectInvalidUri() {
        assertThrows(KnowledgeException.class, () -> parser.parse("file:///tmp/test.json"));
    }
}
